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
const MAX_BATCH_URL_LENGTH = 12_000
const MAX_BATCH_PRICE_POINTS = 1_000
const PARALLEL_REQUESTS = 2

type TCoinRequest = { chain: string; address: string; timestamps: number[] }

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

function mergeCoinRequests(coins: TCoinRequest[]): TCoinRequest[] {
  const merged = coins.reduce<Map<string, TCoinRequest>>((result, coin) => {
    const coinKey = `${coin.chain}:${coin.address.toLowerCase()}`
    const existing = result.get(coinKey)

    if (!existing) {
      result.set(coinKey, {
        chain: coin.chain,
        address: coin.address,
        timestamps: [...coin.timestamps]
      })
      return result
    }

    existing.timestamps.push(...coin.timestamps)
    existing.timestamps = [...new Set(existing.timestamps)].sort((a, b) => a - b)
    return result
  }, new Map())

  return Array.from(merged.values())
}

function countRequestedPricePoints(coins: TCoinRequest[]): number {
  return coins.reduce((total, coin) => total + coin.timestamps.length, 0)
}

function isBatchWithinLimits(coins: TCoinRequest[]): boolean {
  return (
    countRequestedPricePoints(coins) <= MAX_BATCH_PRICE_POINTS &&
    buildBatchHistoricalUrl(coins).length <= MAX_BATCH_URL_LENGTH
  )
}

function splitCoinRequest(coin: TCoinRequest): TCoinRequest[] {
  const midpoint = Math.ceil(coin.timestamps.length / 2)

  return [
    { chain: coin.chain, address: coin.address, timestamps: coin.timestamps.slice(0, midpoint) },
    { chain: coin.chain, address: coin.address, timestamps: coin.timestamps.slice(midpoint) }
  ].filter((splitCoin) => splitCoin.timestamps.length > 0)
}

function normalizeCoinRequests(coins: TCoinRequest[]): TCoinRequest[] {
  const expandedCoins = coins.flatMap((coin) =>
    isBatchWithinLimits([coin]) || coin.timestamps.length === 1 ? [coin] : normalizeCoinRequests(splitCoinRequest(coin))
  )

  return expandedCoins.sort((left, right) => right.timestamps.length - left.timestamps.length)
}

function packCoinRequests(coins: TCoinRequest[]): TCoinRequest[][] {
  return coins.reduce<TCoinRequest[][]>((batches, coin) => {
    const targetBatchIndex = batches.findIndex((batch) => isBatchWithinLimits(mergeCoinRequests([...batch, coin])))

    if (targetBatchIndex === -1) {
      return batches.concat([[coin]])
    }

    return batches.map((batch, index) => (index === targetBatchIndex ? mergeCoinRequests([...batch, coin]) : batch))
  }, [])
}

function materializeRequestedPrices(
  coins: TCoinRequest[],
  fetchedPrices: Map<string, Map<number, number>>
): CachedPrice[] {
  return coins.flatMap((coin) => {
    const tokenKey = `${coin.chain}:${coin.address.toLowerCase()}`
    const fetchedPriceMap = fetchedPrices.get(tokenKey) ?? new Map<number, number>()

    return coin.timestamps
      .map((timestamp) => ({
        tokenKey,
        timestamp,
        price: getPriceAtTimestamp(fetchedPriceMap, timestamp)
      }))
      .filter((entry) => entry.price > 0)
  })
}

export function buildBatchHistoricalUrl(coins: TCoinRequest[]): string {
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

async function fetchBatch(coinBatch: TCoinRequest[], attempt = 0): Promise<Map<string, Map<number, number>>> {
  const uniqueTimestamps = [...new Set(coinBatch.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
  const requestedPricePoints = countRequestedPricePoints(coinBatch)
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
  const cachedPricePoints = countPricePoints(cachedPrices)
  debugLog('defillama', 'loaded cached price points', {
    cachedPoints: cachedPricePoints
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
  const tokenRequests = normalizeCoinRequests(
    tokensToFetch.map((coin) => {
      const tokenKey = `${coin.chain}:${coin.address.toLowerCase()}`
      return {
        chain: coin.chain,
        address: coin.address,
        timestamps: missingByToken.get(tokenKey) ?? []
      }
    })
  )
  const batches = packCoinRequests(tokenRequests).map((coinBatch) => ({ coinBatch }))
  const batchGroups = chunkItems(batches, PARALLEL_REQUESTS)
  const fetchStats = { successfulBatches: 0 }
  debugLog('defillama', 'prepared price fetch batches', {
    tokensToFetch: tokensToFetch.length,
    missingTokens: missingByToken.size,
    uniqueTimestamps: allMissingTimestamps.length,
    missingPricePoints,
    tokenRequests: tokenRequests.length,
    batches: batches.length,
    batchGroups: batchGroups.length
  })

  await batchGroups.reduce<Promise<void>>(async (previousGroupPromise, batchGroup, groupIndex) => {
    await previousGroupPromise

    const batchResults = await Promise.allSettled(batchGroup.map((batch) => fetchBatch(batch.coinBatch)))

    batchResults.forEach((batchResult, batchIndex) => {
      const batch = batchGroup[batchIndex]

      if (batchResult.status === 'rejected') {
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

      const materializedPrices = materializeRequestedPrices(batch.coinBatch, batchResult.value)
      materializedPrices.forEach(({ tokenKey, timestamp, price }) => {
        if (!result.has(tokenKey)) {
          result.set(tokenKey, new Map())
        }

        const existingMap = result.get(tokenKey)!
        existingMap.set(timestamp, price)
        newPrices.push({ tokenKey, timestamp, price })
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
