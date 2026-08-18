import { holdingsConfig } from '@/server/lib/holdings/config'
import { debugError, debugLog } from '@/server/lib/holdings/services/debug'
import { getChainPrefix } from '@/server/lib/holdings/services/defillama'

type TKongTimeseriesPoint = Readonly<{
  time: number | string
  component: string
  value: number | string
}>

export type TKongHeldAssetPriceRequirement = Readonly<{
  chainId: number
  vaultAddress: string
  assetAddress: string
  timestamps: readonly number[]
}>

export type TKongAssetPricePrefetchRequest = Readonly<{
  chainId: number
  assetAddress: string
}>

export interface TKongAssetPricePrefetcher {
  readonly prefetch: (requests: readonly TKongAssetPricePrefetchRequest[]) => void
  readonly resolve: (
    requirements: readonly TKongHeldAssetPriceRequirement[]
  ) => Promise<Map<string, Map<number, number>>>
}

type TKongAssetPriceCandidate = Readonly<{
  vaultAddress: string
  timestamps: readonly number[]
}>

type TKongAssetPriceGroup = Readonly<{
  chainId: number
  assetAddress: string
  priceKey: string
  timestamps: readonly number[]
  candidates: readonly TKongAssetPriceCandidate[]
}>

type TKongFetchError = Error & { status?: number }

type TKongAssetPriceGroupState = {
  readonly group: TKongAssetPriceGroup
  readonly promise: Promise<Map<number, number>>
  readonly resolve: (prices: Map<number, number>) => void
  phase: 'queued' | 'running' | 'settled'
  prices: Map<number, number>
}

const KONG_PRICE_COMPONENT = 'priceUsd'
const KONG_TIMESERIES_TIMEOUT_MS = 4_000
const KONG_TIMESERIES_MAX_RETRIES = 1
const KONG_TIMESERIES_RETRY_DELAY_MS = 200
const KONG_FALLBACK_BUDGET_MS = 6_000
const MAX_CONCURRENT_KONG_ASSET_GROUPS = 8
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

function createAssetPriceGroupState(group: TKongAssetPriceGroup): TKongAssetPriceGroupState {
  const controls: { resolve: (prices: Map<number, number>) => void } = {
    resolve: () => undefined
  }
  const promise = new Promise<Map<number, number>>((resolve) => {
    controls.resolve = resolve
  })

  return {
    group,
    promise,
    resolve: (prices) => controls.resolve(prices),
    phase: 'queued',
    prices: new Map()
  }
}

function toUtcDayStart(timestamp: number): number {
  return Math.floor(timestamp / 86_400) * 86_400
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function isRetryableError(error: unknown): boolean {
  const status = (error as Partial<TKongFetchError>)?.status
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    (typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status)) ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('socket') ||
    message.includes('unable to connect')
  )
}

function groupRequirements(requirements: readonly TKongHeldAssetPriceRequirement[]): TKongAssetPriceGroup[] {
  const byAsset = requirements.reduce<
    Map<
      string,
      {
        chainId: number
        assetAddress: string
        priceKey: string
        timestamps: Set<number>
        candidateTimestamps: Map<string, Set<number>>
      }
    >
  >((groups, requirement) => {
    const assetAddress = requirement.assetAddress.toLowerCase()
    const vaultAddress = requirement.vaultAddress.toLowerCase()
    const priceKey = `${getChainPrefix(requirement.chainId)}:${assetAddress}`
    const group = groups.get(priceKey) ?? {
      chainId: requirement.chainId,
      assetAddress,
      priceKey,
      timestamps: new Set<number>(),
      candidateTimestamps: new Map<string, Set<number>>()
    }
    const candidateTimestamps = group.candidateTimestamps.get(vaultAddress) ?? new Set<number>()
    requirement.timestamps.forEach((timestamp) => {
      group.timestamps.add(timestamp)
      candidateTimestamps.add(timestamp)
    })
    group.candidateTimestamps.set(vaultAddress, candidateTimestamps)
    groups.set(priceKey, group)
    return groups
  }, new Map())

  return Array.from(byAsset.values())
    .map((group) => ({
      chainId: group.chainId,
      assetAddress: group.assetAddress,
      priceKey: group.priceKey,
      timestamps: Array.from(group.timestamps).toSorted((left, right) => left - right),
      candidates: Array.from(group.candidateTimestamps.entries())
        .map(([vaultAddress, timestamps]) => ({
          vaultAddress,
          timestamps: Array.from(timestamps).toSorted((left, right) => left - right)
        }))
        .toSorted((left, right) => left.vaultAddress.localeCompare(right.vaultAddress))
    }))
    .toSorted((left, right) => left.priceKey.localeCompare(right.priceKey))
}

function parseKongVaultAssetPriceTimeline(value: unknown, requestedTimestamps: readonly number[]): Map<number, number> {
  if (!Array.isArray(value)) {
    throw new Error('Kong vault asset price response must be an array')
  }
  const requestedByDay = requestedTimestamps.reduce<Map<number, number[]>>((byDay, timestamp) => {
    const dayStart = toUtcDayStart(timestamp)
    byDay.set(dayStart, [...(byDay.get(dayStart) ?? []), timestamp])
    return byDay
  }, new Map())
  const pricesByDay = value.reduce<Map<number, Set<number>>>((prices, rawPoint) => {
    if (!rawPoint || typeof rawPoint !== 'object') {
      return prices
    }
    const point = rawPoint as Partial<TKongTimeseriesPoint>
    const time = Number(point.time)
    const price = Number(point.value)
    if (
      point.component !== KONG_PRICE_COMPONENT ||
      !Number.isSafeInteger(time) ||
      time % 86_400 !== 0 ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !requestedByDay.has(time)
    ) {
      return prices
    }
    prices.set(time, new Set([...(prices.get(time) ?? []), price]))
    return prices
  }, new Map())
  const result = new Map<number, number>()
  pricesByDay.forEach((prices, dayStart) => {
    if (prices.size !== 1) {
      return
    }
    const price = prices.values().next().value
    if (price === undefined) {
      return
    }
    requestedByDay.get(dayStart)?.forEach((timestamp) => {
      result.set(timestamp, price)
    })
  })
  return result
}

async function fetchKongVaultAssetPriceTimeline(args: {
  readonly chainId: number
  readonly vaultAddress: string
  readonly timestamps: readonly number[]
  readonly fetchFn: typeof fetch
  readonly deadlineMs: number
  readonly attempt?: number
}): Promise<Map<number, number>> {
  if (Date.now() >= args.deadlineMs) {
    throw new Error('Kong vault asset price fallback deadline expired')
  }
  const url = `${holdingsConfig.kongBaseUrl}/api/rest/timeseries/tvl/${args.chainId}/${args.vaultAddress}?components=${KONG_PRICE_COMPONENT}`
  try {
    const timeoutMs = Math.max(1, Math.min(KONG_TIMESERIES_TIMEOUT_MS, args.deadlineMs - Date.now()))
    const response = await args.fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) {
      const error = new Error(
        `Kong vault asset price request failed: ${response.status} for ${args.vaultAddress}`
      ) as TKongFetchError
      error.status = response.status
      throw error
    }
    return parseKongVaultAssetPriceTimeline(await response.json(), args.timestamps)
  } catch (error) {
    const attempt = args.attempt ?? 0
    const retryDelayMs = KONG_TIMESERIES_RETRY_DELAY_MS * 2 ** attempt
    if (
      attempt >= KONG_TIMESERIES_MAX_RETRIES ||
      !isRetryableError(error) ||
      Date.now() + retryDelayMs >= args.deadlineMs
    ) {
      throw error
    }
    await wait(retryDelayMs)
    return fetchKongVaultAssetPriceTimeline({ ...args, attempt: attempt + 1 })
  }
}

async function resolveAssetGroup(args: {
  readonly group: TKongAssetPriceGroup
  readonly fetchFn: typeof fetch
  readonly deadlineMs: number
}): Promise<Map<number, number>> {
  const missingTimestamps = new Set(args.group.timestamps)
  const resolved = new Map<number, number>()

  await args.group.candidates.reduce<Promise<void>>(async (previous, candidate) => {
    await previous
    if (missingTimestamps.size === 0 || Date.now() >= args.deadlineMs) {
      return
    }
    const timestamps = candidate.timestamps.filter((timestamp) => missingTimestamps.has(timestamp))
    if (timestamps.length === 0) {
      return
    }
    try {
      const prices = await fetchKongVaultAssetPriceTimeline({
        chainId: args.group.chainId,
        vaultAddress: candidate.vaultAddress,
        timestamps,
        fetchFn: args.fetchFn,
        deadlineMs: args.deadlineMs
      })
      prices.forEach((price, timestamp) => {
        if (missingTimestamps.delete(timestamp)) {
          resolved.set(timestamp, price)
        }
      })
    } catch (error) {
      debugError('kong-asset-prices', 'historical daily-average asset price timeline failed', error, {
        priceKey: args.group.priceKey
      })
    }
  }, Promise.resolve())

  return resolved
}

async function resolveGroupsWithContinuousConcurrency(
  groups: readonly TKongAssetPriceGroup[],
  fetchFn: typeof fetch,
  deadlineMs: number
): Promise<Array<Readonly<{ group: TKongAssetPriceGroup; prices: Map<number, number> }>>> {
  const nextIndex = { value: 0 }
  const results = new Array<Readonly<{ group: TKongAssetPriceGroup; prices: Map<number, number> }>>(groups.length)
  const workerCount = Math.min(groups.length, MAX_CONCURRENT_KONG_ASSET_GROUPS)
  const runWorker = async (): Promise<void> => {
    const index = nextIndex.value
    nextIndex.value += 1
    const group = groups[index]
    if (!group) {
      return
    }
    results[index] = {
      group,
      prices: await resolveAssetGroup({ group, fetchFn, deadlineMs })
    }
    return runWorker()
  }
  const workers = Array.from({ length: workerCount }, runWorker)
  await Promise.all(workers)
  return results.filter(
    (result): result is Readonly<{ group: TKongAssetPriceGroup; prices: Map<number, number> }> => result !== undefined
  )
}

/**
 * Starts Kong only after the primary provider proves that a held asset/day is
 * missing. The request-scoped queue lets those exact fallback reads overlap
 * the remaining primary-price and PPS work without changing provider
 * precedence or issuing an unbounded speculative fan-out.
 */
export function createKongAssetPricePrefetcher(args: {
  readonly potentialRequirements: readonly TKongHeldAssetPriceRequirement[]
  readonly fetchFn?: typeof fetch
  readonly maxConcurrency?: number
}): TKongAssetPricePrefetcher {
  const potentialGroups = new Map(groupRequirements(args.potentialRequirements).map((group) => [group.priceKey, group]))
  const fetchFn = args.fetchFn ?? fetch
  const requestedConcurrency = Math.floor(args.maxConcurrency ?? MAX_CONCURRENT_KONG_ASSET_GROUPS)
  const maxConcurrency =
    Number.isSafeInteger(requestedConcurrency) && requestedConcurrency > 0
      ? Math.min(MAX_CONCURRENT_KONG_ASSET_GROUPS, requestedConcurrency)
      : MAX_CONCURRENT_KONG_ASSET_GROUPS
  const states = new Map<string, TKongAssetPriceGroupState>()
  const queue: TKongAssetPriceGroupState[] = []
  const active = { count: 0, peak: 0 }
  const resolutionDeadline = { value: null as number | null }
  const prefetchStats = { started: 0, startedBeforeResolve: 0 }

  const drainQueue = (): void => {
    if (active.count >= maxConcurrency) {
      return
    }
    const state = queue.shift()
    if (!state) {
      return
    }
    if (resolutionDeadline.value !== null && Date.now() >= resolutionDeadline.value) {
      state.phase = 'settled'
      state.resolve(state.prices)
      drainQueue()
      return
    }

    state.phase = 'running'
    active.count += 1
    active.peak = Math.max(active.peak, active.count)
    prefetchStats.started += 1
    if (resolutionDeadline.value === null) {
      prefetchStats.startedBeforeResolve += 1
    }
    const deadlineMs = Math.min(
      Date.now() + KONG_FALLBACK_BUDGET_MS,
      resolutionDeadline.value ?? Number.POSITIVE_INFINITY
    )
    void resolveAssetGroup({ group: state.group, fetchFn, deadlineMs })
      .then((prices) => {
        state.prices = prices
        state.phase = 'settled'
        state.resolve(prices)
      })
      .catch((error) => {
        debugError('kong-asset-prices', 'request-scoped historical asset-price prefetch failed', error, {
          priceKey: state.group.priceKey
        })
        state.phase = 'settled'
        state.resolve(state.prices)
      })
      .finally(() => {
        active.count -= 1
        drainQueue()
      })
    drainQueue()
  }

  const scheduleGroup = (group: TKongAssetPriceGroup): TKongAssetPriceGroupState => {
    const existing = states.get(group.priceKey)
    if (existing) {
      return existing
    }
    const state = createAssetPriceGroupState(group)
    states.set(group.priceKey, state)
    queue.push(state)
    drainQueue()
    return state
  }

  const prefetch = (requests: readonly TKongAssetPricePrefetchRequest[]): void => {
    const groups = Array.from(
      new Set(requests.map((request) => `${getChainPrefix(request.chainId)}:${request.assetAddress.toLowerCase()}`))
    ).flatMap((priceKey) => {
      const group = potentialGroups.get(priceKey)
      return group ? [group] : []
    })
    const groupsToSchedule = groups.filter((group) => !states.has(group.priceKey))
    if (groupsToSchedule.length === 0) {
      return
    }
    debugLog('kong-asset-prices', 'starting request-scoped historical daily-average asset-price prefetch', {
      assets: groupsToSchedule.length,
      queuedAssets: queue.length,
      activeAssets: active.count,
      maxConcurrency
    })
    groupsToSchedule.forEach(scheduleGroup)
  }

  const resolve = async (
    requirements: readonly TKongHeldAssetPriceRequirement[]
  ): Promise<Map<string, Map<number, number>>> => {
    const finalGroups = groupRequirements(requirements)
    if (finalGroups.length === 0) {
      return new Map()
    }

    const finalKeys = new Set(finalGroups.map((group) => group.priceKey))
    const discardedQueuedStates = queue.filter((state) => !finalKeys.has(state.group.priceKey))
    queue.splice(0, queue.length, ...queue.filter((state) => finalKeys.has(state.group.priceKey)))
    discardedQueuedStates.forEach((state) => {
      state.phase = 'settled'
      state.resolve(state.prices)
    })
    resolutionDeadline.value = Date.now() + KONG_FALLBACK_BUDGET_MS
    const finalStates = finalGroups.map((group) => scheduleGroup(potentialGroups.get(group.priceKey) ?? group))
    drainQueue()

    debugLog('kong-asset-prices', 'resolving missing historical daily-average asset prices', {
      assets: finalGroups.length,
      candidateVaults: finalGroups.reduce((total, group) => total + group.candidates.length, 0),
      missingPricePoints: finalGroups.reduce((total, group) => total + group.timestamps.length, 0),
      prefetchedAssets: finalStates.filter((state) => state.phase !== 'queued').length,
      startedBeforeResolve: prefetchStats.startedBeforeResolve,
      maxConcurrency
    })

    const timeoutControl = { id: undefined as ReturnType<typeof setTimeout> | undefined }
    const timeout = new Promise<void>((resolveTimeout) => {
      timeoutControl.id = setTimeout(resolveTimeout, KONG_FALLBACK_BUDGET_MS)
    })
    await Promise.race([Promise.all(finalStates.map((state) => state.promise)).then(() => undefined), timeout])
    if (timeoutControl.id !== undefined) {
      clearTimeout(timeoutControl.id)
    }

    const resolved = new Map<string, Map<number, number>>()
    finalGroups.forEach((group) => {
      const prices = states.get(group.priceKey)?.prices ?? new Map<number, number>()
      const requestedTimestamps = new Set(group.timestamps)
      resolved.set(
        group.priceKey,
        new Map(Array.from(prices).filter(([timestamp]) => requestedTimestamps.has(timestamp)))
      )
    })
    debugLog('kong-asset-prices', 'completed missing historical daily-average asset prices', {
      assets: finalGroups.length,
      filledPricePoints: Array.from(resolved.values()).reduce((total, prices) => total + prices.size, 0),
      startedBeforeResolve: prefetchStats.startedBeforeResolve,
      peakConcurrentAssets: active.peak
    })
    return resolved
  }

  return { prefetch, resolve }
}

export async function fetchMissingHistoricalAssetPricesFromKong(args: {
  readonly requirements: readonly TKongHeldAssetPriceRequirement[]
  readonly fetchFn?: typeof fetch
}): Promise<Map<string, Map<number, number>>> {
  const groups = groupRequirements(args.requirements)
  if (groups.length === 0) {
    return new Map()
  }

  const deadlineMs = Date.now() + KONG_FALLBACK_BUDGET_MS
  debugLog('kong-asset-prices', 'fetching missing historical daily-average asset prices', {
    assets: groups.length,
    candidateVaults: groups.reduce((total, group) => total + group.candidates.length, 0),
    missingPricePoints: groups.reduce((total, group) => total + group.timestamps.length, 0)
  })
  const results = await resolveGroupsWithContinuousConcurrency(groups, args.fetchFn ?? fetch, deadlineMs)
  const resolved = new Map<string, Map<number, number>>()
  results.forEach(({ group, prices }) => {
    resolved.set(group.priceKey, prices)
  })
  debugLog('kong-asset-prices', 'completed missing historical daily-average asset prices', {
    assets: groups.length,
    filledPricePoints: results.reduce((total, result) => total + result.prices.size, 0)
  })
  return resolved
}
