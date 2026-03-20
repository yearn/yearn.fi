import { config } from '../config'
import type { CachedTotal } from './cache'
import { checkCacheStaleness, clearUserCache, getCachedTotalsWithTimestamp, saveCachedTotals } from './cache'
import { debugLog } from './debug'
import { fetchHistoricalPrices, getChainPrefix, getPriceAtTimestamp } from './defillama'
import { fetchUserEvents, type VaultVersion } from './graphql'
import {
  buildPositionTimeline,
  generateDailyTimestamps,
  getShareBalanceAtTimestamp,
  getUniqueVaults,
  timestampToDateString
} from './holdings'
import { fetchMultipleVaultsPPS, getPPS } from './kong'
import { fetchMultipleVaultsMetadata } from './vaults'

export interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  dataPoints: Array<{ date: string; timestamp: number; totalUsdValue: number }>
}

export async function getHistoricalHoldings(
  userAddress: string,
  version: VaultVersion = 'all'
): Promise<HoldingsHistoryResponse> {
  const days = config.historyDays
  const timestamps = generateDailyTimestamps(days)
  const startDate = timestampToDateString(timestamps[0])
  const endDate = timestampToDateString(timestamps[timestamps.length - 1])
  const todayDate = timestampToDateString(Math.floor(Date.now() / 1000))
  debugLog('history', 'starting historical holdings aggregation', {
    version,
    days,
    timestamps: timestamps.length,
    startDate,
    endDate
  })

  // Fetch cached totals with timestamp info for staleness check
  let { totals: cachedTotals, oldestUpdatedAt } = await getCachedTotalsWithTimestamp(userAddress, startDate, endDate)
  debugLog('history', 'loaded cached totals for request', {
    cachedTotals: cachedTotals.length,
    oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
  })

  // Always fetch user events (needed for staleness check)
  const maxTimestamp = Math.max(...timestamps) + 86400
  const events = await fetchUserEvents(userAddress, version, maxTimestamp)
  const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
  debugLog('history', 'built position timeline', {
    deposits: events.deposits.length,
    withdrawals: events.withdrawals.length,
    transfersIn: events.transfersIn.length,
    transfersOut: events.transfersOut.length,
    timelineEntries: timeline.length
  })

  // Check if any vaults have been invalidated since cache was written
  if (cachedTotals.length > 0 && timeline.length > 0) {
    const vaults = getUniqueVaults(timeline)
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
    }
  }

  const cachedByDate = new Map(cachedTotals.map((t) => [t.date, t.usdValue]))

  // Always recalculate today (Kong/DefiLlama may not have today's data early in the day)
  const missingTimestamps = timestamps.filter(
    (ts) => !cachedByDate.has(timestampToDateString(ts)) || timestampToDateString(ts) === todayDate
  )
  debugLog('history', 'computed missing timestamps', {
    cachedDates: cachedByDate.size,
    missingTimestamps: missingTimestamps.length,
    alwaysRecomputedToday: true
  })

  const newTotals: CachedTotal[] = []

  if (missingTimestamps.length > 0) {
    // Events already fetched above

    if (timeline.length === 0) {
      debugLog('history', 'timeline empty, returning zero holdings history')
      // No holdings - return zeros without caching to prevent DB spam
      return {
        address: userAddress,
        periodDays: days,
        dataPoints: timestamps.map((ts) => ({
          date: timestampToDateString(ts),
          timestamp: ts,
          totalUsdValue: 0
        }))
      }
    } else {
      const vaults = getUniqueVaults(timeline)
      const vaultMetadata = await fetchMultipleVaultsMetadata(vaults)
      const ppsData = await fetchMultipleVaultsPPS(vaults)
      debugLog('history', 'resolved metadata and PPS for history', {
        vaults: vaults.length,
        metadataResolved: vaultMetadata.size,
        ppsResolved: ppsData.size,
        emptyPpsTimelines: Array.from(ppsData.values()).filter((timeline) => timeline.size === 0).length
      })

      const seenTokens = new Set<string>()
      const underlyingTokens: Array<{ chainId: number; address: string }> = []
      for (const [_key, metadata] of vaultMetadata) {
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
        newTotals: newTotals.length,
        nonZeroTotals: newTotals.filter((total) => total.usdValue > 0).length
      })
    }

    if (newTotals.length > 0) {
      await saveCachedTotals(userAddress, newTotals)
      debugLog('history', 'saved recalculated totals to cache', { newTotals: newTotals.length })
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
    dataPoints: dataPoints.length,
    nonZeroPoints: dataPoints.filter((point) => point.totalUsdValue > 0).length
  })

  return {
    address: userAddress,
    periodDays: days,
    dataPoints
  }
}
