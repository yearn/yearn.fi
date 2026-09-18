import { holdingsConfig } from '../config'
import { type HistoricalPriceBatchResponse, SUPPORTED_CHAINS } from '../types'
import { debugError, debugLog } from './debug'

type TPriceFetchError = Error & {
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
const DEFAULT_YEARN_PRICES_TIMEOUT_MS = 8_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 200
const DEFAULT_YEARN_PRICES_MAX_REQUEST_URL_LENGTH = 8_000
const DEFAULT_YEARN_PRICES_BATCH_TIMESTAMP_SIZE = 45
const DEFAULT_YEARN_PRICES_BATCH_MAX_PRICE_POINTS = 150
const DEFAULT_YEARN_PRICES_PARALLEL_REQUESTS = 12
const YEARN_PRICES_MAX_RANGE_DAYS = 366
const YEARN_PRICES_RANGE_WINDOW_DAYS = 183
const MAX_DAILY_PRICE_DISTANCE_SECONDS = 60 * 60 * 24
const SPLITTABLE_GET_STATUS_CODES = new Set([414, 431, 505])
const yearnPricesRequestLimit = {
  active: 0,
  waiters: [] as Array<() => void>
}

type TCoinRequest = { chain: string; address: string; timestamps: number[] }
type THistoricalPriceFetchTuning = {
  timeoutMs: number
  maxRetries: number
  retryDelayMs: number
  timestampBatchSize: number
  maxTokensPerBatch: number
  maxTimestampsPerTokenPerBatch: number
  maxPricePointsPerBatch: number
  maxRequestUrlLength: number | null
  parallelRequests: number
}

type THistoricalPriceBatchRequest = {
  url: string
  init: RequestInit
  variant: 'yearn_prices_get' | 'yearn_prices_range_get'
}

export type THistoricalPriceRequest = {
  chainId: number
  address: string
  timestamps: number[]
}

const HISTORICAL_PRICE_FETCH_FAILED_BATCHES = Symbol('historicalPriceFetchFailedBatches')
type THistoricalPriceResult = Map<string, Map<number, number>> & {
  [HISTORICAL_PRICE_FETCH_FAILED_BATCHES]?: number
}

export function getChainPrefix(chainId: number): string {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)

  if (!chain) {
    throw new Error(`Unsupported holdings price chain ID: ${chainId}`)
  }

  return chain.pricePrefix
}

function normalizeToUtcDayEnd(timestamp: number): number {
  return Math.floor(timestamp / 86_400) * 86_400 + 86_399
}

function getNormalizedUtcDayEndTimestamps(timestamps: number[]): number[] {
  return [...new Set(timestamps.map((timestamp) => normalizeToUtcDayEnd(timestamp)))].sort((a, b) => a - b)
}

function getContiguousUtcDayEndRange(timestamps: number[]): [number, number] | null {
  const dayEndTimestamps = getNormalizedUtcDayEndTimestamps(timestamps)

  if (dayEndTimestamps.length === 0 || dayEndTimestamps.length > YEARN_PRICES_MAX_RANGE_DAYS) {
    return null
  }

  return isContiguousUtcDayEndTimestamps(dayEndTimestamps)
    ? [dayEndTimestamps[0]!, dayEndTimestamps[dayEndTimestamps.length - 1]!]
    : null
}

function isContiguousUtcDayEndTimestamps(timestamps: number[]): boolean {
  return timestamps.every((timestamp, index) => {
    if (index === 0) {
      return true
    }

    return timestamp - timestamps[index - 1]! === 86_400
  })
}

function areNumberArraysEqual(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function shouldUseYearnPricesRangeRequest(coins: TCoinRequest[]): boolean {
  return (
    coins.some((coin) => getNormalizedUtcDayEndTimestamps(coin.timestamps).length > 1) &&
    coins.every((coin) => getContiguousUtcDayEndRange(coin.timestamps) !== null)
  )
}

function getYearnPricesSharedRangeTimestampGroups(coins: TCoinRequest[]): number[][] | null {
  if (coins.length === 0) {
    return null
  }

  const normalizedTimestampsByCoin = coins.map((coin) => getNormalizedUtcDayEndTimestamps(coin.timestamps))
  const firstTimestamps = normalizedTimestampsByCoin[0] ?? []

  if (firstTimestamps.length <= 1 || !isContiguousUtcDayEndTimestamps(firstTimestamps)) {
    return null
  }

  const allTokensShareRange = normalizedTimestampsByCoin.every((timestamps) =>
    areNumberArraysEqual(timestamps, firstTimestamps)
  )

  return allTokensShareRange ? chunkItems(firstTimestamps, YEARN_PRICES_RANGE_WINDOW_DAYS) : null
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function acquireYearnPricesRequestSlot(): Promise<void> {
  if (yearnPricesRequestLimit.active < DEFAULT_YEARN_PRICES_PARALLEL_REQUESTS) {
    yearnPricesRequestLimit.active += 1
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    yearnPricesRequestLimit.waiters.push(resolve)
  })
}

function releaseYearnPricesRequestSlot(): void {
  const next = yearnPricesRequestLimit.waiters.shift()
  if (next) {
    next()
    return
  }

  yearnPricesRequestLimit.active -= 1
}

async function withYearnPricesRequestSlot<T>(request: () => Promise<T>): Promise<T> {
  await acquireYearnPricesRequestSlot()
  try {
    return await request()
  } finally {
    releaseYearnPricesRequestSlot()
  }
}

function isRetryableError(error: unknown): boolean {
  const priceFetchError = error as Partial<TPriceFetchError>
  const code = typeof priceFetchError?.code === 'string' ? priceFetchError.code : null
  const status = typeof priceFetchError?.status === 'number' ? priceFetchError.status : null
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

function isTimeoutError(error: unknown): boolean {
  const candidate = error as Partial<TPriceFetchError> & { name?: string }
  const code = typeof candidate?.code === 'string' ? candidate.code : null
  const name = typeof candidate?.name === 'string' ? candidate.name : null
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return (
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    name === 'TimeoutError' ||
    message.includes('timed out') ||
    message.includes('timeout')
  )
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_value, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize)
  )
}

async function runWithContinuousConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  runItem: (item: T, index: number) => Promise<void>
): Promise<number> {
  const cursor = { nextIndex: 0 }
  const activity = { active: 0, peak: 0 }
  const runWorker = async (): Promise<void> => {
    const index = cursor.nextIndex
    cursor.nextIndex += 1
    if (index >= items.length) {
      return
    }

    activity.active += 1
    activity.peak = Math.max(activity.peak, activity.active)
    try {
      await runItem(items[index]!, index)
    } finally {
      activity.active -= 1
    }
    return runWorker()
  }
  const workerCount = Math.min(items.length, Math.max(1, concurrency))

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return activity.peak
}

function countPricePoints(priceData: Map<string, Map<number, number>>): number {
  return Array.from(priceData.values()).reduce((total, priceMap) => total + priceMap.size, 0)
}

export function getHistoricalPriceFetchFailedBatches(priceData: Map<string, Map<number, number>>): number {
  return (priceData as THistoricalPriceResult)[HISTORICAL_PRICE_FETCH_FAILED_BATCHES] ?? 0
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
  tuning: THistoricalPriceFetchTuning
): Array<{ coinBatch: TCoinRequest[] }> {
  const batches: Array<{ coinBatch: TCoinRequest[] }> = []
  const state = {
    currentBatch: [] as TCoinRequest[],
    currentBatchPricePoints: 0,
    currentBatchTokenCounts: new Map<string, number>()
  }

  tokenRequests.forEach((tokenRequest) => {
    const tokenKey = `${tokenRequest.chain}:${tokenRequest.address.toLowerCase()}`
    const currentSlicesForToken = state.currentBatchTokenCounts.get(tokenKey) ?? 0
    const nextTokenCount = state.currentBatchTokenCounts.has(tokenKey)
      ? state.currentBatchTokenCounts.size
      : state.currentBatchTokenCounts.size + 1
    const nextPricePointCount = state.currentBatchPricePoints + tokenRequest.timestamps.length
    const nextTokenTimestampCount = currentSlicesForToken * tuning.timestampBatchSize + tokenRequest.timestamps.length
    const nextBatch = mergeCoinRequests([...state.currentBatch, tokenRequest])
    const nextBatchUrlLength = tuning.maxRequestUrlLength === null ? 0 : buildYearnPricesRequest(nextBatch).url.length

    if (
      state.currentBatch.length > 0 &&
      (nextTokenCount > tuning.maxTokensPerBatch ||
        nextPricePointCount > tuning.maxPricePointsPerBatch ||
        nextTokenTimestampCount > tuning.maxTimestampsPerTokenPerBatch ||
        (tuning.maxRequestUrlLength !== null && nextBatchUrlLength > tuning.maxRequestUrlLength))
    ) {
      batches.push({ coinBatch: mergeCoinRequests(state.currentBatch) })
      state.currentBatch = []
      state.currentBatchPricePoints = 0
      state.currentBatchTokenCounts = new Map()
    }

    state.currentBatch.push(tokenRequest)
    state.currentBatchPricePoints += tokenRequest.timestamps.length
    state.currentBatchTokenCounts.set(tokenKey, (state.currentBatchTokenCounts.get(tokenKey) ?? 0) + 1)
  })

  if (state.currentBatch.length > 0) {
    batches.push({ coinBatch: mergeCoinRequests(state.currentBatch) })
  }

  return batches
}

function countRequestedPricePoints(coins: TCoinRequest[]): number {
  return coins.reduce((total, coin) => total + coin.timestamps.length, 0)
}

function getPriceAtTimestampWithinDayWindow(
  priceMap: Map<number, number>,
  targetTimestamp: number
): { price: number; timestamp: number } | null {
  if (priceMap.has(targetTimestamp)) {
    return { price: priceMap.get(targetTimestamp)!, timestamp: targetTimestamp }
  }

  const timestamps = getSortedPriceTimestamps(priceMap)
  const priorTimestamp = findClosestPriorTimestamp(timestamps, targetTimestamp)
  const nextTimestamp = findClosestNextTimestamp(timestamps, targetTimestamp)
  const priorDistance = priorTimestamp === null ? Infinity : targetTimestamp - priorTimestamp
  const nextDistance = nextTimestamp === null ? Infinity : nextTimestamp - targetTimestamp
  const bestTimestamp = priorDistance <= nextDistance ? priorTimestamp : nextTimestamp

  return bestTimestamp === null || Math.min(priorDistance, nextDistance) > MAX_DAILY_PRICE_DISTANCE_SECONDS
    ? null
    : { price: priceMap.get(bestTimestamp)!, timestamp: bestTimestamp }
}

type TMaterializedPrice = {
  tokenKey: string
  timestamp: number
  price: number
}

function materializeRequestedPrices(
  coins: TCoinRequest[],
  fetchedPrices: Map<string, Map<number, number>>
): TMaterializedPrice[] {
  return coins.flatMap((coin) => {
    const tokenKey = `${coin.chain}:${coin.address.toLowerCase()}`
    const fetchedPriceMap = fetchedPrices.get(tokenKey) ?? new Map<number, number>()

    return coin.timestamps
      .map((timestamp) => {
        const matchedPrice = getPriceAtTimestampWithinDayWindow(fetchedPriceMap, timestamp)
        return matchedPrice === null
          ? null
          : {
              tokenKey,
              timestamp,
              price: matchedPrice.price
            }
      })
      .filter((entry): entry is TMaterializedPrice => entry !== null && entry.price > 0)
  })
}

function buildCoinsParam(coins: TCoinRequest[]): Record<string, number[]> {
  return coins.reduce<Record<string, number[]>>((accumulator, coin) => {
    accumulator[`${coin.chain}:${coin.address.toLowerCase()}`] = getNormalizedUtcDayEndTimestamps(coin.timestamps)
    return accumulator
  }, {})
}

function buildRangeCoinsParam(coins: TCoinRequest[]): Record<string, [number, number]> {
  return coins.reduce<Record<string, [number, number]>>((accumulator, coin) => {
    const range = getContiguousUtcDayEndRange(coin.timestamps)

    if (range !== null) {
      accumulator[`${coin.chain}:${coin.address.toLowerCase()}`] = range
    }

    return accumulator
  }, {})
}

function buildYearnPricesBatchHistoricalUrl(coins: TCoinRequest[]): string {
  const encodedCoins = encodeURIComponent(JSON.stringify(buildCoinsParam(coins)))
  const apiBaseUrl = holdingsConfig.yearnPricesBaseUrl.endsWith('/api')
    ? holdingsConfig.yearnPricesBaseUrl
    : `${holdingsConfig.yearnPricesBaseUrl}/api`
  return `${apiBaseUrl}/prices/batchHistorical?coins=${encodedCoins}`
}

function buildYearnPricesRangeHistoricalUrl(coins: TCoinRequest[]): string {
  const encodedCoins = encodeURIComponent(JSON.stringify(buildRangeCoinsParam(coins)))
  const apiBaseUrl = holdingsConfig.yearnPricesBaseUrl.endsWith('/api')
    ? holdingsConfig.yearnPricesBaseUrl
    : `${holdingsConfig.yearnPricesBaseUrl}/api`
  return `${apiBaseUrl}/prices/rangeHistorical?coins=${encodedCoins}`
}

function buildYearnPricesRequest(coins: TCoinRequest[]): THistoricalPriceBatchRequest {
  const request = shouldUseYearnPricesRangeRequest(coins)
    ? {
        url: buildYearnPricesRangeHistoricalUrl(coins),
        variant: 'yearn_prices_range_get' as const
      }
    : {
        url: buildYearnPricesBatchHistoricalUrl(coins),
        variant: 'yearn_prices_get' as const
      }

  return {
    ...request,
    init: {
      headers: {
        Authorization: `Bearer ${holdingsConfig.yearnPricesApiKey}`
      }
    }
  }
}

function abbreviateTokenAddress(address: string): string {
  const normalizedAddress = address.toLowerCase()

  if (normalizedAddress.length <= 9) {
    return normalizedAddress
  }

  return `${normalizedAddress.slice(0, 4)}..${normalizedAddress.slice(-3)}`
}

function buildBatchDebugSummary(
  coinBatch: TCoinRequest[],
  uniqueTimestamps: number[]
): {
  firstTimestamp: number | null
  lastTimestamp: number | null
  firstToken: string | null
  lastToken: string | null
} {
  const firstCoin = coinBatch[0]
  const lastCoin = coinBatch.length > 0 ? coinBatch[coinBatch.length - 1] : undefined

  return {
    firstTimestamp: uniqueTimestamps[0] ?? null,
    lastTimestamp: uniqueTimestamps.length > 0 ? uniqueTimestamps[uniqueTimestamps.length - 1] : null,
    firstToken: firstCoin ? abbreviateTokenAddress(firstCoin.address) : null,
    lastToken: lastCoin ? abbreviateTokenAddress(lastCoin.address) : null
  }
}

function isSplittableGetError(error: unknown): boolean {
  const errorStatus = (error as Partial<TPriceFetchError>)?.status
  const status = typeof errorStatus === 'number' ? errorStatus : null

  return status !== null && SPLITTABLE_GET_STATUS_CODES.has(status)
}

function shouldSplitBatchAfterRequestError(error: unknown): boolean {
  return isSplittableGetError(error) || isTimeoutError(error)
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

const YEARN_PRICES_FETCH_TUNING: THistoricalPriceFetchTuning = {
  timeoutMs: DEFAULT_YEARN_PRICES_TIMEOUT_MS,
  maxRetries: DEFAULT_MAX_RETRIES,
  retryDelayMs: DEFAULT_RETRY_DELAY_MS,
  timestampBatchSize: DEFAULT_YEARN_PRICES_BATCH_TIMESTAMP_SIZE,
  maxTokensPerBatch: 50,
  maxTimestampsPerTokenPerBatch: DEFAULT_YEARN_PRICES_BATCH_TIMESTAMP_SIZE,
  maxPricePointsPerBatch: DEFAULT_YEARN_PRICES_BATCH_MAX_PRICE_POINTS,
  maxRequestUrlLength: DEFAULT_YEARN_PRICES_MAX_REQUEST_URL_LENGTH,
  parallelRequests: DEFAULT_YEARN_PRICES_PARALLEL_REQUESTS
}

function parseHistoricalPriceResponse(response: HistoricalPriceBatchResponse): Map<string, Map<number, number>> {
  return Object.entries(response.coins).reduce<Map<string, Map<number, number>>>((result, [coinKey, coinData]) => {
    const priceMap = coinData.prices.reduce<Map<number, number>>((map, point) => {
      map.set(point.timestamp, point.price)
      return map
    }, new Map<number, number>())

    result.set(coinKey.toLowerCase(), priceMap)
    return result
  }, new Map<string, Map<number, number>>())
}

async function fetchHistoricalPriceRequest(
  request: THistoricalPriceBatchRequest,
  tuning: THistoricalPriceFetchTuning
): Promise<HistoricalPriceBatchResponse> {
  return withYearnPricesRequestSlot(async () => {
    const response = await fetch(request.url, {
      ...request.init,
      signal: AbortSignal.timeout(tuning.timeoutMs)
    })

    if (!response.ok) {
      const error = new Error(`Yearn Prices historical request failed: ${response.status}`) as TPriceFetchError
      error.status = response.status
      throw error
    }

    return (await response.json()) as HistoricalPriceBatchResponse
  })
}

async function fetchBatch(
  coinBatch: TCoinRequest[],
  tuning: THistoricalPriceFetchTuning,
  attempt = 0
): Promise<Map<string, Map<number, number>>> {
  const uniqueTimestamps = [...new Set(coinBatch.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
  const requestedPricePoints = countRequestedPricePoints(coinBatch)
  const request = buildYearnPricesRequest(coinBatch)
  const batchDebugSummary = buildBatchDebugSummary(coinBatch, uniqueTimestamps)
  const requestDetails = {
    variant: request.variant,
    method: request.init.method ?? 'GET',
    urlLength: request.url.length
  }
  debugLog('prices', 'fetching price batch', {
    attempt: attempt + 1,
    tokenCount: coinBatch.length,
    timestampCount: uniqueTimestamps.length,
    pricePointCount: requestedPricePoints,
    ...batchDebugSummary,
    requestDetails
  })

  try {
    const parsed = await fetchHistoricalPriceRequest(request, tuning)
      .then(parseHistoricalPriceResponse)
      .catch(async (error: unknown) => {
        const splitBatch = shouldSplitBatchAfterRequestError(error) ? splitCoinBatch(coinBatch) : null
        if (splitBatch === null) {
          throw error
        }

        debugError('prices', 'splitting price batch after request failed', error, {
          attempt: attempt + 1,
          tokenCount: coinBatch.length,
          timestampCount: uniqueTimestamps.length,
          pricePointCount: requestedPricePoints,
          ...batchDebugSummary,
          ...requestDetails,
          splitMode: splitBatch.splitMode
        })
        const splitResults = await Promise.all(
          splitBatch.batches.map((splitCoinRequests) => fetchBatch(splitCoinRequests, tuning, attempt))
        )
        return mergeFetchedPriceMaps(splitResults)
      })

    debugLog('prices', 'fetched price batch', {
      attempt: attempt + 1,
      tokenCount: coinBatch.length,
      timestampCount: uniqueTimestamps.length,
      pricePointCount: requestedPricePoints,
      ...batchDebugSummary,
      pricePoints: countPricePoints(parsed),
      requestDetails
    })
    return parsed
  } catch (error) {
    if (attempt >= tuning.maxRetries || !isRetryableError(error)) {
      debugError('prices', 'price batch failed', error, {
        attempt: attempt + 1,
        tokenCount: coinBatch.length,
        timestampCount: uniqueTimestamps.length,
        pricePointCount: requestedPricePoints,
        ...batchDebugSummary
      })
      throw error
    }

    debugError('prices', 'retrying price batch', error, {
      nextAttempt: attempt + 2,
      tokenCount: coinBatch.length,
      timestampCount: uniqueTimestamps.length,
      pricePointCount: requestedPricePoints,
      ...batchDebugSummary
    })
    await wait(tuning.retryDelayMs * 2 ** attempt)
    return fetchBatch(coinBatch, tuning, attempt + 1)
  }
}

export async function fetchHistoricalPricesForTokenTimestamps(
  requests: THistoricalPriceRequest[]
): Promise<Map<string, Map<number, number>>> {
  if (holdingsConfig.yearnPricesApiKey.length === 0) {
    throw new Error('Yearn Prices requires YEARN_PRICES_API_KEY or API_KEY_PORTFOLIO')
  }

  const tuning = YEARN_PRICES_FETCH_TUNING
  const coins = mergeCoinRequests(
    requests
      .map((request) => ({
        chain: getChainPrefix(request.chainId),
        address: request.address,
        timestamps: [...new Set(request.timestamps)].sort((a, b) => a - b)
      }))
      .filter((request) => request.timestamps.length > 0)
  )
  const tokenKeys = coins.map((coin) => `${coin.chain}:${coin.address.toLowerCase()}`)
  const requestedTimestamps = [...new Set(coins.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
  const requestedPricePoints = countRequestedPricePoints(coins)

  debugLog('prices', 'starting historical price fetch', {
    tokens: tokenKeys.length,
    timestamps: requestedTimestamps.length,
    pricePointCount: requestedPricePoints,
    parallelRequests: tuning.parallelRequests
  })

  const result = tokenKeys.reduce<Map<string, Map<number, number>>>((priceResult, tokenKey) => {
    priceResult.set(tokenKey, new Map())
    return priceResult
  }, new Map<string, Map<number, number>>())

  if (coins.length === 0 || requestedTimestamps.length === 0) {
    return result
  }

  const fetchStats = { successfulBatches: 0, failedBatches: 0 }
  const fetchConcurrencyStats = { peak: 0 }
  const fetchPriceGroup = async (coinsToFetch: TCoinRequest[]): Promise<void> => {
    const rangeTimestampGroups = getYearnPricesSharedRangeTimestampGroups(coinsToFetch)
    const shouldUseRangeRequests = rangeTimestampGroups !== null || shouldUseYearnPricesRangeRequest(coinsToFetch)
    const effectiveTuning = shouldUseRangeRequests
      ? {
          ...tuning,
          timestampBatchSize: YEARN_PRICES_RANGE_WINDOW_DAYS,
          maxTimestampsPerTokenPerBatch: YEARN_PRICES_RANGE_WINDOW_DAYS,
          maxPricePointsPerBatch: tuning.maxTokensPerBatch * YEARN_PRICES_RANGE_WINDOW_DAYS
        }
      : tuning
    const tokenRequests =
      rangeTimestampGroups === null
        ? buildTokenRequests(coinsToFetch, effectiveTuning.timestampBatchSize)
        : rangeTimestampGroups.flatMap((timestampGroup) =>
            coinsToFetch.map((coin) => ({
              chain: coin.chain,
              address: coin.address,
              timestamps: timestampGroup
            }))
          )
    const batches = buildRequestBatches(tokenRequests, effectiveTuning)
    const batchGroups = Math.ceil(batches.length / effectiveTuning.parallelRequests)
    const workerCount = Math.min(batches.length, effectiveTuning.parallelRequests)
    const allRequestedTimestamps = [...new Set(coinsToFetch.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
    const groupPricePoints = countRequestedPricePoints(coinsToFetch)

    debugLog('prices', 'prepared price fetch batches', {
      tokensToFetch: coinsToFetch.length,
      uniqueTimestamps: allRequestedTimestamps.length,
      pricePointCount: groupPricePoints,
      tokenRequests: tokenRequests.length,
      batches: batches.length,
      batchGroups,
      scheduler: 'continuous-worker-pool',
      workers: workerCount,
      maxTokensPerBatch: effectiveTuning.maxTokensPerBatch,
      maxPricePointsPerBatch: effectiveTuning.maxPricePointsPerBatch,
      maxTimestampsPerTokenPerBatch: effectiveTuning.maxTimestampsPerTokenPerBatch,
      maxRequestUrlLength: effectiveTuning.maxRequestUrlLength,
      useRangeRequests: shouldUseRangeRequests,
      rangeWindows: rangeTimestampGroups?.length ?? null
    })

    const peakConcurrency = await runWithContinuousConcurrency(
      batches,
      effectiveTuning.parallelRequests,
      async (batch) => {
        const batchResult = await fetchBatch(batch.coinBatch, effectiveTuning).then(
          (value) => ({ status: 'fulfilled' as const, value }),
          (reason: unknown) => ({ status: 'rejected' as const, reason })
        )

        if (batchResult.status === 'rejected') {
          fetchStats.failedBatches += 1
          const batchTimestamps = [...new Set(batch.coinBatch.flatMap((coin) => coin.timestamps))].sort(
            (left, right) => left - right
          )
          const batchPricePoints = batch.coinBatch.reduce((total, coin) => total + coin.timestamps.length, 0)
          console.error(
            `[Yearn Prices] Failed to fetch prices for ${batch.coinBatch.length} tokens and ${batchPricePoints} token-timestamp pairs:`,
            batchResult.reason
          )
          debugError('prices', 'price batch worker failed', batchResult.reason, {
            tokenCount: batch.coinBatch.length,
            timestampCount: batchTimestamps.length,
            pricePointCount: batchPricePoints,
            firstTimestamp: batchTimestamps[0] ?? null,
            lastTimestamp: batchTimestamps.length > 0 ? batchTimestamps[batchTimestamps.length - 1] : null
          })
        } else {
          fetchStats.successfulBatches += 1
          const materializedPrices = materializeRequestedPrices(batch.coinBatch, batchResult.value)
          materializedPrices.forEach(({ tokenKey, timestamp, price }) => {
            if (!result.has(tokenKey)) {
              result.set(tokenKey, new Map())
            }

            const existingMap = result.get(tokenKey)!
            existingMap.set(timestamp, price)
          })
        }
      }
    )
    fetchConcurrencyStats.peak = Math.max(fetchConcurrencyStats.peak, peakConcurrency)
  }

  await fetchPriceGroup(coins)

  if (fetchStats.successfulBatches === 0 && countPricePoints(result) === 0) {
    throw new Error('Failed to fetch token prices from Yearn Prices')
  }

  if (fetchStats.failedBatches > 0) {
    Object.defineProperty(result, HISTORICAL_PRICE_FETCH_FAILED_BATCHES, {
      value: fetchStats.failedBatches,
      enumerable: false
    })
  }

  debugLog('prices', 'completed historical price fetch', {
    successfulBatches: fetchStats.successfulBatches,
    failedBatches: fetchStats.failedBatches,
    totalPricePoints: countPricePoints(result),
    peakConcurrentBatches: fetchConcurrencyStats.peak
  })

  return result
}

export async function fetchHistoricalPrices(
  tokens: Array<{ chainId: number; address: string }>,
  timestamps: number[]
): Promise<Map<string, Map<number, number>>> {
  return fetchHistoricalPricesForTokenTimestamps(
    tokens.map((token) => ({
      ...token,
      timestamps
    }))
  )
}

interface TSortedPriceTimestampIndex {
  readonly size: number
  readonly timestamps: readonly number[]
}

const sortedPriceTimestampIndexes = new WeakMap<Map<number, number>, TSortedPriceTimestampIndex>()

function getSortedPriceTimestamps(priceMap: Map<number, number>): readonly number[] {
  const cached = sortedPriceTimestampIndexes.get(priceMap)
  if (cached?.size === priceMap.size) {
    return cached.timestamps
  }

  const timestamps = Array.from(priceMap.keys()).sort((left, right) => left - right)
  sortedPriceTimestampIndexes.set(priceMap, { size: priceMap.size, timestamps })
  return timestamps
}

function findClosestPriorTimestamp(
  timestamps: readonly number[],
  targetTimestamp: number,
  lowerIndex = 0,
  upperIndex = timestamps.length - 1,
  closestPriorTimestamp: number | null = null
): number | null {
  if (lowerIndex > upperIndex) {
    return closestPriorTimestamp
  }

  const middleIndex = Math.floor((lowerIndex + upperIndex) / 2)
  const timestamp = timestamps[middleIndex]
  if (timestamp === undefined) {
    return closestPriorTimestamp
  }
  if (timestamp > targetTimestamp) {
    return findClosestPriorTimestamp(timestamps, targetTimestamp, lowerIndex, middleIndex - 1, closestPriorTimestamp)
  }
  return findClosestPriorTimestamp(timestamps, targetTimestamp, middleIndex + 1, upperIndex, timestamp)
}

function findClosestNextTimestamp(
  timestamps: readonly number[],
  targetTimestamp: number,
  lowerIndex = 0,
  upperIndex = timestamps.length - 1,
  closestNextTimestamp: number | null = null
): number | null {
  if (lowerIndex > upperIndex) {
    return closestNextTimestamp
  }

  const middleIndex = Math.floor((lowerIndex + upperIndex) / 2)
  const timestamp = timestamps[middleIndex]
  if (timestamp === undefined) {
    return closestNextTimestamp
  }
  if (timestamp < targetTimestamp) {
    return findClosestNextTimestamp(timestamps, targetTimestamp, middleIndex + 1, upperIndex, closestNextTimestamp)
  }
  return findClosestNextTimestamp(timestamps, targetTimestamp, lowerIndex, middleIndex - 1, timestamp)
}

export function getPriceAtTimestamp(priceMap: Map<number, number>, targetTimestamp: number): number {
  if (priceMap.has(targetTimestamp)) {
    return priceMap.get(targetTimestamp)!
  }

  const timestamps = getSortedPriceTimestamps(priceMap)

  if (timestamps.length === 0) {
    return 0
  }

  const closestPriorTimestamp = findClosestPriorTimestamp(timestamps, targetTimestamp)

  return closestPriorTimestamp !== null ? priceMap.get(closestPriorTimestamp) || 0 : 0
}
