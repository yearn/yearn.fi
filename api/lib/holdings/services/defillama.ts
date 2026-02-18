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

async function fetchBatch(
  coinBatch: Array<{ chain: string; address: string }>,
  timestampBatch: number[],
  batchLabel: string
): Promise<Map<string, Map<number, number>>> {
  const url = buildBatchHistoricalUrl(coinBatch, timestampBatch)
  const result = new Map<string, Map<number, number>>()

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[DefiLlama] ${batchLabel} failed: ${response.status}`)
      return result
    }

    const data = (await response.json()) as DefiLlamaBatchResponse
    return parseDefiLlamaResponse(data)
  } catch (error) {
    console.error(`[DefiLlama] ${batchLabel} error:`, error)
    return result
  }
}

export async function fetchHistoricalPrices(
  tokens: Array<{ chainId: number; address: string }>,
  timestamps: number[]
): Promise<Map<string, Map<number, number>>> {
  const coins = tokens.map((token) => ({
    chain: getChainPrefix(token.chainId),
    address: token.address
  }))

  const TIMESTAMP_BATCH_SIZE = 10
  const TOKEN_BATCH_SIZE = 15
  const PARALLEL_REQUESTS = 5
  const result = new Map<string, Map<number, number>>()

  // Build all batch combinations
  const batches: Array<{
    coinBatch: Array<{ chain: string; address: string }>
    timestampBatch: number[]
    label: string
  }> = []

  for (let coinIdx = 0; coinIdx < coins.length; coinIdx += TOKEN_BATCH_SIZE) {
    const coinBatch = coins.slice(coinIdx, coinIdx + TOKEN_BATCH_SIZE)
    const coinBatchNum = Math.floor(coinIdx / TOKEN_BATCH_SIZE) + 1

    for (let tsIdx = 0; tsIdx < timestamps.length; tsIdx += TIMESTAMP_BATCH_SIZE) {
      const timestampBatch = timestamps.slice(tsIdx, tsIdx + TIMESTAMP_BATCH_SIZE)
      const tsBatchNum = Math.floor(tsIdx / TIMESTAMP_BATCH_SIZE) + 1

      batches.push({
        coinBatch,
        timestampBatch,
        label: `coins=${coinBatchNum} ts=${tsBatchNum}`
      })
    }
  }

  // Process batches in parallel groups
  for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
    const batchGroup = batches.slice(i, i + PARALLEL_REQUESTS)
    const promises = batchGroup.map((b) => fetchBatch(b.coinBatch, b.timestampBatch, b.label))

    const results = await Promise.all(promises)

    for (const batchResult of results) {
      for (const [coinKey, priceMap] of batchResult) {
        if (!result.has(coinKey)) {
          result.set(coinKey, new Map())
        }
        const existingMap = result.get(coinKey)!
        for (const [ts, price] of priceMap) {
          existingMap.set(ts, price)
        }
      }
    }

    // Small delay between groups to avoid rate limiting
    if (i + PARALLEL_REQUESTS < batches.length) {
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
