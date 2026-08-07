import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { holdingsConfig } from '@/server/lib/holdings/config'

export type THoldingsLedgerRedisOperation = 'cleanup' | 'commit' | 'initialization' | 'lock' | 'read' | 'write'

export class HoldingsLedgerRedisOperationError extends Error {
  readonly operation: THoldingsLedgerRedisOperation

  constructor(operation: THoldingsLedgerRedisOperation) {
    super(`Holdings ledger Redis ${operation} failed`)
    this.name = 'HoldingsLedgerRedisOperationError'
    this.operation = operation
  }
}

const SAFE_ERROR_CLASSES = new Set([
  'AbortError',
  'AggregateError',
  'DOMException',
  'Error',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TimeoutError',
  'TypeError',
  'URIError',
  'UpstashError',
  'UpstashJSONParseError',
  'UrlError'
])

const holdingsLedgerRedisState = {
  client: null as Redis | null,
  disabled: false
}

function getRedisConfig(): { url: string; token: string } | null {
  const url = holdingsConfig.redisUrl
  const token = holdingsConfig.redisToken

  return url && token ? { url, token } : null
}

function getErrorStatus(error: unknown): number | 'unknown' {
  if (!error || typeof error !== 'object') {
    return 'unknown'
  }

  try {
    const candidate = Reflect.get(error, 'status') ?? Reflect.get(error, 'statusCode')
    const status = typeof candidate === 'string' && /^\d{3}$/.test(candidate) ? Number(candidate) : candidate
    return Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599 ? Number(status) : 'unknown'
  } catch {
    return 'unknown'
  }
}

function getErrorClass(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'UnknownError'
  }

  return SAFE_ERROR_CLASSES.has(error.name) ? error.name : 'UnknownError'
}

function shouldDisableRedis(error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status === 401 || status === 403) {
    return true
  }

  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const upstreamMessage = message.split(/,\s*command was:/i, 1)[0]?.toLowerCase() ?? ''
  return (
    upstreamMessage.includes('unauthorized') ||
    upstreamMessage.includes('invalid token') ||
    upstreamMessage.includes('forbidden')
  )
}

export function handleHoldingsLedgerRedisError(operation: THoldingsLedgerRedisOperation, error: unknown): void {
  if (shouldDisableRedis(error)) {
    holdingsLedgerRedisState.disabled = true
    holdingsLedgerRedisState.client = null
  }

  console.error(`[Holdings Ledger Redis] ${operation} failed`, {
    errorClass: getErrorClass(error),
    status: getErrorStatus(error)
  })
}

export async function executeHoldingsLedgerRedisOperation<TValue>(
  operation: THoldingsLedgerRedisOperation,
  action: () => Promise<TValue>
): Promise<TValue> {
  try {
    return await action()
  } catch (error) {
    handleHoldingsLedgerRedisError(operation, error)
    throw new HoldingsLedgerRedisOperationError(operation)
  }
}

export function isHoldingsLedgerStorageEnabled(): boolean {
  return holdingsConfig.ledgerMode !== 'off' && getRedisConfig() !== null && !holdingsLedgerRedisState.disabled
}

export function getHoldingsLedgerRuntimeFingerprint(): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        redisUrl: holdingsConfig.redisUrl,
        redisToken: holdingsConfig.redisToken,
        keyNamespace: process.env.HOLDINGS_LEDGER_KEY_NAMESPACE ?? '',
        ledgerMode: holdingsConfig.ledgerMode,
        chainIds: holdingsConfig.ledgerChainIds,
        overlapBlocks: holdingsConfig.ledgerOverlapBlocks,
        reconcileIntervalMs: holdingsConfig.ledgerReconcileIntervalMs,
        sourceRevision: holdingsConfig.ledgerSourceRevision,
        envioGraphqlUrl: holdingsConfig.envioGraphqlUrl
      })
    )
    .digest('hex')
}

export function getHoldingsLedgerRedisClient(): Redis | null {
  if (holdingsConfig.ledgerMode === 'off' || holdingsLedgerRedisState.disabled) {
    return null
  }

  const config = getRedisConfig()
  if (!config) {
    return null
  }

  if (!holdingsLedgerRedisState.client) {
    holdingsLedgerRedisState.client = new Redis({
      ...config,
      automaticDeserialization: false,
      readYourWrites: true,
      retry: false
    })
  }

  return holdingsLedgerRedisState.client
}
