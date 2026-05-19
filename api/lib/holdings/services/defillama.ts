import { holdingsConfig } from '../config'
import { type DefiLlamaBatchResponse, SUPPORTED_CHAINS } from '../types'
import { debugError, debugLog } from './debug'

type TDefiLlamaError = Error & {
  code?: string
  status?: number
}

type THistoricalPriceProvider = 'defillama' | 'yearn-prices'
type THistoricalPriceProviderConfig = {
  provider: THistoricalPriceProvider
  label: string
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
const DEFAULT_YEARN_PRICES_TIMEOUT_MS = 8_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 200
const DEFAULT_MAX_REQUEST_URL_LENGTH = 3_500
const DEFAULT_YEARN_PRICES_MAX_REQUEST_URL_LENGTH = 8_000
const DEFAULT_YEARN_PRICES_BATCH_TIMESTAMP_SIZE = 45
const DEFAULT_YEARN_PRICES_BATCH_MAX_PRICE_POINTS = 150
const YEARN_PRICES_MAX_RANGE_DAYS = 366
const MAX_REQUESTED_PRICE_DISTANCE_SECONDS = 60 * 60
const MAX_DAILY_PRICE_DISTANCE_SECONDS = 60 * 60 * 24
const SPLITTABLE_GET_STATUS_CODES = new Set([414, 431, 505])

type TCoinRequest = { chain: string; address: string; timestamps: number[] }
type TDefiLlamaFetchTuning = {
  provider: THistoricalPriceProvider
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
  variant: 'free_get' | 'pro_get' | 'yearn_prices_get' | 'yearn_prices_range_get'
}

export type THistoricalPriceRequest = {
  chainId: number
  address: string
  timestamps: number[]
}

type TPriceTimestampMatch = { price: number; timestamp: number } | null
type TPriceTimestampMatcher = (priceMap: Map<number, number>, targetTimestamp: number) => TPriceTimestampMatch
type THistoricalPriceFetchResolution = 'strict' | 'utc_day'
type THistoricalPriceFetchOptions = {
  resolution?: THistoricalPriceFetchResolution
}
const HISTORICAL_PRICE_FETCH_FAILED_BATCHES = Symbol('historicalPriceFetchFailedBatches')
type THistoricalPriceResult = Map<string, Map<number, number>> & {
  [HISTORICAL_PRICE_FETCH_FAILED_BATCHES]?: number
}

export function getChainPrefix(chainId: number): string {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  return chain?.defillamaPrefix || 'ethereum'
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

  const isContiguous = dayEndTimestamps.every((timestamp, index) => {
    if (index === 0) {
      return true
    }

    return timestamp - dayEndTimestamps[index - 1]! === 86_400
  })

  return isContiguous ? [dayEndTimestamps[0]!, dayEndTimestamps[dayEndTimestamps.length - 1]!] : null
}

function shouldUseYearnPricesRangeRequest(coins: TCoinRequest[]): boolean {
  return (
    coins.some((coin) => getNormalizedUtcDayEndTimestamps(coin.timestamps).length > 1) &&
    coins.every((coin) => getContiguousUtcDayEndRange(coin.timestamps) !== null)
  )
}

function normalizeRequestedPriceProvider(value: string | undefined): 'auto' | THistoricalPriceProvider {
  const normalized = (value ?? 'auto').trim().toLowerCase()

  if (normalized === 'yearn' || normalized === 'yearn-prices' || normalized === 'yearn_prices') {
    return 'yearn-prices'
  }

  if (normalized === 'defillama' || normalized === 'llama') {
    return 'defillama'
  }

  return 'auto'
}

function getHistoricalPriceProviderConfig(): THistoricalPriceProviderConfig {
  const requestedProvider = normalizeRequestedPriceProvider(process.env.HOLDINGS_PRICE_PROVIDER)
  const hasYearnPricesConfig =
    holdingsConfig.yearnPricesBaseUrl.length > 0 && holdingsConfig.yearnPricesApiKey.length > 0

  if (requestedProvider === 'yearn-prices') {
    if (!hasYearnPricesConfig) {
      throw new Error(
        'yearn-prices provider requires YEARN_PRICES_BASE_URL and YEARN_PRICES_API_KEY or API_KEY_PORTFOLIO'
      )
    }

    return { provider: 'yearn-prices', label: 'yearn-prices' }
  }

  if (requestedProvider === 'auto' && hasYearnPricesConfig) {
    return { provider: 'yearn-prices', label: 'yearn-prices' }
  }

  return { provider: 'defillama', label: 'DefiLlama' }
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

function isTimeoutError(error: unknown): boolean {
  const candidate = error as Partial<TDefiLlamaError> & { name?: string }
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
        : (tuning.provider === 'yearn-prices'
            ? buildYearnPricesRequest(nextBatch).url
            : tuning.useProApi
              ? buildProBatchHistoricalGetUrl(nextBatch)
              : buildBatchHistoricalUrl(nextBatch)
          ).length

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

function getPriceAtTimestampWithinTolerance(
  priceMap: Map<number, number>,
  targetTimestamp: number
): { price: number; timestamp: number } | null {
  if (priceMap.has(targetTimestamp)) {
    return { price: priceMap.get(targetTimestamp)!, timestamp: targetTimestamp }
  }

  const closestPriorTimestamp = Array.from(priceMap.keys())
    .sort((left, right) => left - right)
    .reduce<number | null>((bestTimestamp, timestamp) => {
      if (timestamp > targetTimestamp) {
        return bestTimestamp
      }

      return timestamp
    }, null)

  if (
    closestPriorTimestamp === null ||
    targetTimestamp - closestPriorTimestamp > MAX_REQUESTED_PRICE_DISTANCE_SECONDS
  ) {
    return null
  }

  return { price: priceMap.get(closestPriorTimestamp)!, timestamp: closestPriorTimestamp }
}

function getPriceAtTimestampWithinDayWindow(
  priceMap: Map<number, number>,
  targetTimestamp: number
): { price: number; timestamp: number } | null {
  if (priceMap.has(targetTimestamp)) {
    return { price: priceMap.get(targetTimestamp)!, timestamp: targetTimestamp }
  }

  const bestMatch = Array.from(priceMap.keys()).reduce<{
    timestamp: number | null
    distance: number
  }>(
    (best, timestamp) => {
      const distance = Math.abs(timestamp - targetTimestamp)

      if (distance > MAX_DAILY_PRICE_DISTANCE_SECONDS) {
        return best
      }

      if (
        best.timestamp === null ||
        distance < best.distance ||
        (distance === best.distance && timestamp < targetTimestamp && (best.timestamp ?? Infinity) >= targetTimestamp)
      ) {
        return {
          timestamp,
          distance
        }
      }

      return best
    },
    {
      timestamp: null,
      distance: Infinity
    }
  )

  return bestMatch.timestamp === null
    ? null
    : { price: priceMap.get(bestMatch.timestamp)!, timestamp: bestMatch.timestamp }
}

function getRequestedPriceMatcher(resolution: THistoricalPriceFetchResolution): TPriceTimestampMatcher {
  return resolution === 'utc_day' ? getPriceAtTimestampWithinDayWindow : getPriceAtTimestampWithinTolerance
}

type TMaterializedPrice = {
  tokenKey: string
  timestamp: number
  price: number
}

function materializeRequestedPrices(
  coins: TCoinRequest[],
  fetchedPrices: Map<string, Map<number, number>>,
  matchPriceAtTimestamp: TPriceTimestampMatcher
): TMaterializedPrice[] {
  return coins.flatMap((coin) => {
    const tokenKey = `${coin.chain}:${coin.address.toLowerCase()}`
    const fetchedPriceMap = fetchedPrices.get(tokenKey) ?? new Map<number, number>()

    return coin.timestamps
      .map((timestamp) => {
        const matchedPrice = matchPriceAtTimestamp(fetchedPriceMap, timestamp)
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

function buildCoinsParam(
  coins: TCoinRequest[],
  options: { normalizeTimestampsToDayEnd?: boolean } = {}
): Record<string, number[]> {
  return coins.reduce<Record<string, number[]>>((accumulator, coin) => {
    const timestamps = options.normalizeTimestampsToDayEnd
      ? getNormalizedUtcDayEndTimestamps(coin.timestamps)
      : coin.timestamps

    accumulator[`${coin.chain}:${coin.address.toLowerCase()}`] = timestamps
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

function joinUrlPath(...segments: string[]): string {
  const path = segments
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
  return `/${path}`
}

function getYearnPricesApiBaseUrl(): string {
  return holdingsConfig.yearnPricesBaseUrl.endsWith('/api')
    ? holdingsConfig.yearnPricesBaseUrl
    : `${holdingsConfig.yearnPricesBaseUrl}/api`
}

function assertHttpsUrl(url: URL): void {
  if (url.protocol !== 'https:') {
    throw new Error(`Blocked historical price request to non-HTTPS upstream: ${url.origin}`)
  }
}

function assertExpectedUpstream(url: URL, baseUrl: string, expectedPath: string): void {
  const base = new URL(baseUrl)
  assertHttpsUrl(url)

  if (url.origin !== base.origin || url.pathname !== joinUrlPath(base.pathname, expectedPath)) {
    throw new Error(`Blocked historical price request to unexpected upstream: ${url.origin}${url.pathname}`)
  }
}

function validateHistoricalPriceRequest(request: TDefiLlamaBatchRequest): URL {
  const url = new URL(request.url)

  if (request.variant === 'free_get') {
    assertExpectedUpstream(url, holdingsConfig.defillamaBaseUrl, 'batchHistorical')
    return url
  }

  if (request.variant === 'pro_get') {
    assertExpectedUpstream(
      url,
      holdingsConfig.defillamaProBaseUrl,
      `${holdingsConfig.defillamaApiKey}/coins/batchHistorical`
    )
    return url
  }

  if (request.variant === 'yearn_prices_get') {
    assertExpectedUpstream(url, getYearnPricesApiBaseUrl(), 'prices/batchHistorical')
    return url
  }

  assertExpectedUpstream(url, getYearnPricesApiBaseUrl(), 'prices/rangeHistorical')
  return url
}

export function buildBatchHistoricalUrl(coins: TCoinRequest[]): string {
  const encodedCoins = encodeURIComponent(JSON.stringify(buildCoinsParam(coins)))
  return `${holdingsConfig.defillamaBaseUrl}/batchHistorical?coins=${encodedCoins}`
}

function buildProBatchHistoricalGetUrl(coins: TCoinRequest[]): string {
  const encodedCoins = encodeURIComponent(JSON.stringify(buildCoinsParam(coins)))
  return `${holdingsConfig.defillamaProBaseUrl}/${holdingsConfig.defillamaApiKey}/coins/batchHistorical?coins=${encodedCoins}`
}

function buildYearnPricesBatchHistoricalUrl(coins: TCoinRequest[]): string {
  const encodedCoins = encodeURIComponent(JSON.stringify(buildCoinsParam(coins, { normalizeTimestampsToDayEnd: true })))
  return `${getYearnPricesApiBaseUrl()}/prices/batchHistorical?coins=${encodedCoins}`
}

function buildYearnPricesRangeHistoricalUrl(coins: TCoinRequest[]): string {
  const encodedCoins = encodeURIComponent(JSON.stringify(buildRangeCoinsParam(coins)))
  return `${getYearnPricesApiBaseUrl()}/prices/rangeHistorical?coins=${encodedCoins}`
}

function buildYearnPricesRequest(coins: TCoinRequest[]): Pick<TDefiLlamaBatchRequest, 'url' | 'variant'> {
  if (shouldUseYearnPricesRangeRequest(coins)) {
    return {
      url: buildYearnPricesRangeHistoricalUrl(coins),
      variant: 'yearn_prices_range_get'
    }
  }

  return {
    url: buildYearnPricesBatchHistoricalUrl(coins),
    variant: 'yearn_prices_get'
  }
}

function buildBatchHistoricalRequests(coins: TCoinRequest[], tuning: TDefiLlamaFetchTuning): TDefiLlamaBatchRequest[] {
  if (tuning.provider === 'yearn-prices') {
    const request = buildYearnPricesRequest(coins)
    return [
      {
        url: request.url,
        init: {
          headers: {
            Authorization: `Bearer ${holdingsConfig.yearnPricesApiKey}`
          }
        },
        variant: request.variant
      }
    ]
  }

  if (holdingsConfig.defillamaApiKey.length === 0) {
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
  const errorStatus = (error as Partial<TDefiLlamaError>)?.status
  const status = typeof errorStatus === 'number' ? errorStatus : null

  return status !== null && SPLITTABLE_GET_STATUS_CODES.has(status)
}

function shouldSplitBatchAfterRequestError(error: unknown, tuning: TDefiLlamaFetchTuning): boolean {
  return isSplittableGetError(error) || (tuning.provider === 'yearn-prices' && isTimeoutError(error))
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

function getDefiLlamaFetchTuning(providerConfig: THistoricalPriceProviderConfig): TDefiLlamaFetchTuning {
  if (providerConfig.provider === 'yearn-prices') {
    return {
      provider: 'yearn-prices',
      useProApi: false,
      timeoutMs: DEFAULT_YEARN_PRICES_TIMEOUT_MS,
      maxRetries: DEFAULT_MAX_RETRIES,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS,
      timestampBatchSize: DEFAULT_YEARN_PRICES_BATCH_TIMESTAMP_SIZE,
      maxTokensPerBatch: 50,
      maxTimestampsPerTokenPerBatch: DEFAULT_YEARN_PRICES_BATCH_TIMESTAMP_SIZE,
      maxPricePointsPerBatch: DEFAULT_YEARN_PRICES_BATCH_MAX_PRICE_POINTS,
      maxRequestUrlLength: DEFAULT_YEARN_PRICES_MAX_REQUEST_URL_LENGTH,
      parallelRequests: 4,
      interGroupDelayMs: 0
    }
  }

  if (holdingsConfig.defillamaApiKey.length > 0) {
    return {
      provider: 'defillama',
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
    provider: 'defillama',
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
  const requests = buildBatchHistoricalRequests(coinBatch, tuning)
  const batchDebugSummary = buildBatchDebugSummary(coinBatch, uniqueTimestamps)
  const requestDetails = requests.map((request) => ({
    variant: request.variant,
    method: request.init.method ?? 'GET',
    urlLength: request.url.length
  }))
  debugLog('prices', 'fetching price batch', {
    attempt: attempt + 1,
    provider: tuning.provider,
    tokenCount: coinBatch.length,
    timestampCount: uniqueTimestamps.length,
    pricePointCount: requestedPricePoints,
    ...batchDebugSummary,
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
          const response = await fetch(validateHistoricalPriceRequest(request), {
            ...request.init,
            redirect: 'error',
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
          if (shouldSplitBatchAfterRequestError(error, tuning)) {
            const splitBatch = splitCoinBatch(coinBatch)

            if (splitBatch !== null) {
              debugError('prices', 'splitting price batch after request failed', error, {
                attempt: attempt + 1,
                provider: tuning.provider,
                tokenCount: coinBatch.length,
                timestampCount: uniqueTimestamps.length,
                pricePointCount: requestedPricePoints,
                ...batchDebugSummary,
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
            debugError('prices', 'price batch request variant failed', error, {
              attempt: attempt + 1,
              provider: tuning.provider,
              tokenCount: coinBatch.length,
              timestampCount: uniqueTimestamps.length,
              pricePointCount: requestedPricePoints,
              ...batchDebugSummary,
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

    debugLog('prices', 'fetched price batch', {
      attempt: attempt + 1,
      provider: tuning.provider,
      tokenCount: coinBatch.length,
      timestampCount: uniqueTimestamps.length,
      pricePointCount: requestedPricePoints,
      ...batchDebugSummary,
      pricePoints: countPricePoints(parsed),
      useProApi: tuning.useProApi,
      requestVariants: requests.map((request) => request.variant),
      requestDetails
    })
    return parsed
  } catch (error) {
    if (attempt >= tuning.maxRetries || !isRetryableError(error)) {
      debugError('prices', 'price batch failed', error, {
        attempt: attempt + 1,
        provider: tuning.provider,
        tokenCount: coinBatch.length,
        timestampCount: uniqueTimestamps.length,
        pricePointCount: requestedPricePoints,
        ...batchDebugSummary,
        useProApi: tuning.useProApi
      })
      throw error
    }

    debugError('prices', 'retrying price batch', error, {
      nextAttempt: attempt + 2,
      provider: tuning.provider,
      tokenCount: coinBatch.length,
      timestampCount: uniqueTimestamps.length,
      pricePointCount: requestedPricePoints,
      ...batchDebugSummary,
      useProApi: tuning.useProApi
    })
    await wait(tuning.retryDelayMs * 2 ** attempt)
    return fetchBatch(coinBatch, tuning, attempt + 1)
  }
}

export async function fetchHistoricalPricesForTokenTimestamps(
  requests: THistoricalPriceRequest[],
  options: THistoricalPriceFetchOptions = {}
): Promise<Map<string, Map<number, number>>> {
  const providerConfig = getHistoricalPriceProviderConfig()
  const resolution = options.resolution ?? 'strict'
  const matchPriceAtTimestamp =
    providerConfig.provider === 'yearn-prices'
      ? getPriceAtTimestampWithinDayWindow
      : getRequestedPriceMatcher(resolution)
  const tuning = getDefiLlamaFetchTuning(providerConfig)
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
    provider: providerConfig.provider,
    tokens: tokenKeys.length,
    timestamps: requestedTimestamps.length,
    pricePointCount: requestedPricePoints,
    resolution,
    useProApi: tuning.useProApi,
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
  const fetchPriceGroup = async (coinsToFetch: TCoinRequest[]): Promise<void> => {
    const shouldUseRangeRequests = tuning.provider === 'yearn-prices' && shouldUseYearnPricesRangeRequest(coinsToFetch)
    const effectiveTuning = shouldUseRangeRequests
      ? {
          ...tuning,
          timestampBatchSize: YEARN_PRICES_MAX_RANGE_DAYS,
          maxTimestampsPerTokenPerBatch: YEARN_PRICES_MAX_RANGE_DAYS,
          maxPricePointsPerBatch: tuning.maxTokensPerBatch * YEARN_PRICES_MAX_RANGE_DAYS
        }
      : tuning
    const tokenRequests = buildTokenRequests(coinsToFetch, effectiveTuning.timestampBatchSize)
    const batches = buildRequestBatches(tokenRequests, effectiveTuning)
    const batchGroups = chunkItems(batches, effectiveTuning.parallelRequests)
    const allRequestedTimestamps = [...new Set(coinsToFetch.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
    const groupPricePoints = countRequestedPricePoints(coinsToFetch)

    debugLog('prices', 'prepared price fetch batches', {
      provider: providerConfig.provider,
      tokensToFetch: coinsToFetch.length,
      uniqueTimestamps: allRequestedTimestamps.length,
      pricePointCount: groupPricePoints,
      tokenRequests: tokenRequests.length,
      batches: batches.length,
      batchGroups: batchGroups.length,
      maxTokensPerBatch: effectiveTuning.maxTokensPerBatch,
      maxPricePointsPerBatch: effectiveTuning.maxPricePointsPerBatch,
      maxTimestampsPerTokenPerBatch: effectiveTuning.maxTimestampsPerTokenPerBatch,
      maxRequestUrlLength: effectiveTuning.maxRequestUrlLength,
      useProApi: effectiveTuning.useProApi,
      useRangeRequests: shouldUseRangeRequests
    })

    await batchGroups.reduce<Promise<void>>(async (previousGroupPromise, batchGroup, groupIndex) => {
      await previousGroupPromise

      const batchResults = await Promise.allSettled(
        batchGroup.map((batch) => fetchBatch(batch.coinBatch, effectiveTuning))
      )

      batchResults.forEach((batchResult, batchIndex) => {
        const batch = batchGroup[batchIndex]

        if (batchResult.status === 'rejected') {
          fetchStats.failedBatches += 1
          const batchTimestamps = [...new Set(batch.coinBatch.flatMap((coin) => coin.timestamps))].sort((a, b) => a - b)
          const batchPricePoints = batch.coinBatch.reduce((total, coin) => total + coin.timestamps.length, 0)
          console.error(
            `[${providerConfig.label}] Failed to fetch prices for ${batch.coinBatch.length} tokens and ${batchPricePoints} token-timestamp pairs:`,
            batchResult.reason
          )
          debugError('prices', 'price batch group member failed', batchResult.reason, {
            provider: providerConfig.provider,
            tokenCount: batch.coinBatch.length,
            timestampCount: batchTimestamps.length,
            pricePointCount: batchPricePoints,
            firstTimestamp: batchTimestamps[0] ?? null,
            lastTimestamp: batchTimestamps.length > 0 ? batchTimestamps[batchTimestamps.length - 1] : null
          })
          return
        }

        fetchStats.successfulBatches += 1

        const materializedPrices = materializeRequestedPrices(batch.coinBatch, batchResult.value, matchPriceAtTimestamp)
        materializedPrices.forEach(({ tokenKey, timestamp, price }) => {
          if (!result.has(tokenKey)) {
            result.set(tokenKey, new Map())
          }

          const existingMap = result.get(tokenKey)!
          existingMap.set(timestamp, price)
        })
      })

      if (groupIndex < batchGroups.length - 1 && effectiveTuning.interGroupDelayMs > 0) {
        await wait(effectiveTuning.interGroupDelayMs)
      }
    }, Promise.resolve())
  }

  await fetchPriceGroup(coins)

  if (fetchStats.successfulBatches === 0 && countPricePoints(result) === 0) {
    throw new Error(`Failed to fetch token prices from ${providerConfig.label}`)
  }

  if (fetchStats.failedBatches > 0) {
    Object.defineProperty(result, HISTORICAL_PRICE_FETCH_FAILED_BATCHES, {
      value: fetchStats.failedBatches,
      enumerable: false
    })
  }

  debugLog('prices', 'completed historical price fetch', {
    provider: providerConfig.provider,
    successfulBatches: fetchStats.successfulBatches,
    failedBatches: fetchStats.failedBatches,
    totalPricePoints: countPricePoints(result),
    resolution
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

export function getPriceAtTimestamp(priceMap: Map<number, number>, targetTimestamp: number): number {
  if (priceMap.has(targetTimestamp)) {
    return priceMap.get(targetTimestamp)!
  }

  const timestamps = Array.from(priceMap.keys()).sort((a, b) => a - b)

  if (timestamps.length === 0) {
    return 0
  }

  let closestPriorTimestamp: number | null = null
  for (const timestamp of timestamps) {
    if (timestamp > targetTimestamp) {
      break
    }
    closestPriorTimestamp = timestamp
  }

  return closestPriorTimestamp !== null ? priceMap.get(closestPriorTimestamp) || 0 : 0
}
