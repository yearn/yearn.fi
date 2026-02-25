import { config } from '../config'
import type { CachedTotal } from './cache'
import { getCachedTotals, saveCachedTotals } from './cache'
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

  const cachedTotals = await getCachedTotals(userAddress, startDate, endDate)
  const cachedByDate = new Map(cachedTotals.map((t) => [t.date, t.usdValue]))
  // Always recalculate today (don't trust cache - value changes throughout the day)
  const missingTimestamps = timestamps.filter(
    (ts) => !cachedByDate.has(timestampToDateString(ts)) || timestampToDateString(ts) === todayDate
  )

  const newTotals: CachedTotal[] = []

  if (missingTimestamps.length > 0) {
    const events = await fetchUserEvents(userAddress, version)
    const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)

    if (timeline.length === 0) {
      // No holdings - cache zeros for missing dates
      for (const ts of missingTimestamps) {
        newTotals.push({ date: timestampToDateString(ts), usdValue: 0 })
      }
    } else {
      const vaults = getUniqueVaults(timeline)
      const vaultMetadata = await fetchMultipleVaultsMetadata(vaults)
      const ppsData = await fetchMultipleVaultsPPS(vaults)

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

      for (const timestamp of missingTimestamps) {
        let dayTotal = 0

        for (const vault of vaults) {
          const vaultKey = `${vault.chainId}:${vault.vaultAddress}`
          const metadata = vaultMetadata.get(vaultKey)

          if (!metadata) continue

          const shares = getShareBalanceAtTimestamp(timeline, vault.vaultAddress, vault.chainId, timestamp)

          if (shares === BigInt(0)) continue

          const ppsMap = ppsData.get(vaultKey)
          const pps = ppsMap ? getPPS(ppsMap, timestamp) : 1.0

          const priceKey = `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}`
          const tokenPriceMap = priceData.get(priceKey)
          const tokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, timestamp) : 0

          const sharesFloat = Number(shares) / 10 ** metadata.decimals
          const usdValue = sharesFloat * pps * tokenPrice

          dayTotal += usdValue
        }

        newTotals.push({ date: timestampToDateString(timestamp), usdValue: dayTotal })
      }
    }

    // Cache all totals except today (today's value changes throughout the day)
    const totalsToCache = newTotals.filter((t) => t.date !== todayDate)
    if (totalsToCache.length > 0) {
      await saveCachedTotals(userAddress, totalsToCache)
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

  return {
    address: userAddress,
    periodDays: days,
    dataPoints
  }
}
