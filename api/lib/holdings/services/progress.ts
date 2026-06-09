import { createHash } from 'node:crypto'
import { getHoldingsRedisClient, handleHoldingsRedisError, isHoldingsStorageEnabled } from '../storage/redis'

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
  addressHash: string
  status: HoldingsProgressStatus
  progress: number
  message: string
  detail: string | null
  startedAt: number
  updatedAt: number
  logs: HoldingsProgressLog[]
}

const PROGRESS_TTL_SECONDS = 10 * 60
const MAX_PROGRESS_LOGS = 20
const PROGRESS_KEY_PREFIX = 'holdings:progress'

function isValidProgressId(id: string | null | undefined): id is string {
  return Boolean(id && /^[a-zA-Z0-9:_-]{1,160}$/.test(id))
}

function normalizeUserAddress(userAddress: string): string {
  return userAddress.toLowerCase()
}

function getUserAddressCacheKey(userAddress: string): string {
  return createHash('sha256').update(normalizeUserAddress(userAddress)).digest('hex')
}

function getProgressKey(id: string): string {
  return `${PROGRESS_KEY_PREFIX}:${id}`
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseLogs(value: unknown): HoldingsProgressLog[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is HoldingsProgressLog => {
        const candidate = entry as Partial<HoldingsProgressLog>
        return (
          typeof candidate.elapsedMs === 'number' &&
          typeof candidate.scope === 'string' &&
          typeof candidate.message === 'string'
        )
      })
      .slice(-MAX_PROGRESS_LOGS)
  }

  return []
}

function parseProgressRecord(value: unknown): HoldingsProgressRecord | null {
  const parsed = parseJsonValue(value)
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const record = parsed as Partial<HoldingsProgressRecord>
  const status = record.status === 'complete' || record.status === 'error' ? record.status : 'running'
  const startedAt = Number(record.startedAt)
  const updatedAt = Number(record.updatedAt)

  if (
    typeof record.id !== 'string' ||
    typeof record.route !== 'string' ||
    typeof record.addressHash !== 'string' ||
    typeof record.message !== 'string' ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(updatedAt)
  ) {
    return null
  }

  return {
    id: record.id,
    route: record.route,
    addressHash: record.addressHash,
    status,
    progress: status === 'complete' ? 100 : clampProgress(Number(record.progress)),
    message: record.message,
    detail: typeof record.detail === 'string' ? record.detail : null,
    startedAt,
    updatedAt,
    logs: parseLogs(record.logs)
  }
}

async function persistProgressRecord(record: HoldingsProgressRecord): Promise<boolean> {
  if (!isHoldingsStorageEnabled()) {
    return false
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    return false
  }

  try {
    const existingRecord = await getPersistedProgressRecord(record.id)
    const existingProgress = existingRecord?.progress ?? 0
    const nextRecord: HoldingsProgressRecord = {
      ...record,
      progress: record.status === 'complete' ? 100 : Math.max(existingProgress, record.progress),
      logs: record.logs.slice(-MAX_PROGRESS_LOGS)
    }

    if (existingRecord && existingRecord.updatedAt > record.updatedAt) {
      return false
    }

    await redis.set(getProgressKey(record.id), JSON.stringify(nextRecord), { ex: PROGRESS_TTL_SECONDS })
    return true
  } catch (error) {
    handleHoldingsRedisError('progress save failed', error)
    return false
  }
}

async function getPersistedProgressRecord(id: string): Promise<HoldingsProgressRecord | null> {
  if (!isHoldingsStorageEnabled()) {
    return null
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    return null
  }

  try {
    return parseProgressRecord(await redis.get(getProgressKey(id)))
  } catch (error) {
    handleHoldingsRedisError('progress lookup failed', error)
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
  if (!isValidProgressId(id) || !isHoldingsStorageEnabled()) {
    return null
  }

  const now = Date.now()
  const record: HoldingsProgressRecord = {
    id,
    route,
    addressHash: getUserAddressCacheKey(address),
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
  if (!isValidProgressId(id)) {
    return null
  }

  return getPersistedProgressRecord(id)
}
