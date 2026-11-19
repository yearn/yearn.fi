import type { TWalletHistoryCoverage } from '@/types/holdingsHistory'
import { holdingsConfig } from '../config'
import type { VaultMetadata } from '../types'
import type { CachedTotal } from './cache'
import { checkCacheStaleness, clearUserCache, getCachedTotalsWithTimestamp, saveCachedTotals } from './cache'
import { debugLog, reportHoldingsProgress } from './debug'
import { fetchUserEvents } from './graphql'
import {
  buildPositionTimeline,
  buildPositionTimelineIndex,
  generateDailyTimestamps,
  generateDailyTimestampsFromRange,
  getIndexedShareBalanceAtTimestamp,
  getShareBalanceAtTimestamp,
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
import {
  fetchHistoricalPrices,
  fetchHistoricalPricesForTokenTimestamps,
  getChainPrefix,
  getHistoricalPriceFetchFailedBatches,
  getPriceAtTimestamp,
  type THistoricalPriceRequest
} from './prices'
import {
  getSettledAddressScopedContext,
  getSettledPpsContext,
  resolveSettledAddressScopedContext,
  type TSettledAddressScopedContext,
  type TSettledAddressScopedContextSource
} from './settledHoldingsContext'
import { fetchMultipleVaultsMetadata } from './vaults'

export interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  timeframe: HoldingsHistoryTimeframe
  hasActivity: boolean
  dataPoints: Array<{ date: string; timestamp: number; totalUsdValue: number; coverage?: TWalletHistoryCoverage }>
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
  dataPoints: Array<{ date: string; timestamp: number; value: number; coverage?: TWalletHistoryCoverage }>
}

const ETHEREUM_WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

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
  version: 'all'
  date: string
  timestamp: number
  summary: {
    totalVaults: number
    vaultsWithShares: number
    totalUsdValue: number
    missingMetadata: number
    missingPps: number
    missingPrice: number
    hasIncompleteShares?: true
  }
  vaults: HoldingsBreakdownVaultResponse[]
  issues: {
    missingMetadata: string[]
    missingPps: string[]
    missingPrice: string[]
  }
  message?: string
}

function filterVisibleVaults<
  TVault extends {
    chainId: number
    vaultAddress: string
  }
>(vaults: TVault[], vaultMetadata: Map<string, VaultMetadata>): TVault[] {
  return vaults.filter((vault) => {
    const metadata = vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))
    return !metadata?.isHidden
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

const MAX_HELD_PRICE_RANGE_FILLER_RATIO = 0.15
const MAX_HELD_PRICE_RANGE_FILLER_POINTS = 10_000
const MAX_HELD_PRICE_RANGE_DAYS = 366

export function fillBoundedHeldAssetPriceRanges(requests: THistoricalPriceRequest[]): THistoricalPriceRequest[] {
  const filledRequests = requests.map((request) => {
    const firstTimestamp = request.timestamps[0]
    const lastTimestamp = request.timestamps[request.timestamps.length - 1]
    if (firstTimestamp === undefined || lastTimestamp === undefined) {
      return request
    }

    const rangeDays = Math.floor((lastTimestamp - firstTimestamp) / 86_400) + 1
    const isDailyRange = lastTimestamp >= firstTimestamp && firstTimestamp + (rangeDays - 1) * 86_400 === lastTimestamp
    if (!isDailyRange || rangeDays > MAX_HELD_PRICE_RANGE_DAYS) {
      return request
    }

    return {
      ...request,
      timestamps: Array.from({ length: rangeDays }, (_value, index) => firstTimestamp + index * 86_400)
    }
  })
  const ownedPoints = requests.reduce((total, request) => total + request.timestamps.length, 0)
  const filledPoints = filledRequests.reduce((total, request) => total + request.timestamps.length, 0)
  const fillerPoints = filledPoints - ownedPoints
  const fillerBudget = Math.min(
    MAX_HELD_PRICE_RANGE_FILLER_POINTS,
    Math.floor(ownedPoints * MAX_HELD_PRICE_RANGE_FILLER_RATIO)
  )

  return fillerPoints > 0 && fillerPoints <= fillerBudget ? filledRequests : requests
}

function buildEmptyBreakdownResponse(
  userAddress: string,
  timestamp: number,
  message: string
): HoldingsBreakdownResponse {
  return {
    address: userAddress,
    version: 'all',
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
  timeframe: HoldingsHistoryTimeframe = '1y',
  requestedVaults?: HoldingsVaultFilter[],
  settledContext?: TSettledAddressScopedContextSource,
  loadCacheValidationVaults?: () => Promise<HoldingsVaultFilter[]>,
  includeCoverage = false
): Promise<HoldingsHistoryResponse> {
  const defaultDays = holdingsConfig.historyDays
  const loadSettledContext = (): Promise<TSettledAddressScopedContext> =>
    settledContext
      ? resolveSettledAddressScopedContext(settledContext)
      : getSettledAddressScopedContext({ userAddress })
  const initialContext = typeof settledContext === 'function' ? null : await loadSettledContext()
  const dayTimestamps = generateDailyTimestamps(defaultDays, 1)
  const latestSettledDayTimestamp =
    initialContext?.latestSettledDayTimestamp ?? dayTimestamps[dayTimestamps.length - 1] ?? 0
  const timestamps =
    timeframe === 'all'
      ? generateDailyTimestampsFromRange(holdingsConfig.historyStartTimestamp, latestSettledDayTimestamp)
      : dayTimestamps
  const periodDays = timestamps.length
  debugLog('history', 'starting historical holdings aggregation', {
    timeframe,
    days: periodDays,
    timestamps: timestamps.length,
    latestSettledDate: timestampToDateString(latestSettledDayTimestamp)
  })

  // Fetch cached totals with timestamp info for staleness check
  let cachedTotals: CachedTotal[] = []
  let oldestUpdatedAt: Date | null = null
  const shouldReadCache = timestamps.length > 0 && !requestedVaults?.length
  const shouldWriteCache = timestamps.length > 0 && !requestedVaults?.length
  if (shouldReadCache) {
    const startDate = timestampToDateString(timestamps[0])
    const endDate = timestampToDateString(timestamps[timestamps.length - 1])
    const cachedResult = await getCachedTotalsWithTimestamp(userAddress, startDate, endDate)
    cachedTotals = includeCoverage ? cachedResult.totals.filter((total) => total.verified) : cachedResult.totals
    oldestUpdatedAt = cachedResult.oldestUpdatedAt
  }
  debugLog('history', 'loaded cached totals for request', {
    timeframe,
    cachedTotals: cachedTotals.length,
    oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
  })
  reportHoldingsProgress(28, 'Checked cached historical totals', `${cachedTotals.length} cached days`)

  let cachedByDate = new Map(cachedTotals.map((total) => [total.date, total.usdValue]))
  const coverageByDate = new Map<string, TWalletHistoryCoverage>()
  const pointCoverage = (date: string) =>
    includeCoverage ? { coverage: coverageByDate.get(date) ?? ('complete' as const) } : {}

  const hasInitialFullCacheCoverage =
    timestamps.length > 0 && timestamps.every((timestamp) => cachedByDate.has(timestampToDateString(timestamp)))

  if (typeof settledContext === 'function' && hasInitialFullCacheCoverage && loadCacheValidationVaults) {
    const validationVaults = await loadCacheValidationVaults()
    const canValidateWithoutWalletContext = validationVaults.length > 0
    const isStale = canValidateWithoutWalletContext
      ? await checkCacheStaleness(
          validationVaults.map((vault) => ({ address: vault.vaultAddress, chainId: vault.chainId })),
          oldestUpdatedAt
        )
      : false

    if (isStale) {
      console.log(`[Aggregator] Cache stale for ${userAddress}, clearing and recalculating`)
      await clearUserCache(userAddress)
      cachedTotals = []
      oldestUpdatedAt = null
      cachedByDate = new Map()
    } else if (canValidateWithoutWalletContext) {
      const dataPoints = timestamps.map((timestamp) => ({
        date: timestampToDateString(timestamp),
        timestamp: toSettledDayTimestamp(timestamp),
        totalUsdValue: cachedByDate.get(timestampToDateString(timestamp)) ?? 0,
        ...pointCoverage(timestampToDateString(timestamp))
      }))
      debugLog('history', 'serving validated portfolio history cache before loading wallet context', {
        dataPoints: dataPoints.length,
        validationVaults: validationVaults.length,
        oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
      })
      reportHoldingsProgress(94, 'Loaded cached historical chart data', `${dataPoints.length} chart points`)

      return {
        address: userAddress,
        periodDays,
        timeframe,
        // Daily totals are only persisted after a non-empty wallet timeline is built.
        hasActivity: cachedTotals.length > 0,
        dataPoints
      }
    }
  }

  const baseContext = initialContext ?? (await loadSettledContext())
  reportHoldingsProgress(18, 'Loaded wallet events', null)

  const timeline = baseContext.timeline
  const positionTimelineIndex = buildPositionTimelineIndex(timeline)
  const hasActivity = baseContext.hasActivity
  debugLog('history', 'built position timeline', {
    deposits: baseContext.events.deposits.length,
    withdrawals: baseContext.events.withdrawals.length,
    transfersIn: baseContext.events.transfersIn.length,
    transfersOut: baseContext.events.transfersOut.length,
    timelineEntries: timeline.length
  })
  reportHoldingsProgress(36, 'Built historical position timeline', `${timeline.length} timeline entries`)

  const vaultMetadata = baseContext.vaultMetadata
  const visibleVaults = filterVisibleVaults(baseContext.rawVaultIdentifiers, vaultMetadata)
  const vaults = filterVaultsByRequestedVault(visibleVaults, requestedVaults)
  debugLog('history', 'resolved visible vaults for history', {
    rawVaults: baseContext.rawVaultIdentifiers.length,
    filteredVaults: vaults.length,
    metadataResolved: vaultMetadata.size
  })
  reportHoldingsProgress(44, 'Resolved vault metadata', `${vaults.length} vaults`)

  // Check if any vaults have been invalidated since cache was written
  if (shouldReadCache && cachedTotals.length > 0 && vaults.length > 0) {
    const vaultIdentifiers = vaults.map((v) => ({ address: v.vaultAddress, chainId: v.chainId }))
    const isStale = await checkCacheStaleness(vaultIdentifiers, oldestUpdatedAt)
    debugLog('history', 'completed cache staleness check', {
      vaults: vaultIdentifiers.length,
      isStale
    })

    if (isStale) {
      console.log(`[Aggregator] Cache stale for ${userAddress}, clearing and recalculating`)
      await clearUserCache(userAddress)
      cachedTotals = []
      oldestUpdatedAt = null
      cachedByDate = new Map()
    }
  }

  const hasFullCacheCoverage =
    timestamps.length > 0 && timestamps.every((timestamp) => cachedByDate.has(timestampToDateString(timestamp)))

  if (hasFullCacheCoverage) {
    const dataPoints = timestamps.map((timestamp) => ({
      date: timestampToDateString(timestamp),
      timestamp: toSettledDayTimestamp(timestamp),
      totalUsdValue: cachedByDate.get(timestampToDateString(timestamp)) ?? 0,
      ...pointCoverage(timestampToDateString(timestamp))
    }))
    debugLog('history', 'serving fully cached historical holdings', {
      dataPoints: dataPoints.length,
      oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
    })
    reportHoldingsProgress(94, 'Loaded cached historical chart data', `${dataPoints.length} chart points`)

    return {
      address: userAddress,
      periodDays,
      timeframe,
      hasActivity,
      dataPoints
    }
  }

  const missingTimestamps = timestamps.filter((ts) => !cachedByDate.has(timestampToDateString(ts)))
  debugLog('history', 'computed missing timestamps', {
    cachedDates: cachedByDate.size,
    missingTimestamps: missingTimestamps.length
  })
  reportHoldingsProgress(52, 'Computed missing historical days', `${missingTimestamps.length} days need valuation`)

  const newTotals: CachedTotal[] = []
  const upstreamFailures = {
    priceBatches: 0,
    ppsVaults: 0
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
        dataPoints: timestamps.map((ts) => ({
          date: timestampToDateString(ts),
          timestamp: toSettledDayTimestamp(ts),
          totalUsdValue: 0,
          ...pointCoverage(timestampToDateString(ts))
        }))
      }
    } else if (vaults.length === 0) {
      debugLog('history', 'no visible vaults matched the request, returning zero holdings history')
      return {
        address: userAddress,
        periodDays,
        timeframe,
        hasActivity,
        dataPoints: timestamps.map((ts) => ({
          date: timestampToDateString(ts),
          timestamp: toSettledDayTimestamp(ts),
          totalUsdValue: 0,
          ...pointCoverage(timestampToDateString(ts))
        }))
      }
    } else {
      const ppsContext = await getSettledPpsContext({
        userAddress,
        ...(requestedVaults === undefined ? {} : { vaultIdentifiers: vaults }),
        context: baseContext
      })
      upstreamFailures.ppsVaults = getPpsFetchFailedVaults(ppsContext.ppsData)
      reportHoldingsProgress(62, 'Loaded vault share price history', `${vaults.length} vaults`)
      const valuationTimestamps = missingTimestamps.map((timestamp) => toSettledDayTimestamp(timestamp))
      const basePriceRequests = buildHeldAssetPriceRequests({
        vaults,
        vaultMetadata,
        positionTimelineIndex,
        timestamps: valuationTimestamps
      })
      const priceRequests = fillBoundedHeldAssetPriceRanges(
        expandNestedVaultAssetPriceRequests(basePriceRequests, vaultMetadata)
      )
      const fetchedPriceData = await fetchHistoricalPricesForTokenTimestamps(priceRequests)
      upstreamFailures.priceBatches = getHistoricalPriceFetchFailedBatches(fetchedPriceData)
      reportHoldingsProgress(76, 'Fetched historical token prices', `${priceRequests.length} price series`)
      const priceData = deriveNestedVaultAssetPriceData({
        priceData: fetchedPriceData,
        priceRequests,
        vaultMetadata,
        ppsData: ppsContext.ppsData,
        underlyingPriceLookup: 'exact',
        requirePriorPps: includeCoverage
      })
      debugLog('history', 'resolved metadata and PPS for history', {
        vaults: ppsContext.ppsIdentifiers.length,
        metadataResolved: vaultMetadata.size,
        ppsResolved: ppsContext.ppsData.size,
        emptyPpsTimelines: Array.from(ppsContext.ppsData.values()).filter((timeline) => timeline.size === 0).length
      })
      debugLog('history', 'resolved historical token prices', {
        tokens: priceRequests.length,
        priceKeys: priceData.size,
        missingTimestamps: missingTimestamps.length,
        failedPriceBatches: upstreamFailures.priceBatches
      })

      missingTimestamps.forEach((timestamp) => {
        const valuationTimestamp = toSettledDayTimestamp(timestamp)
        const day = { value: 0, held: 0, valued: 0 }
        vaults.forEach((vault) => {
          const shares = getIndexedShareBalanceAtTimestamp(
            positionTimelineIndex,
            vault.vaultAddress,
            vault.chainId,
            valuationTimestamp,
            includeCoverage
          )
          if (shares === 0n) return
          day.held += 1
          const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
          const metadata = vaultMetadata.get(vaultKey)
          if (!metadata || shares < 0n) return
          const ppsMap = ppsContext.ppsData.get(vaultKey)
          const pps = ppsMap ? getPPS(ppsMap, valuationTimestamp, includeCoverage) : null
          const priceKey = `${getChainPrefix(metadata.chainId)}:${metadata.token.address.toLowerCase()}`
          const tokenPrice = priceData.get(priceKey)?.get(valuationTimestamp)
          if (!pps || pps <= 0 || !tokenPrice || tokenPrice <= 0) return
          const usdValue = (Number(shares) / 10 ** metadata.decimals) * pps * tokenPrice
          if (!Number.isFinite(usdValue)) return
          day.value += usdValue
          day.valued += 1
        })
        const date = timestampToDateString(timestamp)
        const isComplete = day.held === day.valued
        if (includeCoverage && !isComplete) {
          coverageByDate.set(date, day.valued > 0 ? 'partial' : 'unavailable')
        }
        newTotals.push({
          date,
          usdValue: day.value,
          ...(includeCoverage && isComplete ? { verified: true as const } : {})
        })
      })

      debugLog('history', 'calculated uncached daily totals', {
        newTotals: newTotals.length,
        nonZeroTotals: newTotals.filter((total) => total.usdValue > 0).length
      })
      reportHoldingsProgress(88, 'Calculated uncached chart history', `${newTotals.length} daily totals`)
    }

    const eligibleTotals = includeCoverage ? newTotals.filter((total) => total.verified) : newTotals
    if (
      shouldWriteCache &&
      eligibleTotals.length > 0 &&
      upstreamFailures.priceBatches === 0 &&
      upstreamFailures.ppsVaults === 0
    ) {
      const savedTotals = await saveCachedTotals(userAddress, eligibleTotals)
      debugLog(
        'history',
        savedTotals ? 'saved recalculated totals to cache' : 'did not save recalculated totals to cache',
        {
          newTotals: newTotals.length
        }
      )
      reportHoldingsProgress(
        92,
        savedTotals ? 'Saved historical chart cache' : 'Skipped historical chart cache save',
        `${newTotals.length} daily totals`
      )
    } else if (
      shouldWriteCache &&
      newTotals.length > 0 &&
      (upstreamFailures.priceBatches > 0 || upstreamFailures.ppsVaults > 0)
    ) {
      debugLog('history', 'skipped historical totals cache save because upstream valuation data failed', {
        newTotals: newTotals.length,
        failedPriceBatches: upstreamFailures.priceBatches,
        failedPpsVaults: upstreamFailures.ppsVaults
      })
      reportHoldingsProgress(
        92,
        'Skipped historical chart cache save',
        `${upstreamFailures.priceBatches + upstreamFailures.ppsVaults} upstream fetches failed`
      )
    }
  }

  // Merge cached and new totals
  for (const total of newTotals) {
    cachedByDate.set(total.date, total.usdValue)
  }

  const dataPoints = timestamps.map((ts) => ({
    date: timestampToDateString(ts),
    timestamp: toSettledDayTimestamp(ts),
    totalUsdValue: cachedByDate.get(timestampToDateString(ts)) ?? 0,
    ...pointCoverage(timestampToDateString(ts))
  }))
  debugLog('history', 'completed historical holdings aggregation', {
    dataPoints: dataPoints.length,
    nonZeroPoints: dataPoints.filter((point) => point.totalUsdValue > 0).length
  })
  reportHoldingsProgress(96, 'Prepared historical chart data', `${dataPoints.length} chart points`)

  return {
    address: userAddress,
    periodDays,
    timeframe,
    hasActivity,
    dataPoints
  }
}

export async function getHistoricalHoldingsChart(
  userAddress: string,
  denomination: HoldingsHistoryDenomination = 'usd',
  timeframe: HoldingsHistoryTimeframe = '1y',
  requestedVaults?: HoldingsVaultFilter[],
  settledContext?: TSettledAddressScopedContextSource,
  loadCacheValidationVaults?: () => Promise<HoldingsVaultFilter[]>,
  includeCoverage = false
): Promise<HoldingsHistoryChartResponse> {
  const holdings = await getHistoricalHoldings(
    userAddress,
    timeframe,
    requestedVaults,
    settledContext,
    loadCacheValidationVaults,
    includeCoverage
  )

  if (denomination === 'usd') {
    return {
      address: holdings.address,
      periodDays: holdings.periodDays,
      timeframe: holdings.timeframe,
      denomination,
      hasActivity: holdings.hasActivity,
      dataPoints: holdings.dataPoints.map((point) => ({
        date: point.date,
        timestamp: point.timestamp,
        value: point.totalUsdValue,
        ...(point.coverage ? { coverage: point.coverage } : {})
      }))
    }
  }

  const timestamps = holdings.dataPoints.map((point) => point.timestamp)
  const ethPriceMap = await fetchHistoricalPrices([{ chainId: 1, address: ETHEREUM_WETH_ADDRESS }], timestamps)
  const ethPrices = ethPriceMap.get(`${getChainPrefix(1)}:${ETHEREUM_WETH_ADDRESS.toLowerCase()}`)

  return {
    address: holdings.address,
    periodDays: holdings.periodDays,
    timeframe: holdings.timeframe,
    denomination,
    hasActivity: holdings.hasActivity,
    dataPoints: holdings.dataPoints.map((point) => {
      const ethPriceUsd = includeCoverage
        ? (ethPrices?.get(point.timestamp) ?? 0)
        : ethPrices
          ? getPriceAtTimestamp(ethPrices, point.timestamp)
          : 0
      const coverage = includeCoverage && point.totalUsdValue > 0 && !(ethPriceUsd > 0) ? 'unavailable' : point.coverage
      return {
        date: point.date,
        timestamp: point.timestamp,
        value: ethPriceUsd > 0 ? point.totalUsdValue / ethPriceUsd : 0,
        ...(coverage ? { coverage } : {})
      }
    })
  }
}

export async function getHoldingsBreakdown(
  userAddress: string,
  targetTimestamp?: number
): Promise<HoldingsBreakdownResponse> {
  const context = targetTimestamp === undefined ? await getSettledAddressScopedContext({ userAddress }) : null
  const breakdownDayTimestamp = targetTimestamp ?? context!.latestSettledDayTimestamp
  const breakdownTimestamp = toSettledDayTimestamp(breakdownDayTimestamp)
  const breakdownDate = timestampToDateString(breakdownTimestamp)
  const breakdownPriceTimestamp = breakdownTimestamp
  debugLog('breakdown', 'starting holdings breakdown', {
    timestamp: breakdownTimestamp,
    date: breakdownDate,
    priceTimestamp: breakdownPriceTimestamp
  })

  const maxTimestamp = breakdownDayTimestamp + 86400
  const events = context?.events ?? (await fetchUserEvents(userAddress, maxTimestamp))
  const timeline =
    context?.timeline ??
    buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
  debugLog('breakdown', 'built position timeline for breakdown', {
    deposits: events.deposits.length,
    withdrawals: events.withdrawals.length,
    transfersIn: events.transfersIn.length,
    transfersOut: events.transfersOut.length,
    timelineEntries: timeline.length
  })

  if (timeline.length === 0) {
    debugLog('breakdown', 'no events found for holdings breakdown')
    return buildEmptyBreakdownResponse(userAddress, breakdownTimestamp, 'No events found')
  }

  const rawVaults = context?.rawVaultIdentifiers ?? getUniqueVaults(timeline)
  const vaultMetadata =
    context?.vaultMetadata ?? (await resolveNestedVaultAssetMetadata(await fetchMultipleVaultsMetadata(rawVaults)))
  const vaults = filterVisibleVaults(rawVaults, vaultMetadata)
  debugLog('breakdown', 'resolved visible vaults for breakdown', {
    rawVaults: rawVaults.length,
    filteredVaults: vaults.length,
    metadataResolved: vaultMetadata.size
  })

  if (vaults.length === 0) {
    debugLog('breakdown', 'no visible vaults found for breakdown')
    return buildEmptyBreakdownResponse(userAddress, breakdownTimestamp, 'No matching holdings found')
  }

  const positionIndex = context ? buildPositionTimelineIndex(timeline) : null
  const positions = vaults.map((vault) => {
    const shares = positionIndex
      ? getIndexedShareBalanceAtTimestamp(positionIndex, vault.vaultAddress, vault.chainId, breakdownTimestamp, true)
      : getShareBalanceAtTimestamp(timeline, vault.vaultAddress, vault.chainId, breakdownTimestamp)
    const decimals = vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))?.decimals ?? 18
    return { ...vault, shares, sharesFormatted: Number(shares) / 10 ** decimals }
  })
  const activeVaults = positions.filter((vault) => vault.shares > 0n)
  const hasIncompleteShares = positions.some((vault) => vault.shares < 0n)

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
    ppsIdentifiers.length === 0 ? Promise.resolve(new Map()) : fetchMultipleVaultsPPS(ppsIdentifiers),
    priceRequests.length > 0 ? fetchHistoricalPricesForTokenTimestamps(priceRequests) : Promise.resolve(new Map())
  ])
  const priceData = deriveNestedVaultAssetPriceData({
    priceData: fetchedPriceData,
    priceRequests,
    vaultMetadata,
    ppsData,
    ...(context ? { underlyingPriceLookup: 'exact', requirePriorPps: true } : {})
  })
  debugLog('breakdown', 'resolved metadata, PPS, and prices for breakdown', {
    vaults: ppsIdentifiers.length,
    metadataResolved: vaultMetadata.size,
    ppsResolved: ppsData.size,
    tokens: priceRequests.length,
    priceKeys: priceData.size,
    timestamp: breakdownTimestamp,
    priceTimestamp: breakdownPriceTimestamp,
    activeVaults: activeVaults.length
  })

  const results: HoldingsBreakdownVaultResponse[] = []

  for (const vault of activeVaults) {
    const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
    const metadata = vaultMetadata.get(vaultKey)
    const ppsMap = ppsData.get(vaultKey)
    const pps = ppsMap ? getPPS(ppsMap, breakdownTimestamp, Boolean(context)) : null

    let tokenPrice: number | null = null
    let usdValue: number | null = null

    if (metadata) {
      const priceKey = `${getChainPrefix(metadata.chainId)}:${metadata.token.address.toLowerCase()}`
      const tokenPriceMap = priceData.get(priceKey)
      tokenPrice = context
        ? (tokenPriceMap?.get(breakdownPriceTimestamp) ?? 0)
        : tokenPriceMap
          ? getPriceAtTimestamp(tokenPriceMap, breakdownPriceTimestamp)
          : 0
      usdValue = pps ? vault.sharesFormatted * pps * tokenPrice : 0
    }

    let status: HoldingsBreakdownVaultResponse['status'] = 'ok'
    if (!metadata) {
      status = 'missing_metadata'
    } else if (!pps || !Number.isFinite(pps) || pps <= 0) {
      status = 'missing_pps'
    } else if (!tokenPrice || tokenPrice <= 0 || !Number.isFinite(usdValue)) {
      status = 'missing_price'
    }

    results.push({
      chainId: vault.chainId,
      vaultAddress: vault.vaultAddress,
      shares: vault.shares.toString(),
      sharesFormatted: vault.sharesFormatted,
      pricePerShare: pps,
      tokenPrice,
      usdValue: status === 'ok' ? usdValue : null,
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
    version: 'all',
    date: breakdownDate,
    timestamp: breakdownTimestamp,
    summary: {
      totalVaults: vaults.length,
      vaultsWithShares: withShares.length,
      totalUsdValue,
      missingMetadata: missingMetadata.length,
      missingPps: missingPps.length,
      missingPrice: missingPrice.length,
      ...(hasIncompleteShares ? { hasIncompleteShares: true as const } : {})
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
