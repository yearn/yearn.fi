import { config } from '../config'
import { type DefiLlamaBatchResponse, SUPPORTED_CHAINS } from '../types'
import { type CachedPrice, getCachedPrices, saveCachedPrices } from './cache'
import { debugError, debugLog } from './debug'

type TDefiLlamaError = Error & {
  code?: string
  status?: number
}

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ConnectionRefused',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_ABORTED'
])
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 200
const TIMESTAMP_BATCH_SIZE = 10
const TOKEN_BATCH_SIZE = 5
const PARALLEL_REQUESTS = 2

export function getChainPrefix(chainId: number): string {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  return chain?.defillamaPrefix || 'ethereum'
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function isRetryableError(error: unknown): boolean {
  const defillamaError = error as Partial<TDefiLlamaError>
  const code = typeof defillamaError?.code === 'string' ? defillamaError.code : null
  const status = typeof defillamaError?.status === 'number' ? defillamaError.status : null
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  return (
    (code !== null && RETRYABLE_ERROR_CODES.has(code)) ||
    (status !== null && RETRYABLE_STATUS_CODES.has(status)) ||
    message.includes('socket connection was closed unexpectedly') ||
    message.includes('unable to connect') ||
    message.includes('timed out') ||
    message.includes('timeout')
  )
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_value, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize)
  )
}

function countPricePoints(priceData: Map<string, Map<number, number>>): number {
  return Array.from(priceData.values()).reduce((total, priceMap) => total + priceMap.size, 0)
}

export function buildBatchHistoricalUrl(
  coins: Array<{ chain: string; address: string; timestamps: number[] }>
): string {
  const coinsParam = coins.reduce<Record<string, number[]>>((accumulator, coin) => {
    accumulator[`${coin.chain}:${coin.address.toLowerCase()}`] = coin.timestamps
    return accumulator
  }, {})

  const encodedCoins = encodeURIComponent(JSON.stringify(coinsParam))
  return `${config.defillamaBaseUrl}/batchHistorical?coins=${encodedCoins}`
}

export function parseDefiLlamaResponse(
  response: DefiLlamaBatchResponse,
  _requestedTimestamps: number[]
): Map<string, Map<number, number>> {
  return Object.entries(response.coins).reduce<Map<string, Map<number, number>>>((result, [coinKey, coinData]) => {
    const priceMap = coinData.prices.reduce<Map<number, number>>((map, point) => {
      map.set(point.timestamp, point.price)
      return map
    }, new Map<number, number>())

    result.set(coinKey.toLowerCase(), priceMap)
    return result
  }, new Map<string, Map<number, number>>())
}

async function fetchBatch(
  coinBatch: Array<{ chain: string; address: string; timestamps: number[] }>,
  attempt = 0
): Promise<Map<string, Map<number, number>>> {
  const uniqueTimestamps = [...new Set(coinBatch.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
  const requestedPricePoints = coinBatch.reduce((total, coin) => total + coin.timestamps.length, 0)
  const url = buildBatchHistoricalUrl(coinBatch)
  debugLog('defillama', 'fetching price batch', {
    attempt: attempt + 1,
    tokenCount: coinBatch.length,
    timestampCount: uniqueTimestamps.length,
    pricePointCount: requestedPricePoints
  })

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })

    if (!response.ok) {
      const error = new Error(`DefiLlama batchHistorical request failed: ${response.status}`) as TDefiLlamaError
      error.status = response.status
      throw error
    }

    const data = (await response.json()) as DefiLlamaBatchResponse
    const parsed = parseDefiLlamaResponse(data, uniqueTimestamps)
    debugLog('defillama', 'fetched price batch', {
      attempt: attempt + 1,
      tokenCount: coinBatch.length,
      timestampCount: uniqueTimestamps.length,
      pricePointCount: requestedPricePoints,
      pricePoints: countPricePoints(parsed)
    })
    return parsed
  } catch (error) {
    if (attempt >= DEFAULT_MAX_RETRIES || !isRetryableError(error)) {
      debugError('defillama', 'price batch failed', error, {
        attempt: attempt + 1,
        tokenCount: coinBatch.length,
        timestampCount: uniqueTimestamps.length,
        pricePointCount: requestedPricePoints
      })
      throw error
    }

    debugError('defillama', 'retrying price batch', error, {
      nextAttempt: attempt + 2,
      tokenCount: coinBatch.length,
      timestampCount: uniqueTimestamps.length,
      pricePointCount: requestedPricePoints
    })
    await wait(DEFAULT_RETRY_DELAY_MS * 2 ** attempt)
    return fetchBatch(coinBatch, attempt + 1)
  }
}

export async function fetchHistoricalPrices(
  tokens: Array<{ chainId: number; address: string }>,
  timestamps: number[]
): Promise<Map<string, Map<number, number>>> {
  debugLog('defillama', 'starting historical price fetch', {
    tokens: tokens.length,
    timestamps: timestamps.length
  })
  const coins = tokens.map((token) => ({
    chain: getChainPrefix(token.chainId),
    address: token.address
  }))

  const tokenKeys = coins.map((coin) => `${coin.chain}:${coin.address.toLowerCase()}`)
  const result = tokenKeys.reduce<Map<string, Map<number, number>>>((priceResult, tokenKey) => {
    priceResult.set(tokenKey, new Map())
    return priceResult
  }, new Map<string, Map<number, number>>())

  const cachedPrices = await getCachedPrices(tokenKeys, timestamps)
  debugLog('defillama', 'loaded cached price points', {
    cachedPoints: countPricePoints(cachedPrices)
  })
  const missingByToken = tokenKeys.reduce<Map<string, number[]>>((missing, tokenKey) => {
    const cachedForToken = cachedPrices.get(tokenKey)
    const missingTimestamps = timestamps.filter((timestamp) => {
      if (cachedForToken?.has(timestamp)) {
        result.get(tokenKey)!.set(timestamp, cachedForToken.get(timestamp)!)
        return false
      }

      return true
    })

    if (missingTimestamps.length > 0) {
      missing.set(tokenKey, missingTimestamps)
    }

    return missing
  }, new Map<string, number[]>())

  if (missingByToken.size === 0) {
    debugLog('defillama', 'historical prices fully satisfied by cache', {
      tokens: tokenKeys.length,
      timestamps: timestamps.length
    })
    return result
  }

  const tokensToFetch = coins.filter((coin) => missingByToken.has(`${coin.chain}:${coin.address.toLowerCase()}`))
  const allMissingTimestamps = [...new Set([...missingByToken.values()].flat())].sort((a, b) => a - b)
  const missingPricePoints = [...missingByToken.values()].reduce(
    (total, missingTimestamps) => total + missingTimestamps.length,
    0
  )
  const newPrices: CachedPrice[] = []
  const tokenRequests = tokensToFetch.flatMap((coin) => {
    const tokenKey = `${coin.chain}:${coin.address.toLowerCase()}`
    const missingTimestamps = missingByToken.get(tokenKey) ?? []

    return chunkItems(missingTimestamps, TIMESTAMP_BATCH_SIZE).map((timestampBatch) => ({
      chain: coin.chain,
      address: coin.address,
      timestamps: timestampBatch
    }))
  })
  const batches = chunkItems(tokenRequests, TOKEN_BATCH_SIZE).map((coinBatch) => ({ coinBatch }))
  const batchGroups = chunkItems(batches, PARALLEL_REQUESTS)
  const fetchStats = { successfulBatches: 0 }
  debugLog('defillama', 'prepared price fetch batches', {
    tokensToFetch: tokensToFetch.length,
    missingTokens: missingByToken.size,
    uniqueTimestamps: allMissingTimestamps.length,
    missingPricePoints,
    batches: batches.length,
    batchGroups: batchGroups.length
  })

  await batchGroups.reduce<Promise<void>>(async (previousGroupPromise, batchGroup, groupIndex) => {
    await previousGroupPromise

    const batchResults = await Promise.allSettled(batchGroup.map((batch) => fetchBatch(batch.coinBatch)))

    batchResults.forEach((batchResult, batchIndex) => {
      if (batchResult.status === 'rejected') {
        const batch = batchGroup[batchIndex]
        const batchTimestamps = [...new Set(batch.coinBatch.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
        const batchPricePoints = batch.coinBatch.reduce((total, coin) => total + coin.timestamps.length, 0)
        console.error(
          `[DefiLlama] Failed to fetch prices for ${batch.coinBatch.length} tokens and ${batchPricePoints} token-timestamp pairs:`,
          batchResult.reason
        )
        debugError('defillama', 'price batch group member failed', batchResult.reason, {
          tokenCount: batch.coinBatch.length,
          timestampCount: batchTimestamps.length,
          pricePointCount: batchPricePoints,
          firstTimestamp: batchTimestamps[0] ?? null,
          lastTimestamp: batchTimestamps.at(-1) ?? null
        })
        return
      }

      fetchStats.successfulBatches += 1

      batchResult.value.forEach((priceMap, coinKey) => {
        if (!result.has(coinKey)) {
          result.set(coinKey, new Map())
        }

        const existingMap = result.get(coinKey)!
        priceMap.forEach((price, timestamp) => {
          existingMap.set(timestamp, price)
          newPrices.push({ tokenKey: coinKey, timestamp, price })
        })
      })
    })

    if (groupIndex < batchGroups.length - 1) {
      await wait(50)
    }
  }, Promise.resolve())

  if (fetchStats.successfulBatches === 0 && countPricePoints(result) === 0) {
    throw new Error('Failed to fetch token prices from DefiLlama')
  }

  if (newPrices.length > 0) {
    saveCachedPrices(newPrices).catch(() => {})
  }

  debugLog('defillama', 'completed historical price fetch', {
    successfulBatches: fetchStats.successfulBatches,
    totalPricePoints: countPricePoints(result),
    newPrices: newPrices.length
  })

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

  const closest = timestamps.reduce((bestTimestamp, currentTimestamp) => {
    const bestDiff = Math.abs(targetTimestamp - bestTimestamp)
    const currentDiff = Math.abs(targetTimestamp - currentTimestamp)
    return currentDiff < bestDiff ? currentTimestamp : bestTimestamp
  }, timestamps[0])

  return priceMap.get(closest) || 0
}
