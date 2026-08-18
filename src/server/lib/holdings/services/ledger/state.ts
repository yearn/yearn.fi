import { holdingsConfig, parseHoldingsLedgerSourceRevision } from '@/server/lib/holdings/config'
import { getLedgerSha256, stringifyCanonicalLedgerValue } from '@/server/lib/holdings/services/ledger/codec'
import type { TEnvioLedgerMetadata } from '@/server/lib/holdings/services/ledger/envio'
import type { TLedgerMergeResult } from '@/server/lib/holdings/services/ledger/merge'
import { compareLedgerOrder, compareLedgerStrings } from '@/server/lib/holdings/services/ledger/order'
import {
  LEDGER_STREAMS,
  type TLedgerDependencyV1,
  type TLedgerDirtyReasonCode,
  type TLedgerInvalidationEpochsV1,
  type TLedgerRevisionManifestV1,
  type TLedgerSixStreams,
  type TLedgerSourceEvent,
  type TLedgerStream,
  type TLedgerStreamCoverageV1
} from '@/server/lib/holdings/services/ledger/types'

export const LEDGER_CALCULATION_VERSION = 'canonical-envio-ledger-v3'
export const LEDGER_ENVIO_QUERY_VERSION = 'envio-block-keyset-v1'

export type TLedgerSyncType = 'bootstrap' | 'warm' | 'reconcile' | 'forced-reset' | 'source-reset'

export interface TLedgerDirtyMetadata {
  readonly dirtyFromTimestamp: number | null
  readonly dirtyFromDate: string | null
  readonly dirtyReasons: readonly TLedgerDirtyReasonCode[]
}

function getUtcDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function getAllEvents(streams: TLedgerSixStreams): TLedgerSourceEvent[] {
  return LEDGER_STREAMS.flatMap((stream) => [...streams[stream]] as TLedgerSourceEvent[])
}

export function getLedgerSourceFingerprint(
  sourceIdentity: string,
  metadata: readonly TEnvioLedgerMetadata[],
  sourceRevision = holdingsConfig.ledgerSourceRevision
): string {
  const sourceContract = metadata
    .map(({ chainId, startBlock, endBlock }) => ({ chainId, startBlock, endBlock }))
    .toSorted((left, right) => left.chainId - right.chainId)
  return getLedgerSha256(
    stringifyCanonicalLedgerValue([
      sourceIdentity.trim(),
      LEDGER_ENVIO_QUERY_VERSION,
      parseHoldingsLedgerSourceRevision(sourceRevision),
      sourceContract
    ])
  )
}

export function inferLedgerSyncType(args: {
  readonly current: TLedgerRevisionManifestV1 | null
  readonly sourceFingerprint: string
  readonly forceRebuild: boolean
  readonly nowMs: number
  readonly reconcileIntervalMs: number
}): TLedgerSyncType {
  if (!args.current) {
    return 'bootstrap'
  }
  if (args.current.sourceFingerprint !== args.sourceFingerprint) {
    return 'source-reset'
  }
  if (args.current.calculationVersion !== LEDGER_CALCULATION_VERSION || args.forceRebuild) {
    return 'forced-reset'
  }
  return args.nowMs - args.current.reconciledAtMs >= args.reconcileIntervalMs ? 'reconcile' : 'warm'
}

export function getLedgerLowerBlocks(args: {
  readonly metadata: readonly TEnvioLedgerMetadata[]
  readonly current: TLedgerRevisionManifestV1 | null
  readonly syncType: TLedgerSyncType
  readonly overlapBlocks: number
}): Readonly<Record<number, number>> {
  return Object.fromEntries(
    args.metadata.map((metadata) => {
      const previousCoverageBlocks =
        args.current?.coverage
          .filter((coverage) => coverage.chainId === metadata.chainId)
          .map((coverage) => coverage.completeThroughBlock) ?? []
      const previousBlock =
        previousCoverageBlocks.length === 0 ? metadata.startBlock : Math.min(...previousCoverageBlocks)
      if (args.current && args.syncType !== 'source-reset' && previousBlock > metadata.progressBlock) {
        throw new Error('Envio ledger source checkpoint regressed')
      }
      if (args.syncType !== 'warm' || !args.current) {
        return [metadata.chainId, metadata.startBlock]
      }
      return [metadata.chainId, Math.max(metadata.startBlock, previousBlock - args.overlapBlocks)]
    })
  )
}

export function createLedgerCoverage(
  streams: TLedgerSixStreams,
  metadata: readonly TEnvioLedgerMetadata[]
): TLedgerStreamCoverageV1[] {
  const chainIds = new Set(metadata.map(({ chainId }) => chainId))
  if (chainIds.size === 0 || getAllEvents(streams).some((event) => !chainIds.has(event.chainId))) {
    throw new Error('Ledger streams and Envio chain metadata are inconsistent')
  }

  return metadata
    .flatMap((chainMetadata) =>
      LEDGER_STREAMS.map((stream): TLedgerStreamCoverageV1 => {
        const events = streams[stream]
          .filter((event) => event.chainId === chainMetadata.chainId)
          .toSorted(compareLedgerOrder)
        const last = events.at(-1)
        return {
          stream,
          chainId: chainMetadata.chainId,
          status: last ? 'complete' : 'valid_empty',
          coverageStartTimestamp: 0,
          completeThroughTimestamp: last?.blockTimestamp ?? 0,
          coverageStartBlock: chainMetadata.startBlock,
          completeThroughBlock: chainMetadata.progressBlock,
          cursor: last
            ? {
                blockTimestamp: last.blockTimestamp,
                blockNumber: last.blockNumber,
                logIndex: last.logIndex,
                id: last.id
              }
            : null,
          checkpoint: getLedgerSha256(
            stringifyCanonicalLedgerValue([
              chainMetadata.chainId,
              chainMetadata.progressBlock,
              chainMetadata.eventsProcessed
            ])
          ),
          checkpointState: 'observed',
          count: events.length,
          checksum: getLedgerSha256(stringifyCanonicalLedgerValue([stream, chainMetadata.chainId, events]))
        }
      })
    )
    .toSorted(
      (left, right) =>
        LEDGER_STREAMS.indexOf(left.stream) - LEDGER_STREAMS.indexOf(right.stream) || left.chainId - right.chainId
    )
}

export function createLedgerDependencies(streams: TLedgerSixStreams): TLedgerDependencyV1[] {
  return Array.from(
    getAllEvents(streams)
      .reduce((dependencies, event) => {
        const address = event.vaultAddress.toLowerCase()
        const identity = stringifyCanonicalLedgerValue([event.chainId, address])
        const existing = dependencies.get(identity)
        dependencies.set(identity, {
          kind: 'vault',
          chainId: event.chainId,
          address,
          metadataRevision: null,
          firstEventTimestamp: Math.min(existing?.firstEventTimestamp ?? event.blockTimestamp, event.blockTimestamp)
        })
        return dependencies
      }, new Map<string, TLedgerDependencyV1>())
      .values()
  ).toSorted(
    (left, right) =>
      left.chainId - right.chainId ||
      compareLedgerStrings(left.address, right.address) ||
      left.firstEventTimestamp - right.firstEventTimestamp
  )
}

export function getNextLedgerInvalidationEpochs(
  current: TLedgerRevisionManifestV1 | null,
  syncType: TLedgerSyncType
): TLedgerInvalidationEpochsV1 {
  const epochs = current?.invalidationEpochs ?? {
    global: 0,
    source: 0,
    address: 0,
    vault: 0,
    schema: 0,
    metadata: 0
  }
  return {
    ...epochs,
    source: epochs.source + (syncType === 'source-reset' ? 1 : 0),
    address: epochs.address + (syncType === 'forced-reset' ? 1 : 0),
    schema:
      epochs.schema +
      (syncType === 'forced-reset' && current?.calculationVersion !== LEDGER_CALCULATION_VERSION ? 1 : 0)
  }
}

function getMergeDirtyReasons(merge: TLedgerMergeResult): TLedgerDirtyReasonCode[] {
  const stats = LEDGER_STREAMS.map((stream) => merge.stats[stream])
  return [
    ...(stats.some(({ added }) => added > 0) ? (['tail_append'] as const) : []),
    ...(stats.some(({ replaced }) => replaced > 0) ? (['event_replaced'] as const) : []),
    ...(stats.some(({ deleted }) => deleted > 0) ? (['event_deleted'] as const) : [])
  ]
}

export function getLedgerDirtyMetadata(args: {
  readonly current: TLedgerRevisionManifestV1 | null
  readonly previousStreams: TLedgerSixStreams
  readonly streams: TLedgerSixStreams
  readonly merge: TLedgerMergeResult
  readonly syncType: TLedgerSyncType
}): TLedgerDirtyMetadata {
  const allEvents = getAllEvents(args.streams)
  const previousEvents = getAllEvents(args.previousStreams)
  const rebuildEvents = args.syncType === 'source-reset' ? [...previousEvents, ...allEvents] : allEvents
  const rebuildTimestamp =
    args.syncType === 'bootstrap' || args.syncType === 'forced-reset' || args.syncType === 'source-reset'
      ? rebuildEvents.length === 0
        ? null
        : Math.min(...rebuildEvents.map((event) => event.blockTimestamp))
      : null
  const newTimestamp =
    rebuildTimestamp === null
      ? args.merge.earliestChangedTimestamp
      : args.merge.earliestChangedTimestamp === null
        ? rebuildTimestamp
        : Math.min(rebuildTimestamp, args.merge.earliestChangedTimestamp)
  const timestamps = [args.current?.dirtyFromTimestamp ?? null, newTimestamp].filter(
    (timestamp): timestamp is number => timestamp !== null
  )
  const dirtyFromTimestamp = timestamps.length === 0 ? null : Math.min(...timestamps)
  const dirtyReasons = Array.from(
    new Set<TLedgerDirtyReasonCode>([
      ...(args.current?.dirtyReasons ?? []),
      ...getMergeDirtyReasons(args.merge),
      ...(args.syncType === 'bootstrap' ? (['bootstrap'] as const) : []),
      ...(args.syncType === 'reconcile' ? (['reconcile'] as const) : []),
      ...(args.syncType === 'forced-reset' ? (['forced_reset'] as const) : []),
      ...(args.syncType === 'source-reset' ? (['source_generation'] as const) : [])
    ])
  ).toSorted()

  return {
    dirtyFromTimestamp,
    dirtyFromDate: dirtyFromTimestamp === null ? null : getUtcDate(dirtyFromTimestamp),
    dirtyReasons: dirtyFromTimestamp === null ? [] : dirtyReasons
  }
}

export function getStreamLowerBlock(
  lowerBlocks: Readonly<Record<number, number>>,
  stream: TLedgerStream,
  chainId: number
): number {
  if (!LEDGER_STREAMS.includes(stream)) {
    throw new Error('Ledger stream is unsupported')
  }
  const lowerBlock = lowerBlocks[chainId]
  if (lowerBlock === undefined) {
    throw new Error('Ledger lower block is missing')
  }
  return lowerBlock
}
