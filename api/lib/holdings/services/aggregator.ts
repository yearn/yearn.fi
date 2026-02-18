import { config } from '../config'
import type { CachedHolding, ChainHoldings, DailyHoldings, HoldingsHistoryResponse, VaultHolding } from '../types'
import { SUPPORTED_CHAINS as CHAINS } from '../types'
import { getCachedHoldings, saveCachedHoldings } from './cache'
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
import { fetchMultipleVaultsMetadata } from './ydaemon'

export async function getHistoricalHoldings(
  userAddress: string,
  version: VaultVersion = 'all'
): Promise<HoldingsHistoryResponse> {
  const days = config.historyDays
  const timestamps = generateDailyTimestamps(days)
  const startDate = timestampToDateString(timestamps[0])
  const endDate = timestampToDateString(timestamps[timestamps.length - 1])

  const cachedHoldings = await getCachedHoldings(userAddress, startDate, endDate)
  const cachedDates = new Set(cachedHoldings.map((h) => h.date))
  const missingTimestamps = timestamps.filter((ts) => !cachedDates.has(timestampToDateString(ts)))

  const newHoldings: CachedHolding[] = []

  if (missingTimestamps.length > 0) {
    const events = await fetchUserEvents(userAddress, version)
    const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)

    if (timeline.length === 0) {
      return {
        address: userAddress,
        periodDays: days,
        dataPoints: timestamps.map((ts) => ({
          date: timestampToDateString(ts),
          timestamp: ts,
          totalUsdValue: 0,
          chains: []
        }))
      }
    }

    const vaults = getUniqueVaults(timeline)
    const vaultMetadata = await fetchMultipleVaultsMetadata(vaults)
    const ppsData = await fetchMultipleVaultsPPS(vaults)

    const underlyingTokens: Array<{ chainId: number; address: string }> = []
    for (const [_key, metadata] of vaultMetadata) {
      underlyingTokens.push({
        chainId: metadata.chainId,
        address: metadata.token.address
      })
    }

    const priceData = await fetchHistoricalPrices(underlyingTokens, missingTimestamps)

    for (const timestamp of missingTimestamps) {
      const dateStr = timestampToDateString(timestamp)

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

        newHoldings.push({
          userAddress,
          date: dateStr,
          chainId: vault.chainId,
          vaultAddress: vault.vaultAddress,
          shares: shares.toString(),
          usdValue,
          pricePerShare: pps,
          underlyingPrice: tokenPrice
        })
      }
    }

    if (newHoldings.length > 0) {
      await saveCachedHoldings(newHoldings)
    }
  }

  const allHoldings = [...cachedHoldings, ...newHoldings]

  return aggregateHoldings(userAddress, days, timestamps, allHoldings)
}

function aggregateHoldings(
  userAddress: string,
  days: number,
  timestamps: number[],
  holdings: CachedHolding[]
): HoldingsHistoryResponse {
  const holdingsByDate = new Map<string, CachedHolding[]>()
  for (const holding of holdings) {
    const existing = holdingsByDate.get(holding.date) || []
    existing.push(holding)
    holdingsByDate.set(holding.date, existing)
  }

  const dataPoints: DailyHoldings[] = timestamps.map((timestamp) => {
    const dateStr = timestampToDateString(timestamp)
    const dayHoldings = holdingsByDate.get(dateStr) || []

    const chainMap = new Map<number, VaultHolding[]>()
    for (const holding of dayHoldings) {
      const existing = chainMap.get(holding.chainId) || []
      existing.push({
        address: holding.vaultAddress,
        shares: holding.shares,
        usdValue: holding.usdValue,
        pricePerShare: holding.pricePerShare,
        underlyingPrice: holding.underlyingPrice
      })
      chainMap.set(holding.chainId, existing)
    }

    const chains: ChainHoldings[] = []
    for (const [chainId, vaults] of chainMap) {
      const chainConfig = CHAINS.find((c) => c.id === chainId)
      const totalUsdValue = vaults.reduce((sum, v) => sum + v.usdValue, 0)
      chains.push({
        chainId,
        chainName: chainConfig?.name || 'unknown',
        totalUsdValue,
        vaults
      })
    }

    chains.sort((a, b) => a.chainId - b.chainId)

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
