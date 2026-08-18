import { getLedgerAdminAccessError, isValidLedgerWalletAddress } from '@/server/holdings/ledger/access'
import { json, LEDGER_ADMIN_CORS_HEADERS, noContent, queryString } from '@/server/http'
import { holdingsConfig } from '@/server/lib/holdings/config'
import {
  createHoldingsDebugContext,
  debugLog,
  isHoldingsDebugRequested,
  startHoldingsDebugTimer,
  withHoldingsDebugContext
} from '@/server/lib/holdings/services/debug'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import {
  createVerifiedLedgerSnapshot,
  createVerifiedLedgerSnapshotFromSynchronizedRevision,
  type TCreateVerifiedLedgerSnapshotResult
} from '@/server/lib/holdings/services/ledger/snapshot'
import { LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'
import type { TLedgerPipelineRedis } from '@/server/lib/holdings/services/ledger/store'
import {
  HoldingsLedgerSyncError,
  withSynchronizedHoldingsLedgerRevision
} from '@/server/lib/holdings/services/ledger/sync'
import { getHoldingsLedgerRedisClient } from '@/server/lib/holdings/storage/ledgerRedis'

const SNAPSHOT_BODY_FIELDS = ['address', 'refresh', 'forceRebuild', 'compareLegacy'] as const
const SECONDS_PER_DAY = 24 * 60 * 60

interface TLedgerSnapshotRequestBody {
  readonly address: string
  readonly refresh?: boolean
  readonly forceRebuild?: boolean
  readonly compareLegacy?: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateSnapshotBody(value: unknown): TLedgerSnapshotRequestBody | null {
  if (!isPlainObject(value)) {
    return null
  }
  const fields = Object.keys(value)
  if (
    fields.length === 0 ||
    fields.some((field) => !SNAPSHOT_BODY_FIELDS.includes(field as (typeof SNAPSHOT_BODY_FIELDS)[number])) ||
    typeof value.address !== 'string' ||
    !isValidLedgerWalletAddress(value.address) ||
    (value.refresh !== undefined && typeof value.refresh !== 'boolean') ||
    (value.forceRebuild !== undefined && typeof value.forceRebuild !== 'boolean') ||
    (value.compareLegacy !== undefined && typeof value.compareLegacy !== 'boolean')
  ) {
    return null
  }
  return {
    address: value.address,
    ...(value.refresh === undefined ? {} : { refresh: value.refresh }),
    ...(value.forceRebuild === undefined ? {} : { forceRebuild: value.forceRebuild }),
    ...(value.compareLegacy === undefined ? {} : { compareLegacy: value.compareLegacy })
  }
}

async function parseSnapshotBody(request: Request): Promise<TLedgerSnapshotRequestBody | null> {
  try {
    return validateSnapshotBody(await request.json())
  } catch {
    return null
  }
}

function getSnapshotCutoffs(nowMs: number): {
  readonly latestSettledDayTimestamp: number
  readonly eventUpperTimestamp: number
} {
  const eventUpperTimestamp = Math.floor(nowMs / 1000)
  const currentUtcDayTimestamp = Math.floor(eventUpperTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY
  return {
    latestSettledDayTimestamp: Math.max(currentUtcDayTimestamp - SECONDS_PER_DAY, 0),
    eventUpperTimestamp
  }
}

function getSnapshotCreationError(
  result: Exclude<TCreateVerifiedLedgerSnapshotResult, { readonly status: 'ready' }>
): Response {
  if (result.status === 'empty') {
    return json(
      { error: 'No verified holdings ledger revision is available', reasonCode: 'empty' },
      { status: 404, headers: LEDGER_ADMIN_CORS_HEADERS }
    )
  }
  if (result.status === 'incompatible') {
    return json(
      { error: 'Holdings ledger revision is incompatible', reasonCode: result.reason },
      { status: 409, headers: LEDGER_ADMIN_CORS_HEADERS }
    )
  }
  return json(
    { error: 'Failed to pin holdings ledger snapshot', reasonCode: result.status },
    { status: 409, headers: LEDGER_ADMIN_CORS_HEADERS }
  )
}

export function OPTIONS(): Response {
  return noContent(LEDGER_ADMIN_CORS_HEADERS)
}

export async function POST(request: Request): Promise<Response> {
  const accessError = getLedgerAdminAccessError(request)
  if (accessError) {
    return accessError
  }
  const body = await parseSnapshotBody(request)
  if (!body) {
    return json({ error: 'Invalid request body' }, { status: 400, headers: LEDGER_ADMIN_CORS_HEADERS })
  }
  const refresh = body.refresh ?? true
  if (!refresh && (body.forceRebuild || body.compareLegacy)) {
    return json(
      { error: 'forceRebuild and compareLegacy require refresh to be enabled' },
      { status: 400, headers: LEDGER_ADMIN_CORS_HEADERS }
    )
  }
  if (refresh) {
    const sourceAccessError = getLedgerAdminAccessError(request, { requiresEnvio: true })
    if (sourceAccessError) {
      return sourceAccessError
    }
  }

  const cutoffNowMs = Date.now()
  const cutoffs = getSnapshotCutoffs(cutoffNowMs)
  const debugEnabled = isHoldingsDebugRequested(queryString(request, 'debug'))
  return withHoldingsDebugContext(
    createHoldingsDebugContext('ledger-snapshot', body.address, debugEnabled),
    async () => {
      const getRequestDurationMs = startHoldingsDebugTimer()
      debugLog('route', 'started holdings ledger snapshot request', {
        refresh,
        forceRebuild: body.forceRebuild ?? false,
        compareLegacy: body.compareLegacy ?? false
      })

      try {
        const operation = await (async (): Promise<
          | { readonly kind: 'response'; readonly response: Response }
          | { readonly kind: 'snapshot'; readonly result: TCreateVerifiedLedgerSnapshotResult }
        > => {
          if (refresh) {
            const getSyncDurationMs = startHoldingsDebugTimer()
            const synchronized = await withSynchronizedHoldingsLedgerRevision(
              {
                address: body.address,
                forceRebuild: body.forceRebuild,
                compareLegacy: body.compareLegacy
              },
              async ({ syncResult, verifiedRevision, headSource, redis, walletHash }) => {
                debugLog('route', 'completed ledger synchronization before snapshot', {
                  durationMs: syncResult.durationMs,
                  status: syncResult.status,
                  syncType: syncResult.syncType,
                  fetchedEvents: syncResult.events.fetched,
                  totalEvents: syncResult.events.total,
                  pages: syncResult.envio.pages,
                  rows: syncResult.envio.rows,
                  strategy: syncResult.envio.strategy,
                  requests: syncResult.envio.requests,
                  presenceRequests: syncResult.envio.presenceRequests,
                  batchedRequests: syncResult.envio.batchedRequests,
                  continuationRequests: syncResult.envio.continuationRequests,
                  laggingChains: syncResult.envio.laggingChains
                })
                if (syncResult.envio.laggingChains > 0) {
                  return null
                }
                const getPinDurationMs = startHoldingsDebugTimer()
                const result = await createVerifiedLedgerSnapshotFromSynchronizedRevision({
                  redis,
                  walletHash,
                  verifiedRevision,
                  headSource,
                  expectedCalculationVersion: LEDGER_CALCULATION_VERSION,
                  expectedChainIds: holdingsConfig.ledgerChainIds,
                  latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
                  eventUpperTimestamp: cutoffs.eventUpperTimestamp,
                  nowMs: Date.now()
                })
                debugLog('route', 'completed verified snapshot pin operation', {
                  durationMs: getPinDurationMs(),
                  status: result.status,
                  revisionSource: 'synchronized'
                })
                return result
              }
            )
            if (synchronized.kind === 'busy') {
              const { syncResult } = synchronized
              debugLog('route', 'completed ledger synchronization before snapshot', {
                durationMs: getSyncDurationMs(),
                status: syncResult.status,
                reasonCode: syncResult.reasonCode
              })
              debugLog('route', 'completed holdings ledger snapshot request', {
                durationMs: getRequestDurationMs(),
                status: 'syncing',
                httpStatus: 202
              })
              return {
                kind: 'response',
                response: json(
                  { status: 'syncing', reasonCode: syncResult.reasonCode },
                  { status: 202, headers: { ...LEDGER_ADMIN_CORS_HEADERS, 'Retry-After': '2' } }
                )
              }
            }
            const { syncResult } = synchronized
            if (syncResult.envio.laggingChains > 0) {
              debugLog('route', 'completed holdings ledger snapshot request', {
                durationMs: getRequestDurationMs(),
                status: 'source_lagging',
                httpStatus: 503,
                laggingChains: syncResult.envio.laggingChains
              })
              return {
                kind: 'response',
                response: json(
                  { error: 'Holdings ledger source is not ready', reasonCode: 'source_lagging' },
                  { status: 503, headers: { ...LEDGER_ADMIN_CORS_HEADERS, 'Retry-After': '30' } }
                )
              }
            }
            if (synchronized.consumed === null) {
              throw new Error('Synchronized ledger snapshot result is missing')
            }
            return { kind: 'snapshot', result: synchronized.consumed }
          }

          const redis = getHoldingsLedgerRedisClient() as TLedgerPipelineRedis | null
          if (!redis) {
            debugLog('route', 'completed holdings ledger snapshot request', {
              durationMs: getRequestDurationMs(),
              status: 'storage_unavailable',
              httpStatus: 503
            })
            return {
              kind: 'response',
              response: json(
                { error: 'Holdings ledger storage is unavailable' },
                { status: 503, headers: LEDGER_ADMIN_CORS_HEADERS }
              )
            }
          }
          const getPinDurationMs = startHoldingsDebugTimer()
          const result = await createVerifiedLedgerSnapshot({
            redis,
            walletHash: hashLedgerWalletAddress(body.address),
            expectedCalculationVersion: LEDGER_CALCULATION_VERSION,
            expectedChainIds: holdingsConfig.ledgerChainIds,
            latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
            eventUpperTimestamp: cutoffs.eventUpperTimestamp,
            fallbackToPrevious: true,
            nowMs: Date.now()
          })
          debugLog('route', 'completed verified snapshot pin operation', {
            durationMs: getPinDurationMs(),
            status: result.status,
            revisionSource: 'last-known-good'
          })
          return { kind: 'snapshot', result }
        })()
        if (operation.kind === 'response') {
          return operation.response
        }
        const { result } = operation
        if (result.status !== 'ready') {
          const response = getSnapshotCreationError(result)
          debugLog('route', 'completed holdings ledger snapshot request', {
            durationMs: getRequestDurationMs(),
            status: result.status,
            httpStatus: response.status
          })
          return response
        }

        const response = json(
          {
            status: 'ready',
            snapshotId: result.pin.snapshotId,
            revision: result.head.revision,
            sourceGeneration: result.head.sourceGeneration,
            headSource: result.headSource,
            freshness: refresh ? 'refreshed' : 'last-known-good',
            latestSettledDayTimestamp: result.pin.latestSettledDayTimestamp,
            eventUpperTimestamp: result.pin.eventUpperTimestamp,
            expiresAtMs: result.pin.expiresAtMs
          },
          { status: 201, headers: LEDGER_ADMIN_CORS_HEADERS }
        )
        debugLog('route', 'completed holdings ledger snapshot request', {
          durationMs: getRequestDurationMs(),
          status: 'ready',
          httpStatus: response.status,
          freshness: refresh ? 'refreshed' : 'last-known-good'
        })
        return response
      } catch (error) {
        if (error instanceof HoldingsLedgerSyncError) {
          debugLog('route', 'completed holdings ledger snapshot request', {
            durationMs: getRequestDurationMs(),
            status: 'sync_failed',
            httpStatus: error.statusCode,
            reasonCode: error.reasonCode
          })
          return json(
            { error: 'Holdings ledger synchronization failed', reasonCode: error.reasonCode },
            { status: error.statusCode, headers: LEDGER_ADMIN_CORS_HEADERS }
          )
        }
        debugLog('route', 'completed holdings ledger snapshot request', {
          durationMs: getRequestDurationMs(),
          status: 'failed',
          httpStatus: 500
        })
        console.error('Holdings ledger snapshot creation failed', {
          errorClass: error instanceof Error ? error.name : 'UnknownError',
          mode: holdingsConfig.ledgerMode
        })
        return json(
          { error: 'Failed to create holdings ledger snapshot' },
          { status: 500, headers: LEDGER_ADMIN_CORS_HEADERS }
        )
      }
    }
  )
}
