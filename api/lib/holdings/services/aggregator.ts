import { config } from '../config'
import type { VaultMetadata } from '../types'
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
import { toVaultKey } from './pnlShared'
import { fetchMultipleVaultsMetadata } from './vaults'

export interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  dataPoints: Array<{ date: string; timestamp: number; totalUsdValue: number }>
}

function filterVaultsByAuthoritativeVersion<
  TVault extends {
    chainId: number
    vaultAddress: string
  }
>(vaults: TVault[], vaultMetadata: Map<string, VaultMetadata>, version: VaultVersion): TVault[] {
  if (version === 'all') {
    return vaults
  }

  return vaults.filter((vault) => vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))?.version === version)
}

export async function getHistoricalHoldings(
  userAddress: string,
  version: VaultVersion = 'all'
): Promise<HoldingsHistoryResponse> {
  const days = config.historyDays
  const timestamps = generateDailyTimestamps(days, 1)
  const startDate = timestampToDateString(timestamps[0])
  const endDate = timestampToDateString(timestamps[timestamps.length - 1])
  debugLog('history', 'starting historical holdings aggregation', {
    version,
    days,
    timestamps: timestamps.length,
    startDate,
    endDate
  })

  // Fetch cached totals with timestamp info for staleness check
  let { totals: cachedTotals, oldestUpdatedAt } = await getCachedTotalsWithTimestamp(
    userAddress,
    version,
    startDate,
    endDate
  )
  debugLog('history', 'loaded cached totals for request', {
    version,
    cachedTotals: cachedTotals.length,
    oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
  })

  const cachedByDate = new Map(cachedTotals.map((total) => [total.date, total.usdValue]))
  const hasFullCacheCoverage = timestamps.every((timestamp) => cachedByDate.has(timestampToDateString(timestamp)))

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
      periodDays: days,
      dataPoints
    }
  }

  // Always fetch the full event set, then filter vaults by authoritative Kong metadata version.
  const maxTimestamp = Math.max(...timestamps) + 86400
  const events = await fetchUserEvents(userAddress, 'all', maxTimestamp)
  const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
  debugLog('history', 'built position timeline', {
    deposits: events.deposits.length,
    withdrawals: events.withdrawals.length,
    transfersIn: events.transfersIn.length,
    transfersOut: events.transfersOut.length,
    timelineEntries: timeline.length
  })

  const rawVaults = timeline.length > 0 ? getUniqueVaults(timeline) : []
  const vaultMetadata = rawVaults.length > 0 ? await fetchMultipleVaultsMetadata(rawVaults) : new Map()
  const vaults = filterVaultsByAuthoritativeVersion(rawVaults, vaultMetadata, version)
  debugLog('history', 'resolved authoritative vault versions for history', {
    version,
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
        periodDays: days,
        dataPoints: timestamps.map((ts) => ({
          date: timestampToDateString(ts),
          timestamp: ts,
          totalUsdValue: 0
        }))
      }
    } else if (vaults.length === 0) {
      debugLog('history', 'no vaults matched the requested authoritative version, returning zero holdings history', {
        version
      })
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
      const ppsData = await fetchMultipleVaultsPPS(vaults)
      debugLog('history', 'resolved metadata and PPS for history', {
        version,
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
        version,
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
        newTotals: newTotals.length,
        nonZeroTotals: newTotals.filter((total) => total.usdValue > 0).length
      })
    }

    if (newTotals.length > 0) {
      await saveCachedTotals(userAddress, version, newTotals)
      debugLog('history', 'saved recalculated totals to cache', { version, newTotals: newTotals.length })
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
    dataPoints: dataPoints.length,
    nonZeroPoints: dataPoints.filter((point) => point.totalUsdValue > 0).length
  })

  return {
    address: userAddress,
    periodDays: days,
    dataPoints
  }
}
