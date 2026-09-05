import { holdingsConfig } from '../config'
import { debugError, debugLog } from './debug'

export type PPSTimeline = Map<number, number>

const PPS_FETCH_FAILED_VAULTS = Symbol('ppsFetchFailedVaults')

type TPpsFetchResult = Map<string, PPSTimeline> & {
  [PPS_FETCH_FAILED_VAULTS]?: number
}

export function getPpsFetchFailedVaults(ppsData: Map<string, PPSTimeline>): number {
  return (ppsData as TPpsFetchResult)[PPS_FETCH_FAILED_VAULTS] ?? 0
}

type TFetchLike = typeof fetch

type TKongFetchOptions = {
  fetchFn?: TFetchLike
  timeoutMs?: number
  maxRetries?: number
  retryDelayMs?: number
}

type TKongFetchError = Error & {
  code?: string
  status?: number
}

const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_CONCURRENCY = 12
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
const ppsTimelineTimestampIndexes = new WeakMap<PPSTimeline, readonly number[]>()
const inFlightVaultPpsRequests = new Map<string, Promise<PPSTimeline>>()
const ppsRequestLimit = {
  active: 0,
  waiters: [] as Array<() => void>
}

function getKongPpsRestBaseUrl(): string {
  return `${holdingsConfig.kongBaseUrl}/api/rest`
}

function buildPPSTimeline(response: TPpsPoint[]): PPSTimeline {
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

function getMaxRetries(options?: TKongFetchOptions): number {
  return options?.maxRetries ?? DEFAULT_MAX_RETRIES
}

function getRetryDelayMs(options?: TKongFetchOptions): number {
  return options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
}

function acquirePpsRequestSlot(): Promise<void> {
  if (ppsRequestLimit.active < DEFAULT_CONCURRENCY) {
    ppsRequestLimit.active += 1
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    ppsRequestLimit.waiters.push(resolve)
  })
}

function releasePpsRequestSlot(): void {
  const next = ppsRequestLimit.waiters.shift()
  if (next) {
    next()
    return
  }

  ppsRequestLimit.active -= 1
}

async function withPpsRequestSlot<T>(request: () => Promise<T>): Promise<T> {
  await acquirePpsRequestSlot()
  try {
    return await request()
  } finally {
    releasePpsRequestSlot()
  }
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

type TPpsPoint = {
  time: number
  value: string
}

function parsePpsPoint(value: unknown): TPpsPoint {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid Kong PPS point')
  }

  const point = value as Partial<TPpsPoint>
  if (!Number.isSafeInteger(point.time) || typeof point.value !== 'string' || !Number.isFinite(Number(point.value))) {
    throw new Error('Invalid Kong PPS point')
  }

  return { time: Number(point.time), value: point.value }
}

async function fetchVaultPpsWithRetry(
  chainId: number,
  vaultAddress: string,
  options?: TKongFetchOptions,
  attempt = 0
): Promise<PPSTimeline> {
  try {
    const url = `${getKongPpsRestBaseUrl()}/timeseries/pps/${chainId}/${vaultAddress}`
    const response = await withPpsRequestSlot(() =>
      getFetchFn(options)(url, {
        signal: AbortSignal.timeout(getTimeoutMs(options))
      })
    )

    if (!response.ok) {
      const error = new Error(`Kong PPS request failed: ${response.status} for ${vaultAddress}`) as TKongFetchError
      error.status = response.status
      throw error
    }

    const responseText = await response.text()
    const responseValue = JSON.parse(responseText)
    if (!Array.isArray(responseValue)) {
      throw new Error(`Invalid Kong PPS response for ${vaultAddress}`)
    }

    const timeline = buildPPSTimeline(responseValue.map(parsePpsPoint))
    debugLog('kong-pps', 'resolved Kong PPS request', {
      chainId,
      vaultAddress: vaultAddress.toLowerCase(),
      points: timeline.size,
      responseBytes: new TextEncoder().encode(responseText).byteLength
    })
    return timeline
  } catch (error) {
    if (attempt >= getMaxRetries(options) || !isRetryableError(error)) {
      throw error
    }

    debugError('kong-pps', 'retrying Kong PPS fetch', error, {
      chainId,
      vaultAddress: vaultAddress.toLowerCase(),
      nextAttempt: attempt + 2
    })
    await wait(getRetryDelayMs(options) * 2 ** attempt)
    return fetchVaultPpsWithRetry(chainId, vaultAddress, options, attempt + 1)
  }
}

function fetchVaultPpsDeduped(
  chainId: number,
  vaultAddress: string,
  options?: TKongFetchOptions
): Promise<PPSTimeline> {
  const key = `${chainId}:${vaultAddress.toLowerCase()}`
  const existing = inFlightVaultPpsRequests.get(key)
  if (existing) {
    return existing
  }

  const request = fetchVaultPpsWithRetry(chainId, vaultAddress, options).finally(() => {
    inFlightVaultPpsRequests.delete(key)
  })
  inFlightVaultPpsRequests.set(key, request)
  return request
}

async function fetchVaultPpsOutcome(
  vault: { chainId: number; vaultAddress: string },
  options?: TKongFetchOptions
): Promise<{ key: string; timeline: PPSTimeline; failed: boolean }> {
  const key = `${vault.chainId}:${vault.vaultAddress.toLowerCase()}`
  try {
    return {
      key,
      timeline: await fetchVaultPpsDeduped(vault.chainId, vault.vaultAddress, options),
      failed: false
    }
  } catch (error) {
    debugError('kong-pps', 'Kong PPS fetch failed', error, { key })
    return {
      key,
      timeline: new Map(),
      failed: true
    }
  }
}

export async function fetchMultipleVaultsPPS(
  vaults: Array<{ chainId: number; vaultAddress: string }>,
  options?: TKongFetchOptions
): Promise<Map<string, PPSTimeline>> {
  const uniqueVaults = Array.from(
    new Map(vaults.map((vault) => [`${vault.chainId}:${vault.vaultAddress.toLowerCase()}`, vault])).values()
  )
  const outcomes = await Promise.all(uniqueVaults.map((vault) => fetchVaultPpsOutcome(vault, options)))
  const timelines = new Map(outcomes.map((outcome) => [outcome.key, outcome.timeline]))
  const failedVaults = outcomes.filter((outcome) => outcome.failed).length
  Object.defineProperty(timelines, PPS_FETCH_FAILED_VAULTS, {
    value: failedVaults,
    enumerable: false
  })
  debugLog('kong-pps', 'resolved PPS timelines with Kong', {
    requested: vaults.length,
    unique: uniqueVaults.length,
    failedVaults
  })

  return timelines
}
