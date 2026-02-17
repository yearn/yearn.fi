import { config } from '../config'
import type { CachedHolding, ChainHoldings, DailyHoldings, HoldingsHistoryResponse, VaultHolding } from '../types'
import { SUPPORTED_CHAINS as CHAINS } from '../types'
import { getCachedHoldings, saveCachedHoldings } from './cache'
import { fetchHistoricalPrices, getChainPrefix, getPriceAtTimestamp } from './defillama'
import { fetchUserEvents } from './graphql'
import {
  buildPositionTimeline,
  generateDailyTimestamps,
  getShareBalanceAtTimestamp,
  getUniqueVaults,
  timestampToDateString
} from './holdings'
import { fetchMultipleVaultsPPS, interpolatePPS } from './kong'
import { fetchMultipleVaultsMetadata } from './ydaemon'

export async function getHistoricalHoldings(userAddress: string): Promise<HoldingsHistoryResponse> {
  const days = config.historyDays
  const timestamps = generateDailyTimestamps(days)
  const startDate = timestampToDateString(timestamps[0])
  const endDate = timestampToDateString(timestamps[timestamps.length - 1])

  const cachedHoldings = await getCachedHoldings(userAddress, startDate, endDate)

  const cachedDates = new Set(cachedHoldings.map((h) => h.date))
  const missingTimestamps = timestamps.filter((ts) => !cachedDates.has(timestampToDateString(ts)))

  const newHoldings: CachedHolding[] = await (async () => {
    if (missingTimestamps.length === 0) return []

    const events = await fetchUserEvents(userAddress)

    const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)

    if (timeline.length === 0) {
      return []
    }

    const vaults = getUniqueVaults(timeline)

    const vaultMetadata = await fetchMultipleVaultsMetadata(vaults)

    const ppsData = await fetchMultipleVaultsPPS(vaults)

    const underlyingTokens = Array.from(vaultMetadata.values()).map((metadata) => ({
      chainId: metadata.chainId,
      address: metadata.token.address
    }))

    const priceData = await fetchHistoricalPrices(underlyingTokens, missingTimestamps)

    const computed = missingTimestamps.flatMap((timestamp) => {
      const dateStr = timestampToDateString(timestamp)
      return vaults.flatMap((vault) => {
        const vaultKey = `${vault.chainId}:${vault.vaultAddress}`
        const metadata = vaultMetadata.get(vaultKey)
        if (!metadata) return []

        const shares = getShareBalanceAtTimestamp(timeline, vault.vaultAddress, vault.chainId, timestamp)
        if (shares === BigInt(0)) return []

        const ppsMap = ppsData.get(vaultKey)
        const pps = ppsMap ? interpolatePPS(ppsMap, timestamp) : 1.0

        const priceKey = `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}`
        const tokenPriceMap = priceData.get(priceKey)
        const tokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, timestamp) : 0

        const sharesFloat = Number(shares) / 10 ** metadata.decimals
        const usdValue = sharesFloat * pps * tokenPrice

        return [
          {
            userAddress,
            date: dateStr,
            chainId: vault.chainId,
            vaultAddress: vault.vaultAddress,
            shares: shares.toString(),
            usdValue,
            pricePerShare: pps,
            underlyingPrice: tokenPrice
          }
        ]
      })
    })

    if (computed.length > 0) {
      await saveCachedHoldings(computed)
    }

    return computed
  })()

  const allHoldings = [...cachedHoldings, ...newHoldings]

  return aggregateHoldings(userAddress, days, timestamps, allHoldings)
}

function aggregateHoldings(
  userAddress: string,
  days: number,
  timestamps: number[],
  holdings: CachedHolding[]
): HoldingsHistoryResponse {
  const holdingsByDate = holdings.reduce((acc, holding) => {
    const existing = acc.get(holding.date) || []
    existing.push(holding)
    acc.set(holding.date, existing)
    return acc
  }, new Map<string, CachedHolding[]>())

  const dataPoints: DailyHoldings[] = timestamps.map((timestamp) => {
    const dateStr = timestampToDateString(timestamp)
    const dayHoldings = holdingsByDate.get(dateStr) || []

    const chainMap = dayHoldings.reduce((acc, holding) => {
      const existing = acc.get(holding.chainId) || []
      existing.push({
        address: holding.vaultAddress,
        shares: holding.shares,
        usdValue: holding.usdValue,
        pricePerShare: holding.pricePerShare,
        underlyingPrice: holding.underlyingPrice
      })
      acc.set(holding.chainId, existing)
      return acc
    }, new Map<number, VaultHolding[]>())

    const chains: ChainHoldings[] = Array.from(chainMap.entries())
      .map(([chainId, vaults]) => {
        const chainConfig = CHAINS.find((c) => c.id === chainId)
        const totalUsdValue = vaults.reduce((sum, v) => sum + v.usdValue, 0)
        return {
          chainId,
          chainName: chainConfig?.name || 'unknown',
          totalUsdValue,
          vaults
        }
      })
      .sort((a, b) => a.chainId - b.chainId)

    const totalUsdValue = chains.reduce((sum, c) => sum + c.totalUsdValue, 0)

    return {
      date: dateStr,
      timestamp,
      totalUsdValue,
      chains
    }
  })

  return {
    address: userAddress,
    periodDays: days,
    dataPoints
  }
}
