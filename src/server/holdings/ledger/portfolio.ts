import {
  getLedgerAdminAccessError,
  getLedgerReadinessError,
  isValidLedgerWalletAddress
} from '@/server/holdings/ledger/access'
import {
  GET_CORS_HEADERS,
  json,
  LEDGER_ADMIN_CORS_HEADERS,
  noContent,
  queryString,
  queryValue,
  WALLET_SCOPED_CACHE_CONTROL
} from '@/server/http'
import {
  getHistoricalHoldingsChart,
  getHoldingsProtocolReturnHistory,
  type HoldingsHistoryDenomination,
  type HoldingsHistoryTimeframe,
  type VaultVersion
} from '@/server/lib/holdings'
import {
  createHoldingsDebugContext,
  debugLog,
  isHoldingsDebugRequested,
  startHoldingsDebugTimer,
  withHoldingsDebugContext
} from '@/server/lib/holdings/services/debug'
import { getLedgerProtocolReturnRows } from '@/server/lib/holdings/services/ledger/rows'
import { LEDGER_STREAMS } from '@/server/lib/holdings/services/ledger/types'
import {
  createWalletLedgerEventSource,
  isWalletLedgerCompatible,
  readWalletLedger,
  synchronizeWalletLedger,
  type TWalletLedgerState
} from '@/server/lib/holdings/services/ledger/wallet'

const SECONDS_PER_DAY = 24 * 60 * 60
const PORTFOLIO_HEADERS = {
  ...GET_CORS_HEADERS,
  'Cache-Control': WALLET_SCOPED_CACHE_CONTROL
} as const

type TPortfolioLedgerFreshness = 'cached' | 'refreshed' | 'stale'

type TResolvedWalletLedger =
  | {
      readonly kind: 'ready'
      readonly ledger: TWalletLedgerState
      readonly freshness: TPortfolioLedgerFreshness
    }
  | { readonly kind: 'response'; readonly response: Response }

function parseVersion(value: string | undefined): VaultVersion {
  return value === 'v2' || value === 'v3' ? value : 'all'
}

function parseDenomination(value: string | undefined): HoldingsHistoryDenomination {
  return value === 'eth' ? 'eth' : 'usd'
}

function parseTimeframe(value: string | undefined): HoldingsHistoryTimeframe {
  return value === 'all' ? 'all' : '1y'
}

function parseBooleanFlag(value: string | string[] | undefined, fallback: boolean): boolean | null {
  if (value === undefined) {
    return fallback
  }
  if (value === '1') {
    return true
  }
  if (value === '0') {
    return false
  }
  return null
}

function getLedgerCutoffs(
  ledger: TWalletLedgerState,
  nowMs: number
): {
  readonly eventUpperTimestamp: number
  readonly latestSettledDayTimestamp: number
} {
  const eventUpperTimestamp = Math.min(Math.floor(nowMs / 1000), Math.floor(ledger.updatedAtMs / 1000))
  const currentUtcDayTimestamp = Math.floor(eventUpperTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY
  return {
    eventUpperTimestamp,
    latestSettledDayTimestamp: Math.max(currentUtcDayTimestamp - SECONDS_PER_DAY, 0)
  }
}

function getLedgerEventCount(ledger: TWalletLedgerState): number {
  return LEDGER_STREAMS.reduce((total, stream) => total + ledger.streams[stream].length, 0)
}

function getSyncErrorDetails(error: unknown): { readonly reasonCode?: string; readonly statusCode: number } {
  const details = error as { readonly reasonCode?: unknown; readonly statusCode?: unknown }
  const reasonCode = typeof details?.reasonCode === 'string' ? details.reasonCode : undefined
  const statusCode =
    typeof details?.statusCode === 'number' && Number.isInteger(details.statusCode) && details.statusCode >= 400
      ? details.statusCode
      : 500
  return { ...(reasonCode ? { reasonCode } : {}), statusCode }
}

async function readCachedWalletLedger(address: string): Promise<TResolvedWalletLedger> {
  const result = await readWalletLedger({ address })
  if (result.status === 'ready' && isWalletLedgerCompatible(result.ledger)) {
    return { kind: 'ready', ledger: result.ledger, freshness: 'cached' }
  }
  if (result.status === 'ready') {
    return {
      kind: 'response',
      response: json(
        { error: 'Stored holdings ledger is incompatible', reasonCode: 'incompatible' },
        { status: 409, headers: PORTFOLIO_HEADERS }
      )
    }
  }
  if (result.status === 'corrupt') {
    return {
      kind: 'response',
      response: json(
        { error: 'Stored holdings ledger is corrupt', reasonCode: 'corrupt' },
        { status: 409, headers: PORTFOLIO_HEADERS }
      )
    }
  }
  return {
    kind: 'response',
    response: json(
      { error: 'No stored holdings ledger is available', reasonCode: 'missing' },
      { status: 409, headers: PORTFOLIO_HEADERS }
    )
  }
}

async function readStaleWalletLedger(address: string): Promise<TResolvedWalletLedger | null> {
  try {
    const result = await readWalletLedger({ address })
    return result.status === 'ready' && isWalletLedgerCompatible(result.ledger)
      ? { kind: 'ready', ledger: result.ledger, freshness: 'stale' }
      : null
  } catch {
    return null
  }
}

async function resolveWalletLedger(args: {
  readonly address: string
  readonly refresh: boolean
  readonly forceRebuild: boolean
}): Promise<TResolvedWalletLedger> {
  if (!args.refresh) {
    return readCachedWalletLedger(args.address)
  }

  try {
    const result = await synchronizeWalletLedger({
      address: args.address,
      forceRebuild: args.forceRebuild
    })
    if (result.status === 'syncing') {
      const stale = await readStaleWalletLedger(args.address)
      return (
        stale ?? {
          kind: 'response',
          response: json(
            { status: 'syncing', reasonCode: result.reasonCode },
            { status: 202, headers: { ...PORTFOLIO_HEADERS, 'Retry-After': '2' } }
          )
        }
      )
    }
    return {
      kind: 'ready',
      ledger: result.ledger,
      freshness: result.outcome === 'fresh' ? 'cached' : 'refreshed'
    }
  } catch (error) {
    const stale = await readStaleWalletLedger(args.address)
    if (stale) {
      return stale
    }
    const details = getSyncErrorDetails(error)
    return {
      kind: 'response',
      response: json(
        {
          error: 'Failed to refresh holdings ledger',
          ...(details.reasonCode ? { reasonCode: details.reasonCode } : {})
        },
        { status: details.statusCode, headers: PORTFOLIO_HEADERS }
      )
    }
  }
}

export function OPTIONS(): Response {
  return noContent(LEDGER_ADMIN_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const addressValue = queryValue(request, 'address')
  const refresh = parseBooleanFlag(queryValue(request, 'refresh'), true)
  const forceRebuild = parseBooleanFlag(queryValue(request, 'forceRebuild'), false)
  if (
    typeof addressValue !== 'string' ||
    !isValidLedgerWalletAddress(addressValue) ||
    refresh === null ||
    forceRebuild === null
  ) {
    return json({ error: 'Invalid request query' }, { status: 400, headers: PORTFOLIO_HEADERS })
  }
  if (!refresh && forceRebuild) {
    return json({ error: 'forceRebuild requires refresh to be enabled' }, { status: 400, headers: PORTFOLIO_HEADERS })
  }
  if (forceRebuild) {
    const accessError = getLedgerAdminAccessError(request, { requiresEnvio: true })
    if (accessError) {
      return accessError
    }
  } else {
    const readinessError = getLedgerReadinessError({ requiresEnvio: refresh, requiresReadWrite: true })
    if (readinessError) {
      return json(readinessError, { status: 503, headers: PORTFOLIO_HEADERS })
    }
  }

  const debugEnabled = isHoldingsDebugRequested(queryString(request, 'debug'))
  return withHoldingsDebugContext(
    createHoldingsDebugContext('ledger-portfolio-history', addressValue, debugEnabled),
    async () => {
      const getDurationMs = startHoldingsDebugTimer()
      const version = parseVersion(queryString(request, 'version'))
      const denomination = parseDenomination(queryString(request, 'denomination'))
      const timeframe = parseTimeframe(queryString(request, 'timeframe'))

      debugLog('ledger-portfolio', 'started combined wallet ledger portfolio request', {
        refresh,
        forceRebuild,
        version,
        denomination,
        timeframe
      })

      try {
        const resolved = await resolveWalletLedger({ address: addressValue, refresh, forceRebuild })
        if (resolved.kind === 'response') {
          return resolved.response
        }

        const cutoffs = getLedgerCutoffs(resolved.ledger, Date.now())
        const eventSource = createWalletLedgerEventSource({
          ledger: resolved.ledger,
          ...cutoffs
        })
        const aggregationOptions = { eventSource, cacheMode: 'bypass' as const }
        const [balance, protocolReturn, growth] = await Promise.all([
          getHistoricalHoldingsChart(
            addressValue,
            version,
            'seq',
            'paged',
            denomination,
            timeframe,
            undefined,
            aggregationOptions
          ),
          getHoldingsProtocolReturnHistory(addressValue, version, 'seq', 'paged', timeframe, undefined, undefined, {
            ...aggregationOptions,
            protocolReturnEventEnrichment: 'address-only'
          }),
          getLedgerProtocolReturnRows({ address: addressValue, version, eventSource })
        ])

        if (!balance.hasActivity && protocolReturn.summary.totalVaults === 0 && growth.summary.totalVaults === 0) {
          return json({ error: 'No holdings found for address' }, { status: 404, headers: PORTFOLIO_HEADERS })
        }

        debugLog('ledger-portfolio', 'completed combined wallet ledger portfolio request', {
          durationMs: getDurationMs(),
          freshness: resolved.freshness,
          events: getLedgerEventCount(resolved.ledger),
          balancePoints: balance.dataPoints.length,
          protocolReturnPoints: protocolReturn.dataPoints.length,
          growthVaults: growth.summary.totalVaults
        })

        return json(
          {
            address: balance.address,
            version,
            denomination,
            timeframe,
            ledger: {
              revision: resolved.ledger.revision,
              freshness: resolved.freshness,
              syncedAtMs: resolved.ledger.updatedAtMs,
              eventUpperTimestamp: cutoffs.eventUpperTimestamp,
              latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
              eventCount: getLedgerEventCount(resolved.ledger),
              coverageByChain: resolved.ledger.coverage.map((coverage) => ({
                chainId: coverage.chainId,
                progressBlock: coverage.completeThroughBlock
              }))
            },
            balance: {
              address: balance.address,
              denomination,
              timeframe,
              dataPoints: balance.dataPoints.map((point) => ({
                date: point.date,
                value: point.value
              }))
            },
            protocolReturn,
            growth
          },
          { headers: PORTFOLIO_HEADERS }
        )
      } catch (error) {
        const errorClass = error instanceof Error ? error.name : 'UnknownError'
        debugLog('ledger-portfolio', 'combined wallet ledger portfolio request failed', {
          durationMs: getDurationMs(),
          errorClass
        })
        console.error('Holdings wallet ledger portfolio request failed', { errorClass })
        return json(
          { error: 'Failed to calculate holdings ledger portfolio' },
          { status: 500, headers: PORTFOLIO_HEADERS }
        )
      }
    }
  )
}
