import type { THoldingsAggregationOptions } from '@/server/lib/holdings/services/eventSource'
import {
  createKongAssetPricePrefetcher,
  fetchMissingHistoricalAssetPricesFromKong,
  type TKongHeldAssetPriceRequirement
} from '@/server/lib/holdings/services/kongAssetPrices'
import { holdingsConfig } from '../config'
import type { VaultMetadata } from '../types'
import type { CachedTotal } from './cache'
import { checkCacheStaleness, clearUserCache, getCachedTotalsWithTimestamp, saveCachedTotals } from './cache'
import { debugLog, reportHoldingsProgress } from './debug'
import {
  fetchHistoricalPrices,
  fetchHistoricalPricesForTokenTimestamps,
  getChainPrefix,
  getHistoricalPriceFetchFailedBatches,
  getPriceAtTimestamp,
  type THistoricalPriceRequest
} from './defillama'
import {
  fetchUserEvents,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  type VaultVersion
} from './graphql'
import {
  buildPositionTimeline,
  buildPositionTimelineIndex,
  generateDailyTimestamps,
  generateDailyTimestampsFromRange,
  getIndexedShareBalanceAtTimestamp,
  getUniqueVaults,
  type TPositionTimelineIndex,
  timestampToDateString,
  toSettledDayTimestamp
} from './holdings'
import { fetchMultipleVaultsPPS, getPPS, getPpsFetchFailedVaults } from './kong'
import {
  deriveNestedVaultAssetPriceData,
  expandNestedVaultAssetPriceRequests,
  getNestedVaultPpsIdentifiersFromPriceRequests,
  mergeVaultIdentifiers,
  resolveNestedVaultAssetMetadata
} from './nestedVaultPrices'
import { toVaultKey } from './pnlShared'
import { getSettledAddressScopedContext, getSettledVersionedPpsContext } from './settledHoldingsContext'
import { fetchMultipleVaultsMetadata } from './vaults'

export interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  timeframe: HoldingsHistoryTimeframe
  hasActivity: boolean
  isComplete: boolean
  dataPoints: Array<{ date: string; timestamp: number; totalUsdValue: number; isComplete: boolean }>
}

export type HoldingsHistoryDenomination = 'usd' | 'eth'
export type HoldingsHistoryTimeframe = '1y' | 'all'
export type HoldingsVaultFilter = { chainId: number; vaultAddress: string }

export interface HoldingsHistoryChartResponse {
  address: string
  periodDays: number
  timeframe: HoldingsHistoryTimeframe
  denomination: HoldingsHistoryDenomination
  hasActivity: boolean
  isComplete: boolean
  dataPoints: Array<{ date: string; timestamp: number; value: number; isComplete: boolean }>
}

const ETHEREUM_WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const SECONDS_PER_DAY = 24 * 60 * 60

export interface HoldingsBreakdownVaultResponse {
  chainId: number
  vaultAddress: string
  shares: string
  sharesFormatted: number
  pricePerShare: number | null
  tokenPrice: number | null
  usdValue: number | null
  metadata: {
    symbol: string
    decimals: number
    tokenAddress: string
  } | null
  status: 'ok' | 'missing_metadata' | 'missing_pps' | 'missing_price'
}

export interface HoldingsBreakdownResponse {
  address: string
  version: VaultVersion
  date: string
  timestamp: number
  summary: {
    totalVaults: number
    vaultsWithShares: number
    totalUsdValue: number
    missingMetadata: number
    missingPps: number
    missingPrice: number
  }
  vaults: HoldingsBreakdownVaultResponse[]
  issues: {
    missingMetadata: string[]
    missingPps: string[]
    missingPrice: string[]
  }
  message?: string
}

export function getHoldingsTotalsCacheVersion(version: VaultVersion): string {
  return version
}

function filterVaultsByAuthoritativeVersion<
  TVault extends {
    chainId: number
    vaultAddress: string
  }
>(vaults: TVault[], vaultMetadata: Map<string, VaultMetadata>, version: VaultVersion): TVault[] {
  return vaults.filter((vault) => {
    const metadata = vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))

    if (metadata?.isHidden) {
      return false
    }

    if (version === 'all') {
      return true
    }

    return metadata?.version === version
  })
}

function filterVaultsByRequestedVault<TVault extends { chainId: number; vaultAddress: string }>(
  vaults: TVault[],
  requestedVaults?: HoldingsVaultFilter[]
): TVault[] {
  if (!requestedVaults?.length) {
    return vaults
  }

  const requestedVaultKeys = new Set(
    requestedVaults.map((vault) => toVaultKey(vault.chainId, vault.vaultAddress.toLowerCase()))
  )
  return vaults.filter((vault) => requestedVaultKeys.has(toVaultKey(vault.chainId, vault.vaultAddress)))
}

function getMissingKongAssetPriceRequirements(args: {
  readonly vaults: readonly { readonly chainId: number; readonly vaultAddress: string }[]
  readonly vaultMetadata: ReadonlyMap<string, VaultMetadata>
  readonly positionTimelineIndex: TPositionTimelineIndex
  readonly ppsData: ReadonlyMap<string, Map<number, number>>
  readonly priceData: ReadonlyMap<string, Map<number, number>>
  readonly timestamps: readonly number[]
}): TKongHeldAssetPriceRequirement[] {
  return args.vaults.flatMap((vault) => {
    const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
    const metadata = args.vaultMetadata.get(vaultKey)
    const ppsMap = args.ppsData.get(vaultKey)
    if (!metadata || !ppsMap) {
      return []
    }
    const priceKey = `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}`
    const priceMap = args.priceData.get(priceKey)
    const timestamps = args.timestamps.filter((timestamp) => {
      if (
        getIndexedShareBalanceAtTimestamp(args.positionTimelineIndex, vault.vaultAddress, vault.chainId, timestamp) ===
        BigInt(0)
      ) {
        return false
      }
      const pps = getPPS(ppsMap, timestamp)
      if (pps === null || !Number.isFinite(pps) || pps <= 0) {
        return false
      }
      const price = priceMap?.get(timestamp) ?? 0
      return !Number.isFinite(price) || price <= 0
    })
    return timestamps.length > 0
      ? [
          {
            chainId: vault.chainId,
            vaultAddress: vault.vaultAddress,
            assetAddress: metadata.token.address,
            timestamps
          }
        ]
      : []
  })
}

function getPotentialKongAssetPriceRequirements(args: {
  readonly vaults: readonly { readonly chainId: number; readonly vaultAddress: string }[]
  readonly vaultMetadata: ReadonlyMap<string, VaultMetadata>
  readonly positionTimelineIndex: TPositionTimelineIndex
  readonly timestamps: readonly number[]
}): TKongHeldAssetPriceRequirement[] {
  return args.vaults.flatMap((vault) => {
    const metadata = args.vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))
    if (!metadata) {
      return []
    }
    const timestamps = args.timestamps.filter(
      (timestamp) =>
        getIndexedShareBalanceAtTimestamp(args.positionTimelineIndex, vault.vaultAddress, vault.chainId, timestamp) !==
        BigInt(0)
    )
    return timestamps.length > 0
      ? [
          {
            chainId: vault.chainId,
            vaultAddress: vault.vaultAddress,
            assetAddress: metadata.token.address,
            timestamps
          }
        ]
      : []
  })
}

function buildHeldAssetPriceRequests(args: {
  readonly vaults: readonly { readonly chainId: number; readonly vaultAddress: string }[]
  readonly vaultMetadata: ReadonlyMap<string, VaultMetadata>
  readonly positionTimelineIndex: TPositionTimelineIndex
  readonly timestamps: readonly number[]
}): THistoricalPriceRequest[] {
  const requests = args.vaults.reduce<Map<string, { chainId: number; address: string; timestamps: Set<number> }>>(
    (requestsByAsset, vault) => {
      const metadata = args.vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))
      if (!metadata) {
        return requestsByAsset
      }

      const heldTimestamps = args.timestamps.filter(
        (timestamp) =>
          getIndexedShareBalanceAtTimestamp(
            args.positionTimelineIndex,
            vault.vaultAddress,
            vault.chainId,
            timestamp
          ) !== BigInt(0)
      )
      if (heldTimestamps.length === 0) {
        return requestsByAsset
      }

      const tokenKey = `${metadata.chainId}:${metadata.token.address.toLowerCase()}`
      const existing = requestsByAsset.get(tokenKey)
      if (existing) {
        heldTimestamps.forEach((timestamp) => {
          existing.timestamps.add(timestamp)
        })
        return requestsByAsset
      }

      requestsByAsset.set(tokenKey, {
        chainId: metadata.chainId,
        address: metadata.token.address,
        timestamps: new Set(heldTimestamps)
      })
      return requestsByAsset
    },
    new Map()
  )

  return Array.from(requests.values()).map((request) => ({
    chainId: request.chainId,
    address: request.address,
    timestamps: Array.from(request.timestamps).sort((left, right) => left - right)
  }))
}

function buildEmptyBreakdownResponse(
  userAddress: string,
  version: VaultVersion,
  timestamp: number,
  message: string
): HoldingsBreakdownResponse {
  return {
    address: userAddress,
    version,
    date: timestampToDateString(timestamp),
    timestamp,
    summary: {
      totalVaults: 0,
      vaultsWithShares: 0,
      totalUsdValue: 0,
      missingMetadata: 0,
      missingPps: 0,
      missingPrice: 0
    },
    vaults: [],
    issues: {
      missingMetadata: [],
      missingPps: [],
      missingPrice: []
    },
    message
  }
}

export async function getHistoricalHoldings(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged',
  timeframe: HoldingsHistoryTimeframe = '1y',
  requestedVaults?: HoldingsVaultFilter[],
  options: THoldingsAggregationOptions = {}
): Promise<HoldingsHistoryResponse> {
  const defaultDays = holdingsConfig.historyDays
  const legacyDayTimestamps = options.eventSource ? [] : generateDailyTimestamps(defaultDays, 1)
  const latestSettledDayTimestamp = options.eventSource?.latestSettledDayTimestamp ?? legacyDayTimestamps.at(-1) ?? 0
  const dayTimestamps = options.eventSource
    ? generateDailyTimestampsFromRange(
        latestSettledDayTimestamp - Math.max(defaultDays - 1, 0) * SECONDS_PER_DAY,
        latestSettledDayTimestamp
      )
    : legacyDayTimestamps
  const timestamps =
    timeframe === 'all'
      ? generateDailyTimestampsFromRange(holdingsConfig.historyStartTimestamp, latestSettledDayTimestamp)
      : dayTimestamps
  const periodDays = timestamps.length
  debugLog('history', 'starting historical holdings aggregation', {
    version,
    fetchType,
    paginationMode,
    timeframe,
    days: periodDays,
    timestamps: timestamps.length,
    latestSettledDate: timestampToDateString(latestSettledDayTimestamp)
  })

  const cacheVersion = getHoldingsTotalsCacheVersion(version)
  const suppliedTotalsCache = options.totalsCache
  const usePersistentDerivedCache =
    (options.cacheMode ?? 'default') === 'default' && (!options.eventSource || suppliedTotalsCache !== undefined)
  const shouldReadCache = usePersistentDerivedCache && timestamps.length > 0 && !requestedVaults?.length
  const shouldWriteCache = usePersistentDerivedCache && timestamps.length > 0 && !requestedVaults?.length
  const startDate = timestamps.length > 0 ? timestampToDateString(timestamps[0]) : null
  const endDate = timestamps.length > 0 ? timestampToDateString(timestamps[timestamps.length - 1]) : null
  const cachedResultPromise: Promise<{
    readonly totals: readonly (CachedTotal & { readonly isComplete?: boolean })[]
    readonly oldestUpdatedAt: Date | null
  }> =
    shouldReadCache && startDate && endDate
      ? suppliedTotalsCache
        ? suppliedTotalsCache.read(startDate, endDate)
        : getCachedTotalsWithTimestamp(userAddress, cacheVersion, startDate, endDate)
      : Promise.resolve({ totals: [], oldestUpdatedAt: null })
  const canServeSuppliedCacheWithoutContext =
    suppliedTotalsCache !== undefined && typeof options.eventSource?.hasActivity === 'boolean'
  const baseContextPromise = canServeSuppliedCacheWithoutContext
    ? null
    : (options.settledContext ??
      getSettledAddressScopedContext({
        userAddress,
        fetchType,
        paginationMode,
        eventSource: options.eventSource
      }))
  if (baseContextPromise) {
    void baseContextPromise.catch(() => undefined)
  }
  const initialCachedResult = await cachedResultPromise
  const initialCachedTotals = initialCachedResult.totals.map((total) => ({
    ...total,
    isComplete: total.isComplete !== false
  }))
  const initialCachedByDate = new Map(initialCachedTotals.map((total) => [total.date, total]))
  const hasInitialFullCacheCoverage =
    timestamps.length > 0 && timestamps.every((timestamp) => initialCachedByDate.has(timestampToDateString(timestamp)))

  if (canServeSuppliedCacheWithoutContext && hasInitialFullCacheCoverage) {
    const dataPoints = timestamps.map((timestamp) => {
      const date = timestampToDateString(timestamp)
      const total = initialCachedByDate.get(date)
      return {
        date,
        timestamp: toSettledDayTimestamp(timestamp),
        totalUsdValue: total?.usdValue ?? 0,
        isComplete: total?.isComplete ?? false
      }
    })
    debugLog('history', 'serving fully cached historical holdings without rebuilding valuation context', {
      version,
      dataPoints: dataPoints.length,
      oldestUpdatedAt: initialCachedResult.oldestUpdatedAt?.toISOString() ?? null
    })
    reportHoldingsProgress(94, 'Loaded cached historical chart data', `${dataPoints.length} chart points`)

    return {
      address: userAddress,
      periodDays,
      timeframe,
      hasActivity: options.eventSource?.hasActivity ?? false,
      isComplete: dataPoints.every((point) => point.isComplete),
      dataPoints
    }
  }

  const baseContext = await (baseContextPromise ??
    options.settledContext ??
    getSettledAddressScopedContext({
      userAddress,
      fetchType,
      paginationMode,
      eventSource: options.eventSource
    }))
  reportHoldingsProgress(18, 'Loaded wallet events', null)
  debugLog('history', 'loaded cached totals for request', {
    version,
    timeframe,
    cachedTotals: initialCachedTotals.length,
    oldestUpdatedAt: initialCachedResult.oldestUpdatedAt?.toISOString() ?? null
  })
  reportHoldingsProgress(28, 'Checked cached historical totals', `${initialCachedTotals.length} cached days`)

  const timeline = baseContext.timeline
  const positionTimelineIndex = buildPositionTimelineIndex(timeline)
  const hasActivity = baseContext.hasActivity
  debugLog('history', 'built position timeline', {
    fetchType,
    paginationMode,
    deposits: baseContext.events.deposits.length,
    withdrawals: baseContext.events.withdrawals.length,
    transfersIn: baseContext.events.transfersIn.length,
    transfersOut: baseContext.events.transfersOut.length,
    timelineEntries: timeline.length
  })
  reportHoldingsProgress(36, 'Built historical position timeline', `${timeline.length} timeline entries`)

  const vaultMetadata = baseContext.vaultMetadata
  const scopedRawVaults = filterVaultsByRequestedVault(baseContext.rawVaultIdentifiers, requestedVaults)
  const unidentifiedVersionVaults =
    version === 'all'
      ? []
      : scopedRawVaults.filter((vault) => !vaultMetadata.has(toVaultKey(vault.chainId, vault.vaultAddress)))
  const versionFilteredVaults = filterVaultsByAuthoritativeVersion(scopedRawVaults, vaultMetadata, version)
  const vaults = versionFilteredVaults
  debugLog('history', 'resolved authoritative vault versions for history', {
    version,
    fetchType,
    paginationMode,
    rawVaults: baseContext.rawVaultIdentifiers.length,
    filteredVaults: vaults.length,
    metadataResolved: vaultMetadata.size
  })
  reportHoldingsProgress(44, 'Resolved vault metadata', `${vaults.length} vaults`)

  const legacyCacheVaultIdentifiers = scopedRawVaults.map((vault) => ({
    address: vault.vaultAddress,
    chainId: vault.chainId
  }))
  const isLegacyCacheStale =
    shouldReadCache && !suppliedTotalsCache && initialCachedTotals.length > 0 && legacyCacheVaultIdentifiers.length > 0
      ? await checkCacheStaleness(legacyCacheVaultIdentifiers, initialCachedResult.oldestUpdatedAt)
      : false

  if (shouldReadCache && !suppliedTotalsCache && initialCachedTotals.length > 0 && vaults.length > 0) {
    debugLog('history', 'completed cache staleness check', {
      version,
      fetchType,
      paginationMode,
      vaults: legacyCacheVaultIdentifiers.length,
      isStale: isLegacyCacheStale
    })

    if (isLegacyCacheStale) {
      console.log(`[Aggregator] Cache stale for ${userAddress}, clearing and recalculating`)
      await clearUserCache(userAddress, cacheVersion)
    }
  }

  const cachedTotals = isLegacyCacheStale ? [] : initialCachedTotals
  const oldestUpdatedAt = isLegacyCacheStale ? null : initialCachedResult.oldestUpdatedAt
  const cachedByDate = new Map(cachedTotals.map((total) => [total.date, total]))

  const hasFullCacheCoverage =
    timestamps.length > 0 && timestamps.every((timestamp) => cachedByDate.has(timestampToDateString(timestamp)))

  if (hasFullCacheCoverage) {
    const dataPoints = timestamps.map((timestamp) => {
      const date = timestampToDateString(timestamp)
      const total = cachedByDate.get(date)
      return {
        date,
        timestamp: toSettledDayTimestamp(timestamp),
        totalUsdValue: total?.usdValue ?? 0,
        isComplete: total?.isComplete ?? false
      }
    })
    debugLog('history', 'serving fully cached historical holdings', {
      version,
      dataPoints: dataPoints.length,
      oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
    })
    reportHoldingsProgress(94, 'Loaded cached historical chart data', `${dataPoints.length} chart points`)

    return {
      address: userAddress,
      periodDays,
      timeframe,
      hasActivity,
      isComplete: dataPoints.every((point) => point.isComplete),
      dataPoints
    }
  }

  const missingTimestamps = timestamps.filter((ts) => !cachedByDate.has(timestampToDateString(ts)))
  debugLog('history', 'computed missing timestamps', {
    fetchType,
    paginationMode,
    cachedDates: cachedByDate.size,
    missingTimestamps: missingTimestamps.length
  })
  reportHoldingsProgress(52, 'Computed missing historical days', `${missingTimestamps.length} days need valuation`)

  const newTotals: Array<CachedTotal & { readonly isComplete: boolean }> = []
  const valuationHealth = {
    failedMetadataVaults: baseContext.metadataFetchFailedVaults,
    failedPpsVaults: 0,
    failedPriceBatches: 0,
    incompletePositions: 0
  }

  if (missingTimestamps.length > 0) {
    // Events already fetched above

    if (timeline.length === 0) {
      debugLog('history', 'timeline empty, returning zero holdings history')
      // No holdings - return zeros without caching to prevent DB spam
      return {
        address: userAddress,
        periodDays,
        timeframe,
        hasActivity,
        isComplete: true,
        dataPoints: timestamps.map((ts) => ({
          date: timestampToDateString(ts),
          timestamp: toSettledDayTimestamp(ts),
          totalUsdValue: 0,
          isComplete: true
        }))
      }
    } else if (vaults.length === 0) {
      const unidentifiedPositionsByDate = missingTimestamps.map(
        (timestamp) =>
          unidentifiedVersionVaults.filter(
            (vault) =>
              getIndexedShareBalanceAtTimestamp(
                positionTimelineIndex,
                vault.vaultAddress,
                vault.chainId,
                toSettledDayTimestamp(timestamp)
              ) !== BigInt(0)
          ).length
      )
      const incompleteDates = unidentifiedPositionsByDate.filter((positions) => positions > 0).length
      const incompletePositions = unidentifiedPositionsByDate.reduce((count, positions) => count + positions, 0)
      if (incompletePositions > 0) {
        valuationHealth.incompletePositions += incompletePositions
        missingTimestamps.forEach((timestamp, index) => {
          newTotals.push({
            date: timestampToDateString(timestamp),
            usdValue: 0,
            isComplete: (unidentifiedPositionsByDate[index] ?? 0) === 0
          })
        })
        debugLog('history', 'calculated provisional zero history for unclassified positions', {
          version,
          fetchType,
          paginationMode,
          incompleteDates,
          incompletePositions,
          reason: 'unclassified_positions'
        })
      } else {
        debugLog('history', 'no vaults matched the requested authoritative version, returning zero holdings history', {
          version,
          fetchType,
          paginationMode
        })
        return {
          address: userAddress,
          periodDays,
          timeframe,
          hasActivity,
          isComplete: true,
          dataPoints: timestamps.map((ts) => ({
            date: timestampToDateString(ts),
            timestamp: toSettledDayTimestamp(ts),
            totalUsdValue: 0,
            isComplete: true
          }))
        }
      }
    } else {
      const ppsContextPromise = getSettledVersionedPpsContext({
        userAddress,
        version,
        fetchType,
        paginationMode,
        vaultIdentifiers: vaults,
        context: baseContext,
        eventSource: options.eventSource,
        valuationLoader: options.valuationLoader,
        valuationConsumer: 'balance'
      })
      const valuationTimestamps = missingTimestamps.map((timestamp) => toSettledDayTimestamp(timestamp))
      const kongAssetPricePrefetcher = options.valuationLoader
        ? createKongAssetPricePrefetcher({
            potentialRequirements: getPotentialKongAssetPriceRequirements({
              vaults,
              vaultMetadata,
              positionTimelineIndex,
              timestamps: valuationTimestamps
            })
          })
        : null
      const basePriceRequests = buildHeldAssetPriceRequests({
        vaults,
        vaultMetadata,
        positionTimelineIndex,
        timestamps: valuationTimestamps
      })
      const priceRequests = expandNestedVaultAssetPriceRequests(basePriceRequests, vaultMetadata)
      const ppsIdentifiers = mergeVaultIdentifiers([
        ...vaults,
        ...getNestedVaultPpsIdentifiersFromPriceRequests(basePriceRequests, vaultMetadata)
      ])
      const [ppsContext, fetchedPriceData] = await Promise.all([
        ppsContextPromise,
        options.valuationLoader
          ? options.valuationLoader.fetchHistoricalPrices(priceRequests, {
              resolution: 'utc_day',
              consumer: 'balance',
              ...(kongAssetPricePrefetcher
                ? {
                    onMissingHistoricalPrice: (request) => {
                      kongAssetPricePrefetcher.prefetch([{ chainId: request.chainId, assetAddress: request.address }])
                    }
                  }
                : {})
            })
          : fetchHistoricalPricesForTokenTimestamps(priceRequests, { resolution: 'utc_day' })
      ])
      valuationHealth.failedPpsVaults = getPpsFetchFailedVaults(ppsContext.ppsData)
      valuationHealth.failedPriceBatches = getHistoricalPriceFetchFailedBatches(fetchedPriceData)
      reportHoldingsProgress(62, 'Loaded vault share price history', `${vaults.length} vaults`)
      reportHoldingsProgress(76, 'Fetched historical token prices', `${priceRequests.length} price series`)
      const derivedPriceData = deriveNestedVaultAssetPriceData({
        priceData: fetchedPriceData,
        priceRequests,
        vaultMetadata,
        ppsData: ppsContext.ppsData
      })
      const kongPriceRequirements = getMissingKongAssetPriceRequirements({
        vaults,
        vaultMetadata,
        positionTimelineIndex,
        ppsData: ppsContext.ppsData,
        priceData: derivedPriceData,
        timestamps: valuationTimestamps
      })
      const kongAssetPriceData = kongAssetPricePrefetcher
        ? await kongAssetPricePrefetcher.resolve(kongPriceRequirements)
        : await fetchMissingHistoricalAssetPricesFromKong({ requirements: kongPriceRequirements })
      debugLog('history', 'resolved metadata and PPS for history', {
        version,
        fetchType,
        paginationMode,
        vaults: ppsIdentifiers.length,
        metadataResolved: vaultMetadata.size,
        ppsResolved: ppsContext.ppsData.size,
        emptyPpsTimelines: Array.from(ppsContext.ppsData.values()).filter((timeline) => timeline.size === 0).length
      })
      debugLog('history', 'resolved historical token prices', {
        version,
        fetchType,
        paginationMode,
        tokens: priceRequests.length,
        priceKeys: derivedPriceData.size,
        kongDailyAveragePriceKeys: kongAssetPriceData.size,
        missingTimestamps: missingTimestamps.length,
        failedPriceBatches: valuationHealth.failedPriceBatches,
        failedPpsVaults: valuationHealth.failedPpsVaults,
        failedMetadataVaults: valuationHealth.failedMetadataVaults
      })

      missingTimestamps.forEach((timestamp) => {
        const valuationTimestamp = toSettledDayTimestamp(timestamp)
        const unidentifiedPositions = unidentifiedVersionVaults.filter(
          (vault) =>
            getIndexedShareBalanceAtTimestamp(
              positionTimelineIndex,
              vault.vaultAddress,
              vault.chainId,
              valuationTimestamp
            ) !== BigInt(0)
        ).length
        const dayValuation = vaults.reduce(
          (result, vault) => {
            const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
            const shares = getIndexedShareBalanceAtTimestamp(
              positionTimelineIndex,
              vault.vaultAddress,
              vault.chainId,
              valuationTimestamp
            )

            if (shares === BigInt(0)) {
              return result
            }

            const metadata = vaultMetadata.get(vaultKey)
            if (!metadata) {
              return {
                usdValue: result.usdValue,
                incompletePositions: result.incompletePositions + 1
              }
            }

            const ppsMap = ppsContext.ppsData.get(vaultKey)
            const pps = ppsMap ? getPPS(ppsMap, valuationTimestamp) : null
            if (pps === null || !Number.isFinite(pps) || pps <= 0) {
              return {
                usdValue: result.usdValue,
                incompletePositions: result.incompletePositions + 1
              }
            }

            const priceKey = `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}`
            const tokenPriceMap = derivedPriceData.get(priceKey)
            const primaryTokenPrice = tokenPriceMap?.get(valuationTimestamp) ?? 0
            const kongDailyAveragePrice = kongAssetPriceData.get(priceKey)?.get(valuationTimestamp) ?? 0
            const tokenPrice = primaryTokenPrice > 0 ? primaryTokenPrice : kongDailyAveragePrice
            if (!Number.isFinite(tokenPrice) || tokenPrice <= 0) {
              return {
                usdValue: result.usdValue,
                incompletePositions: result.incompletePositions + 1
              }
            }

            const sharesFloat = Number(shares) / 10 ** metadata.decimals
            return {
              usdValue: result.usdValue + sharesFloat * pps * tokenPrice,
              incompletePositions: result.incompletePositions
            }
          },
          { usdValue: 0, incompletePositions: unidentifiedPositions }
        )
        valuationHealth.incompletePositions += dayValuation.incompletePositions

        newTotals.push({
          date: timestampToDateString(timestamp),
          usdValue: dayValuation.usdValue,
          isComplete: dayValuation.incompletePositions === 0
        })
      })

      debugLog('history', 'calculated uncached daily totals', {
        version,
        fetchType,
        paginationMode,
        newTotals: newTotals.length,
        nonZeroTotals: newTotals.filter((total) => total.usdValue > 0).length,
        provisionalTotals: newTotals.filter((total) => !total.isComplete).length
      })
      reportHoldingsProgress(88, 'Calculated uncached chart history', `${newTotals.length} daily totals`)
    }

    const incompleteTotals = newTotals.filter((total) => !total.isComplete)
    const completeTotals = newTotals.filter((total) => total.isComplete)
    const totalsToWrite = suppliedTotalsCache ? newTotals : completeTotals
    if (shouldWriteCache && totalsToWrite.length > 0) {
      const writeTotalsPromise = Promise.resolve(
        suppliedTotalsCache
          ? suppliedTotalsCache.write(totalsToWrite)
          : saveCachedTotals(
              userAddress,
              cacheVersion,
              totalsToWrite.map(({ date, usdValue }) => ({ date, usdValue }))
            )
      )
      const writeMode = { value: 'awaited' as 'awaited' | 'scheduled' }
      const scheduleTotalsCacheWrite = suppliedTotalsCache ? options.scheduleTotalsCacheWrite : undefined
      const logWriteResult = (savedTotals: boolean): boolean => {
        debugLog(
          'history',
          savedTotals ? 'saved recalculated totals to cache' : 'did not save recalculated totals to cache',
          {
            version,
            fetchType,
            paginationMode,
            newTotals: totalsToWrite.length,
            provisionalTotals: newTotals.filter((total) => !total.isComplete).length,
            writeMode: writeMode.value
          }
        )
        return savedTotals
      }
      const trackedWriteTotalsPromise = writeTotalsPromise.then(logWriteResult)
      if (scheduleTotalsCacheWrite) {
        try {
          scheduleTotalsCacheWrite(trackedWriteTotalsPromise)
          writeMode.value = 'scheduled'
          debugLog('history', 'queued recalculated totals cache write', {
            version,
            fetchType,
            paginationMode,
            newTotals: totalsToWrite.length,
            provisionalTotals: newTotals.filter((total) => !total.isComplete).length
          })
          reportHoldingsProgress(92, 'Queued historical chart cache save', `${totalsToWrite.length} daily totals`)
        } catch {
          const savedTotals = await trackedWriteTotalsPromise
          reportHoldingsProgress(
            92,
            savedTotals ? 'Saved historical chart cache' : 'Skipped historical chart cache save',
            `${totalsToWrite.length} daily totals`
          )
        }
      } else {
        const savedTotals = await trackedWriteTotalsPromise
        reportHoldingsProgress(
          92,
          savedTotals ? 'Saved historical chart cache' : 'Skipped historical chart cache save',
          `${totalsToWrite.length} daily totals`
        )
      }
    } else if (shouldWriteCache && newTotals.length > 0) {
      debugLog('history', 'skipped historical totals cache save because every date was incomplete', {
        version,
        fetchType,
        paginationMode,
        newTotals: newTotals.length,
        ...valuationHealth
      })
      reportHoldingsProgress(92, 'Skipped historical chart cache save', 'all daily valuations were incomplete')
    }

    if (incompleteTotals.length > 0) {
      debugLog('history', 'returning provisional historical holdings valuation', {
        version,
        fetchType,
        paginationMode,
        incompleteDates: incompleteTotals.length,
        ...valuationHealth
      })
    }
  }

  // Merge cached and new totals
  newTotals.forEach((total) => {
    cachedByDate.set(total.date, total)
  })

  const dataPoints = timestamps.map((timestamp) => {
    const date = timestampToDateString(timestamp)
    const total = cachedByDate.get(date)
    return {
      date,
      timestamp: toSettledDayTimestamp(timestamp),
      totalUsdValue: total?.usdValue ?? 0,
      isComplete: total?.isComplete ?? false
    }
  })
  debugLog('history', 'completed historical holdings aggregation', {
    version,
    fetchType,
    paginationMode,
    dataPoints: dataPoints.length,
    nonZeroPoints: dataPoints.filter((point) => point.totalUsdValue > 0).length
  })
  reportHoldingsProgress(96, 'Prepared historical chart data', `${dataPoints.length} chart points`)

  return {
    address: userAddress,
    periodDays,
    timeframe,
    hasActivity,
    isComplete: dataPoints.every((point) => point.isComplete),
    dataPoints
  }
}

export async function getHistoricalHoldingsChart(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged',
  denomination: HoldingsHistoryDenomination = 'usd',
  timeframe: HoldingsHistoryTimeframe = '1y',
  requestedVaults?: HoldingsVaultFilter[],
  options: THoldingsAggregationOptions = {}
): Promise<HoldingsHistoryChartResponse> {
  const holdings = await getHistoricalHoldings(
    userAddress,
    version,
    fetchType,
    paginationMode,
    timeframe,
    requestedVaults,
    options
  )

  if (denomination === 'usd') {
    return {
      address: holdings.address,
      periodDays: holdings.periodDays,
      timeframe: holdings.timeframe,
      denomination,
      hasActivity: holdings.hasActivity,
      isComplete: holdings.isComplete,
      dataPoints: holdings.dataPoints.map((point) => ({
        date: point.date,
        timestamp: point.timestamp,
        value: point.totalUsdValue,
        isComplete: point.isComplete
      }))
    }
  }

  const timestamps = holdings.dataPoints.map((point) => point.timestamp)
  const ethPriceMap = options.valuationLoader
    ? await options.valuationLoader.fetchHistoricalPrices(
        [{ chainId: 1, address: ETHEREUM_WETH_ADDRESS, timestamps }],
        { resolution: 'utc_day', consumer: 'balance' }
      )
    : await fetchHistoricalPrices([{ chainId: 1, address: ETHEREUM_WETH_ADDRESS }], timestamps)
  const ethPrices = ethPriceMap.get(`${getChainPrefix(1)}:${ETHEREUM_WETH_ADDRESS.toLowerCase()}`)

  const dataPoints = holdings.dataPoints.map((point) => {
    const ethPriceUsd = ethPrices?.get(point.timestamp) ?? 0
    const hasEthPrice = Number.isFinite(ethPriceUsd) && ethPriceUsd > 0
    return {
      date: point.date,
      timestamp: point.timestamp,
      value: hasEthPrice ? point.totalUsdValue / ethPriceUsd : 0,
      isComplete: point.isComplete && hasEthPrice
    }
  })

  return {
    address: holdings.address,
    periodDays: holdings.periodDays,
    timeframe: holdings.timeframe,
    denomination,
    hasActivity: holdings.hasActivity,
    isComplete: dataPoints.every((point) => point.isComplete),
    dataPoints
  }
}

export async function getHoldingsBreakdown(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged',
  targetTimestamp?: number,
  options: THoldingsAggregationOptions = {}
): Promise<HoldingsBreakdownResponse> {
  const breakdownDayTimestamp =
    targetTimestamp ??
    options.eventSource?.latestSettledDayTimestamp ??
    generateDailyTimestamps(holdingsConfig.historyDays, 1).at(-1) ??
    0
  const breakdownTimestamp = toSettledDayTimestamp(breakdownDayTimestamp)
  const breakdownDate = timestampToDateString(breakdownTimestamp)
  const breakdownPriceTimestamp = breakdownTimestamp
  debugLog('breakdown', 'starting holdings breakdown', {
    version,
    fetchType,
    paginationMode,
    timestamp: breakdownTimestamp,
    date: breakdownDate,
    priceTimestamp: breakdownPriceTimestamp
  })

  const maxTimestamp = breakdownDayTimestamp + SECONDS_PER_DAY
  const events = options.eventSource
    ? await options.eventSource.load({
        userAddress,
        version: 'all',
        maxTimestamp,
        fetchType,
        paginationMode
      })
    : await fetchUserEvents(userAddress, 'all', maxTimestamp, fetchType, paginationMode)
  const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
  const positionTimelineIndex = buildPositionTimelineIndex(timeline)
  debugLog('breakdown', 'built position timeline for breakdown', {
    version,
    fetchType,
    paginationMode,
    deposits: events.deposits.length,
    withdrawals: events.withdrawals.length,
    transfersIn: events.transfersIn.length,
    transfersOut: events.transfersOut.length,
    timelineEntries: timeline.length
  })

  if (timeline.length === 0) {
    debugLog('breakdown', 'no events found for holdings breakdown', {
      version,
      fetchType,
      paginationMode
    })
    return buildEmptyBreakdownResponse(userAddress, version, breakdownTimestamp, 'No events found')
  }

  const rawVaults = getUniqueVaults(timeline)
  const baseVaultMetadata = rawVaults.length > 0 ? await fetchMultipleVaultsMetadata(rawVaults) : new Map()
  const vaultMetadata = await resolveNestedVaultAssetMetadata(baseVaultMetadata)
  const vaults = filterVaultsByAuthoritativeVersion(rawVaults, vaultMetadata, version)
  debugLog('breakdown', 'resolved authoritative vault versions for breakdown', {
    version,
    fetchType,
    paginationMode,
    rawVaults: rawVaults.length,
    filteredVaults: vaults.length,
    metadataResolved: vaultMetadata.size
  })

  if (vaults.length === 0) {
    debugLog('breakdown', 'no vaults matched the requested authoritative version for breakdown', {
      version,
      fetchType,
      paginationMode
    })
    return buildEmptyBreakdownResponse(userAddress, version, breakdownTimestamp, 'No matching holdings found')
  }

  const activeVaults = vaults.reduce<
    Array<{
      chainId: number
      vaultAddress: string
      shares: bigint
      sharesFormatted: number
    }>
  >((active, vault) => {
    const metadata = vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))
    const decimals = metadata?.decimals ?? 18
    const shares = getIndexedShareBalanceAtTimestamp(
      positionTimelineIndex,
      vault.vaultAddress,
      vault.chainId,
      breakdownTimestamp
    )

    if (shares <= BigInt(0)) {
      return active
    }

    active.push({
      chainId: vault.chainId,
      vaultAddress: vault.vaultAddress,
      shares,
      sharesFormatted: Number(shares) / 10 ** decimals
    })
    return active
  }, [])

  const seenTokens = new Set<string>()
  const underlyingTokens: Array<{ chainId: number; address: string }> = []
  for (const vault of activeVaults) {
    const metadata = vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))
    if (!metadata) {
      continue
    }

    const tokenKey = `${metadata.chainId}:${metadata.token.address.toLowerCase()}`
    if (!seenTokens.has(tokenKey)) {
      seenTokens.add(tokenKey)
      underlyingTokens.push({
        chainId: metadata.chainId,
        address: metadata.token.address
      })
    }
  }

  const basePriceRequests = underlyingTokens.map((token) => ({
    ...token,
    timestamps: [breakdownPriceTimestamp]
  }))
  const priceRequests = expandNestedVaultAssetPriceRequests(basePriceRequests, vaultMetadata)
  const ppsIdentifiers = mergeVaultIdentifiers([
    ...activeVaults,
    ...getNestedVaultPpsIdentifiersFromPriceRequests(basePriceRequests, vaultMetadata)
  ])
  const [ppsData, fetchedPriceData] = await Promise.all([
    ppsIdentifiers.length > 0 ? fetchMultipleVaultsPPS(ppsIdentifiers) : Promise.resolve(new Map()),
    priceRequests.length > 0
      ? fetchHistoricalPricesForTokenTimestamps(priceRequests, { resolution: 'utc_day' })
      : Promise.resolve(new Map())
  ])
  const derivedPriceData = deriveNestedVaultAssetPriceData({
    priceData: fetchedPriceData,
    priceRequests,
    vaultMetadata,
    ppsData
  })
  const kongPriceRequirements = getMissingKongAssetPriceRequirements({
    vaults: activeVaults,
    vaultMetadata,
    positionTimelineIndex,
    ppsData,
    priceData: derivedPriceData,
    timestamps: [breakdownPriceTimestamp]
  })
  const kongAssetPriceData = await fetchMissingHistoricalAssetPricesFromKong({
    requirements: kongPriceRequirements
  })
  debugLog('breakdown', 'resolved metadata, PPS, and prices for breakdown', {
    version,
    fetchType,
    paginationMode,
    vaults: ppsIdentifiers.length,
    metadataResolved: vaultMetadata.size,
    ppsResolved: ppsData.size,
    tokens: priceRequests.length,
    priceKeys: derivedPriceData.size,
    kongDailyAveragePriceKeys: kongAssetPriceData.size,
    timestamp: breakdownTimestamp,
    priceTimestamp: breakdownPriceTimestamp,
    activeVaults: activeVaults.length
  })

  const results: HoldingsBreakdownVaultResponse[] = []

  for (const vault of activeVaults) {
    const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
    const metadata = vaultMetadata.get(vaultKey)
    const ppsMap = ppsData.get(vaultKey)
    const pps = ppsMap ? getPPS(ppsMap, breakdownTimestamp) : null

    let tokenPrice: number | null = null
    let usdValue: number | null = null

    if (metadata) {
      const priceKey = `${getChainPrefix(metadata.chainId)}:${metadata.token.address.toLowerCase()}`
      const tokenPriceMap = derivedPriceData.get(priceKey)
      const primaryTokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, breakdownPriceTimestamp) : 0
      const kongDailyAveragePrice = kongAssetPriceData.get(priceKey)?.get(breakdownPriceTimestamp) ?? 0
      tokenPrice = primaryTokenPrice > 0 ? primaryTokenPrice : kongDailyAveragePrice
      usdValue = pps ? vault.sharesFormatted * pps * tokenPrice : 0
    }

    let status: HoldingsBreakdownVaultResponse['status'] = 'ok'
    if (!metadata) {
      status = 'missing_metadata'
    } else if (!pps) {
      status = 'missing_pps'
    } else if (tokenPrice === 0) {
      status = 'missing_price'
    }

    results.push({
      chainId: vault.chainId,
      vaultAddress: vault.vaultAddress,
      shares: vault.shares.toString(),
      sharesFormatted: vault.sharesFormatted,
      pricePerShare: pps,
      tokenPrice,
      usdValue,
      metadata: metadata
        ? {
            symbol: metadata.token.symbol,
            decimals: metadata.decimals,
            tokenAddress: metadata.token.address
          }
        : null,
      status
    })
  }

  results.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))

  const withShares = results.filter((vault) => vault.sharesFormatted > 0)
  const missingMetadata = results.filter((vault) => vault.status === 'missing_metadata')
  const missingPps = results.filter((vault) => vault.status === 'missing_pps')
  const missingPrice = results.filter((vault) => vault.status === 'missing_price')
  const totalUsdValue = withShares.reduce((sum, vault) => sum + (vault.usdValue ?? 0), 0)

  debugLog('breakdown', 'completed holdings breakdown', {
    version,
    fetchType,
    paginationMode,
    timestamp: breakdownTimestamp,
    totalVaults: vaults.length,
    vaultsWithShares: withShares.length,
    totalUsdValue,
    missingMetadata: missingMetadata.length,
    missingPps: missingPps.length,
    missingPrice: missingPrice.length
  })

  return {
    address: userAddress,
    version,
    date: breakdownDate,
    timestamp: breakdownTimestamp,
    summary: {
      totalVaults: vaults.length,
      vaultsWithShares: withShares.length,
      totalUsdValue,
      missingMetadata: missingMetadata.length,
      missingPps: missingPps.length,
      missingPrice: missingPrice.length
    },
    vaults: withShares,
    issues: {
      missingMetadata: missingMetadata.map((vault) => `${vault.chainId}:${vault.vaultAddress}`),
      missingPps: missingPps
        .filter((vault) => vault.sharesFormatted > 0)
        .map((vault) => `${vault.chainId}:${vault.vaultAddress}`),
      missingPrice: missingPrice
        .filter((vault) => vault.sharesFormatted > 0)
        .map((vault) => `${vault.chainId}:${vault.vaultAddress}`)
    }
  }
}
