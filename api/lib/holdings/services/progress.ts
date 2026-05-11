export type HoldingsProgressStatus = 'running' | 'complete' | 'error'

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
  logs: Array<{
    elapsedMs: number
    scope: string
    message: string
    payload?: Record<string, unknown>
  }>
}

const PROGRESS_TTL_MS = 10 * 60 * 1000
const MAX_PROGRESS_LOGS = 20
const progressRecords = new Map<string, HoldingsProgressRecord>()

function isValidProgressId(id: string | null | undefined): id is string {
  return Boolean(id && /^[a-zA-Z0-9:_-]{1,160}$/.test(id))
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function cleanupProgressRecords(): void {
  const now = Date.now()
  progressRecords.forEach((record, id) => {
    if (now - record.updatedAt > PROGRESS_TTL_MS) {
      progressRecords.delete(id)
    }
  })
}

export function startHoldingsProgress({
  id,
  route,
  address,
  message
}: {
  id: string | null | undefined
  route: string
  address: string
  message: string
}): string | null {
  cleanupProgressRecords()

  if (!isValidProgressId(id)) {
    return null
  }

  const now = Date.now()
  progressRecords.set(id, {
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
  })

  return id
}

export function updateHoldingsProgress(
  id: string | null | undefined,
  update: {
    progress?: number
    message?: string
    detail?: string | null
    status?: HoldingsProgressStatus
  }
): void {
  if (!isValidProgressId(id)) {
    return
  }

  const record = progressRecords.get(id)
  if (!record) {
    return
  }

  const nextProgress = update.progress === undefined ? record.progress : clampProgress(update.progress)
  progressRecords.set(id, {
    ...record,
    status: update.status ?? record.status,
    progress: update.status === 'complete' ? 100 : Math.max(record.progress, nextProgress),
    message: update.message ?? record.message,
    detail: update.detail === undefined ? record.detail : update.detail,
    updatedAt: Date.now()
  })
}

export function appendHoldingsProgressLog(
  id: string | null | undefined,
  log: { elapsedMs: number; scope: string; message: string; payload?: Record<string, unknown> }
): void {
  if (!isValidProgressId(id)) {
    return
  }

  const record = progressRecords.get(id)
  if (!record) {
    return
  }

  progressRecords.set(id, {
    ...record,
    logs: [...record.logs, log].slice(-MAX_PROGRESS_LOGS),
    updatedAt: Date.now()
  })
}

export function getHoldingsProgress(id: string | null | undefined): HoldingsProgressRecord | null {
  cleanupProgressRecords()

  if (!isValidProgressId(id)) {
    return null
  }

  return progressRecords.get(id) ?? null
}
