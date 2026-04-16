import { config } from '../config'
import type { VaultMetadata } from '../types'
import type { CachedTotal } from './cache'
import { checkCacheStaleness, clearUserCache, getCachedTotalsWithTimestamp, saveCachedTotals } from './cache'
import { debugLog } from './debug'
import { fetchHistoricalPrices, getChainPrefix, getPriceAtTimestamp } from './defillama'
import {
  fetchUserEvents,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  type VaultVersion
} from './graphql'
import {
  buildPositionTimeline,
  generateDailyTimestamps,
  generateDailyTimestampsFromRange,
  getShareBalanceAtTimestamp,
  getUniqueVaults,
  timestampToDateString
} from './holdings'
import { fetchMultipleVaultsPPS, getPPS } from './kong'
import { toVaultKey } from './pnlShared'
import { fetchMultipleVaultsMetadata } from './vaults'

export interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  timeframe: HoldingsHistoryTimeframe
  dataPoints: Array<{ date: string; timestamp: number; totalUsdValue: number }>
}

export type HoldingsHistoryDenomination = 'usd' | 'eth'
export type HoldingsHistoryTimeframe = '1y' | 'all'

export interface HoldingsHistoryChartResponse {
  address: string
  periodDays: number
  timeframe: HoldingsHistoryTimeframe
  denomination: HoldingsHistoryDenomination
  dataPoints: Array<{ date: string; timestamp: number; value: number }>
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
  timeframe: HoldingsHistoryTimeframe = '1y'
): Promise<HoldingsHistoryResponse> {
  const defaultDays = config.historyDays
  const defaultTimestamps = generateDailyTimestamps(defaultDays, 1)
  const latestSettledTimestamp = defaultTimestamps[defaultTimestamps.length - 1]
  let timestamps = timeframe === 'all' ? [] : defaultTimestamps
  let periodDays = defaultDays
  debugLog('history', 'starting historical holdings aggregation', {
    version,
    fetchType,
    paginationMode,
    timeframe,
    days: periodDays,
    timestamps: timestamps.length,
    latestSettledDate: timestampToDateString(latestSettledTimestamp)
  })

  // Fetch cached totals with timestamp info for staleness check
  let cachedTotals: CachedTotal[] = []
  let oldestUpdatedAt: Date | null = null
  if (timeframe !== 'all') {
    const startDate = timestampToDateString(timestamps[0])
    const endDate = timestampToDateString(timestamps[timestamps.length - 1])
    const cachedResult = await getCachedTotalsWithTimestamp(userAddress, version, startDate, endDate)
    cachedTotals = cachedResult.totals
    oldestUpdatedAt = cachedResult.oldestUpdatedAt
  }
  debugLog('history', 'loaded cached totals for request', {
    version,
    timeframe,
    cachedTotals: cachedTotals.length,
    oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
  })

  const cachedByDate = new Map(cachedTotals.map((total) => [total.date, total.usdValue]))
  const hasFullCacheCoverage =
    timestamps.length > 0 && timestamps.every((timestamp) => cachedByDate.has(timestampToDateString(timestamp)))

  if (hasFullCacheCoverage) {
    const dataPoints = timestamps.map((timestamp) => ({
      date: timestampToDateString(timestamp),
      timestamp,
      totalUsdValue: cachedByDate.get(timestampToDateString(timestamp)) ?? 0
    }))
    debugLog('history', 'serving fully cached historical holdings', {
      version,
      dataPoints: dataPoints.length,
      oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
    })

    return {
      address: userAddress,
      periodDays,
      timeframe,
      dataPoints
    }
  }

  // Always fetch the full event set, then filter vaults by authoritative Kong metadata version.
  const maxTimestamp = latestSettledTimestamp + 86400
  const events = await fetchUserEvents(userAddress, 'all', maxTimestamp, fetchType, paginationMode)
  const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
  debugLog('history', 'built position timeline', {
    fetchType,
    paginationMode,
    deposits: events.deposits.length,
    withdrawals: events.withdrawals.length,
    transfersIn: events.transfersIn.length,
    transfersOut: events.transfersOut.length,
    timelineEntries: timeline.length
  })

  if (timeframe === 'all' && timeline.length > 0) {
    const firstEventTimestamp = timeline[0]?.blockTimestamp ?? timestamps[0]
    const allTimestamps = generateDailyTimestampsFromRange(firstEventTimestamp, latestSettledTimestamp)

    if (allTimestamps.length > 0) {
      timestamps = allTimestamps
      periodDays = allTimestamps.length
    }
  }

  const rawVaults = timeline.length > 0 ? getUniqueVaults(timeline) : []
  const vaultMetadata = rawVaults.length > 0 ? await fetchMultipleVaultsMetadata(rawVaults) : new Map()
  const vaults = filterVaultsByAuthoritativeVersion(rawVaults, vaultMetadata, version)
  debugLog('history', 'resolved authoritative vault versions for history', {
    version,
    fetchType,
    paginationMode,
    rawVaults: rawVaults.length,
    filteredVaults: vaults.length,
    metadataResolved: vaultMetadata.size
  })

  // Check if any vaults have been invalidated since cache was written
  if (cachedTotals.length > 0 && vaults.length > 0) {
    const vaultIdentifiers = vaults.map((v) => ({ address: v.vaultAddress, chainId: v.chainId }))
    const isStale = await checkCacheStaleness(vaultIdentifiers, oldestUpdatedAt)
    debugLog('history', 'completed cache staleness check', {
      version,
      fetchType,
      paginationMode,
      vaults: vaultIdentifiers.length,
      isStale
    })

    if (isStale) {
      console.log(`[Aggregator] Cache stale for ${userAddress}, clearing and recalculating`)
      await clearUserCache(userAddress, version)
      cachedTotals = []
      oldestUpdatedAt = null
    }
  }

  const missingTimestamps = timestamps.filter((ts) => !cachedByDate.has(timestampToDateString(ts)))
  debugLog('history', 'computed missing timestamps', {
    fetchType,
    paginationMode,
    cachedDates: cachedByDate.size,
    missingTimestamps: missingTimestamps.length
  })

  const newTotals: CachedTotal[] = []

  if (missingTimestamps.length > 0) {
    // Events already fetched above

    if (timeline.length === 0) {
      debugLog('history', 'timeline empty, returning zero holdings history')
      // No holdings - return zeros without caching to prevent DB spam
      return {
        address: userAddress,
        periodDays,
        timeframe,
        dataPoints: timestamps.map((ts) => ({
          date: timestampToDateString(ts),
          timestamp: ts,
          totalUsdValue: 0
        }))
      }
    } else if (vaults.length === 0) {
      debugLog('history', 'no vaults matched the requested authoritative version, returning zero holdings history', {
        version,
        fetchType,
        paginationMode
      })
      return {
        address: userAddress,
        periodDays,
        timeframe,
        dataPoints: timestamps.map((ts) => ({
          date: timestampToDateString(ts),
          timestamp: ts,
          totalUsdValue: 0
        }))
      }
    } else {
      const ppsData = await fetchMultipleVaultsPPS(vaults)
      debugLog('history', 'resolved metadata and PPS for history', {
        version,
        fetchType,
        paginationMode,
        vaults: vaults.length,
        metadataResolved: vaultMetadata.size,
        ppsResolved: ppsData.size,
        emptyPpsTimelines: Array.from(ppsData.values()).filter((timeline) => timeline.size === 0).length
      })

      const seenTokens = new Set<string>()
      const underlyingTokens: Array<{ chainId: number; address: string }> = []
      for (const vault of vaults) {
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

      const priceData = await fetchHistoricalPrices(underlyingTokens, missingTimestamps)
      debugLog('history', 'resolved historical token prices', {
        version,
        fetchType,
        paginationMode,
        tokens: underlyingTokens.length,
        priceKeys: priceData.size,
        missingTimestamps: missingTimestamps.length
      })

      for (const timestamp of missingTimestamps) {
        let dayTotal = 0

        for (const vault of vaults) {
          const vaultKey = `${vault.chainId}:${vault.vaultAddress}`
          const metadata = vaultMetadata.get(vaultKey)

          if (!metadata) continue

          const shares = getShareBalanceAtTimestamp(timeline, vault.vaultAddress, vault.chainId, timestamp)

          if (shares === BigInt(0)) continue

          const ppsMap = ppsData.get(vaultKey)
          const pps = ppsMap ? getPPS(ppsMap, timestamp) : null

          if (pps === null) continue

          const priceKey = `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}`
          const tokenPriceMap = priceData.get(priceKey)
          const tokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, timestamp) : 0

          const sharesFloat = Number(shares) / 10 ** metadata.decimals
          const usdValue = sharesFloat * pps * tokenPrice

          dayTotal += usdValue
        }

        newTotals.push({ date: timestampToDateString(timestamp), usdValue: dayTotal })
      }

      debugLog('history', 'calculated uncached daily totals', {
        version,
        fetchType,
        paginationMode,
        newTotals: newTotals.length,
        nonZeroTotals: newTotals.filter((total) => total.usdValue > 0).length
      })
    }

    if (newTotals.length > 0) {
      await saveCachedTotals(userAddress, version, newTotals)
      debugLog('history', 'saved recalculated totals to cache', {
        version,
        fetchType,
        paginationMode,
        newTotals: newTotals.length
      })
    }
  }

  // Merge cached and new totals
  for (const total of newTotals) {
    cachedByDate.set(total.date, total.usdValue)
  }

  const dataPoints = timestamps.map((ts) => ({
    date: timestampToDateString(ts),
    timestamp: ts,
    totalUsdValue: cachedByDate.get(timestampToDateString(ts)) ?? 0
  }))
  debugLog('history', 'completed historical holdings aggregation', {
    version,
    fetchType,
    paginationMode,
    dataPoints: dataPoints.length,
    nonZeroPoints: dataPoints.filter((point) => point.totalUsdValue > 0).length
  })

  return {
    address: userAddress,
    periodDays,
    timeframe,
    dataPoints
  }
}

export async function getHistoricalHoldingsChart(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged',
  denomination: HoldingsHistoryDenomination = 'usd',
  timeframe: HoldingsHistoryTimeframe = '1y'
): Promise<HoldingsHistoryChartResponse> {
  const holdings = await getHistoricalHoldings(userAddress, version, fetchType, paginationMode, timeframe)

  if (denomination === 'usd') {
    return {
      address: holdings.address,
      periodDays: holdings.periodDays,
      timeframe: holdings.timeframe,
      denomination,
      dataPoints: holdings.dataPoints.map((point) => ({
        date: point.date,
        timestamp: point.timestamp,
        value: point.totalUsdValue
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
    dataPoints: holdings.dataPoints.map((point) => {
      const ethPriceUsd = ethPrices ? getPriceAtTimestamp(ethPrices, point.timestamp) : 0
      return {
        date: point.date,
        timestamp: point.timestamp,
        value: ethPriceUsd > 0 ? point.totalUsdValue / ethPriceUsd : 0
      }
    })
  }
}

export async function getHoldingsBreakdown(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged',
  targetTimestamp?: number
): Promise<HoldingsBreakdownResponse> {
  const timestamps = generateDailyTimestamps(config.historyDays, 1)
  const breakdownTimestamp = targetTimestamp ?? timestamps[timestamps.length - 1]
  const breakdownDate = timestampToDateString(breakdownTimestamp)
  debugLog('breakdown', 'starting holdings breakdown', {
    version,
    fetchType,
    paginationMode,
    timestamp: breakdownTimestamp,
    date: breakdownDate
  })

  const maxTimestamp = breakdownTimestamp + 86400
  const events = await fetchUserEvents(userAddress, 'all', maxTimestamp, fetchType, paginationMode)
  const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
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
  const vaultMetadata = rawVaults.length > 0 ? await fetchMultipleVaultsMetadata(rawVaults) : new Map()
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

  const ppsData = await fetchMultipleVaultsPPS(vaults)
  const seenTokens = new Set<string>()
  const underlyingTokens: Array<{ chainId: number; address: string }> = []
  for (const vault of vaults) {
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

  const priceData =
    underlyingTokens.length > 0 ? await fetchHistoricalPrices(underlyingTokens, [breakdownTimestamp]) : new Map()
  debugLog('breakdown', 'resolved metadata, PPS, and prices for breakdown', {
    version,
    fetchType,
    paginationMode,
    vaults: vaults.length,
    metadataResolved: vaultMetadata.size,
    ppsResolved: ppsData.size,
    tokens: underlyingTokens.length,
    priceKeys: priceData.size,
    timestamp: breakdownTimestamp
  })

  const results: HoldingsBreakdownVaultResponse[] = []

  for (const vault of vaults) {
    const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
    const metadata = vaultMetadata.get(vaultKey)
    const shares = getShareBalanceAtTimestamp(timeline, vault.vaultAddress, vault.chainId, breakdownTimestamp)
    const ppsMap = ppsData.get(vaultKey)
    const pps = ppsMap ? getPPS(ppsMap, breakdownTimestamp) : null
    const decimals = metadata?.decimals ?? 18
    const sharesFormatted = Number(shares) / 10 ** decimals

    let tokenPrice: number | null = null
    let usdValue: number | null = null

    if (metadata) {
      const priceKey = `${getChainPrefix(metadata.chainId)}:${metadata.token.address.toLowerCase()}`
      const tokenPriceMap = priceData.get(priceKey)
      tokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, breakdownTimestamp) : 0
      usdValue = pps ? sharesFormatted * pps * tokenPrice : 0
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
      shares: shares.toString(),
      sharesFormatted,
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
