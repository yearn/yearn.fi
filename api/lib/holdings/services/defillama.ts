import { config } from '../config'
import { type DefiLlamaBatchResponse, SUPPORTED_CHAINS } from '../types'

export function getChainPrefix(chainId: number): string {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  return chain?.defillamaPrefix || 'ethereum'
}

export function buildBatchHistoricalUrl(
  coins: Array<{ chain: string; address: string }>,
  timestamps: number[]
): string {
  const coinsParam: Record<string, number[]> = {}

  for (const coin of coins) {
    const key = `${coin.chain}:${coin.address}`
    coinsParam[key] = timestamps
  }

  const encodedCoins = encodeURIComponent(JSON.stringify(coinsParam))
  return `${config.defillamaBaseUrl}/batchHistorical?coins=${encodedCoins}`
}

export function parseDefiLlamaResponse(response: DefiLlamaBatchResponse): Map<string, Map<number, number>> {
  const result = new Map<string, Map<number, number>>()

  for (const [coinKey, coinData] of Object.entries(response.coins)) {
    const priceMap = new Map<number, number>()

    for (const pricePoint of coinData.prices) {
      priceMap.set(pricePoint.timestamp, pricePoint.price)
    }

    result.set(coinKey.toLowerCase(), priceMap)
  }

  return result
}

export async function fetchHistoricalPrices(
  tokens: Array<{ chainId: number; address: string }>,
  timestamps: number[]
): Promise<Map<string, Map<number, number>>> {
  const coins = tokens.map((token) => ({
    chain: getChainPrefix(token.chainId),
    address: token.address
  }))

  const BATCH_SIZE = 10
  const result = new Map<string, Map<number, number>>()

  for (let i = 0; i < timestamps.length; i += BATCH_SIZE) {
    const timestampBatch = timestamps.slice(i, i + BATCH_SIZE)
    const url = buildBatchHistoricalUrl(coins, timestampBatch)

    try {
      const response = await fetch(url)

      if (!response.ok) {
        console.error(`[DefiLlama] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${response.status}`)
        continue
      }

      const data = (await response.json()) as DefiLlamaBatchResponse
      const batchResult = parseDefiLlamaResponse(data)

      for (const [coinKey, priceMap] of batchResult) {
        if (!result.has(coinKey)) {
          result.set(coinKey, new Map())
        }
        const existingMap = result.get(coinKey)!
        for (const [ts, price] of priceMap) {
          existingMap.set(ts, price)
        }
      }
    } catch (error) {
      console.error(`[DefiLlama] Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error)
    }

    if (i + BATCH_SIZE < timestamps.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return result
}

export function getPriceAtTimestamp(priceMap: Map<number, number>, targetTimestamp: number): number {
  if (priceMap.has(targetTimestamp)) {
    return priceMap.get(targetTimestamp)!
  }

  const timestamps = Array.from(priceMap.keys()).sort((a, b) => a - b)

  if (timestamps.length === 0) {
    return 0
  }

  let closest = timestamps[0]
  let minDiff = Math.abs(targetTimestamp - closest)

  for (const ts of timestamps) {
    const diff = Math.abs(targetTimestamp - ts)
    if (diff < minDiff) {
      minDiff = diff
      closest = ts
    }
  }

  return priceMap.get(closest) || 0
}
