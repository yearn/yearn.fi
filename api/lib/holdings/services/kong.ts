import { config } from '../config'
import type { KongPPSDataPoint } from '../types'
import { debugError, debugLog } from './debug'

export type PPSTimeline = Map<number, number>

type TFetchLike = typeof fetch

type TKongFetchOptions = {
  fetchFn?: TFetchLike
  timeoutMs?: number
  concurrency?: number
  maxRetries?: number
  retryDelayMs?: number
}

type TKongFetchError = Error & {
  code?: string
  status?: number
}

const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_CONCURRENCY = 3
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 200
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

export function buildPPSTimeline(response: KongPPSDataPoint[]): PPSTimeline {
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

function chunkVaults<T>(items: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_value, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize)
  )
}

function getFetchFn(options?: TKongFetchOptions): TFetchLike {
  return options?.fetchFn ?? fetch
}

function getTimeoutMs(options?: TKongFetchOptions): number {
  return options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
}

function getConcurrency(options?: TKongFetchOptions): number {
  return options?.concurrency ?? DEFAULT_CONCURRENCY
}

function getMaxRetries(options?: TKongFetchOptions): number {
  return options?.maxRetries ?? DEFAULT_MAX_RETRIES
}

function getRetryDelayMs(options?: TKongFetchOptions): number {
  return options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
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

  const timestamps = Array.from(timeline.keys()).sort((a, b) => a - b)

  // If target is before all data, use earliest
  if (timestamp < timestamps[0]) {
    return timeline.get(timestamps[0])!
  }

  // Find the latest timestamp that's <= target (most recent PPS before/at this time)
  const closest = timestamps.reduce(
    (latest, currentTimestamp) => (currentTimestamp <= timestamp ? currentTimestamp : latest),
    timestamps[0]
  )

  return timeline.get(closest) ?? null
}

export async function fetchVaultPPS(
  chainId: number,
  vaultAddress: string,
  options?: TKongFetchOptions
): Promise<PPSTimeline> {
  const url = `${config.kongBaseUrl}/api/rest/timeseries/pps/${chainId}/${vaultAddress}`
  const response = await getFetchFn(options)(url, { signal: AbortSignal.timeout(getTimeoutMs(options)) })

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

export async function fetchMultipleVaultsPPS(
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
  const results = await chunkVaults(uniqueVaults, getConcurrency(options)).reduce<
    Promise<Array<{ key: string; timeline: PPSTimeline }>>
  >(async (allResultsPromise, batch) => {
    const allResults = await allResultsPromise
    const batchResults = await Promise.all(
      batch.map(async ({ chainId, vaultAddress }) => {
        const key = `${chainId}:${vaultAddress.toLowerCase()}`
        try {
          const timeline = await fetchVaultPPSDeduped(chainId, vaultAddress, options)
          return { key, timeline }
        } catch (error) {
          console.error(`[Kong] Failed to fetch PPS for ${key}:`, error)
          debugError('kong-pps', 'vault PPS fetch failed', error, { key })
          return { key, timeline: new Map() as PPSTimeline }
        }
      })
    )

    return [...allResults, ...batchResults]
  }, Promise.resolve([]))

  const map = new Map<string, PPSTimeline>()
  results.map(({ key, timeline }) => map.set(key, timeline))
  debugLog('kong-pps', 'resolved PPS timelines', {
    resolved: map.size,
    emptyTimelines: Array.from(map.values()).filter((timeline) => timeline.size === 0).length
  })

  return map
}
