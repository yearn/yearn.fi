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
  const coinsParam = Object.fromEntries(coins.map((coin) => [`${coin.chain}:${coin.address}`, timestamps]))

  const encodedCoins = encodeURIComponent(JSON.stringify(coinsParam))
  return `${config.defillamaBaseUrl}/batchHistorical?coins=${encodedCoins}`
}

export function parseDefiLlamaResponse(response: DefiLlamaBatchResponse): Map<string, Map<number, number>> {
  return new Map(
    Object.entries(response.coins).map(([coinKey, coinData]) => [
      coinKey.toLowerCase(),
      new Map(coinData.prices.map((pp) => [pp.timestamp, pp.price]))
    ])
  )
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
  const batches = Array.from({ length: Math.ceil(timestamps.length / BATCH_SIZE) }, (_, i) =>
    timestamps.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
  )

  return batches.reduce(async (accPromise, timestampBatch, batchIdx) => {
    const result = await accPromise
    const url = buildBatchHistoricalUrl(coins, timestampBatch)

    try {
      const response = await fetch(url)

      if (!response.ok) {
        console.error(`[DefiLlama] Batch ${batchIdx + 1} failed: ${response.status}`)
        return result
      }

      const data = (await response.json()) as DefiLlamaBatchResponse
      const batchResult = parseDefiLlamaResponse(data)

      batchResult.forEach((priceMap, coinKey) => {
        if (!result.has(coinKey)) {
          result.set(coinKey, new Map())
        }
        const existingMap = result.get(coinKey)!
        priceMap.forEach((price, ts) => {
          existingMap.set(ts, price)
        })
      })
    } catch (error) {
      console.error(`[DefiLlama] Batch ${batchIdx + 1} error:`, error)
    }

    if (batchIdx < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return result
  }, Promise.resolve(new Map<string, Map<number, number>>()))
}

export function getPriceAtTimestamp(priceMap: Map<number, number>, targetTimestamp: number): number {
  if (priceMap.has(targetTimestamp)) {
    return priceMap.get(targetTimestamp)!
  }

  const timestamps = Array.from(priceMap.keys()).sort((a, b) => a - b)

  if (timestamps.length === 0) {
    return 0
  }

  const closest = timestamps.reduce((acc, ts) => {
    const diff = Math.abs(targetTimestamp - ts)
    const accDiff = Math.abs(targetTimestamp - acc)
    return diff < accDiff ? ts : acc
  }, timestamps[0])

  return priceMap.get(closest) || 0
}
