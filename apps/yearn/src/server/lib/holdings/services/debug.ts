import { AsyncLocalStorage } from 'node:async_hooks'
import { appendHoldingsProgressLog, updateHoldingsProgress } from './progress'

export interface HoldingsDebugContext {
  enabled: boolean
  requestId: string
  route: 'history' | 'breakdown' | 'protocol-return-history' | 'portfolio'
  address: string
  startedAt: number
  lotsEnabled: boolean
  vaultFilter: string | null
  txFilter: string | null
  progressId: string | null
  pendingProgressWrites: Promise<void>[]
}

export type THoldingsProgressReporter = (progress: number, message: string, detail?: string | null) => void

const storage = new AsyncLocalStorage<HoldingsDebugContext>()
const progressReporterStorage = new AsyncLocalStorage<THoldingsProgressReporter>()

function formatPayload(payload?: Record<string, unknown>): string {
  if (!payload || Object.keys(payload).length === 0) {
    return ''
  }

  return ` ${JSON.stringify(payload)}`
}

export function isHoldingsDebugRequested(debugValue?: string | null): boolean {
  if (!debugValue) {
    return false
  }

  const normalized = debugValue.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function createHoldingsDebugContext(
  route: 'history' | 'breakdown' | 'protocol-return-history' | 'portfolio',
  address: string,
  enabled: boolean,
  options?: {
    lotsEnabled?: boolean
    vaultFilter?: string | null
    txFilter?: string | null
    progressId?: string | null
  }
): HoldingsDebugContext {
  return {
    enabled,
    requestId: `${route}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    route,
    address: address.toLowerCase(),
    startedAt: Date.now(),
    lotsEnabled: options?.lotsEnabled ?? false,
    vaultFilter: options?.vaultFilter?.toLowerCase() ?? null,
    txFilter: options?.txFilter?.toLowerCase() ?? null,
    progressId: options?.progressId ?? null,
    pendingProgressWrites: []
  }
}

export async function withHoldingsDebugContext<T>(context: HoldingsDebugContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, async () => {
    try {
      return await fn()
    } finally {
      await Promise.allSettled(context.pendingProgressWrites)
    }
  })
}

export function getHoldingsDebugContext(): HoldingsDebugContext | undefined {
  return storage.getStore()
}

export function withHoldingsProgressReporter<T>(reporter: THoldingsProgressReporter, fn: () => Promise<T>): Promise<T> {
  return progressReporterStorage.run(reporter, fn)
}

export function getHoldingsProgressReporter(): THoldingsProgressReporter | undefined {
  const reporter = progressReporterStorage.getStore()
  if (reporter) {
    return reporter
  }

  const context = getHoldingsDebugContext()
  if (!context) {
    return undefined
  }

  return (progress, message, detail): void => {
    context.pendingProgressWrites.push(
      updateHoldingsProgress(context.progressId, { progress, message, detail: detail ?? null })
    )
  }
}

export function debugLog(scope: string, message: string, payload?: Record<string, unknown>): void {
  const context = getHoldingsDebugContext()

  if (!context?.enabled) {
    return
  }

  const elapsedMs = Date.now() - context.startedAt
  context.pendingProgressWrites.push(appendHoldingsProgressLog(context.progressId, { elapsedMs, scope, message }))

  console.log(`[HoldingsDebug][${context.requestId}][+${elapsedMs}ms][${scope}] ${message}${formatPayload(payload)}`)
}

export function reportHoldingsProgress(progress: number, message: string, detail?: string | null): void {
  getHoldingsProgressReporter()?.(progress, message, detail)
}

export function debugError(scope: string, message: string, error: unknown, payload?: Record<string, unknown>): void {
  const context = getHoldingsDebugContext()

  if (!context?.enabled) {
    return
  }

  const errorMessage = error instanceof Error ? error.message : String(error)
  debugLog(scope, message, {
    ...payload,
    error: errorMessage
  })
}
