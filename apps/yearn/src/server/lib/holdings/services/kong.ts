import { holdingsConfig } from '../config'
import type { KongPPSDataPoint } from '../types'
import { debugError, debugLog } from './debug'

export type PPSTimeline = Map<number, number>

const PPS_FETCH_FAILED_VAULTS = Symbol('ppsFetchFailedVaults')
const PPS_BATCH_FALLBACK_VAULTS = Symbol('ppsBatchFallbackVaults')

type TPpsFetchResult = Map<string, PPSTimeline> & {
  [PPS_FETCH_FAILED_VAULTS]?: number
  [PPS_BATCH_FALLBACK_VAULTS]?: number
}

export type TPpsRange = Readonly<{
  start: number
  finish: number
}>

export function getPpsFetchFailedVaults(ppsData: Map<string, PPSTimeline>): number {
  return (ppsData as TPpsFetchResult)[PPS_FETCH_FAILED_VAULTS] ?? 0
}

export function getPpsBatchFallbackVaults(ppsData: Map<string, PPSTimeline>): number {
  return (ppsData as TPpsFetchResult)[PPS_BATCH_FALLBACK_VAULTS] ?? 0
}

type TFetchLike = typeof fetch

type TKongFetchOptions = {
  fetchFn?: TFetchLike
  timeoutMs?: number
  concurrency?: number
  maxRetries?: number
  retryDelayMs?: number
  range?: TPpsRange
  batch?: boolean
}

type TKongFetchError = Error & {
  code?: string
  status?: number
}

const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_CONCURRENCY = 12
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 200
const UTC_DAY_SECONDS = 86_400
const MAX_BATCH_ADDRESSES = 50
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
const inFlightVaultPPSFetches = new Map<string, Promise<PPSTimeline>>()
const ppsTimelineTimestampIndexes = new WeakMap<PPSTimeline, readonly number[]>()

function getKongPpsRestBaseUrl(): string {
  return `${holdingsConfig.kongBaseUrl}/api/rest`
}

function shouldUseBatchPps(options?: TKongFetchOptions): options is TKongFetchOptions & { range: TPpsRange } {
  return Boolean(options?.range && (options.batch ?? process.env.HOLDINGS_KONG_BATCH_PPS === 'true'))
}

function isBatchRangeSupported(range: TPpsRange): boolean {
  if (
    !Number.isSafeInteger(range.start) ||
    !Number.isSafeInteger(range.finish) ||
    range.start < 0 ||
    range.start > range.finish ||
    range.start % UTC_DAY_SECONDS !== 0 ||
    range.finish % UTC_DAY_SECONDS !== 0
  ) {
    return false
  }

  const startDate = new Date(range.start * 1000)
  const targetYear = startDate.getUTCFullYear() + 10
  const targetMonth = startDate.getUTCMonth()
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(startDate.getUTCDate(), lastTargetDay)
  return range.finish <= Date.UTC(targetYear, targetMonth, targetDay) / 1000
}

export function buildPPSTimeline(response: Array<Pick<KongPPSDataPoint, 'time' | 'value'>>): PPSTimeline {
  return new Map(response.map((p) => [p.time, parseFloat(p.value)]))
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function isRetryableError(error: unknown): boolean {
  const kongError = error as Partial<TKongFetchError>
  const code = typeof kongError?.code === 'string' ? kongError.code : null
  const status = typeof kongError?.status === 'number' ? kongError.status : null
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

function getFetchFn(options?: TKongFetchOptions): TFetchLike {
  return options?.fetchFn ?? fetch
}

function getTimeoutMs(options?: TKongFetchOptions): number {
  return options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
}

function getConcurrency(options?: TKongFetchOptions): number {
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY
  return Number.isSafeInteger(concurrency) && concurrency > 0 ? concurrency : DEFAULT_CONCURRENCY
}

function getMaxRetries(options?: TKongFetchOptions): number {
  return options?.maxRetries ?? DEFAULT_MAX_RETRIES
}

function getRetryDelayMs(options?: TKongFetchOptions): number {
  return options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
}

function findClosestPpsTimestamp(
  timestamps: readonly number[],
  targetTimestamp: number,
  low = 0,
  high = timestamps.length - 1,
  closest = timestamps[0]!
): number {
  if (low > high) {
    return closest
  }

  const middle = Math.floor((low + high) / 2)
  const candidate = timestamps[middle] ?? closest
  return candidate <= targetTimestamp
    ? findClosestPpsTimestamp(timestamps, targetTimestamp, middle + 1, high, candidate)
    : findClosestPpsTimestamp(timestamps, targetTimestamp, low, middle - 1, closest)
}

export function getPPS(timeline: PPSTimeline, timestamp: number): number | null {
  // Exact match
  if (timeline.has(timestamp)) {
    return timeline.get(timestamp)!
  }

  // Find closest timestamp (Kong only has midnight timestamps)
  if (timeline.size === 0) {
    return null
  }

  const cachedTimestamps = ppsTimelineTimestampIndexes.get(timeline)
  const timestamps =
    cachedTimestamps?.length === timeline.size
      ? cachedTimestamps
      : Array.from(timeline.keys()).toSorted((left, right) => left - right)
  if (timestamps !== cachedTimestamps) {
    ppsTimelineTimestampIndexes.set(timeline, timestamps)
  }

  // If target is before all data, use earliest
  if (timestamp < timestamps[0]) {
    return timeline.get(timestamps[0])!
  }

  // Find the latest timestamp that's <= target (most recent PPS before/at this time)
  const closest = findClosestPpsTimestamp(timestamps, timestamp)

  return timeline.get(closest) ?? null
}

export async function fetchVaultPPS(
  chainId: number,
  vaultAddress: string,
  options?: TKongFetchOptions
): Promise<PPSTimeline> {
  const url = `${getKongPpsRestBaseUrl()}/timeseries/pps/${chainId}/${vaultAddress}`
  const response = await getFetchFn(options)(url, {
    signal: AbortSignal.timeout(getTimeoutMs(options))
  })

  if (!response.ok) {
    const error = new Error(`Kong API request failed: ${response.status} for ${vaultAddress}`) as TKongFetchError
    error.status = response.status
    throw error
  }

  const data = (await response.json()) as KongPPSDataPoint[]
  return buildPPSTimeline(data)
}

async function fetchVaultPPSWithRetry(
  chainId: number,
  vaultAddress: string,
  options?: TKongFetchOptions,
  attempt = 0
): Promise<PPSTimeline> {
  try {
    return await fetchVaultPPS(chainId, vaultAddress, options)
  } catch (error) {
    if (attempt >= getMaxRetries(options) || !isRetryableError(error)) {
      throw error
    }

    debugError('kong-pps', 'retrying vault PPS fetch', error, {
      chainId,
      vaultAddress,
      nextAttempt: attempt + 2
    })
    await wait(getRetryDelayMs(options) * 2 ** attempt)
    return fetchVaultPPSWithRetry(chainId, vaultAddress, options, attempt + 1)
  }
}

function fetchVaultPPSDeduped(
  chainId: number,
  vaultAddress: string,
  options?: TKongFetchOptions
): Promise<PPSTimeline> {
  const key = `${chainId}:${vaultAddress.toLowerCase()}`
  const existing = inFlightVaultPPSFetches.get(key)

  if (existing) {
    debugLog('kong-pps', 'reusing in-flight vault PPS fetch', { key })
    return existing
  }

  const request = fetchVaultPPSWithRetry(chainId, vaultAddress, options).finally(() => {
    inFlightVaultPPSFetches.delete(key)
  })

  inFlightVaultPPSFetches.set(key, request)
  return request
}

type TPpsFetchOutcome = Readonly<{
  key: string
  timeline: PPSTimeline
  failed: boolean
}>

async function fetchPpsWorker(
  vaults: Array<{ chainId: number; vaultAddress: string }>,
  queueState: { nextIndex: number },
  outcomes: Array<TPpsFetchOutcome | undefined>,
  options?: TKongFetchOptions
): Promise<void> {
  const index = queueState.nextIndex
  const vault = vaults[index]

  if (!vault) {
    return
  }

  queueState.nextIndex += 1
  const { chainId, vaultAddress } = vault
  const key = `${chainId}:${vaultAddress.toLowerCase()}`
  const outcome = await (async (): Promise<TPpsFetchOutcome> => {
    try {
      const timeline = await fetchVaultPPSDeduped(chainId, vaultAddress, options)
      return { key, timeline, failed: false }
    } catch (error) {
      console.error(`[Kong] Failed to fetch PPS for ${key}:`, error)
      debugError('kong-pps', 'vault PPS fetch failed', error, { key })
      return { key, timeline: new Map() as PPSTimeline, failed: true }
    }
  })()
  outcomes[index] = outcome
  await fetchPpsWorker(vaults, queueState, outcomes, options)
}

async function fetchMultipleVaultsPPSLegacy(
  vaults: Array<{ chainId: number; vaultAddress: string }>,
  options?: TKongFetchOptions
): Promise<Map<string, PPSTimeline>> {
  const uniqueVaults = Array.from(
    new Map(vaults.map((vault) => [`${vault.chainId}:${vault.vaultAddress.toLowerCase()}`, vault])).values()
  )
  debugLog('kong-pps', 'fetching PPS timelines', {
    requested: vaults.length,
    unique: uniqueVaults.length,
    concurrency: getConcurrency(options),
    maxRetries: getMaxRetries(options)
  })
  const workerCount = Math.min(uniqueVaults.length, getConcurrency(options))
  const queueState = { nextIndex: 0 }
  const outcomes = Array.from<TPpsFetchOutcome | undefined>({ length: uniqueVaults.length })
  await Promise.all(
    Array.from({ length: workerCount }, () => fetchPpsWorker(uniqueVaults, queueState, outcomes, options))
  )
  const results = outcomes.filter((outcome): outcome is TPpsFetchOutcome => outcome !== undefined)

  const map = new Map<string, PPSTimeline>()
  results.forEach(({ key, timeline }) => {
    map.set(key, timeline)
  })
  Object.defineProperty(map, PPS_FETCH_FAILED_VAULTS, {
    value: results.filter((result) => result.failed).length,
    enumerable: false
  })
  debugLog('kong-pps', 'resolved PPS timelines', {
    resolved: map.size,
    emptyTimelines: Array.from(map.values()).filter((timeline) => timeline.size === 0).length
  })

  return map
}

type TPpsBatchPoint = {
  time: number
  value: string
}

type TPpsBatchChunkResult = {
  timelines: Map<string, PPSTimeline>
  failedVaults: number
  fallbackVaults: number
}

function parsePpsBatchPoint(value: unknown): TPpsBatchPoint {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid Kong batch PPS point')
  }

  const point = value as Partial<TPpsBatchPoint>
  if (!Number.isSafeInteger(point.time) || typeof point.value !== 'string' || !Number.isFinite(Number(point.value))) {
    throw new Error('Invalid Kong batch PPS point')
  }

  return { time: Number(point.time), value: point.value }
}

function parsePpsBatchResponse(
  value: unknown,
  vaults: Array<{ chainId: number; vaultAddress: string }>
): Map<string, PPSTimeline> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Kong batch PPS response')
  }

  const response = value as Record<string, unknown>
  return new Map(
    vaults.map((vault) => {
      const key = `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`
      const points = response[key]
      if (!Array.isArray(points)) {
        throw new Error(`Missing Kong batch PPS series for ${key}`)
      }

      return [key, buildPPSTimeline(points.map(parsePpsBatchPoint))] as const
    })
  )
}

async function fetchPpsBatchWithRetry(
  vaults: Array<{ chainId: number; vaultAddress: string }>,
  range: TPpsRange,
  options?: TKongFetchOptions,
  attempt = 0
): Promise<Map<string, PPSTimeline>> {
  try {
    const addresses = vaults.map((vault) => `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`)
    const body = JSON.stringify({ start: range.start, finish: range.finish, addresses })
    const response = await getFetchFn(options)(`${getKongPpsRestBaseUrl()}/timeseries/pps/v2`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(getTimeoutMs(options))
    })

    if (!response.ok) {
      const error = new Error(`Kong batch PPS request failed: ${response.status}`) as TKongFetchError
      error.status = response.status
      throw error
    }

    const responseText = await response.text()
    const timelines = parsePpsBatchResponse(JSON.parse(responseText), vaults)
    debugLog('kong-pps', 'resolved Kong batch PPS request', {
      series: vaults.length,
      points: Array.from(timelines.values()).reduce((total, timeline) => total + timeline.size, 0),
      responseBytes: new TextEncoder().encode(responseText).byteLength,
      start: range.start,
      finish: range.finish
    })
    return timelines
  } catch (error) {
    if (attempt >= getMaxRetries(options) || !isRetryableError(error)) {
      throw error
    }

    debugError('kong-pps', 'retrying Kong batch PPS fetch', error, {
      series: vaults.length,
      nextAttempt: attempt + 2
    })
    await wait(getRetryDelayMs(options) * 2 ** attempt)
    return fetchPpsBatchWithRetry(vaults, range, options, attempt + 1)
  }
}

function mergePpsBatchChunkResults(results: TPpsBatchChunkResult[]): TPpsBatchChunkResult {
  return {
    timelines: new Map(results.flatMap((result) => Array.from(result.timelines.entries()))),
    failedVaults: results.reduce((total, result) => total + result.failedVaults, 0),
    fallbackVaults: results.reduce((total, result) => total + result.fallbackVaults, 0)
  }
}

async function fetchPpsBatchChunk(
  vaults: Array<{ chainId: number; vaultAddress: string }>,
  range: TPpsRange,
  options?: TKongFetchOptions
): Promise<TPpsBatchChunkResult> {
  try {
    return {
      timelines: await fetchPpsBatchWithRetry(vaults, range, options),
      failedVaults: 0,
      fallbackVaults: 0
    }
  } catch (error) {
    const status = (error as Partial<TKongFetchError>)?.status
    if (status === 413 && vaults.length > 1) {
      const middle = Math.ceil(vaults.length / 2)
      const results = await Promise.all(
        [vaults.slice(0, middle), vaults.slice(middle)].map((chunk) => fetchPpsBatchChunk(chunk, range, options))
      )
      return mergePpsBatchChunkResults(results)
    }

    debugError('kong-pps', 'Kong batch PPS fetch failed, falling back to per-vault requests', error, {
      series: vaults.length,
      start: range.start,
      finish: range.finish
    })
    const timelines = await fetchMultipleVaultsPPSLegacy(vaults, options)
    return {
      timelines,
      failedVaults: getPpsFetchFailedVaults(timelines),
      fallbackVaults: vaults.length
    }
  }
}

export async function fetchMultipleVaultsPPS(
  vaults: Array<{ chainId: number; vaultAddress: string }>,
  options?: TKongFetchOptions
): Promise<Map<string, PPSTimeline>> {
  if (!shouldUseBatchPps(options) || !isBatchRangeSupported(options.range)) {
    if (shouldUseBatchPps(options)) {
      debugLog('kong-pps', 'Kong batch PPS range is unsupported, using per-vault requests', options.range)
    }
    return fetchMultipleVaultsPPSLegacy(vaults, options)
  }

  const uniqueVaults = Array.from(
    new Map(vaults.map((vault) => [`${vault.chainId}:${vault.vaultAddress.toLowerCase()}`, vault])).values()
  )
  const chunks = Array.from({ length: Math.ceil(uniqueVaults.length / MAX_BATCH_ADDRESSES) }, (_value, index) =>
    uniqueVaults.slice(index * MAX_BATCH_ADDRESSES, (index + 1) * MAX_BATCH_ADDRESSES)
  )
  const combined = mergePpsBatchChunkResults(
    await Promise.all(chunks.map((chunk) => fetchPpsBatchChunk(chunk, options.range, options)))
  )
  const timelines = new Map(
    uniqueVaults.map((vault) => {
      const key = `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`
      return [key, combined.timelines.get(key) ?? new Map()] as const
    })
  )
  Object.defineProperties(timelines, {
    [PPS_FETCH_FAILED_VAULTS]: { value: combined.failedVaults, enumerable: false },
    [PPS_BATCH_FALLBACK_VAULTS]: { value: combined.fallbackVaults, enumerable: false }
  })
  debugLog('kong-pps', 'resolved PPS timelines with Kong batch endpoint', {
    requested: vaults.length,
    unique: uniqueVaults.length,
    requests: chunks.length,
    fallbackVaults: combined.fallbackVaults,
    failedVaults: combined.failedVaults
  })

  return timelines
}
