import { AsyncLocalStorage } from 'node:async_hooks'

export interface HoldingsDebugContext {
  enabled: boolean
  requestId: string
  route: 'history' | 'pnl'
  address: string
  startedAt: number
  lotsEnabled: boolean
  vaultFilter: string | null
  txFilter: string | null
}

const storage = new AsyncLocalStorage<HoldingsDebugContext>()

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
  route: 'history' | 'pnl',
  address: string,
  enabled: boolean,
  options?: {
    lotsEnabled?: boolean
    vaultFilter?: string | null
    txFilter?: string | null
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
    txFilter: options?.txFilter?.toLowerCase() ?? null
  }
}

export async function withHoldingsDebugContext<T>(context: HoldingsDebugContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn)
}

export function getHoldingsDebugContext(): HoldingsDebugContext | undefined {
  return storage.getStore()
}

export function getHoldingsDebugFilters(): {
  lotsEnabled: boolean
  vaultFilter: string | null
  txFilter: string | null
} {
  const context = getHoldingsDebugContext()

  return {
    lotsEnabled: context?.lotsEnabled ?? false,
    vaultFilter: context?.vaultFilter ?? null,
    txFilter: context?.txFilter ?? null
  }
}

export function debugLog(scope: string, message: string, payload?: Record<string, unknown>): void {
  const context = getHoldingsDebugContext()

  if (!context?.enabled) {
    return
  }

  const elapsedMs = Date.now() - context.startedAt
  console.log(`[HoldingsDebug][${context.requestId}][+${elapsedMs}ms][${scope}] ${message}${formatPayload(payload)}`)
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

export function debugTable(scope: string, message: string, rows: Array<Record<string, unknown>>): void {
  const context = getHoldingsDebugContext()

  if (!context?.enabled) {
    return
  }

  const elapsedMs = Date.now() - context.startedAt
  console.log(`[HoldingsDebug][${context.requestId}][+${elapsedMs}ms][${scope}] ${message}`)
  console.table(rows)
}
