import { getPool, isDatabaseEnabled } from '../db/connection'

export type HoldingsProgressStatus = 'running' | 'complete' | 'error'

export type HoldingsProgressLog = {
  elapsedMs: number
  scope: string
  message: string
  payload?: Record<string, unknown>
}

export type HoldingsProgressRecord = {
  id: string
  route: string
  address: string
  status: HoldingsProgressStatus
  progress: number
  message: string
  detail: string | null
  startedAt: number
  updatedAt: number
  logs: HoldingsProgressLog[]
}

type HoldingsProgressRow = {
  id: string
  route: string
  address: string
  status: HoldingsProgressStatus
  progress: number
  message: string
  detail: string | null
  started_at: Date | string
  updated_at: Date | string
  logs: unknown
}

const PROGRESS_TTL_INTERVAL = '10 minutes'
const PERSISTED_PROGRESS_CLEANUP_INTERVAL_MS = 60 * 1000
const MAX_PROGRESS_LOGS = 20
const persistedProgressCleanupState = { lastCleanupAt: 0 }

function isValidProgressId(id: string | null | undefined): id is string {
  return Boolean(id && /^[a-zA-Z0-9:_-]{1,160}$/.test(id))
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(progress)))
}

async function cleanupPersistedProgressRecords(): Promise<void> {
  const now = Date.now()
  if (now - persistedProgressCleanupState.lastCleanupAt < PERSISTED_PROGRESS_CLEANUP_INTERVAL_MS) {
    return
  }
  persistedProgressCleanupState.lastCleanupAt = now

  if (!isDatabaseEnabled()) {
    return
  }

  const pool = await getPool()
  if (!pool) {
    return
  }

  try {
    await pool.query(`DELETE FROM holdings_progress WHERE updated_at < NOW() - INTERVAL '${PROGRESS_TTL_INTERVAL}'`)
  } catch (error) {
    console.error('[Holdings Progress] Failed to delete stale progress rows:', error)
  }
}

function parseTimestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

function parseLogs(value: unknown): HoldingsProgressLog[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is HoldingsProgressLog => {
      const candidate = entry as Partial<HoldingsProgressLog>
      return (
        typeof candidate.elapsedMs === 'number' &&
        typeof candidate.scope === 'string' &&
        typeof candidate.message === 'string'
      )
    })
  }

  if (typeof value === 'string') {
    try {
      return parseLogs(JSON.parse(value))
    } catch {
      return []
    }
  }

  return []
}

function rowToProgressRecord(row: HoldingsProgressRow): HoldingsProgressRecord {
  return {
    id: row.id,
    route: row.route,
    address: row.address,
    status: row.status,
    progress: clampProgress(Number(row.progress)),
    message: row.message,
    detail: row.detail ?? null,
    startedAt: parseTimestamp(row.started_at),
    updatedAt: parseTimestamp(row.updated_at),
    logs: parseLogs(row.logs).slice(-MAX_PROGRESS_LOGS)
  }
}

async function persistProgressRecord(record: HoldingsProgressRecord): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    return false
  }

  const pool = await getPool()
  if (!pool) {
    return false
  }

  try {
    await pool.query(
      `INSERT INTO holdings_progress (
         id, route, address, status, progress, message, detail, started_at, updated_at, logs
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (id)
       DO UPDATE SET
         route = EXCLUDED.route,
         address = EXCLUDED.address,
         status = EXCLUDED.status,
         progress = CASE
           WHEN EXCLUDED.status = 'complete' THEN 100
           ELSE GREATEST(holdings_progress.progress, EXCLUDED.progress)
         END,
         message = EXCLUDED.message,
         detail = EXCLUDED.detail,
         updated_at = EXCLUDED.updated_at,
         logs = EXCLUDED.logs
       WHERE holdings_progress.updated_at <= EXCLUDED.updated_at`,
      [
        record.id,
        record.route,
        record.address,
        record.status,
        record.progress,
        record.message,
        record.detail,
        new Date(record.startedAt),
        new Date(record.updatedAt),
        JSON.stringify(record.logs)
      ]
    )
    return true
  } catch (error) {
    console.error('[Holdings Progress] Failed to save progress row:', error)
    return false
  }
}

async function getPersistedProgressRecord(id: string): Promise<HoldingsProgressRecord | null> {
  if (!isDatabaseEnabled()) {
    return null
  }

  const pool = await getPool()
  if (!pool) {
    return null
  }

  try {
    const result = await pool.query<HoldingsProgressRow>(
      `SELECT id, route, address, status, progress, message, detail, started_at, updated_at, logs
       FROM holdings_progress
       WHERE id = $1 AND updated_at >= NOW() - INTERVAL '${PROGRESS_TTL_INTERVAL}'`,
      [id]
    )
    const row = result.rows[0]
    return row ? rowToProgressRecord(row) : null
  } catch (error) {
    console.error('[Holdings Progress] Failed to get progress row:', error)
    return null
  }
}

export async function startHoldingsProgress({
  id,
  route,
  address,
  message
}: {
  id: string | null | undefined
  route: string
  address: string
  message: string
}): Promise<string | null> {
  void cleanupPersistedProgressRecords()

  if (!isValidProgressId(id) || !isDatabaseEnabled()) {
    return null
  }

  const now = Date.now()
  const record: HoldingsProgressRecord = {
    id,
    route,
    address: address.toLowerCase(),
    status: 'running',
    progress: 8,
    message,
    detail: null,
    startedAt: now,
    updatedAt: now,
    logs: []
  }
  return (await persistProgressRecord(record)) ? id : null
}

export async function updateHoldingsProgress(
  id: string | null | undefined,
  update: {
    progress?: number
    message?: string
    detail?: string | null
    status?: HoldingsProgressStatus
  }
): Promise<void> {
  if (!isValidProgressId(id)) {
    return
  }

  const record = await getPersistedProgressRecord(id)
  if (!record) {
    return
  }

  const nextProgress = update.progress === undefined ? record.progress : clampProgress(update.progress)
  const nextRecord: HoldingsProgressRecord = {
    ...record,
    status: update.status ?? record.status,
    progress: update.status === 'complete' ? 100 : Math.max(record.progress, nextProgress),
    message: update.message ?? record.message,
    detail: update.detail === undefined ? record.detail : update.detail,
    updatedAt: Math.max(Date.now(), record.updatedAt + 1)
  }
  await persistProgressRecord(nextRecord)
}

export async function appendHoldingsProgressLog(
  id: string | null | undefined,
  log: HoldingsProgressLog
): Promise<void> {
  if (!isValidProgressId(id)) {
    return
  }

  const record = await getPersistedProgressRecord(id)
  if (!record) {
    return
  }

  const nextRecord: HoldingsProgressRecord = {
    ...record,
    logs: [...record.logs, log].slice(-MAX_PROGRESS_LOGS),
    updatedAt: Math.max(Date.now(), record.updatedAt + 1)
  }
  await persistProgressRecord(nextRecord)
}

export async function getHoldingsProgress(id: string | null | undefined): Promise<HoldingsProgressRecord | null> {
  void cleanupPersistedProgressRecords()

  if (!isValidProgressId(id)) {
    return null
  }

  return getPersistedProgressRecord(id)
}
