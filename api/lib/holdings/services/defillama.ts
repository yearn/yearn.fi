import { config } from '../config'
import { type DefiLlamaBatchResponse, SUPPORTED_CHAINS } from '../types'
import { type CachedPrice, getCachedPrices, saveCachedPrices } from './cache'

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

export function parseDefiLlamaResponse(
  response: DefiLlamaBatchResponse,
  requestedTimestamps: number[]
): Map<string, Map<number, number>> {
  const result = new Map<string, Map<number, number>>()

  for (const [coinKey, coinData] of Object.entries(response.coins)) {
    const priceMap = new Map<number, number>()

    // DefiLlama returns prices in order of requested timestamps
    // Map each returned price to the corresponding requested timestamp
    for (let i = 0; i < coinData.prices.length && i < requestedTimestamps.length; i++) {
      const requestedTs = requestedTimestamps[i]
      const price = coinData.prices[i].price
      priceMap.set(requestedTs, price)
    }

    result.set(coinKey.toLowerCase(), priceMap)
  }

  return result
}

async function fetchBatch(
  coinBatch: Array<{ chain: string; address: string }>,
  timestampBatch: number[]
): Promise<Map<string, Map<number, number>>> {
  const url = buildBatchHistoricalUrl(coinBatch, timestampBatch)
  const result = new Map<string, Map<number, number>>()

  try {
    const response = await fetch(url)

    if (!response.ok) {
      return result
    }

    const data = (await response.json()) as DefiLlamaBatchResponse
    return parseDefiLlamaResponse(data, timestampBatch)
  } catch {
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

  const tokenKeys = coins.map((c) => `${c.chain}:${c.address.toLowerCase()}`)
  const result = new Map<string, Map<number, number>>()

  // Check cache first
  const cachedPrices = await getCachedPrices(tokenKeys, timestamps)

  // Find which token/timestamp combinations we still need
  const missingByToken = new Map<string, number[]>()

  for (const tokenKey of tokenKeys) {
    const cachedForToken = cachedPrices.get(tokenKey)
    if (!result.has(tokenKey)) {
      result.set(tokenKey, new Map())
    }

    for (const ts of timestamps) {
      if (cachedForToken?.has(ts)) {
        result.get(tokenKey)!.set(ts, cachedForToken.get(ts)!)
      } else {
        if (!missingByToken.has(tokenKey)) {
          missingByToken.set(tokenKey, [])
        }
        missingByToken.get(tokenKey)!.push(ts)
      }
    }
  }

  // If everything is cached, return early
  if (missingByToken.size === 0) {
    return result
  }

  // Build list of tokens that need fetching and all their missing timestamps
  const tokensToFetch = coins.filter((c) => missingByToken.has(`${c.chain}:${c.address.toLowerCase()}`))
  const allMissingTimestamps = [...new Set([...missingByToken.values()].flat())].sort((a, b) => a - b)

  const TIMESTAMP_BATCH_SIZE = 20
  const TOKEN_BATCH_SIZE = 10
  const PARALLEL_REQUESTS = 10
  const newPrices: CachedPrice[] = []

  // Build all batch combinations
  const batches: Array<{
    coinBatch: Array<{ chain: string; address: string }>
    timestampBatch: number[]
  }> = []

  for (let coinIdx = 0; coinIdx < tokensToFetch.length; coinIdx += TOKEN_BATCH_SIZE) {
    const coinBatch = tokensToFetch.slice(coinIdx, coinIdx + TOKEN_BATCH_SIZE)

    for (let tsIdx = 0; tsIdx < allMissingTimestamps.length; tsIdx += TIMESTAMP_BATCH_SIZE) {
      const timestampBatch = allMissingTimestamps.slice(tsIdx, tsIdx + TIMESTAMP_BATCH_SIZE)

      batches.push({
        coinBatch,
        timestampBatch
      })
    }
  }

  // Process batches in parallel groups
  for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
    const batchGroup = batches.slice(i, i + PARALLEL_REQUESTS)
    const promises = batchGroup.map((b) => fetchBatch(b.coinBatch, b.timestampBatch))

    const results = await Promise.all(promises)

    for (const batchResult of results) {
      for (const [coinKey, priceMap] of batchResult) {
        if (!result.has(coinKey)) {
          result.set(coinKey, new Map())
        }
        const existingMap = result.get(coinKey)!
        for (const [ts, price] of priceMap) {
          existingMap.set(ts, price)
          newPrices.push({ tokenKey: coinKey, timestamp: ts, price })
        }
      }
    }

    // Small delay between groups to avoid rate limiting
    if (i + PARALLEL_REQUESTS < batches.length) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  // Save new prices to cache (don't await - fire and forget)
  if (newPrices.length > 0) {
    saveCachedPrices(newPrices).catch(() => {})
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
