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
const DEFAULT_PRO_TIMEOUT_MS = 12_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 200
const DEFAULT_MAX_REQUEST_URL_LENGTH = 3_500
const SPLITTABLE_GET_STATUS_CODES = new Set([414, 431, 505])

type TCoinRequest = { chain: string; address: string; timestamps: number[] }
type TDefiLlamaFetchTuning = {
  useProApi: boolean
  timeoutMs: number
  maxRetries: number
  retryDelayMs: number
  timestampBatchSize: number
  maxTokensPerBatch: number
  maxTimestampsPerTokenPerBatch: number
  maxPricePointsPerBatch: number
  maxRequestUrlLength: number | null
  parallelRequests: number
  interGroupDelayMs: number
}

type TDefiLlamaBatchRequest = {
  url: string
  init: RequestInit
  variant: 'free_get' | 'pro_get'
}

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

function mergeFetchedPriceMaps(priceMaps: Array<Map<string, Map<number, number>>>): Map<string, Map<number, number>> {
  return priceMaps.reduce<Map<string, Map<number, number>>>((mergedResult, priceMap) => {
    priceMap.forEach((tokenPrices, tokenKey) => {
      const existingTokenPrices = mergedResult.get(tokenKey) ?? new Map<number, number>()

      tokenPrices.forEach((price, timestamp) => {
        existingTokenPrices.set(timestamp, price)
      })

      mergedResult.set(tokenKey, existingTokenPrices)
    })

    return mergedResult
  }, new Map<string, Map<number, number>>())
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

function buildTokenRequests(tokensToFetch: TCoinRequest[], timestampBatchSize: number): TCoinRequest[] {
  const timestampSlicesByToken = tokensToFetch.map((coin) =>
    chunkItems(coin.timestamps, timestampBatchSize).map((timestampBatch) => ({
      chain: coin.chain,
      address: coin.address,
      timestamps: timestampBatch
    }))
  )

  return Array.from(
    { length: Math.max(0, ...timestampSlicesByToken.map((timestampSlices) => timestampSlices.length)) },
    (_value, sliceIndex) =>
      timestampSlicesByToken.flatMap((timestampSlices) => {
        const slice = timestampSlices[sliceIndex]
        return slice ? [slice] : []
      })
  ).flat()
}

function buildRequestBatches(
  tokenRequests: TCoinRequest[],
  tuning: TDefiLlamaFetchTuning
): Array<{ coinBatch: TCoinRequest[] }> {
  const batches: Array<{ coinBatch: TCoinRequest[] }> = []
  let currentBatch: TCoinRequest[] = []
  let currentBatchPricePoints = 0
  let currentBatchTokenCounts = new Map<string, number>()

  tokenRequests.forEach((tokenRequest) => {
    const tokenKey = `${tokenRequest.chain}:${tokenRequest.address.toLowerCase()}`
    const currentSlicesForToken = currentBatchTokenCounts.get(tokenKey) ?? 0
    const nextTokenCount = currentBatchTokenCounts.has(tokenKey)
      ? currentBatchTokenCounts.size
      : currentBatchTokenCounts.size + 1
    const nextPricePointCount = currentBatchPricePoints + tokenRequest.timestamps.length
    const nextTokenTimestampCount = currentSlicesForToken * tuning.timestampBatchSize + tokenRequest.timestamps.length
    const nextBatch = mergeCoinRequests([...currentBatch, tokenRequest])
    const nextBatchUrlLength =
      tuning.maxRequestUrlLength === null
        ? 0
        : (tuning.useProApi ? buildProBatchHistoricalGetUrl(nextBatch) : buildBatchHistoricalUrl(nextBatch)).length

    if (
      currentBatch.length > 0 &&
      (nextTokenCount > tuning.maxTokensPerBatch ||
        nextPricePointCount > tuning.maxPricePointsPerBatch ||
        nextTokenTimestampCount > tuning.maxTimestampsPerTokenPerBatch ||
        (tuning.maxRequestUrlLength !== null && nextBatchUrlLength > tuning.maxRequestUrlLength))
    ) {
      batches.push({ coinBatch: mergeCoinRequests(currentBatch) })
      currentBatch = []
      currentBatchPricePoints = 0
      currentBatchTokenCounts = new Map()
    }

    currentBatch.push(tokenRequest)
    currentBatchPricePoints += tokenRequest.timestamps.length
    currentBatchTokenCounts.set(tokenKey, (currentBatchTokenCounts.get(tokenKey) ?? 0) + 1)
  })

  if (currentBatch.length > 0) {
    batches.push({ coinBatch: mergeCoinRequests(currentBatch) })
  }

  return batches
}

function countRequestedPricePoints(coins: TCoinRequest[]): number {
  return coins.reduce((total, coin) => total + coin.timestamps.length, 0)
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

function buildCoinsParam(coins: TCoinRequest[]): Record<string, number[]> {
  return coins.reduce<Record<string, number[]>>((accumulator, coin) => {
    accumulator[`${coin.chain}:${coin.address.toLowerCase()}`] = coin.timestamps
    return accumulator
  }, {})
}

export function buildBatchHistoricalUrl(coins: TCoinRequest[]): string {
  const encodedCoins = encodeURIComponent(JSON.stringify(buildCoinsParam(coins)))
  return `${config.defillamaBaseUrl}/batchHistorical?coins=${encodedCoins}`
}

function buildProBatchHistoricalGetUrl(coins: TCoinRequest[]): string {
  const encodedCoins = encodeURIComponent(JSON.stringify(buildCoinsParam(coins)))
  return `${config.defillamaProBaseUrl}/${config.defillamaApiKey}/coins/batchHistorical?coins=${encodedCoins}`
}

function buildBatchHistoricalRequests(coins: TCoinRequest[]): TDefiLlamaBatchRequest[] {
  if (config.defillamaApiKey.length === 0) {
    return [
      {
        url: buildBatchHistoricalUrl(coins),
        init: {},
        variant: 'free_get'
      }
    ]
  }

  return [
    {
      url: buildProBatchHistoricalGetUrl(coins),
      init: {},
      variant: 'pro_get'
    },
    {
      url: buildBatchHistoricalUrl(coins),
      init: {},
      variant: 'free_get'
    }
  ]
}

function isSplittableGetError(error: unknown): boolean {
  const status =
    typeof (error as Partial<TDefiLlamaError>)?.status === 'number' ? (error as Partial<TDefiLlamaError>).status : null

  return status !== null && SPLITTABLE_GET_STATUS_CODES.has(status)
}

function splitCoinBatch(
  coinBatch: TCoinRequest[]
): { batches: [TCoinRequest[], TCoinRequest[]]; splitMode: string } | null {
  if (coinBatch.length > 1) {
    const midpoint = Math.ceil(coinBatch.length / 2)
    return {
      batches: [coinBatch.slice(0, midpoint), coinBatch.slice(midpoint)],
      splitMode: 'coin_batch'
    }
  }

  const [coinRequest] = coinBatch
  if (!coinRequest || coinRequest.timestamps.length <= 1) {
    return null
  }

  const midpoint = Math.ceil(coinRequest.timestamps.length / 2)
  return {
    batches: [
      [{ ...coinRequest, timestamps: coinRequest.timestamps.slice(0, midpoint) }],
      [{ ...coinRequest, timestamps: coinRequest.timestamps.slice(midpoint) }]
    ],
    splitMode: 'timestamp_batch'
  }
}

function getDefiLlamaFetchTuning(): TDefiLlamaFetchTuning {
  if (config.defillamaApiKey.length > 0) {
    return {
      useProApi: true,
      timeoutMs: DEFAULT_PRO_TIMEOUT_MS,
      maxRetries: DEFAULT_MAX_RETRIES,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS / 2,
      timestampBatchSize: 40,
      maxTokensPerBatch: 25,
      maxTimestampsPerTokenPerBatch: 40,
      maxPricePointsPerBatch: 600,
      maxRequestUrlLength: DEFAULT_MAX_REQUEST_URL_LENGTH,
      parallelRequests: 10,
      interGroupDelayMs: 0
    }
  }

  return {
    useProApi: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    timestampBatchSize: 10,
    maxTokensPerBatch: 50,
    maxTimestampsPerTokenPerBatch: 50,
    maxPricePointsPerBatch: 500,
    maxRequestUrlLength: null,
    parallelRequests: 2,
    interGroupDelayMs: 50
  }
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
  coinBatch: TCoinRequest[],
  tuning: TDefiLlamaFetchTuning,
  attempt = 0
): Promise<Map<string, Map<number, number>>> {
  const uniqueTimestamps = [...new Set(coinBatch.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
  const requestedPricePoints = countRequestedPricePoints(coinBatch)
  const requests = buildBatchHistoricalRequests(coinBatch)
  const requestDetails = requests.map((request) => ({
    variant: request.variant,
    method: request.init.method ?? 'GET',
    urlLength: request.url.length
  }))
  debugLog('defillama', 'fetching price batch', {
    attempt: attempt + 1,
    tokenCount: coinBatch.length,
    timestampCount: uniqueTimestamps.length,
    pricePointCount: requestedPricePoints,
    useProApi: tuning.useProApi,
    requestVariants: requests.map((request) => request.variant),
    requestDetails
  })

  try {
    const parsed = await requests.reduce<Promise<Map<string, Map<number, number>> | null>>(
      async (parsedPromise, request, requestIndex) => {
        const existingParsed = await parsedPromise

        if (existingParsed !== null) {
          return existingParsed
        }

        try {
          const response = await fetch(request.url, {
            ...request.init,
            signal: AbortSignal.timeout(tuning.timeoutMs)
          })

          if (!response.ok) {
            const error = new Error(`DefiLlama batchHistorical request failed: ${response.status}`) as TDefiLlamaError
            error.status = response.status
            throw error
          }

          const data = (await response.json()) as DefiLlamaBatchResponse
          return parseDefiLlamaResponse(data, uniqueTimestamps)
        } catch (error) {
          if ((request.variant === 'pro_get' || request.variant === 'free_get') && isSplittableGetError(error)) {
            const splitBatch = splitCoinBatch(coinBatch)

            if (splitBatch !== null) {
              debugError('defillama', 'splitting price batch after get request failed', error, {
                attempt: attempt + 1,
                tokenCount: coinBatch.length,
                timestampCount: uniqueTimestamps.length,
                pricePointCount: requestedPricePoints,
                useProApi: tuning.useProApi,
                requestVariant: request.variant,
                requestMethod: request.init.method ?? 'GET',
                requestUrlLength: request.url.length,
                splitMode: splitBatch.splitMode
              })

              const splitResults = await Promise.all(
                splitBatch.batches.map((splitCoinRequests) => fetchBatch(splitCoinRequests, tuning, attempt))
              )
              return mergeFetchedPriceMaps(splitResults)
            }
          }

          if (requestIndex < requests.length - 1) {
            debugError('defillama', 'price batch request variant failed', error, {
              attempt: attempt + 1,
              tokenCount: coinBatch.length,
              timestampCount: uniqueTimestamps.length,
              pricePointCount: requestedPricePoints,
              useProApi: tuning.useProApi,
              requestVariant: request.variant,
              requestMethod: request.init.method ?? 'GET',
              requestUrlLength: request.url.length
            })
            return null
          }

          throw error
        }
      },
      Promise.resolve(null)
    )

    if (parsed === null) {
      throw new Error('DefiLlama batch request resolved without a response')
    }

    debugLog('defillama', 'fetched price batch', {
      attempt: attempt + 1,
      tokenCount: coinBatch.length,
      timestampCount: uniqueTimestamps.length,
      pricePointCount: requestedPricePoints,
      pricePoints: countPricePoints(parsed),
      useProApi: tuning.useProApi,
      requestVariants: requests.map((request) => request.variant),
      requestDetails
    })
    return parsed
  } catch (error) {
    if (attempt >= tuning.maxRetries || !isRetryableError(error)) {
      debugError('defillama', 'price batch failed', error, {
        attempt: attempt + 1,
        tokenCount: coinBatch.length,
        timestampCount: uniqueTimestamps.length,
        pricePointCount: requestedPricePoints,
        useProApi: tuning.useProApi
      })
      throw error
    }

    debugError('defillama', 'retrying price batch', error, {
      nextAttempt: attempt + 2,
      tokenCount: coinBatch.length,
      timestampCount: uniqueTimestamps.length,
      pricePointCount: requestedPricePoints,
      useProApi: tuning.useProApi
    })
    await wait(tuning.retryDelayMs * 2 ** attempt)
    return fetchBatch(coinBatch, tuning, attempt + 1)
  }
}

export async function fetchHistoricalPrices(
  tokens: Array<{ chainId: number; address: string }>,
  timestamps: number[]
): Promise<Map<string, Map<number, number>>> {
  const tuning = getDefiLlamaFetchTuning()
  debugLog('defillama', 'starting historical price fetch', {
    tokens: tokens.length,
    timestamps: timestamps.length,
    useProApi: tuning.useProApi,
    parallelRequests: tuning.parallelRequests
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
  const tokenRequests = buildTokenRequests(
    tokensToFetch.map((coin) => {
      const tokenKey = `${coin.chain}:${coin.address.toLowerCase()}`
      return {
        chain: coin.chain,
        address: coin.address,
        timestamps: missingByToken.get(tokenKey) ?? []
      }
    }),
    tuning.timestampBatchSize
  )
  const batches = buildRequestBatches(tokenRequests, tuning)
  const batchGroups = chunkItems(batches, tuning.parallelRequests)
  const fetchStats = { successfulBatches: 0 }
  debugLog('defillama', 'prepared price fetch batches', {
    tokensToFetch: tokensToFetch.length,
    missingTokens: missingByToken.size,
    uniqueTimestamps: allMissingTimestamps.length,
    missingPricePoints,
    tokenRequests: tokenRequests.length,
    batches: batches.length,
    batchGroups: batchGroups.length,
    maxTokensPerBatch: tuning.maxTokensPerBatch,
    maxPricePointsPerBatch: tuning.maxPricePointsPerBatch,
    maxTimestampsPerTokenPerBatch: tuning.maxTimestampsPerTokenPerBatch,
    maxRequestUrlLength: tuning.maxRequestUrlLength,
    useProApi: tuning.useProApi
  })

  await batchGroups.reduce<Promise<void>>(async (previousGroupPromise, batchGroup, groupIndex) => {
    await previousGroupPromise

    const batchResults = await Promise.allSettled(batchGroup.map((batch) => fetchBatch(batch.coinBatch, tuning)))

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

    if (groupIndex < batchGroups.length - 1 && tuning.interGroupDelayMs > 0) {
      await wait(tuning.interGroupDelayMs)
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
