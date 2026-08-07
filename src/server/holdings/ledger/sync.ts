import { getLedgerAdminAccessError, isValidLedgerWalletAddress } from '@/server/holdings/ledger/access'
import { json, LEDGER_ADMIN_CORS_HEADERS, noContent, queryString } from '@/server/http'
import {
  createHoldingsDebugContext,
  debugLog,
  isHoldingsDebugRequested,
  startHoldingsDebugTimer,
  withHoldingsDebugContext
} from '@/server/lib/holdings/services/debug'
import {
  HoldingsLedgerSyncError,
  syncHoldingsLedger,
  type TLedgerSyncResult
} from '@/server/lib/holdings/services/ledger/sync'
import { LEDGER_DIRTY_REASON_CODES, type TLedgerDirtyReasonCode } from '@/server/lib/holdings/services/ledger/types'

const INVALID_REQUEST_BODY = { error: 'Invalid request body' } as const
const SYNC_FAILED_ERROR = 'Holdings ledger synchronization failed'
const SYNC_BODY_FIELDS = ['address', 'forceRebuild', 'compareLegacy'] as const

interface TLedgerSyncRequestBody {
  readonly address: string
  readonly forceRebuild?: boolean
  readonly compareLegacy?: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateSyncBody(value: unknown): TLedgerSyncRequestBody | null {
  if (!isPlainObject(value)) {
    return null
  }
  const fields = Object.keys(value)
  if (
    fields.length === 0 ||
    fields.some((field) => !SYNC_BODY_FIELDS.includes(field as (typeof SYNC_BODY_FIELDS)[number])) ||
    typeof value.address !== 'string' ||
    !isValidLedgerWalletAddress(value.address) ||
    (value.forceRebuild !== undefined && typeof value.forceRebuild !== 'boolean') ||
    (value.compareLegacy !== undefined && typeof value.compareLegacy !== 'boolean')
  ) {
    return null
  }
  return {
    address: value.address,
    ...(value.forceRebuild === undefined ? {} : { forceRebuild: value.forceRebuild }),
    ...(value.compareLegacy === undefined ? {} : { compareLegacy: value.compareLegacy })
  }
}

async function parseSyncBody(request: Request): Promise<TLedgerSyncRequestBody | null> {
  try {
    return validateSyncBody(await request.json())
  } catch {
    return null
  }
}

function getDirtyReasons(reasons: readonly string[]): TLedgerDirtyReasonCode[] {
  return reasons.filter((reason): reason is TLedgerDirtyReasonCode =>
    LEDGER_DIRTY_REASON_CODES.includes(reason as TLedgerDirtyReasonCode)
  )
}

function sanitizeSyncResult(result: TLedgerSyncResult): unknown {
  if (result.status === 'syncing') {
    return { status: result.status, reasonCode: result.reasonCode }
  }
  return {
    status: result.status,
    syncType: result.syncType,
    revision: result.revision,
    sourceGeneration: result.sourceGeneration,
    eventCounts: {
      cached: result.events.cached,
      fetched: result.events.fetched,
      added: result.events.added,
      replaced: result.events.replaced,
      deleted: result.events.deleted,
      total: result.events.total
    },
    envio: {
      pages: result.envio.pages,
      rows: result.envio.rows,
      chains: result.envio.chains,
      validationQueries: result.envio.validationQueries,
      readyChains: result.envio.readyChains,
      laggingChains: result.envio.laggingChains
    },
    storage: {
      chunks: result.storage.chunks,
      indexShards: result.storage.indexShards,
      encodedBytes: result.storage.encodedBytes,
      newBlobs: result.storage.newBlobs
    },
    dirty: {
      fromTimestamp: result.dirty.fromTimestamp,
      fromDate: result.dirty.fromDate,
      reasons: getDirtyReasons(result.dirty.reasons)
    },
    parity: {
      status: result.parity.status,
      reasonCode: result.parity.reasonCode
    },
    durationMs: result.durationMs
  }
}

export function OPTIONS(): Response {
  return noContent(LEDGER_ADMIN_CORS_HEADERS)
}

export async function POST(request: Request): Promise<Response> {
  const accessError = getLedgerAdminAccessError(request, { requiresEnvio: true })
  if (accessError) {
    return accessError
  }
  const body = await parseSyncBody(request)
  if (!body) {
    return json(INVALID_REQUEST_BODY, { status: 400, headers: LEDGER_ADMIN_CORS_HEADERS })
  }

  const debugEnabled = isHoldingsDebugRequested(queryString(request, 'debug'))
  return withHoldingsDebugContext(createHoldingsDebugContext('ledger-sync', body.address, debugEnabled), async () => {
    const getRequestDurationMs = startHoldingsDebugTimer()
    debugLog('route', 'started holdings ledger sync request', {
      forceRebuild: body.forceRebuild ?? false,
      compareLegacy: body.compareLegacy ?? false
    })

    try {
      const result = await syncHoldingsLedger(body)
      const httpStatus = result.status === 'syncing' ? 202 : 200
      debugLog('route', 'completed holdings ledger sync request', {
        durationMs: getRequestDurationMs(),
        status: result.status,
        httpStatus,
        ...(result.status === 'syncing'
          ? { reasonCode: result.reasonCode }
          : {
              syncType: result.syncType,
              cachedEvents: result.events.cached,
              fetchedEvents: result.events.fetched,
              totalEvents: result.events.total,
              pages: result.envio.pages,
              rows: result.envio.rows,
              laggingChains: result.envio.laggingChains,
              chunks: result.storage.chunks,
              indexShards: result.storage.indexShards,
              encodedBytes: result.storage.encodedBytes
            })
      })
      return result.status === 'syncing'
        ? json(sanitizeSyncResult(result), {
            status: 202,
            headers: { ...LEDGER_ADMIN_CORS_HEADERS, 'Retry-After': '2' }
          })
        : json(sanitizeSyncResult(result), { status: 200, headers: LEDGER_ADMIN_CORS_HEADERS })
    } catch (error) {
      if (error instanceof HoldingsLedgerSyncError) {
        debugLog('route', 'completed holdings ledger sync request', {
          durationMs: getRequestDurationMs(),
          status: 'failed',
          httpStatus: error.statusCode,
          reasonCode: error.reasonCode
        })
        return json(
          { error: SYNC_FAILED_ERROR, reasonCode: error.reasonCode },
          { status: error.statusCode, headers: LEDGER_ADMIN_CORS_HEADERS }
        )
      }
      debugLog('route', 'completed holdings ledger sync request', {
        durationMs: getRequestDurationMs(),
        status: 'failed',
        httpStatus: 500
      })
      return json(
        { error: SYNC_FAILED_ERROR, reasonCode: 'storage_failed' },
        { status: 500, headers: LEDGER_ADMIN_CORS_HEADERS }
      )
    }
  })
}
