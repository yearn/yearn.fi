import { stringifyCanonicalLedgerValue } from '@/server/lib/holdings/services/ledger/codec'
import { compareLedgerOrder } from '@/server/lib/holdings/services/ledger/order'
import {
  LEDGER_STREAMS,
  type TLedgerSixStreams,
  type TLedgerSourceEvent,
  type TLedgerStream
} from '@/server/lib/holdings/services/ledger/types'

export interface TLedgerAuthoritativeWindow {
  readonly stream: TLedgerStream
  readonly chainId: number
  readonly lowerBlock: number
  readonly upperBlock: number
}

export interface TLedgerStreamMergeStats {
  readonly cached: number
  readonly fetched: number
  readonly added: number
  readonly replaced: number
  readonly deleted: number
  readonly total: number
}

export interface TLedgerMergeResult {
  readonly streams: TLedgerSixStreams
  readonly stats: Readonly<Record<TLedgerStream, TLedgerStreamMergeStats>>
  readonly earliestChangedTimestamp: number | null
  readonly latestCachedTimestamp: number | null
}

function getEventIdentity(event: TLedgerSourceEvent): string {
  return stringifyCanonicalLedgerValue([event.chainId, event.id])
}

function assertWindow(window: TLedgerAuthoritativeWindow): void {
  if (
    !Number.isSafeInteger(window.chainId) ||
    window.chainId <= 0 ||
    !Number.isSafeInteger(window.lowerBlock) ||
    window.lowerBlock < 0 ||
    !Number.isSafeInteger(window.upperBlock) ||
    window.upperBlock < window.lowerBlock
  ) {
    throw new Error('Ledger authoritative window is invalid')
  }
}

function getStreamWindows(
  stream: TLedgerStream,
  windows: readonly TLedgerAuthoritativeWindow[]
): Map<number, TLedgerAuthoritativeWindow> {
  return windows
    .filter((window) => window.stream === stream)
    .reduce((byChain, window) => {
      assertWindow(window)
      if (byChain.has(window.chainId)) {
        throw new Error('Ledger authoritative windows must be unique per stream and chain')
      }
      byChain.set(window.chainId, window)
      return byChain
    }, new Map<number, TLedgerAuthoritativeWindow>())
}

function isInsideWindow(event: TLedgerSourceEvent, windowsByChain: Map<number, TLedgerAuthoritativeWindow>): boolean {
  const window = windowsByChain.get(event.chainId)
  return Boolean(window && event.blockNumber >= window.lowerBlock && event.blockNumber <= window.upperBlock)
}

function indexEvents(events: readonly TLedgerSourceEvent[], label: string): Map<string, TLedgerSourceEvent> {
  return events.reduce((byIdentity, event) => {
    const identity = getEventIdentity(event)
    const existing = byIdentity.get(identity)
    if (existing && stringifyCanonicalLedgerValue(existing) !== stringifyCanonicalLedgerValue(event)) {
      throw new Error(`${label} contains conflicting records for one stable identity`)
    }
    byIdentity.set(identity, existing ?? event)
    return byIdentity
  }, new Map<string, TLedgerSourceEvent>())
}

function mergeStream(args: {
  stream: TLedgerStream
  cached: readonly TLedgerSourceEvent[]
  fetched: readonly TLedgerSourceEvent[]
  windows: readonly TLedgerAuthoritativeWindow[]
}): {
  readonly events: TLedgerSourceEvent[]
  readonly stats: TLedgerStreamMergeStats
  readonly changedTimestamps: number[]
} {
  const windowsByChain = getStreamWindows(args.stream, args.windows)
  if (windowsByChain.size === 0) {
    throw new Error('Ledger merge requires an authoritative window for every synchronized stream')
  }
  if (args.fetched.some((event) => !isInsideWindow(event, windowsByChain))) {
    throw new Error('Fetched ledger event is outside its authoritative window')
  }

  const cachedByIdentity = indexEvents(args.cached, 'Cached ledger stream')
  const fetchedByIdentity = indexEvents(args.fetched, 'Fetched ledger stream')
  const cachedWindowEvents = args.cached.filter((event) => isInsideWindow(event, windowsByChain))
  const retained = args.cached.filter(
    (event) => !isInsideWindow(event, windowsByChain) && !fetchedByIdentity.has(getEventIdentity(event))
  )
  const addedEvents = Array.from(fetchedByIdentity.entries()).flatMap(([identity, event]) =>
    cachedByIdentity.has(identity) ? [] : [event]
  )
  const replacedEvents = Array.from(fetchedByIdentity.entries()).flatMap(([identity, event]) => {
    const cached = cachedByIdentity.get(identity)
    return cached && stringifyCanonicalLedgerValue(cached) !== stringifyCanonicalLedgerValue(event)
      ? [{ cached, fetched: event }]
      : []
  })
  const deletedEvents = cachedWindowEvents.filter((event) => !fetchedByIdentity.has(getEventIdentity(event)))
  const events = [...retained, ...fetchedByIdentity.values()].toSorted(compareLedgerOrder)
  const changedTimestamps = [
    ...addedEvents.map((event) => event.blockTimestamp),
    ...replacedEvents.flatMap(({ cached, fetched }) => [cached.blockTimestamp, fetched.blockTimestamp]),
    ...deletedEvents.map((event) => event.blockTimestamp)
  ]

  return {
    events,
    stats: {
      cached: args.cached.length,
      fetched: args.fetched.length,
      added: addedEvents.length,
      replaced: replacedEvents.length,
      deleted: deletedEvents.length,
      total: events.length
    },
    changedTimestamps
  }
}

export function mergeLedgerStreams(args: {
  cached: TLedgerSixStreams
  fetched: TLedgerSixStreams
  windows: readonly TLedgerAuthoritativeWindow[]
}): TLedgerMergeResult {
  const merged = LEDGER_STREAMS.map((stream) => {
    const result = mergeStream({
      stream,
      cached: args.cached[stream],
      fetched: args.fetched[stream],
      windows: args.windows
    })
    return [stream, result] as const
  })
  const changedTimestamps = merged.flatMap(([, result]) => result.changedTimestamps)
  const cachedTimestamps = LEDGER_STREAMS.flatMap((stream) => args.cached[stream].map((event) => event.blockTimestamp))

  return {
    streams: Object.fromEntries(
      merged.map(([stream, result]) => [stream, result.events])
    ) as unknown as TLedgerSixStreams,
    stats: Object.fromEntries(merged.map(([stream, result]) => [stream, result.stats])) as Record<
      TLedgerStream,
      TLedgerStreamMergeStats
    >,
    earliestChangedTimestamp: changedTimestamps.length === 0 ? null : Math.min(...changedTimestamps),
    latestCachedTimestamp: cachedTimestamps.length === 0 ? null : Math.max(...cachedTimestamps)
  }
}
