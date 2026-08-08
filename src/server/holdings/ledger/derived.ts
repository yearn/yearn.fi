import { getLedgerAdminAccessError, isValidLedgerWalletAddress } from '@/server/holdings/ledger/access'
import { json, LEDGER_ADMIN_CORS_HEADERS, queryValue } from '@/server/http'
import { holdingsConfig } from '@/server/lib/holdings/config'
import {
  createHoldingsDebugContext,
  debugLog,
  isHoldingsDebugRequested,
  startHoldingsDebugTimer,
  withHoldingsDebugContext
} from '@/server/lib/holdings/services/debug'
import type { THoldingsAggregationOptions } from '@/server/lib/holdings/services/eventSource'
import { isLedgerSnapshotId } from '@/server/lib/holdings/services/ledger/codec'
import { createLedgerEventSource } from '@/server/lib/holdings/services/ledger/consumer'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import { loadVerifiedLedgerSnapshot } from '@/server/lib/holdings/services/ledger/snapshot'
import { LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'
import type { TLedgerPipelineRedis } from '@/server/lib/holdings/services/ledger/store'
import { getHoldingsLedgerRedisClient } from '@/server/lib/holdings/storage/ledgerRedis'

type TLedgerDerivedHandler = (request: Request, options: THoldingsAggregationOptions) => Promise<Response>
type TLedgerDerivedDebugRoute = 'ledger-history' | 'ledger-breakdown' | 'ledger-protocol-return-history'

function getSnapshotResponseHeaders(args: {
  readonly snapshotId: string
  readonly revision: string
  readonly sourceGeneration: number
}): Headers {
  const headers = new Headers(LEDGER_ADMIN_CORS_HEADERS)
  headers.set('X-Holdings-Ledger-Snapshot', args.snapshotId)
  headers.set('X-Holdings-Ledger-Revision', args.revision)
  headers.set('X-Holdings-Ledger-Source-Generation', String(args.sourceGeneration))
  headers.set('X-Holdings-Ledger-Calculation-Version', LEDGER_CALCULATION_VERSION)
  return headers
}

function attachSnapshotResponseHeaders(
  response: Response,
  snapshot: { readonly snapshotId: string; readonly revision: string; readonly sourceGeneration: number }
): Response {
  const headers = new Headers(response.headers)
  getSnapshotResponseHeaders(snapshot).forEach((value, key) => {
    headers.set(key, value)
  })
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

function getSnapshotLoadError(
  result: Exclude<Awaited<ReturnType<typeof loadVerifiedLedgerSnapshot>>, { readonly status: 'ready' }>
): Response {
  if (result.status === 'missing' || result.status === 'expired') {
    return json(
      { error: 'Holdings ledger snapshot not found or expired', reasonCode: result.status },
      { status: 404, headers: LEDGER_ADMIN_CORS_HEADERS }
    )
  }
  if (result.status === 'incompatible') {
    return json(
      { error: 'Holdings ledger snapshot is incompatible', reasonCode: result.reason },
      { status: 409, headers: LEDGER_ADMIN_CORS_HEADERS }
    )
  }
  return json(
    { error: 'Holdings ledger snapshot failed verification', reasonCode: 'corrupt' },
    { status: 409, headers: LEDGER_ADMIN_CORS_HEADERS }
  )
}

export async function handleLedgerDerivedRequest(
  request: Request,
  handler: TLedgerDerivedHandler,
  options?: { readonly requiresEnvio?: boolean; readonly debugRoute?: TLedgerDerivedDebugRoute }
): Promise<Response> {
  const accessError = getLedgerAdminAccessError(request, options?.requiresEnvio ? { requiresEnvio: true } : undefined)
  if (accessError) {
    return accessError
  }

  const address = queryValue(request, 'address')
  const snapshotId = queryValue(request, 'snapshotId')
  if (
    typeof address !== 'string' ||
    !isValidLedgerWalletAddress(address) ||
    typeof snapshotId !== 'string' ||
    !isLedgerSnapshotId(snapshotId)
  ) {
    return json(
      { error: 'Valid address and snapshotId query parameters are required' },
      { status: 400, headers: LEDGER_ADMIN_CORS_HEADERS }
    )
  }

  const debugValue = queryValue(request, 'debug')
  const progressId = queryValue(request, 'progressId')
  const debugRoute = options?.debugRoute ?? 'ledger-history'
  const debugContext = createHoldingsDebugContext(
    debugRoute,
    address,
    isHoldingsDebugRequested(typeof debugValue === 'string' ? debugValue : null),
    { progressId: typeof progressId === 'string' ? progressId : null }
  )

  return withHoldingsDebugContext(debugContext, async () => {
    const getTotalDurationMs = startHoldingsDebugTimer()
    debugLog('ledger-derived', 'started ledger-derived request', { route: debugRoute })
    const redis = getHoldingsLedgerRedisClient() as TLedgerPipelineRedis | null
    if (!redis) {
      debugLog('ledger-derived', 'completed ledger-derived request', {
        durationMs: getTotalDurationMs(),
        route: debugRoute,
        status: 'storage_unavailable',
        httpStatus: 503
      })
      return json(
        { error: 'Holdings ledger storage is unavailable' },
        { status: 503, headers: LEDGER_ADMIN_CORS_HEADERS }
      )
    }

    try {
      const getSnapshotDurationMs = startHoldingsDebugTimer()
      const result = await loadVerifiedLedgerSnapshot({
        redis,
        walletHash: hashLedgerWalletAddress(address),
        snapshotId,
        expectedCalculationVersion: LEDGER_CALCULATION_VERSION,
        expectedChainIds: holdingsConfig.ledgerChainIds
      })
      debugLog('ledger-derived', 'loaded and verified pinned ledger snapshot', {
        durationMs: getSnapshotDurationMs(),
        status: result.status,
        headSource: result.status === 'ready' ? result.headSource : undefined,
        records: result.status === 'ready' ? result.manifest.recordCount : undefined,
        chunks: result.status === 'ready' ? result.manifest.chunks.length : undefined,
        indexShards: result.status === 'ready' ? result.manifest.indexes.length : undefined
      })
      if (result.status !== 'ready') {
        const response = getSnapshotLoadError(result)
        debugLog('ledger-derived', 'completed ledger-derived request', {
          durationMs: getTotalDurationMs(),
          route: debugRoute,
          status: result.status,
          httpStatus: response.status
        })
        return response
      }

      const eventSource = createLedgerEventSource({
        snapshotId: result.pin.snapshotId,
        latestSettledDayTimestamp: result.pin.latestSettledDayTimestamp,
        eventUpperTimestamp: result.pin.eventUpperTimestamp,
        verified: result.verified
      })
      const getHandlerDurationMs = startHoldingsDebugTimer()
      const response = await handler(request, { eventSource, cacheMode: 'bypass' })
      debugLog('ledger-derived', 'completed derived holdings calculation', {
        durationMs: getHandlerDurationMs(),
        route: debugRoute,
        httpStatus: response.status
      })
      debugLog('ledger-derived', 'completed ledger-derived request', {
        durationMs: getTotalDurationMs(),
        route: debugRoute,
        status: 'ready',
        httpStatus: response.status
      })
      return attachSnapshotResponseHeaders(response, {
        snapshotId: result.pin.snapshotId,
        revision: result.head.revision,
        sourceGeneration: result.head.sourceGeneration
      })
    } catch (error) {
      const errorClass = error instanceof Error ? error.name : 'UnknownError'
      debugLog('ledger-derived', 'ledger-derived request failed', {
        durationMs: getTotalDurationMs(),
        route: debugRoute,
        status: 'error',
        httpStatus: 500,
        errorClass
      })
      console.error('Holdings ledger derived request failed', { errorClass })
      return json(
        { error: 'Failed to read holdings ledger snapshot' },
        { status: 500, headers: LEDGER_ADMIN_CORS_HEADERS }
      )
    }
  })
}
