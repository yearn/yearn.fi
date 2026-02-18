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
import { fetchMultipleVaultsPPS, interpolatePPS } from './kong'
import { fetchMultipleVaultsMetadata } from './ydaemon'

export async function getHistoricalHoldings(
  userAddress: string,
  version: VaultVersion = 'v3'
): Promise<HoldingsHistoryResponse> {
  console.log('[Aggregator] Starting getHistoricalHoldings for:', userAddress, 'version:', version)

  const days = config.historyDays
  const timestamps = generateDailyTimestamps(days)
  const startDate = timestampToDateString(timestamps[0])
  const endDate = timestampToDateString(timestamps[timestamps.length - 1])
  console.log('[Aggregator] Date range:', startDate, 'to', endDate)

  const cachedHoldings = await getCachedHoldings(userAddress, startDate, endDate)
  console.log('[Aggregator] Cached holdings:', cachedHoldings.length)

  const cachedDates = new Set(cachedHoldings.map((h) => h.date))
  const missingTimestamps = timestamps.filter((ts) => !cachedDates.has(timestampToDateString(ts)))
  console.log('[Aggregator] Missing timestamps:', missingTimestamps.length)

  const newHoldings: CachedHolding[] = []

  if (missingTimestamps.length > 0) {
    console.log('[Aggregator] Fetching user events...')
    const events = await fetchUserEvents(userAddress, version)
    console.log(
      '[Aggregator] Events:',
      events.deposits.length,
      'deposits,',
      events.withdrawals.length,
      'withdrawals,',
      events.transfersIn.length,
      'transfers in,',
      events.transfersOut.length,
      'transfers out'
    )

    const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
    console.log('[Aggregator] Timeline events:', timeline.length)

    if (timeline.length === 0) {
      console.log('[Aggregator] No timeline events, returning empty')
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
    console.log('[Aggregator] Unique vaults:', vaults.length)

    console.log('[Aggregator] Fetching vault metadata...')
    const vaultMetadata = await fetchMultipleVaultsMetadata(vaults)
    console.log('[Aggregator] Vault metadata entries:', vaultMetadata.size)

    console.log('[Aggregator] Fetching PPS data...')
    const ppsData = await fetchMultipleVaultsPPS(vaults)
    console.log('[Aggregator] PPS data entries:', ppsData.size)

    const underlyingTokens: Array<{ chainId: number; address: string }> = []
    for (const [_key, metadata] of vaultMetadata) {
      underlyingTokens.push({
        chainId: metadata.chainId,
        address: metadata.token.address
      })
    }
    console.log('[Aggregator] Underlying tokens:', underlyingTokens.length)

    console.log('[Aggregator] Fetching historical prices...')
    const priceData = await fetchHistoricalPrices(underlyingTokens, missingTimestamps)
    console.log('[Aggregator] Price data entries:', priceData.size)

    for (const timestamp of missingTimestamps) {
      const dateStr = timestampToDateString(timestamp)

      for (const vault of vaults) {
        const vaultKey = `${vault.chainId}:${vault.vaultAddress}`
        const metadata = vaultMetadata.get(vaultKey)

        if (!metadata) continue

        const shares = getShareBalanceAtTimestamp(timeline, vault.vaultAddress, vault.chainId, timestamp)

        if (shares === BigInt(0)) continue

        const ppsMap = ppsData.get(vaultKey)
        const pps = ppsMap ? interpolatePPS(ppsMap, timestamp) : 1.0

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
