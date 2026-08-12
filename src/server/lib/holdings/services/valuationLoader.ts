import { randomUUID } from 'node:crypto'
import { debugError, debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import {
  fetchHistoricalPricesForTokenTimestamps,
  getChainPrefix,
  getHistoricalPriceFetchFailedBatches,
  setHistoricalPriceFetchFailedBatches,
  type THistoricalPriceFetchOptions,
  type THistoricalPriceFetchResolution,
  type THistoricalPriceRequest
} from '@/server/lib/holdings/services/defillama'
import {
  fetchMultipleVaultsPPS,
  getPpsFetchFailedVaultKeys,
  type PPSTimeline,
  setPpsFetchFailureMetadata
} from '@/server/lib/holdings/services/kong'

export type THoldingsVaultPpsRequest = Readonly<{
  chainId: number
  vaultAddress: string
}>

export type THoldingsHistoricalPriceRequest = Readonly<{
  chainId: number
  address: string
  timestamps: readonly number[]
}>

export type THoldingsValuationConsumer = 'growth' | 'protocol-return' | 'balance'

export type THoldingsValuationRequestOptions = Readonly<{
  consumer?: THoldingsValuationConsumer
}>

export type THoldingsValuationPpsOptions = THoldingsValuationRequestOptions

export type THoldingsHistoricalPriceLoadOptions = THistoricalPriceFetchOptions & THoldingsValuationRequestOptions

export interface THoldingsValuationLoader {
  readonly key: string
  readonly fetchVaultPps: (
    vaults: readonly THoldingsVaultPpsRequest[],
    options?: THoldingsValuationPpsOptions
  ) => Promise<Map<string, PPSTimeline>>
  readonly fetchHistoricalPrices: (
    requests: readonly THoldingsHistoricalPriceRequest[],
    options?: THoldingsHistoricalPriceLoadOptions
  ) => Promise<Map<string, Map<number, number>>>
}

type TDeferred<T> = Readonly<{
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}>

type TNormalizedVaultPpsRequest = Readonly<{
  key: string
  chainId: number
  vaultAddress: string
}>

type TPpsEntry = Readonly<{
  timeline: PPSTimeline
  failed: boolean
}>

type TPendingPpsEntry = {
  readonly request: TNormalizedVaultPpsRequest
  readonly deferred: TDeferred<TPpsEntry>
  consumer: THoldingsValuationConsumer
}

type TValuationEntryPhase = 'pending' | 'in-flight' | 'settled'

type TPpsEntryState = {
  readonly promise: Promise<TPpsEntry>
  consumer: THoldingsValuationConsumer
  phase: TValuationEntryPhase
}

type TNormalizedHistoricalPriceRequest = Readonly<{
  tokenKey: string
  chainId: number
  address: string
  timestamps: readonly number[]
}>

type TPriceFailureRecord = Readonly<{
  failedBatches: number
}>

type TPriceEntry = Readonly<{
  price: number | undefined
  failureRecord: TPriceFailureRecord | null
}>

type TPriceProviderEntry = Readonly<{
  readonly cacheKey: string
  readonly request: Omit<TNormalizedHistoricalPriceRequest, 'timestamps'>
  readonly providerTimestamp: number
}>

type TPriceRangePlanningEntry = TPriceProviderEntry & {
  readonly requestedConsumers: Set<THoldingsValuationConsumer>
  consumer: THoldingsValuationConsumer
}

type TPendingPriceEntry = TPriceRangePlanningEntry & {
  readonly deferred: TDeferred<TPriceEntry>
}

type TPriceEntryState = {
  readonly promise: Promise<TPriceEntry>
  readonly providerEntry: TPriceProviderEntry
  readonly requestedConsumers: Set<THoldingsValuationConsumer>
  settledEntry: TPriceEntry | null
  consumer: THoldingsValuationConsumer
  phase: TValuationEntryPhase
}

type TQueuedPriceDispatch = Readonly<{
  consumer: THoldingsValuationConsumer
  sequence: number
  dispatch: () => Promise<void>
}>

const PRICE_RESOLUTIONS = ['strict', 'utc_day'] as const satisfies readonly THistoricalPriceFetchResolution[]
const VALUATION_CONSUMERS = [
  'growth',
  'protocol-return',
  'balance'
] as const satisfies readonly THoldingsValuationConsumer[]
const VALUATION_CONSUMER_PRIORITY: Readonly<Record<THoldingsValuationConsumer, number>> = {
  growth: 3,
  'protocol-return': 2,
  balance: 1
}
const SECONDS_PER_DAY = 86_400
const MAX_DUPLICATED_PRICE_POINTS_PER_LOADER = 256
const MAX_CONCURRENT_PRICE_PROVIDER_BATCHES_PER_LOADER = 2

function createDeferred<T>(): TDeferred<T> {
  const controls: {
    resolve: (value: T) => void
    reject: (reason?: unknown) => void
  } = {
    resolve: () => undefined,
    reject: () => undefined
  }
  const promise = new Promise<T>((resolve, reject) => {
    controls.resolve = resolve
    controls.reject = reject
  })

  return {
    promise,
    resolve: (value) => controls.resolve(value),
    reject: (reason) => controls.reject(reason)
  }
}

function normalizeChainId(chainId: number): number {
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid holdings valuation chain ID: ${chainId}`)
  }

  return chainId
}

function normalizeAddress(address: string, label: string): string {
  const normalizedAddress = address.trim().toLowerCase()

  if (normalizedAddress.length === 0) {
    throw new Error(`Holdings valuation ${label} is required`)
  }

  return normalizedAddress
}

function normalizeVaultPpsRequest(request: THoldingsVaultPpsRequest): TNormalizedVaultPpsRequest {
  const chainId = normalizeChainId(request.chainId)
  const vaultAddress = normalizeAddress(request.vaultAddress, 'vault address')

  return {
    key: `${chainId}:${vaultAddress}`,
    chainId,
    vaultAddress
  }
}

function normalizeTimestamp(timestamp: number): number {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error(`Invalid holdings valuation timestamp: ${timestamp}`)
  }

  return timestamp
}

function normalizeHistoricalPriceRequests(
  requests: readonly THoldingsHistoricalPriceRequest[]
): TNormalizedHistoricalPriceRequest[] {
  const mergedRequests = requests.reduce<Map<string, TNormalizedHistoricalPriceRequest>>((merged, request) => {
    const chainId = normalizeChainId(request.chainId)
    const address = normalizeAddress(request.address, 'token address')
    const tokenKey = `${getChainPrefix(chainId)}:${address}`
    const timestamps = Array.from(new Set(request.timestamps.map(normalizeTimestamp))).toSorted(
      (left, right) => left - right
    )
    const existing = merged.get(tokenKey)
    const mergedTimestamps = Array.from(new Set([...(existing?.timestamps ?? []), ...timestamps])).toSorted(
      (left, right) => left - right
    )

    merged.set(tokenKey, {
      tokenKey,
      chainId,
      address,
      timestamps: mergedTimestamps
    })
    return merged
  }, new Map())

  return Array.from(mergedRequests.values())
}

function getPriceResolution(options?: THistoricalPriceFetchOptions): THistoricalPriceFetchResolution {
  const resolution = options?.resolution ?? 'strict'

  if (!PRICE_RESOLUTIONS.includes(resolution)) {
    throw new Error(`Invalid holdings historical price resolution: ${resolution}`)
  }

  return resolution
}

function getValuationConsumer(options?: THoldingsValuationRequestOptions): THoldingsValuationConsumer {
  const consumer = options?.consumer ?? 'balance'

  if (!VALUATION_CONSUMERS.includes(consumer)) {
    throw new Error(`Invalid holdings valuation consumer: ${consumer}`)
  }

  return consumer
}

function promoteConsumer(
  current: THoldingsValuationConsumer,
  requested: THoldingsValuationConsumer
): THoldingsValuationConsumer {
  return VALUATION_CONSUMER_PRIORITY[requested] > VALUATION_CONSUMER_PRIORITY[current] ? requested : current
}

function isHigherPriorityConsumer(requested: THoldingsValuationConsumer, current: THoldingsValuationConsumer): boolean {
  return VALUATION_CONSUMER_PRIORITY[requested] > VALUATION_CONSUMER_PRIORITY[current]
}

function groupPendingEntriesByConsumer<TEntry extends { readonly consumer: THoldingsValuationConsumer }>(
  entries: readonly TEntry[]
): Array<Readonly<{ consumer: THoldingsValuationConsumer; entries: TEntry[] }>> {
  return VALUATION_CONSUMERS.map((consumer) => ({
    consumer,
    entries: entries.filter((entry) => entry.consumer === consumer)
  })).filter((group) => group.entries.length > 0)
}

function getPriceCacheKey(
  resolution: THistoricalPriceFetchResolution,
  tokenKey: string,
  providerTimestamp: number
): string {
  return `${resolution}:${tokenKey}:${providerTimestamp}`
}

function getProviderPriceTimestamp(resolution: THistoricalPriceFetchResolution, timestamp: number): number {
  return resolution === 'utc_day' ? Math.floor(timestamp / 86_400) * 86_400 + 86_399 : timestamp
}

function clonePpsTimeline(timeline: PPSTimeline | undefined): PPSTimeline {
  return new Map(timeline ?? [])
}

function getPriceEntriesByToken<TEntry extends Pick<TPriceProviderEntry, 'request'>>(
  entries: readonly TEntry[]
): ReadonlyMap<string, readonly TEntry[]> {
  return entries.reduce<Map<string, TEntry[]>>((byToken, entry) => {
    const tokenEntries = byToken.get(entry.request.tokenKey) ?? []
    tokenEntries.push(entry)
    byToken.set(entry.request.tokenKey, tokenEntries)
    return byToken
  }, new Map())
}

function areContiguousUtcDayEntries<TEntry extends Pick<TPriceProviderEntry, 'providerTimestamp'>>(
  entries: readonly TEntry[]
): boolean {
  const timestamps = entries.map(({ providerTimestamp }) => providerTimestamp).toSorted((left, right) => left - right)
  return timestamps.every(
    (timestamp, index) => index === 0 || timestamp - (timestamps[index - 1] ?? timestamp) === SECONDS_PER_DAY
  )
}

function arePriceEntriesContiguousByToken(entries: readonly TPriceProviderEntry[]): boolean {
  return Array.from(getPriceEntriesByToken(entries).values()).every(areContiguousUtcDayEntries)
}

function getBalanceRangeFillerEntries(
  balanceEntries: readonly TPendingPriceEntry[],
  candidateEntries: readonly TPriceRangePlanningEntry[]
): TPriceProviderEntry[] {
  const candidatesByToken = getPriceEntriesByToken(
    Array.from(
      new Map(
        candidateEntries
          .filter(({ requestedConsumers, consumer }) => requestedConsumers.has('balance') && consumer !== 'balance')
          .map((entry) => [entry.cacheKey, entry])
      ).values()
    )
  )

  return Array.from(getPriceEntriesByToken(balanceEntries).values()).flatMap((ownedEntries) => {
    const sortedOwnedEntries = ownedEntries.toSorted((left, right) => left.providerTimestamp - right.providerTimestamp)

    if (sortedOwnedEntries.length < 2) {
      return []
    }

    const firstOwnedTimestamp = sortedOwnedEntries[0]?.providerTimestamp ?? 0
    const lastOwnedTimestamp = sortedOwnedEntries.at(-1)?.providerTimestamp ?? 0
    const tokenKey = sortedOwnedEntries[0]?.request.tokenKey
    const interiorCandidates = (tokenKey ? (candidatesByToken.get(tokenKey) ?? []) : []).filter(
      ({ providerTimestamp }) => providerTimestamp > firstOwnedTimestamp && providerTimestamp < lastOwnedTimestamp
    )
    const filledEntries = [...sortedOwnedEntries, ...interiorCandidates]

    return areContiguousUtcDayEntries(filledEntries) ? interiorCandidates : []
  })
}

function getContiguousPriceRuns(entries: readonly TPendingPriceEntry[]): TPendingPriceEntry[][] {
  return entries
    .toSorted((left, right) => left.providerTimestamp - right.providerTimestamp)
    .reduce<TPendingPriceEntry[][]>((runs, entry) => {
      const currentRun = runs.at(-1)
      const previousEntry = currentRun?.at(-1)

      if (
        currentRun &&
        previousEntry &&
        entry.providerTimestamp - previousEntry.providerTimestamp === SECONDS_PER_DAY
      ) {
        currentRun.push(entry)
        return runs
      }

      runs.push([entry])
      return runs
    }, [])
}

function splitPriceEntriesForRangeEfficiency(entries: readonly TPendingPriceEntry[]): TPendingPriceEntry[][] {
  const runsByToken = Array.from(getPriceEntriesByToken(entries).values()).map(getContiguousPriceRuns)
  const longRunsByToken = runsByToken.map((runs) => runs.filter((run) => run.length > 1))
  const maximumLongRuns = Math.max(0, ...longRunsByToken.map((runs) => runs.length))
  const rangeBatches = Array.from({ length: maximumLongRuns }, (_value, index) =>
    longRunsByToken.flatMap((runs) => runs[index] ?? [])
  ).filter((batch) => batch.length > 0)
  const sparseBatch = runsByToken.flatMap((runs) => runs.filter((run) => run.length === 1).flat())

  return [...rangeBatches, ...(sparseBatch.length > 0 ? [sparseBatch] : [])]
}

export function createHoldingsValuationLoader(): THoldingsValuationLoader {
  const key = `holdings-valuation:${randomUUID()}`
  const ppsEntryPromises = new Map<string, Promise<TPpsEntry>>()
  const ppsEntryStates = new Map<string, TPpsEntryState>()
  const pendingPpsEntries = new Map<string, TPendingPpsEntry>()
  const ppsScheduleState = { scheduled: false }
  const priceEntryPromises = new Map<string, Promise<TPriceEntry>>()
  const priceEntryStates = new Map<string, TPriceEntryState>()
  const priceDuplicationBudget = { remaining: MAX_DUPLICATED_PRICE_POINTS_PER_LOADER }
  const pendingPriceEntries = {
    strict: new Map<string, TPendingPriceEntry>(),
    utc_day: new Map<string, TPendingPriceEntry>()
  } satisfies Record<THistoricalPriceFetchResolution, Map<string, TPendingPriceEntry>>
  const pendingBalanceRangeFillers = {
    strict: new Map<string, TPriceRangePlanningEntry>(),
    utc_day: new Map<string, TPriceRangePlanningEntry>()
  } satisfies Record<THistoricalPriceFetchResolution, Map<string, TPriceRangePlanningEntry>>
  const priceScheduleState: Record<THistoricalPriceFetchResolution, boolean> = {
    strict: false,
    utc_day: false
  }
  const priceDispatchQueue: TQueuedPriceDispatch[] = []
  const priceDispatchScheduleState = { scheduled: false }
  const activePriceDispatches = { count: 0 }
  const activeBalancePriceDispatches = { count: 0 }
  const priceDispatchSequence = { next: 0 }

  const schedulePriceDispatchQueue = (): void => {
    if (!priceDispatchScheduleState.scheduled) {
      priceDispatchScheduleState.scheduled = true
      queueMicrotask(drainPriceDispatchQueue)
    }
  }

  const drainPriceDispatchQueue = (): void => {
    priceDispatchScheduleState.scheduled = false
    const availableDispatches = Math.max(
      0,
      MAX_CONCURRENT_PRICE_PROVIDER_BATCHES_PER_LOADER - activePriceDispatches.count
    )
    if (availableDispatches === 0 || priceDispatchQueue.length === 0) {
      return
    }

    const sortedQueue = priceDispatchQueue.toSorted(
      (left, right) =>
        VALUATION_CONSUMER_PRIORITY[right.consumer] - VALUATION_CONSUMER_PRIORITY[left.consumer] ||
        left.sequence - right.sequence
    )
    const dispatches = sortedQueue.reduce<TQueuedPriceDispatch[]>((selected, queuedDispatch) => {
      if (selected.length >= availableDispatches) {
        return selected
      }

      const selectedBalanceDispatches = selected.filter(({ consumer }) => consumer === 'balance').length
      if (
        queuedDispatch.consumer === 'balance' &&
        activeBalancePriceDispatches.count + selectedBalanceDispatches >= 1
      ) {
        return selected
      }

      selected.push(queuedDispatch)
      return selected
    }, [])
    const selectedSequences = new Set(dispatches.map(({ sequence }) => sequence))
    const retainedDispatches = priceDispatchQueue.filter(({ sequence }) => !selectedSequences.has(sequence))
    priceDispatchQueue.splice(0, priceDispatchQueue.length, ...retainedDispatches)
    activePriceDispatches.count += dispatches.length
    activeBalancePriceDispatches.count += dispatches.filter(({ consumer }) => consumer === 'balance').length
    dispatches.forEach(({ consumer, dispatch }) => {
      const releaseDispatch = (): void => {
        activePriceDispatches.count -= 1
        if (consumer === 'balance') {
          activeBalancePriceDispatches.count -= 1
        }
        schedulePriceDispatchQueue()
      }
      void dispatch().then(releaseDispatch, releaseDispatch)
    })
  }

  const enqueuePriceDispatch = (consumer: THoldingsValuationConsumer, dispatch: () => Promise<void>): void => {
    const sequence = priceDispatchSequence.next
    priceDispatchSequence.next += 1
    priceDispatchQueue.push({ consumer, sequence, dispatch })
    schedulePriceDispatchQueue()
  }

  const dispatchPpsBatch = async (
    consumer: THoldingsValuationConsumer,
    batch: TPendingPpsEntry[],
    lowerProviderConcurrency: boolean
  ): Promise<void> => {
    const getDurationMs = startHoldingsDebugTimer()
    batch.forEach(({ request, deferred }) => {
      const state = ppsEntryStates.get(request.key)
      if (state?.promise === deferred.promise) {
        state.phase = 'in-flight'
        state.consumer = consumer
      }
    })
    debugLog('valuation-loader', 'dispatching coalesced PPS batch', {
      loaderKey: key,
      consumer,
      vaults: batch.length
    })
    try {
      const vaults = batch.map(({ request }) => ({
        chainId: request.chainId,
        vaultAddress: request.vaultAddress
      }))
      const result = lowerProviderConcurrency
        ? await fetchMultipleVaultsPPS(vaults, { concurrency: 1 })
        : await fetchMultipleVaultsPPS(vaults)
      const failedVaultKeys = new Set(getPpsFetchFailedVaultKeys(result))

      batch.forEach(({ request, deferred }) => {
        const state = ppsEntryStates.get(request.key)
        if (state?.promise === deferred.promise) {
          state.phase = 'settled'
        }
        deferred.resolve({
          timeline: clonePpsTimeline(result.get(request.key)),
          failed: failedVaultKeys.has(request.key)
        })
      })
      debugLog('valuation-loader', 'completed coalesced PPS batch', {
        loaderKey: key,
        consumer,
        vaults: batch.length,
        failedVaults: failedVaultKeys.size,
        durationMs: getDurationMs()
      })
    } catch (error) {
      batch.forEach(({ request, deferred }) => {
        if (ppsEntryPromises.get(request.key) === deferred.promise) {
          ppsEntryPromises.delete(request.key)
          ppsEntryStates.delete(request.key)
        }
        deferred.reject(error)
      })
      debugError('valuation-loader', 'coalesced PPS batch failed', error, {
        loaderKey: key,
        consumer,
        vaults: batch.length,
        durationMs: getDurationMs()
      })
    }
  }

  const flushPpsBatch = (): void => {
    ppsScheduleState.scheduled = false
    const batch = Array.from(pendingPpsEntries.values())
    pendingPpsEntries.clear()
    const consumerBatches = groupPendingEntriesByConsumer(batch)
    const lowerProviderConcurrency = consumerBatches.length > 1

    consumerBatches.forEach(({ consumer, entries }) => {
      void dispatchPpsBatch(consumer, entries, lowerProviderConcurrency)
    })
  }

  const schedulePpsBatch = (): void => {
    if (!ppsScheduleState.scheduled) {
      ppsScheduleState.scheduled = true
      queueMicrotask(flushPpsBatch)
    }
  }

  const loadPpsEntry = (
    request: TNormalizedVaultPpsRequest,
    consumer: THoldingsValuationConsumer
  ): Promise<TPpsEntry> => {
    const existing = ppsEntryPromises.get(request.key)

    if (existing) {
      const pending = pendingPpsEntries.get(request.key)
      if (pending) {
        pending.consumer = promoteConsumer(pending.consumer, consumer)
        const state = ppsEntryStates.get(request.key)
        if (state?.promise === pending.deferred.promise) {
          state.consumer = pending.consumer
        }
        return existing
      }
      const state = ppsEntryStates.get(request.key)
      if (state?.phase !== 'in-flight' || !isHigherPriorityConsumer(consumer, state.consumer)) {
        return existing
      }

      debugLog('valuation-loader', 'forking in-flight PPS key for a higher-priority consumer', {
        loaderKey: key,
        fromConsumer: state.consumer,
        toConsumer: consumer
      })
    }

    const deferred = createDeferred<TPpsEntry>()
    ppsEntryPromises.set(request.key, deferred.promise)
    ppsEntryStates.set(request.key, { promise: deferred.promise, consumer, phase: 'pending' })
    pendingPpsEntries.set(request.key, { request, deferred, consumer })
    schedulePpsBatch()
    return deferred.promise
  }

  const dispatchPriceBatch = async (
    resolution: THistoricalPriceFetchResolution,
    consumer: THoldingsValuationConsumer,
    batch: TPendingPriceEntry[],
    rangeFillers: readonly TPriceProviderEntry[] = []
  ): Promise<void> => {
    const getDurationMs = startHoldingsDebugTimer()
    const providerBatch = [...batch, ...rangeFillers]
    batch.forEach(({ cacheKey, deferred }) => {
      const state = priceEntryStates.get(cacheKey)
      if (state?.promise === deferred.promise) {
        state.phase = 'in-flight'
        state.consumer = consumer
      }
    })
    debugLog('valuation-loader', 'dispatching coalesced historical-price batch', {
      loaderKey: key,
      resolution,
      consumer,
      pricePoints: batch.length,
      providerPricePoints: providerBatch.length,
      duplicatedRangeFillers: rangeFillers.length,
      tokens: new Set(providerBatch.map(({ request }) => request.tokenKey)).size
    })
    try {
      const requests = Array.from(
        providerBatch
          .reduce<Map<string, THistoricalPriceRequest>>((grouped, pending) => {
            const existing = grouped.get(pending.request.tokenKey)
            const timestamps = Array.from(
              new Set([...(existing?.timestamps ?? []), pending.providerTimestamp])
            ).toSorted((left, right) => left - right)

            grouped.set(pending.request.tokenKey, {
              chainId: pending.request.chainId,
              address: pending.request.address,
              timestamps
            })
            return grouped
          }, new Map())
          .values()
      )
      const result = await fetchHistoricalPricesForTokenTimestamps(requests, { resolution })
      const failedBatches = getHistoricalPriceFetchFailedBatches(result)
      const failureRecord = failedBatches > 0 ? { failedBatches } : null
      const missingEntries = batch.filter(
        ({ request, providerTimestamp }) => result.get(request.tokenKey)?.get(providerTimestamp) === undefined
      )
      const missingRangeFillers = rangeFillers.filter(
        ({ request, providerTimestamp }) => result.get(request.tokenKey)?.get(providerTimestamp) === undefined
      )
      const failureEntryKeys = new Set(
        failureRecord === null
          ? []
          : missingEntries.length > 0
            ? missingEntries.map(({ cacheKey }) => cacheKey)
            : rangeFillers.length === 0 || missingRangeFillers.length === 0
              ? batch.slice(0, 1).map(({ cacheKey }) => cacheKey)
              : []
      )

      batch.forEach(({ cacheKey, request, providerTimestamp, deferred }) => {
        const state = priceEntryStates.get(cacheKey)
        const entry = {
          price: result.get(request.tokenKey)?.get(providerTimestamp),
          failureRecord: failureEntryKeys.has(cacheKey) ? failureRecord : null
        }
        if (state?.promise === deferred.promise) {
          state.phase = 'settled'
          state.settledEntry = entry
        }
        deferred.resolve(entry)
      })
      debugLog('valuation-loader', 'completed coalesced historical-price batch', {
        loaderKey: key,
        resolution,
        consumer,
        pricePoints: batch.length,
        providerPricePoints: providerBatch.length,
        duplicatedRangeFillers: rangeFillers.length,
        tokens: requests.length,
        failedBatches,
        durationMs: getDurationMs()
      })
    } catch (error) {
      batch.forEach(({ cacheKey, deferred }) => {
        if (priceEntryPromises.get(cacheKey) === deferred.promise) {
          priceEntryPromises.delete(cacheKey)
          priceEntryStates.delete(cacheKey)
        }
        deferred.reject(error)
      })
      debugError('valuation-loader', 'coalesced historical-price batch failed', error, {
        loaderKey: key,
        resolution,
        consumer,
        pricePoints: batch.length,
        providerPricePoints: providerBatch.length,
        duplicatedRangeFillers: rangeFillers.length,
        durationMs: getDurationMs()
      })
    }
  }

  const enqueuePriceBatch = (
    resolution: THistoricalPriceFetchResolution,
    consumer: THoldingsValuationConsumer,
    batch: TPendingPriceEntry[],
    rangeFillers: readonly TPriceProviderEntry[] = []
  ): void => {
    batch.forEach(({ cacheKey, deferred }) => {
      const state = priceEntryStates.get(cacheKey)
      if (state?.promise === deferred.promise) {
        state.phase = 'in-flight'
        state.consumer = consumer
      }
    })
    enqueuePriceDispatch(consumer, () => dispatchPriceBatch(resolution, consumer, batch, rangeFillers))
  }

  const flushPriceBatch = (resolution: THistoricalPriceFetchResolution): void => {
    priceScheduleState[resolution] = false
    const pendingEntries = pendingPriceEntries[resolution]
    const batch = Array.from(pendingEntries.values())
    pendingEntries.clear()
    const existingBalanceRangeFillers = Array.from(pendingBalanceRangeFillers[resolution].values())
    pendingBalanceRangeFillers[resolution].clear()
    const consumerBatches = groupPendingEntriesByConsumer(batch)
    const balanceBatch = consumerBatches.find(({ consumer }) => consumer === 'balance')
    const sameFlushBalanceRangeFillers = batch.filter(
      ({ requestedConsumers, consumer }) => requestedConsumers.has('balance') && consumer !== 'balance'
    )
    const balanceRangeFillers =
      resolution === 'utc_day'
        ? getBalanceRangeFillerEntries(balanceBatch?.entries ?? [], [
            ...sameFlushBalanceRangeFillers,
            ...existingBalanceRangeFillers
          ])
        : []
    const filledBalanceEntries = [...(balanceBatch?.entries ?? []), ...balanceRangeFillers]
    const useBoundedRangeFillers =
      balanceBatch !== undefined &&
      balanceRangeFillers.length > 0 &&
      balanceRangeFillers.length <= priceDuplicationBudget.remaining &&
      arePriceEntriesContiguousByToken(filledBalanceEntries)
    if (useBoundedRangeFillers) {
      priceDuplicationBudget.remaining -= balanceRangeFillers.length
    }
    const splitBalanceBatch =
      balanceBatch !== undefined &&
      resolution === 'utc_day' &&
      !useBoundedRangeFillers &&
      !arePriceEntriesContiguousByToken(balanceBatch.entries)
        ? splitPriceEntriesForRangeEfficiency(balanceBatch.entries)
        : null

    if (balanceBatch && (balanceRangeFillers.length > 0 || splitBalanceBatch !== null)) {
      debugLog('valuation-loader', 'planned balance historical-price range batches', {
        loaderKey: key,
        resolution,
        ownedPricePoints: balanceBatch.entries.length,
        promotedOverlapPoints: balanceRangeFillers.length,
        duplicatedRangeFillers: useBoundedRangeFillers ? balanceRangeFillers.length : 0,
        remainingDuplicationBudget: priceDuplicationBudget.remaining,
        providerBatches: splitBalanceBatch?.length ?? 1,
        strategy: useBoundedRangeFillers ? 'bounded-range-fillers' : 'split-contiguous-runs'
      })
    }

    consumerBatches.forEach(({ consumer, entries }) => {
      if (consumer !== 'balance') {
        enqueuePriceBatch(resolution, consumer, entries)
        return
      }

      if (useBoundedRangeFillers) {
        enqueuePriceBatch(resolution, consumer, entries, balanceRangeFillers)
        return
      }

      const providerBatches = splitBalanceBatch ?? [entries]
      providerBatches.forEach((providerEntries) => {
        enqueuePriceBatch(resolution, consumer, providerEntries)
      })
    })
  }

  const schedulePriceBatch = (resolution: THistoricalPriceFetchResolution): void => {
    if (!priceScheduleState[resolution]) {
      priceScheduleState[resolution] = true
      queueMicrotask(() => flushPriceBatch(resolution))
    }
  }

  const loadPriceEntry = (
    resolution: THistoricalPriceFetchResolution,
    request: Omit<TNormalizedHistoricalPriceRequest, 'timestamps'>,
    timestamp: number,
    consumer: THoldingsValuationConsumer,
    forkInFlightPromotion: boolean
  ): Promise<TPriceEntry> => {
    const providerTimestamp = getProviderPriceTimestamp(resolution, timestamp)
    const cacheKey = getPriceCacheKey(resolution, request.tokenKey, providerTimestamp)
    const existing = priceEntryPromises.get(cacheKey)

    if (existing) {
      const state = priceEntryStates.get(cacheKey)
      state?.requestedConsumers.add(consumer)
      const pending = pendingPriceEntries[resolution].get(cacheKey)
      if (pending) {
        pending.requestedConsumers.add(consumer)
        pending.consumer = promoteConsumer(pending.consumer, consumer)
        if (state?.promise === pending.deferred.promise) {
          state.consumer = pending.consumer
        }
        return existing
      }
      if (
        !forkInFlightPromotion ||
        !state ||
        state.phase !== 'in-flight' ||
        !isHigherPriorityConsumer(consumer, state.consumer)
      ) {
        return existing
      }
    }

    const deferred = createDeferred<TPriceEntry>()
    const providerEntry = { cacheKey, request, providerTimestamp }
    const requestedConsumers = new Set([consumer])
    priceEntryPromises.set(cacheKey, deferred.promise)
    priceEntryStates.set(cacheKey, {
      promise: deferred.promise,
      providerEntry,
      requestedConsumers,
      settledEntry: null,
      consumer,
      phase: 'pending'
    })
    pendingPriceEntries[resolution].set(cacheKey, {
      ...providerEntry,
      deferred,
      requestedConsumers,
      consumer
    })
    schedulePriceBatch(resolution)
    return deferred.promise
  }

  const fetchVaultPps = async (
    vaults: readonly THoldingsVaultPpsRequest[],
    options?: THoldingsValuationPpsOptions
  ): Promise<Map<string, PPSTimeline>> => {
    const getDurationMs = startHoldingsDebugTimer()
    const consumer = getValuationConsumer(options)
    const requests = Array.from(
      new Map(vaults.map(normalizeVaultPpsRequest).map((request) => [request.key, request])).values()
    )
    const cacheHits = requests.filter((request) => ppsEntryPromises.has(request.key)).length
    const entries = await Promise.all(
      requests.map(async (request) => ({
        request,
        entry: await loadPpsEntry(request, consumer)
      }))
    )
    const result = new Map(entries.map(({ request, entry }) => [request.key, clonePpsTimeline(entry.timeline)]))
    const failedVaultKeys = entries.filter(({ entry }) => entry.failed).map(({ request }) => request.key)
    setPpsFetchFailureMetadata(result, failedVaultKeys)
    debugLog('valuation-loader', 'resolved request-scoped PPS subset', {
      loaderKey: key,
      consumer,
      requestedVaults: vaults.length,
      uniqueVaults: requests.length,
      cacheHits,
      failedVaults: failedVaultKeys.length,
      durationMs: getDurationMs()
    })
    return result
  }

  const fetchHistoricalPrices = async (
    requests: readonly THoldingsHistoricalPriceRequest[],
    options?: THoldingsHistoricalPriceLoadOptions
  ): Promise<Map<string, Map<number, number>>> => {
    const getDurationMs = startHoldingsDebugTimer()
    const resolution = getPriceResolution(options)
    const consumer = getValuationConsumer(options)
    const normalizedRequests = normalizeHistoricalPriceRequests(requests)
    const requestedPricePoints = normalizedRequests.reduce((total, request) => total + request.timestamps.length, 0)
    const canonicalPriceKeys = normalizedRequests.flatMap((request) =>
      request.timestamps.map((timestamp) =>
        getPriceCacheKey(resolution, request.tokenKey, getProviderPriceTimestamp(resolution, timestamp))
      )
    )
    const uniqueCanonicalPriceKeys = Array.from(new Set(canonicalPriceKeys))
    const cacheHits = uniqueCanonicalPriceKeys.filter((cacheKey) => priceEntryPromises.has(cacheKey)).length
    const existingBalanceRangeFillers =
      resolution === 'utc_day' && consumer === 'balance'
        ? uniqueCanonicalPriceKeys.flatMap((cacheKey): TPriceRangePlanningEntry[] => {
            const state = priceEntryStates.get(cacheKey)

            return state &&
              isHigherPriorityConsumer(state.consumer, 'balance') &&
              (state.phase === 'in-flight' || state.settledEntry?.price !== undefined)
              ? [
                  {
                    ...state.providerEntry,
                    requestedConsumers: state.requestedConsumers,
                    consumer: state.consumer
                  }
                ]
              : []
          })
        : []
    const inFlightPromotionKeys = uniqueCanonicalPriceKeys.filter((cacheKey) => {
      const state = priceEntryStates.get(cacheKey)
      return state?.phase === 'in-flight' && isHigherPriorityConsumer(consumer, state.consumer)
    })
    const forkInFlightPromotions =
      inFlightPromotionKeys.length > 0 && inFlightPromotionKeys.length <= priceDuplicationBudget.remaining
    if (forkInFlightPromotions) {
      priceDuplicationBudget.remaining -= inFlightPromotionKeys.length
    }
    if (inFlightPromotionKeys.length > 0) {
      debugLog('valuation-loader', 'planned in-flight historical-price priority promotion', {
        loaderKey: key,
        consumer,
        promotedPricePoints: inFlightPromotionKeys.length,
        duplicatedPricePoints: forkInFlightPromotions ? inFlightPromotionKeys.length : 0,
        remainingDuplicationBudget: priceDuplicationBudget.remaining,
        strategy: forkInFlightPromotions ? 'bounded-independent-subset' : 'share-existing-provider-work'
      })
    }
    const entryPromises = normalizedRequests.flatMap((request) =>
      request.timestamps.map(async (timestamp) => ({
        request,
        timestamp,
        entry: await loadPriceEntry(resolution, request, timestamp, consumer, forkInFlightPromotions)
      }))
    )
    const hasPendingBalanceEntries =
      consumer === 'balance' &&
      uniqueCanonicalPriceKeys.some((cacheKey) => pendingPriceEntries[resolution].get(cacheKey)?.consumer === 'balance')
    if (hasPendingBalanceEntries) {
      existingBalanceRangeFillers.forEach((entry) => {
        pendingBalanceRangeFillers[resolution].set(entry.cacheKey, entry)
      })
    }
    const entries = await Promise.all(entryPromises)
    const result = new Map<string, Map<number, number>>(
      normalizedRequests.map((request) => [request.tokenKey, new Map()])
    )

    entries.forEach(({ request, timestamp, entry }) => {
      if (entry.price !== undefined) {
        result.get(request.tokenKey)?.set(timestamp, entry.price)
      }
    })

    const failureRecords = new Set(
      entries.flatMap(({ entry }) => (entry.failureRecord === null ? [] : [entry.failureRecord]))
    )
    const failedBatches = Array.from(failureRecords).reduce(
      (total, failureRecord) => total + failureRecord.failedBatches,
      0
    )
    setHistoricalPriceFetchFailedBatches(result, failedBatches)
    debugLog('valuation-loader', 'resolved request-scoped historical-price subset', {
      loaderKey: key,
      resolution,
      consumer,
      requestedTokens: requests.length,
      uniqueTokens: normalizedRequests.length,
      requestedPricePoints,
      uniquePricePoints: uniqueCanonicalPriceKeys.length,
      cacheHits,
      failedBatches,
      durationMs: getDurationMs()
    })
    return result
  }

  return {
    key,
    fetchVaultPps,
    fetchHistoricalPrices
  }
}
