import { after } from 'next/server'
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
  holdingsConfig,
  type VaultVersion
} from '@/server/lib/holdings'
import {
  createHoldingsDebugContext,
  debugLog,
  isHoldingsDebugRequested,
  startHoldingsDebugTimer,
  withHoldingsDebugContext
} from '@/server/lib/holdings/services/debug'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import { getLedgerProtocolReturnRows } from '@/server/lib/holdings/services/ledger/rows'
import { LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'
import { LEDGER_STREAMS } from '@/server/lib/holdings/services/ledger/types'
import {
  createWalletLedgerDailyUsdTotalsCache,
  createWalletLedgerEventSource,
  getWalletLedgerDailyUsdDateRange,
  isWalletLedgerCompatible,
  readVerifiedWalletLedgerHeaderForAddress,
  readWalletLedger,
  synchronizeWalletLedger,
  type TWalletLedgerCheckedMarkerV2,
  type TWalletLedgerCompletedSyncResult,
  type TWalletLedgerDailyUsdCacheIdentity,
  type TWalletLedgerState,
  type TWalletLedgerVaultIdentifier
} from '@/server/lib/holdings/services/ledger/wallet'
import {
  enqueueWalletLedgerDerivedPortfolioCacheWrite,
  readWalletLedgerDerivedPortfolioCache,
  type TWalletLedgerDerivedPortfolioCacheIdentity,
  type TWalletLedgerDerivedPortfolioCacheReadResult
} from '@/server/lib/holdings/services/ledger/walletDerivedCache'
import { readWalletLedgerInvalidationHead } from '@/server/lib/holdings/services/ledger/walletInvalidation'
import { WALLET_LEDGER_FRESHNESS_MS } from '@/server/lib/holdings/services/ledger/walletTypes'
import { getSettledAddressScopedContext } from '@/server/lib/holdings/services/settledHoldingsContext'
import {
  createHoldingsValuationLoader,
  type THoldingsValuationLoader
} from '@/server/lib/holdings/services/valuationLoader'
import {
  prefetchGlobalVaultMetadata,
  resetGlobalVaultMetadataCacheForBenchmark
} from '@/server/lib/holdings/services/vaults'
import { getHoldingsLedgerRedisClient } from '@/server/lib/holdings/storage/ledgerRedis'

const SECONDS_PER_DAY = 24 * 60 * 60
const PORTFOLIO_HEADERS = {
  ...GET_CORS_HEADERS,
  'Cache-Control': WALLET_SCOPED_CACHE_CONTROL
} as const
const BENCHMARK_METADATA_RESET_HEADER = 'x-holdings-benchmark-metadata-cache-reset'

type TPortfolioLedgerFreshness = 'cached' | 'refreshed' | 'stale'
type TPortfolioProjectionCacheReadPolicy = 'default' | 'skip-derived' | 'skip-all'

type TResolvedWalletLedger =
  | {
      readonly kind: 'ready'
      readonly ledger: TWalletLedgerState
      readonly freshness: TPortfolioLedgerFreshness
      readonly effectiveCoverage: TWalletLedgerState['coverage']
      readonly coveredAtMs: number
      readonly projectionCacheReadPolicy: TPortfolioProjectionCacheReadPolicy
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
  coveredAtMs: number,
  nowMs: number
): {
  readonly eventUpperTimestamp: number
  readonly latestSettledDayTimestamp: number
} {
  const eventUpperTimestamp = Math.min(Math.floor(nowMs / 1000), Math.floor(coveredAtMs / 1000))
  const currentUtcDayTimestamp = Math.floor(eventUpperTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY
  return {
    eventUpperTimestamp,
    latestSettledDayTimestamp: Math.max(currentUtcDayTimestamp - SECONDS_PER_DAY, 0)
  }
}

function getLedgerEventCount(ledger: TWalletLedgerState): number {
  return LEDGER_STREAMS.reduce((total, stream) => total + ledger.streams[stream].length, 0)
}

function getHeaderCutoffs(header: TWalletLedgerCheckedMarkerV2, nowMs: number) {
  const eventUpperTimestamp = Math.min(Math.floor(nowMs / 1000), Math.floor(header.coveredAtMs / 1000))
  const currentUtcDayTimestamp = Math.floor(eventUpperTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY
  return {
    eventUpperTimestamp,
    latestSettledDayTimestamp: Math.max(currentUtcDayTimestamp - SECONDS_PER_DAY, 0)
  }
}

function isFreshCompatibleHeader(
  header: TWalletLedgerCheckedMarkerV2,
  nowMs: number,
  invalidationHead: number
): boolean {
  const configuredChains = [...holdingsConfig.ledgerChainIds].toSorted((left, right) => left - right)
  return (
    header.calculationVersion === LEDGER_CALCULATION_VERSION &&
    header.appliedInvalidationSequence === invalidationHead &&
    header.checkedAtMs <= nowMs &&
    header.reconciledAtMs <= nowMs &&
    nowMs - header.checkedAtMs < WALLET_LEDGER_FRESHNESS_MS &&
    nowMs - header.reconciledAtMs < holdingsConfig.ledgerReconcileIntervalMs &&
    header.coverage.length === configuredChains.length &&
    header.coverage.every(({ chainId }, index) => chainId === configuredChains[index])
  )
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
    return {
      kind: 'ready',
      ledger: result.ledger,
      freshness: 'cached',
      effectiveCoverage: result.ledger.coverage,
      coveredAtMs: result.ledger.updatedAtMs,
      projectionCacheReadPolicy: 'default'
    }
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
      ? {
          kind: 'ready',
          ledger: result.ledger,
          freshness: 'stale',
          effectiveCoverage: result.ledger.coverage,
          coveredAtMs: result.ledger.updatedAtMs,
          projectionCacheReadPolicy: 'default'
        }
      : null
  } catch {
    return null
  }
}

function getProjectionCacheReadPolicy(result: TWalletLedgerCompletedSyncResult): TPortfolioProjectionCacheReadPolicy {
  if (result.syncType === 'bootstrap' || result.syncType === 'forced-reset' || result.syncType === 'source-reset') {
    return 'skip-all'
  }
  if (
    result.transition.previousEventRevision !== result.ledger.eventRevision ||
    result.transition.previousAppliedInvalidationSequence !== result.ledger.appliedInvalidationSequence
  ) {
    return 'skip-derived'
  }
  return 'default'
}

async function resolveWalletLedger(args: {
  readonly address: string
  readonly refresh: boolean
  readonly forceRebuild: boolean
  readonly prefetchVaultMetadata: boolean
  readonly onVaultsDiscovered?: (vaults: readonly TWalletLedgerVaultIdentifier[]) => void | Promise<void>
}): Promise<TResolvedWalletLedger> {
  if (!args.refresh) {
    return readCachedWalletLedger(args.address)
  }

  try {
    const result = await synchronizeWalletLedger({
      address: args.address,
      forceRebuild: args.forceRebuild,
      prefetchVaultMetadata: args.prefetchVaultMetadata,
      onVaultsDiscovered: args.onVaultsDiscovered
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
      freshness: result.outcome === 'fresh' ? 'cached' : 'refreshed',
      effectiveCoverage: result.effectiveCoverage,
      coveredAtMs: result.coveredAtMs,
      projectionCacheReadPolicy: getProjectionCacheReadPolicy(result)
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

function createWriteOnlyDailyUsdTotalsCache(
  cache: ReturnType<typeof createWalletLedgerDailyUsdTotalsCache>
): ReturnType<typeof createWalletLedgerDailyUsdTotalsCache> {
  return {
    read: () => Promise.resolve({ totals: [], oldestUpdatedAt: null }),
    write: cache.write
  }
}

function startVaultPpsPrefetch(
  valuationLoader: THoldingsValuationLoader,
  vaults: readonly TWalletLedgerVaultIdentifier[]
): void {
  const getDurationMs = startHoldingsDebugTimer()
  void valuationLoader
    .fetchVaultPps(vaults, { consumer: 'balance' })
    .then((pps) => {
      debugLog('ledger-portfolio', 'prefetched wallet vault PPS while persisting the ledger', {
        durationMs: getDurationMs(),
        requested: vaults.length,
        resolved: pps.size
      })
    })
    .catch((error) => {
      debugLog('ledger-portfolio', 'wallet vault PPS prefetch failed without blocking the portfolio request', {
        durationMs: getDurationMs(),
        requested: vaults.length,
        errorClass: error instanceof Error ? error.name : 'UnknownError'
      })
    })
}

function getDailyUsdCacheIdentity(
  ledger: TWalletLedgerState,
  version: VaultVersion
): TWalletLedgerDailyUsdCacheIdentity {
  return {
    walletHash: ledger.walletHash,
    version,
    ledgerRevision: ledger.revision,
    ledgerCalculationVersion: ledger.calculationVersion,
    sourceGeneration: ledger.sourceGeneration,
    eventRevision: ledger.eventRevision,
    appliedInvalidationSequence: ledger.appliedInvalidationSequence
  }
}

function getDerivedPortfolioCacheIdentity(args: {
  readonly ledger: TWalletLedgerState
  readonly latestSettledDayTimestamp: number
  readonly version: VaultVersion
  readonly timeframe: HoldingsHistoryTimeframe
}): TWalletLedgerDerivedPortfolioCacheIdentity {
  return {
    walletHash: args.ledger.walletHash,
    ledgerRevision: args.ledger.revision,
    eventRevision: args.ledger.eventRevision,
    sourceGeneration: args.ledger.sourceGeneration,
    appliedInvalidationSequence: args.ledger.appliedInvalidationSequence,
    ledgerCalculationVersion: args.ledger.calculationVersion,
    latestSettledDayTimestamp: args.latestSettledDayTimestamp,
    version: args.version,
    timeframe: args.timeframe
  }
}

function getHeaderDailyUsdCacheIdentity(
  header: TWalletLedgerCheckedMarkerV2,
  walletHash: string,
  version: VaultVersion
): TWalletLedgerDailyUsdCacheIdentity {
  return {
    walletHash,
    version,
    ledgerRevision: header.revision,
    ledgerCalculationVersion: header.calculationVersion,
    sourceGeneration: header.sourceGeneration,
    eventRevision: header.eventRevision,
    appliedInvalidationSequence: header.appliedInvalidationSequence
  }
}

function getHeaderDerivedPortfolioCacheIdentity(args: {
  readonly header: TWalletLedgerCheckedMarkerV2
  readonly walletHash: string
  readonly latestSettledDayTimestamp: number
  readonly version: VaultVersion
  readonly timeframe: HoldingsHistoryTimeframe
}): TWalletLedgerDerivedPortfolioCacheIdentity {
  return {
    walletHash: args.walletHash,
    ledgerRevision: args.header.revision,
    eventRevision: args.header.eventRevision,
    sourceGeneration: args.header.sourceGeneration,
    appliedInvalidationSequence: args.header.appliedInvalidationSequence,
    ledgerCalculationVersion: args.header.calculationVersion,
    latestSettledDayTimestamp: args.latestSettledDayTimestamp,
    version: args.version,
    timeframe: args.timeframe
  }
}

async function readFullyCachedPortfolio(args: {
  readonly address: string
  readonly version: VaultVersion
  readonly timeframe: HoldingsHistoryTimeframe
}): Promise<Response | null> {
  const getDurationMs = startHoldingsDebugTimer()
  const redis = getHoldingsLedgerRedisClient()
  if (!redis) {
    return null
  }
  const [verifiedHeader, invalidationHead] = await Promise.all([
    readVerifiedWalletLedgerHeaderForAddress({ address: args.address }),
    readWalletLedgerInvalidationHead({ redis })
  ])
  const nowMs = Date.now()
  if (verifiedHeader.status !== 'ready' || !isFreshCompatibleHeader(verifiedHeader.header, nowMs, invalidationHead)) {
    debugLog('ledger-portfolio', 'skipped fully cached portfolio fast path', {
      durationMs: getDurationMs(),
      headerStatus: verifiedHeader.status,
      reason: verifiedHeader.status === 'ready' ? 'stale_or_incompatible' : verifiedHeader.status
    })
    return null
  }

  const header = verifiedHeader.header
  const walletHash = hashLedgerWalletAddress(args.address)
  const cutoffs = getHeaderCutoffs(header, nowMs)
  const dateRange = getWalletLedgerDailyUsdDateRange({
    latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
    timeframe: args.timeframe
  })
  const [cachedBalance, cachedDerived] = await Promise.all([
    createWalletLedgerDailyUsdTotalsCache(getHeaderDailyUsdCacheIdentity(header, walletHash, args.version)).read(
      dateRange.startDate,
      dateRange.endDate
    ),
    readWalletLedgerDerivedPortfolioCache(
      getHeaderDerivedPortfolioCacheIdentity({
        header,
        walletHash,
        latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
        version: args.version,
        timeframe: args.timeframe
      })
    )
  ])
  const balanceByDate = new Map(cachedBalance.totals.map((total) => [total.date, total]))
  const hasFullBalanceCoverage = dateRange.dates.every((date) => balanceByDate.has(date))
  if (!hasFullBalanceCoverage || cachedDerived.status !== 'hit') {
    debugLog('ledger-portfolio', 'skipped fully cached portfolio fast path', {
      durationMs: getDurationMs(),
      reason: !hasFullBalanceCoverage ? 'incomplete_balance_cache' : 'derived_cache_miss',
      cachedBalanceDays: cachedBalance.totals.length,
      expectedBalanceDays: dateRange.dates.length,
      derivedStatus: cachedDerived.status
    })
    return null
  }

  const balanceDataPoints = dateRange.dates.map((date) => {
    const total = balanceByDate.get(date)
    return { date, value: total?.usdValue ?? 0, isComplete: total?.isComplete !== false }
  })
  const { protocolReturn, growth } = cachedDerived.value
  if (!header.hasActivity && protocolReturn.summary.totalVaults === 0 && growth.summary.totalVaults === 0) {
    return json({ error: 'No holdings found for address' }, { status: 404, headers: PORTFOLIO_HEADERS })
  }
  debugLog('ledger-portfolio', 'served fully cached portfolio without decoding wallet events', {
    durationMs: getDurationMs(),
    events: header.eventCount,
    encodedBytesAvoided: header.encodedBytes,
    balancePoints: balanceDataPoints.length,
    protocolReturnPoints: protocolReturn.dataPoints.length,
    growthVaults: growth.summary.totalVaults
  })
  return json(
    {
      address: args.address.toLowerCase(),
      version: args.version,
      denomination: 'usd',
      timeframe: args.timeframe,
      ledger: {
        revision: header.revision,
        eventRevision: header.eventRevision,
        appliedInvalidationSequence: header.appliedInvalidationSequence,
        freshness: 'cached',
        syncedAtMs: header.updatedAtMs,
        eventUpperTimestamp: cutoffs.eventUpperTimestamp,
        latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
        eventCount: header.eventCount,
        coverageByChain: header.coverage.map((coverage) => ({
          chainId: coverage.chainId,
          progressBlock: coverage.completeThroughBlock
        }))
      },
      balance: {
        address: args.address.toLowerCase(),
        denomination: 'usd',
        timeframe: args.timeframe,
        isComplete: balanceDataPoints.every((point) => point.isComplete),
        dataPoints: balanceDataPoints
      },
      protocolReturn,
      growth
    },
    { headers: PORTFOLIO_HEADERS }
  )
}

export function OPTIONS(): Response {
  return noContent(LEDGER_ADMIN_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const addressValue = queryValue(request, 'address')
  const refresh = parseBooleanFlag(queryValue(request, 'refresh'), true)
  const forceRebuild = parseBooleanFlag(queryValue(request, 'forceRebuild'), false)
  const benchmarkResetMetadataCache = parseBooleanFlag(queryValue(request, 'benchmarkResetMetadataCache'), false)
  if (
    typeof addressValue !== 'string' ||
    !isValidLedgerWalletAddress(addressValue) ||
    refresh === null ||
    forceRebuild === null ||
    benchmarkResetMetadataCache === null
  ) {
    return json({ error: 'Invalid request query' }, { status: 400, headers: PORTFOLIO_HEADERS })
  }
  if (!refresh && forceRebuild) {
    return json({ error: 'forceRebuild requires refresh to be enabled' }, { status: 400, headers: PORTFOLIO_HEADERS })
  }
  if (
    benchmarkResetMetadataCache &&
    (!refresh || !process.env.HOLDINGS_LEDGER_KEY_NAMESPACE?.startsWith('benchmark_'))
  ) {
    return json(
      { error: 'Benchmark metadata reset requires refresh and an isolated benchmark namespace' },
      { status: 403, headers: PORTFOLIO_HEADERS }
    )
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

  if (benchmarkResetMetadataCache) {
    await resetGlobalVaultMetadataCacheForBenchmark()
  }

  const debugEnabled = isHoldingsDebugRequested(queryString(request, 'debug'))
  const response = await withHoldingsDebugContext(
    createHoldingsDebugContext('ledger-portfolio', addressValue, debugEnabled),
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
        const fullyCached =
          refresh && !forceRebuild && denomination === 'usd'
            ? await readFullyCachedPortfolio({ address: addressValue, version, timeframe }).catch(() => null)
            : null
        if (fullyCached) {
          return fullyCached
        }
        const valuationLoader = createHoldingsValuationLoader()
        if (refresh) {
          void prefetchGlobalVaultMetadata().catch(() => undefined)
        }
        const resolved = await resolveWalletLedger({
          address: addressValue,
          refresh,
          forceRebuild,
          prefetchVaultMetadata: refresh,
          onVaultsDiscovered: refresh
            ? (vaults) => {
                startVaultPpsPrefetch(valuationLoader, vaults)
              }
            : undefined
        })
        if (resolved.kind === 'response') {
          return resolved.response
        }

        const cutoffs = getLedgerCutoffs(resolved.coveredAtMs, Date.now())
        const eventSource = createWalletLedgerEventSource({
          ledger: resolved.ledger,
          ...cutoffs
        })
        const dailyUsdTotalsCache = createWalletLedgerDailyUsdTotalsCache(
          getDailyUsdCacheIdentity(resolved.ledger, version)
        )
        const balanceOptions = {
          eventSource,
          totalsCache:
            resolved.projectionCacheReadPolicy === 'skip-all'
              ? createWriteOnlyDailyUsdTotalsCache(dailyUsdTotalsCache)
              : dailyUsdTotalsCache,
          scheduleTotalsCacheWrite: (persistence: Promise<boolean>) => {
            after(() => persistence)
          },
          valuationLoader
        }
        const derivedCacheIdentity = getDerivedPortfolioCacheIdentity({
          ledger: resolved.ledger,
          latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
          version,
          timeframe
        })
        const balancePromise = getHistoricalHoldingsChart(
          addressValue,
          version,
          'seq',
          'paged',
          denomination,
          timeframe,
          undefined,
          balanceOptions
        )
        const shouldReadDerivedCache = !forceRebuild && resolved.projectionCacheReadPolicy === 'default'
        if (resolved.projectionCacheReadPolicy !== 'default') {
          debugLog('ledger-portfolio', 'skipped projection cache reads after ledger identity transition', {
            policy: resolved.projectionCacheReadPolicy
          })
        }
        const derivedCacheRead: Promise<TWalletLedgerDerivedPortfolioCacheReadResult> = shouldReadDerivedCache
          ? readWalletLedgerDerivedPortfolioCache(derivedCacheIdentity)
          : Promise.resolve({ status: 'miss' })
        const derivedPromise = derivedCacheRead.then(async (cached) => {
          if (cached.status === 'hit') {
            return { ...cached.value, cacheStatus: 'hit' as const }
          }

          const settledContext = getSettledAddressScopedContext({
            userAddress: addressValue,
            fetchType: 'seq',
            paginationMode: 'paged',
            eventSource
          })
          const uncachedLedgerOptions = {
            eventSource,
            valuationLoader,
            settledContext,
            cacheMode: 'bypass' as const
          }
          const [protocolReturn, growth] = await Promise.all([
            getHoldingsProtocolReturnHistory(addressValue, version, 'seq', 'paged', timeframe, undefined, undefined, {
              ...uncachedLedgerOptions,
              protocolReturnEventEnrichment: 'address-only'
            }),
            getLedgerProtocolReturnRows({
              address: addressValue,
              version,
              eventSource,
              options: { valuationLoader, settledContext }
            })
          ])
          const cacheWrite = enqueueWalletLedgerDerivedPortfolioCacheWrite(derivedCacheIdentity, {
            protocolReturn,
            growth
          })
          if (cacheWrite.persistence) {
            after(() => cacheWrite.persistence)
          }
          return { protocolReturn, growth, cacheStatus: `${cached.status}:${cacheWrite.status}` }
        })
        const [balance, derived] = await Promise.all([balancePromise, derivedPromise])
        const { protocolReturn, growth } = derived

        if (!balance.hasActivity && protocolReturn.summary.totalVaults === 0 && growth.summary.totalVaults === 0) {
          return json({ error: 'No holdings found for address' }, { status: 404, headers: PORTFOLIO_HEADERS })
        }

        debugLog('ledger-portfolio', 'completed combined wallet ledger portfolio request', {
          durationMs: getDurationMs(),
          freshness: resolved.freshness,
          events: getLedgerEventCount(resolved.ledger),
          balancePoints: balance.dataPoints.length,
          protocolReturnPoints: protocolReturn.dataPoints.length,
          growthVaults: growth.summary.totalVaults,
          derivedCacheStatus: shouldReadDerivedCache ? derived.cacheStatus : `bypass:${derived.cacheStatus}`
        })

        return json(
          {
            address: addressValue.toLowerCase(),
            version,
            denomination,
            timeframe,
            ledger: {
              revision: resolved.ledger.revision,
              eventRevision: resolved.ledger.eventRevision,
              appliedInvalidationSequence: resolved.ledger.appliedInvalidationSequence,
              freshness: resolved.freshness,
              syncedAtMs: resolved.ledger.updatedAtMs,
              eventUpperTimestamp: cutoffs.eventUpperTimestamp,
              latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
              eventCount: getLedgerEventCount(resolved.ledger),
              coverageByChain: resolved.effectiveCoverage.map((coverage) => ({
                chainId: coverage.chainId,
                progressBlock: coverage.completeThroughBlock
              }))
            },
            balance: {
              address: addressValue.toLowerCase(),
              denomination,
              timeframe,
              isComplete: balance.isComplete,
              dataPoints: balance.dataPoints.map((point) => ({
                date: point.date,
                value: point.value,
                isComplete: point.isComplete
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
  if (benchmarkResetMetadataCache) {
    response.headers.set(BENCHMARK_METADATA_RESET_HEADER, '1')
  }
  return response
}
