import { randomUUID } from 'node:crypto'
import { holdingsConfig } from '@/server/lib/holdings/config'
import { debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import { fetchUserLedgerSourceEvents } from '@/server/lib/holdings/services/graphql'
import {
  createLedgerRevisionManifest,
  encodeLedgerChunks,
  encodeLedgerIndexShards,
  stringifyCanonicalLedgerValue,
  type TLedgerVerifiedRevisionV1,
  verifyLedgerRevision,
  verifyLedgerRevisionWithReusedContent
} from '@/server/lib/holdings/services/ledger/codec'
import {
  fetchEnvioLedgerMetadata,
  fetchEnvioLedgerSource,
  rereadEnvioLedgerMetadata,
  type TEnvioLedgerFetchStats,
  type TEnvioLedgerFetchStrategy,
  type TEnvioLedgerMetadata
} from '@/server/lib/holdings/services/ledger/envio'
import {
  getLedgerChunkKey,
  getLedgerFenceKey,
  getLedgerIndexShardKey,
  getLedgerLockKey,
  hashLedgerWalletAddress
} from '@/server/lib/holdings/services/ledger/keys'
import {
  acquireLedgerLock,
  releaseLedgerLock,
  renewLedgerLock,
  type TLedgerLock
} from '@/server/lib/holdings/services/ledger/lock'
import {
  mergeLedgerStreams,
  type TLedgerAuthoritativeWindow,
  type TLedgerStreamMergeStats
} from '@/server/lib/holdings/services/ledger/merge'
import { reportLedgerMetric } from '@/server/lib/holdings/services/ledger/metrics'
import { compareLedgerOrder } from '@/server/lib/holdings/services/ledger/order'
import {
  readVerifiedLedgerRevision,
  type TLedgerRevisionReadResult
} from '@/server/lib/holdings/services/ledger/revision'
import {
  createLedgerCoverage,
  createLedgerDependencies,
  getLedgerDirtyMetadata,
  getLedgerLowerBlocks,
  getLedgerSourceFingerprint,
  getNextLedgerInvalidationEpochs,
  inferLedgerSyncType,
  LEDGER_CALCULATION_VERSION,
  type TLedgerDirtyMetadata,
  type TLedgerSyncType
} from '@/server/lib/holdings/services/ledger/state'
import {
  commitVerifiedLedgerRevision,
  recoverCorruptLedgerHeadFromPrevious,
  type TImmutableLedgerBlobWriteItem,
  type TLedgerPipelineRedis,
  writeImmutableLedgerBlobs,
  writeLedgerSyncStatus
} from '@/server/lib/holdings/services/ledger/store'
import {
  LEDGER_SCHEMA_VERSION,
  LEDGER_STREAMS,
  type TCreateLedgerRevisionManifestInputV1,
  type TLedgerHeadV1,
  type TLedgerRevisionManifestV1,
  type TLedgerSixStreams,
  type TLedgerStream,
  type TLedgerSyncReasonCode,
  type TLedgerSyncStatusV1
} from '@/server/lib/holdings/services/ledger/types'
import {
  getHoldingsLedgerRedisClient,
  HoldingsLedgerRedisOperationError
} from '@/server/lib/holdings/storage/ledgerRedis'

const LEDGER_SYNC_LOCK_TTL_MS = 5 * 60 * 1000
const LEDGER_SYNC_HEARTBEAT_INTERVAL_MS = 60 * 1000

export type TLedgerParityStatus = 'not-run' | 'match' | 'mismatch'

export interface TLedgerParityResult {
  readonly status: TLedgerParityStatus
  readonly reasonCode: 'event-mismatch' | null
}

export interface TLedgerSyncStorageStats {
  readonly chunks: number
  readonly indexShards: number
  readonly encodedBytes: number
  readonly newBlobs: number
}

export interface TLedgerSyncEventStats extends TLedgerStreamMergeStats {
  readonly total: number
}

export interface TLedgerEnvioResponseStats {
  readonly pages: number
  readonly rows: number
  readonly chains: number
  readonly validationQueries: number
  readonly strategy: TEnvioLedgerFetchStrategy
  readonly requests: number
  readonly presenceRequests: number
  readonly batchedRequests: number
  readonly continuationRequests: number
  readonly readyChains: number
  readonly laggingChains: number
}

export type TLedgerSyncResult =
  | { readonly status: 'syncing'; readonly reasonCode: 'lock_busy' }
  | {
      readonly status: 'updated' | 'unchanged'
      readonly syncType: TLedgerSyncType
      readonly revision: string
      readonly sourceGeneration: number
      readonly events: TLedgerSyncEventStats
      readonly streams: Readonly<Record<TLedgerStream, TLedgerStreamMergeStats>>
      readonly envio: TLedgerEnvioResponseStats
      readonly storage: TLedgerSyncStorageStats
      readonly dirty: {
        readonly fromTimestamp: number | null
        readonly fromDate: string | null
        readonly reasons: readonly string[]
      }
      readonly parity: TLedgerParityResult
      readonly durationMs: number
    }

type TLedgerCompletedSyncResult = Exclude<TLedgerSyncResult, { readonly status: 'syncing' }>
type TLedgerBusySyncResult = Extract<TLedgerSyncResult, { readonly status: 'syncing' }>

interface TLedgerSyncCompletion {
  readonly syncResult: TLedgerCompletedSyncResult
  readonly verifiedRevision: TLedgerVerifiedRevisionV1
  readonly headSource: 'active' | 'previous'
}

interface TLedgerSyncArguments {
  readonly address: string
  readonly forceRebuild?: boolean
  readonly compareLegacy?: boolean
}

export interface TSynchronizedHoldingsLedgerRevision {
  readonly syncResult: TLedgerCompletedSyncResult
  readonly verifiedRevision: TLedgerVerifiedRevisionV1
  readonly headSource: 'active' | 'previous'
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
}

export type TWithSynchronizedHoldingsLedgerRevisionResult<TConsumed> =
  | { readonly kind: 'busy'; readonly syncResult: TLedgerBusySyncResult }
  | { readonly kind: 'completed'; readonly syncResult: TLedgerCompletedSyncResult; readonly consumed: TConsumed }

export class HoldingsLedgerSyncError extends Error {
  readonly reasonCode: TLedgerSyncReasonCode
  readonly statusCode: number

  constructor(reasonCode: TLedgerSyncReasonCode, statusCode: number) {
    super('Holdings ledger synchronization failed')
    this.name = 'HoldingsLedgerSyncError'
    this.reasonCode = reasonCode
    this.statusCode = statusCode
  }
}

function emptyLedgerStreams(): TLedgerSixStreams {
  return {
    v3Deposits: [],
    v3Withdrawals: [],
    v2Deposits: [],
    v2Withdrawals: [],
    transfersIn: [],
    transfersOut: []
  }
}

function getSyncStatus(args: {
  state: TLedgerSyncStatusV1['state']
  sourceGeneration: number
  revision: string | null
  reasonCode: TLedgerSyncReasonCode | null
  updatedAtMs: number
}): TLedgerSyncStatusV1 {
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    state: args.state,
    sourceGeneration: args.sourceGeneration,
    revision: args.revision,
    reasonCode: args.reasonCode,
    updatedAtMs: args.updatedAtMs
  } as TLedgerSyncStatusV1
}

function createRevisionId(nowMs: number): string {
  return `r_${nowMs.toString(36)}_${randomUUID().replaceAll('-', '')}`
}

function getAuthoritativeWindows(
  envioWindows: readonly { readonly chainId: number; readonly lowerBlock: number; readonly upperBlock: number }[]
): TLedgerAuthoritativeWindow[] {
  return LEDGER_STREAMS.flatMap((stream) => envioWindows.map((window) => ({ stream, ...window })))
}

function getSourceGeneration(current: TLedgerRevisionManifestV1 | null, syncType: TLedgerSyncType): number {
  if (!current) {
    return 1
  }
  return current.sourceGeneration + (syncType === 'source-reset' ? 1 : 0)
}

function selectConfiguredMetadata(metadata: readonly TEnvioLedgerMetadata[]): readonly TEnvioLedgerMetadata[] {
  const metadataByChain = new Map(metadata.map((entry) => [entry.chainId, entry]))
  const selected = holdingsConfig.ledgerChainIds.map((chainId) => metadataByChain.get(chainId))
  if (selected.some((entry) => entry === undefined)) {
    throw new Error('Envio ledger source chain scope is incomplete')
  }
  return selected as TEnvioLedgerMetadata[]
}

function sumStreamStats(stats: Readonly<Record<TLedgerStream, TLedgerStreamMergeStats>>): TLedgerSyncEventStats {
  return LEDGER_STREAMS.reduce<TLedgerSyncEventStats>(
    (total, stream) => ({
      cached: total.cached + stats[stream].cached,
      fetched: total.fetched + stats[stream].fetched,
      added: total.added + stats[stream].added,
      replaced: total.replaced + stats[stream].replaced,
      deleted: total.deleted + stats[stream].deleted,
      total: total.total + stats[stream].total
    }),
    { cached: 0, fetched: 0, added: 0, replaced: 0, deleted: 0, total: 0 }
  )
}

function getCheckpointBoundStreams(
  streams: TLedgerSixStreams,
  metadata: readonly TEnvioLedgerMetadata[]
): TLedgerSixStreams {
  const upperBlocks = new Map(metadata.map(({ chainId, progressBlock }) => [chainId, progressBlock]))
  return Object.fromEntries(
    LEDGER_STREAMS.map((stream) => [
      stream,
      streams[stream]
        .filter((event) => {
          const upperBlock = upperBlocks.get(event.chainId)
          return upperBlock !== undefined && event.blockNumber <= upperBlock
        })
        .toSorted(compareLedgerOrder)
    ])
  ) as unknown as TLedgerSixStreams
}

async function compareLegacyEvents(
  address: string,
  streams: TLedgerSixStreams,
  metadata: readonly TEnvioLedgerMetadata[]
): Promise<TLedgerParityResult> {
  const legacy = await fetchUserLedgerSourceEvents(address).catch(() => {
    throw new HoldingsLedgerSyncError('upstream_failed', 502)
  })
  return stringifyCanonicalLedgerValue(getCheckpointBoundStreams(legacy, metadata)) ===
    stringifyCanonicalLedgerValue(getCheckpointBoundStreams(streams, metadata))
    ? { status: 'match', reasonCode: null }
    : { status: 'mismatch', reasonCode: 'event-mismatch' }
}

function getNewImmutableBlobs(args: {
  walletHash: string
  current: TLedgerRevisionManifestV1 | null
  chunks: ReturnType<typeof encodeLedgerChunks>
  indexes: ReturnType<typeof encodeLedgerIndexShards>
}): TImmutableLedgerBlobWriteItem[] {
  const existingKeys = new Set([
    ...(args.current?.chunks.map(({ key }) => key) ?? []),
    ...(args.current?.indexes.map(({ key }) => key) ?? [])
  ])
  return [
    ...args.chunks.map(
      (chunk): TImmutableLedgerBlobWriteItem => ({
        kind: 'chunk',
        key: getLedgerChunkKey(args.walletHash, chunk.descriptor.checksum),
        checksum: chunk.descriptor.checksum,
        value: chunk.data
      })
    ),
    ...args.indexes.map(
      (index): TImmutableLedgerBlobWriteItem => ({
        kind: 'index',
        key: getLedgerIndexShardKey(args.walletHash, index.descriptor.shard, index.descriptor.checksum),
        checksum: index.descriptor.checksum,
        shard: index.descriptor.shard,
        value: index.data
      })
    )
  ].filter(({ key }) => !existingKeys.has(key))
}

function getStoredChunks(walletHash: string, chunks: ReturnType<typeof encodeLedgerChunks>) {
  return chunks.map((chunk) => ({
    ...chunk,
    key: getLedgerChunkKey(walletHash, chunk.descriptor.checksum)
  }))
}

function getStoredIndexes(walletHash: string, indexes: ReturnType<typeof encodeLedgerIndexShards>) {
  return indexes.map((index) => ({
    ...index,
    key: getLedgerIndexShardKey(walletHash, index.descriptor.shard, index.descriptor.checksum)
  }))
}

function createCandidateManifest(args: {
  walletHash: string
  current: TLedgerRevisionManifestV1 | null
  streams: TLedgerSixStreams
  metadata: readonly TEnvioLedgerMetadata[]
  sourceFingerprint: string
  syncType: TLedgerSyncType
  sourceGeneration: number
  nowMs: number
  dirty: TLedgerDirtyMetadata
  chunks: TCreateLedgerRevisionManifestInputV1['chunks']
  indexes: TCreateLedgerRevisionManifestInputV1['indexes']
}): TLedgerRevisionManifestV1 {
  const reconciledAtMs = args.syncType === 'warm' && args.current ? args.current.reconciledAtMs : args.nowMs
  return createLedgerRevisionManifest({
    calculationVersion: LEDGER_CALCULATION_VERSION,
    walletHash: args.walletHash,
    sourceFingerprint: args.sourceFingerprint,
    sourceGeneration: args.sourceGeneration,
    revision: createRevisionId(args.nowMs),
    parentRevision: args.syncType === 'source-reset' ? null : (args.current?.revision ?? null),
    chainScope: args.metadata.map(({ chainId }) => chainId),
    coverage: createLedgerCoverage(args.streams, args.metadata),
    chunks: args.chunks,
    indexes: args.indexes,
    dependencies: createLedgerDependencies(args.streams),
    invalidationEpochs: getNextLedgerInvalidationEpochs(args.current, args.syncType),
    dirtyFromTimestamp: args.dirty.dirtyFromTimestamp,
    dirtyFromDate: args.dirty.dirtyFromDate,
    dirtyReasons: args.dirty.dirtyReasons,
    createdAtMs: args.syncType === 'source-reset' || !args.current ? args.nowMs : args.current.createdAtMs,
    updatedAtMs: args.nowMs,
    reconciledAtMs
  })
}

function shouldCommitRevision(args: {
  current: TLedgerRevisionManifestV1 | null
  candidate: TLedgerRevisionManifestV1
  streamsChanged: boolean
  syncType: TLedgerSyncType
}): boolean {
  if (!args.current || args.syncType !== 'warm' || args.streamsChanged) {
    return true
  }
  return (
    stringifyCanonicalLedgerValue(args.current.coverage) !== stringifyCanonicalLedgerValue(args.candidate.coverage) ||
    stringifyCanonicalLedgerValue(args.current.dependencies) !==
      stringifyCanonicalLedgerValue(args.candidate.dependencies) ||
    stringifyCanonicalLedgerValue(args.current.dirtyReasons) !==
      stringifyCanonicalLedgerValue(args.candidate.dirtyReasons) ||
    args.current.dirtyFromTimestamp !== args.candidate.dirtyFromTimestamp
  )
}

function getStorageStats(manifest: TLedgerRevisionManifestV1, newBlobs: number): TLedgerSyncStorageStats {
  return {
    chunks: manifest.chunks.length,
    indexShards: manifest.indexes.length,
    encodedBytes: manifest.activeEncodedBytes,
    newBlobs
  }
}

function getEnvioResponseStats(
  stats: TEnvioLedgerFetchStats,
  metadata: readonly TEnvioLedgerMetadata[]
): TLedgerEnvioResponseStats {
  const readyChains = metadata.filter(({ isReady }) => isReady).length
  return {
    pages: stats.totalPages,
    rows: stats.totalRows,
    chains: stats.chainCount,
    validationQueries: stats.validationQueries,
    strategy: stats.strategy,
    requests: stats.totalRequests,
    presenceRequests: stats.presenceRequests,
    batchedRequests: stats.batchedRequests,
    continuationRequests: stats.continuationRequests,
    readyChains,
    laggingChains: metadata.length - readyChains
  }
}

function getMetricSyncReason(syncType: TLedgerSyncType): 'bootstrap' | 'warm' | 'reconcile' | 'forced-reset' {
  return syncType === 'source-reset' ? 'forced-reset' : syncType
}

function getCurrentRevision(read: TLedgerRevisionReadResult): {
  readonly head: TLedgerHeadV1 | null
  readonly manifest: TLedgerRevisionManifestV1 | null
  readonly streams: TLedgerSixStreams
} {
  if (read.status === 'corrupt') {
    throw new HoldingsLedgerSyncError('decode_failed', 500)
  }
  return read.status === 'ready'
    ? { head: read.head, manifest: read.manifest, streams: read.verified.streams }
    : { head: null, manifest: null, streams: emptyLedgerStreams() }
}

function normalizeSyncError(error: unknown): HoldingsLedgerSyncError {
  if (error instanceof HoldingsLedgerSyncError) {
    return error
  }
  if (error instanceof HoldingsLedgerRedisOperationError) {
    return new HoldingsLedgerSyncError('storage_failed', 503)
  }
  if (error instanceof Error && error.message.startsWith('Envio ledger source')) {
    return new HoldingsLedgerSyncError('upstream_failed', 502)
  }
  return new HoldingsLedgerSyncError('storage_failed', 500)
}

async function readCurrentRevisionForSync(args: {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
  readonly lock: TLedgerLock
  readonly forceRebuild: boolean
  readonly startedAtMs: number
}): Promise<TLedgerRevisionReadResult> {
  const active = await readVerifiedLedgerRevision({
    redis: args.redis,
    walletHash: args.walletHash,
    retryIncomplete: true
  })
  if (active.status !== 'corrupt' || !args.forceRebuild) {
    return active
  }

  const previous = await readVerifiedLedgerRevision({
    redis: args.redis,
    walletHash: args.walletHash,
    usePreviousHead: true,
    retryIncomplete: true
  })
  if (previous.status !== 'ready') {
    throw new HoldingsLedgerSyncError('decode_failed', 500)
  }
  const recovery = await recoverCorruptLedgerHeadFromPrevious({
    redis: args.redis,
    lock: args.lock,
    previousRevision: previous.verified,
    syncStatus: getSyncStatus({
      state: 'syncing',
      sourceGeneration: previous.head.sourceGeneration,
      revision: previous.head.revision,
      reasonCode: null,
      updatedAtMs: Date.now()
    })
  })
  if (recovery.status === 'lock_lost') {
    throw new HoldingsLedgerSyncError('stale_fence', 409)
  }
  if (recovery.status === 'previous_changed') {
    throw new HoldingsLedgerSyncError('cas_rejected', 409)
  }
  if (recovery.status === 'active_missing') {
    throw new HoldingsLedgerSyncError('decode_failed', 500)
  }

  const recovered = await readVerifiedLedgerRevision({
    redis: args.redis,
    walletHash: args.walletHash,
    retryIncomplete: false
  })
  if (
    recovered.status !== 'ready' ||
    stringifyCanonicalLedgerValue(recovered.head) !== stringifyCanonicalLedgerValue(previous.head)
  ) {
    throw new HoldingsLedgerSyncError('decode_failed', 500)
  }
  reportLedgerMetric({
    name: 'ledger.recovery',
    outcome: 'success',
    mode: holdingsConfig.ledgerMode,
    walletHash: args.walletHash,
    durationMs: Date.now() - args.startedAtMs,
    fallback: 'previous-head'
  })
  return recovered
}

async function assertLockRenewed(redis: TLedgerPipelineRedis, walletHash: string, lock: TLedgerLock): Promise<void> {
  const result = await renewLedgerLock({
    redis,
    lockKey: getLedgerLockKey(walletHash),
    lock,
    ttlMs: LEDGER_SYNC_LOCK_TTL_MS
  })
  if (result.status !== 'renewed') {
    throw new HoldingsLedgerSyncError('stale_fence', 409)
  }
}

async function writeRequiredSyncStatus(args: {
  redis: TLedgerPipelineRedis
  walletHash: string
  lock: TLedgerLock
  status: TLedgerSyncStatusV1
}): Promise<void> {
  const result = await writeLedgerSyncStatus(args)
  if (result.status !== 'written') {
    throw new HoldingsLedgerSyncError('stale_fence', 409)
  }
}

function createLedgerSyncHeartbeat(args: {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
  readonly lock: TLedgerLock
}): () => Promise<void> {
  const heartbeat = {
    renewedAtMs: Date.now(),
    inFlight: null as Promise<void> | null
  }
  return async () => {
    if (Date.now() - heartbeat.renewedAtMs < LEDGER_SYNC_HEARTBEAT_INTERVAL_MS) {
      return
    }
    if (heartbeat.inFlight) {
      await heartbeat.inFlight
      return
    }
    const renewal = assertLockRenewed(args.redis, args.walletHash, args.lock)
      .then(() => {
        heartbeat.renewedAtMs = Date.now()
      })
      .finally(() => {
        heartbeat.inFlight = null
      })
    heartbeat.inFlight = renewal
    await renewal
  }
}

async function performLedgerSync(args: {
  address: string
  forceRebuild: boolean
  compareLegacy: boolean
  redis: TLedgerPipelineRedis
  walletHash: string
  lock: TLedgerLock
  currentRead: TLedgerRevisionReadResult
  attemptState: { sourceGeneration: number }
  startedAtMs: number
}): Promise<TLedgerSyncCompletion> {
  const current = getCurrentRevision(args.currentRead)
  const getMetadataDurationMs = startHoldingsDebugTimer()
  const initialMetadata = selectConfiguredMetadata(await fetchEnvioLedgerMetadata())
  debugLog('ledger-sync', 'fetched Envio synchronization metadata', {
    durationMs: getMetadataDurationMs(),
    chains: initialMetadata.length,
    readyChains: initialMetadata.filter(({ isReady }) => isReady).length
  })
  if (initialMetadata.length === 0) {
    throw new HoldingsLedgerSyncError('upstream_failed', 502)
  }
  const sourceFingerprint = getLedgerSourceFingerprint(holdingsConfig.envioGraphqlUrl, initialMetadata)
  const syncType = inferLedgerSyncType({
    current: current.manifest,
    sourceFingerprint,
    forceRebuild: args.forceRebuild,
    nowMs: args.startedAtMs,
    reconcileIntervalMs: holdingsConfig.ledgerReconcileIntervalMs
  })
  const sourceGeneration = getSourceGeneration(current.manifest, syncType)
  debugLog('ledger-sync', 'selected synchronization plan', {
    syncType,
    sourceGeneration,
    overlapBlocks: syncType === 'warm' ? holdingsConfig.ledgerOverlapBlocks : 0,
    hasCurrentRevision: current.manifest !== null
  })
  args.attemptState.sourceGeneration = sourceGeneration
  await writeRequiredSyncStatus({
    redis: args.redis,
    walletHash: args.walletHash,
    lock: args.lock,
    status: getSyncStatus({
      state: 'syncing',
      sourceGeneration,
      revision: current.manifest?.revision ?? null,
      reasonCode: null,
      updatedAtMs: args.startedAtMs
    })
  })
  const lowerBlockByChain = getLedgerLowerBlocks({
    metadata: initialMetadata,
    current: current.manifest,
    syncType,
    overlapBlocks: holdingsConfig.ledgerOverlapBlocks
  })
  const heartbeat = createLedgerSyncHeartbeat({
    redis: args.redis,
    walletHash: args.walletHash,
    lock: args.lock
  })
  const fetchStrategy: TEnvioLedgerFetchStrategy = syncType === 'warm' ? 'warm-batched' : 'cold-batched'
  const getSourceFetchDurationMs = startHoldingsDebugTimer()
  const fetched = await fetchEnvioLedgerSource({
    address: args.address,
    metadata: initialMetadata,
    lowerBlockByChain,
    strategy: fetchStrategy,
    onPage: heartbeat
  })
  debugLog('ledger-sync', 'fetched authoritative Envio event windows', {
    durationMs: getSourceFetchDurationMs(),
    strategy: fetched.stats.strategy,
    paginationMode: 'paged',
    pages: fetched.stats.totalPages,
    rows: fetched.stats.totalRows,
    chains: fetched.stats.chainCount,
    requests: fetched.stats.totalRequests,
    presenceChainProbes: fetched.stats.validationQueries,
    presenceHttpRequests: fetched.stats.presenceRequests,
    presenceRequests: fetched.stats.presenceRequests,
    batchedRequests: fetched.stats.batchedRequests,
    continuationRequests: fetched.stats.continuationRequests,
    blockPartitionCount: fetched.stats.blockPartitionCount ?? 0,
    blockPartitionRequests: fetched.stats.blockPartitionRequests ?? 0,
    validationQueries: fetched.stats.validationQueries
  })
  const getMetadataRevalidationDurationMs = startHoldingsDebugTimer()
  await rereadEnvioLedgerMetadata(initialMetadata)
  await assertLockRenewed(args.redis, args.walletHash, args.lock)
  debugLog('ledger-sync', 'revalidated Envio metadata and lock ownership', {
    durationMs: getMetadataRevalidationDurationMs()
  })

  const getMergeDurationMs = startHoldingsDebugTimer()
  const mergeCached = syncType === 'source-reset' ? emptyLedgerStreams() : current.streams
  const merge = mergeLedgerStreams({
    cached: mergeCached,
    fetched: fetched.streams,
    windows: getAuthoritativeWindows(fetched.windows)
  })
  const streamsChanged = LEDGER_STREAMS.some((stream) => {
    const stats = merge.stats[stream]
    return stats.added > 0 || stats.replaced > 0 || stats.deleted > 0
  })
  const dirty =
    !streamsChanged && syncType === 'warm' && current.manifest
      ? {
          dirtyFromTimestamp: current.manifest.dirtyFromTimestamp,
          dirtyFromDate: current.manifest.dirtyFromDate,
          dirtyReasons: current.manifest.dirtyReasons
        }
      : getLedgerDirtyMetadata({
          current: current.manifest,
          previousStreams: current.streams,
          streams: merge.streams,
          merge,
          syncType
        })
  debugLog('ledger-sync', 'merged authoritative event windows', {
    durationMs: getMergeDurationMs(),
    cachedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].cached, 0),
    fetchedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].fetched, 0),
    addedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].added, 0),
    replacedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].replaced, 0),
    deletedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].deleted, 0),
    totalEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].total, 0),
    streamsChanged
  })
  const getParityDurationMs = startHoldingsDebugTimer()
  const parity = args.compareLegacy
    ? await compareLegacyEvents(args.address, merge.streams, initialMetadata)
    : ({ status: 'not-run', reasonCode: null } as const)
  debugLog('ledger-sync', 'completed optional legacy parity check', {
    durationMs: getParityDurationMs(),
    status: parity.status
  })
  if (parity.status !== 'not-run') {
    reportLedgerMetric({
      name: 'ledger.parity',
      outcome: parity.status === 'match' ? 'success' : 'error',
      mode: holdingsConfig.ledgerMode,
      walletHash: args.walletHash,
      durationMs: Date.now() - args.startedAtMs,
      parityReason: parity.reasonCode ?? undefined,
      envioPages: fetched.stats.totalPages,
      envioRows: fetched.stats.totalRows,
      envioRequestCount: fetched.stats.totalRequests,
      envioPresenceChainProbeCount: fetched.stats.validationQueries,
      envioPresenceRequestCount: fetched.stats.presenceRequests,
      envioBatchedRequestCount: fetched.stats.batchedRequests,
      envioContinuationRequestCount: fetched.stats.continuationRequests
    })
  }
  const getCandidateDurationMs = startHoldingsDebugTimer()
  const content =
    args.currentRead.status === 'ready' && syncType === 'warm' && !streamsChanged
      ? ({
          mode: 'reused-verified',
          chunks: args.currentRead.manifest.chunks,
          indexes: args.currentRead.manifest.indexes,
          previous: args.currentRead.verified
        } as const)
      : (() => {
          const chunks = encodeLedgerChunks(merge.streams)
          return {
            mode: 'encoded',
            chunks,
            indexes: encodeLedgerIndexShards(chunks)
          } as const
        })()
  const candidate = createCandidateManifest({
    walletHash: args.walletHash,
    current: current.manifest,
    streams: merge.streams,
    metadata: initialMetadata,
    sourceFingerprint,
    syncType,
    sourceGeneration,
    nowMs: Date.now(),
    dirty,
    chunks: content.chunks,
    indexes: content.indexes
  })
  debugLog('ledger-sync', 'prepared candidate revision manifest', {
    durationMs: getCandidateDurationMs(),
    contentMode: content.mode,
    records: candidate.recordCount,
    chunks: candidate.chunks.length,
    indexShards: candidate.indexes.length,
    encodedBytes: candidate.activeEncodedBytes
  })
  const commitRequired = shouldCommitRevision({
    current: current.manifest,
    candidate,
    streamsChanged,
    syncType
  })
  const events = sumStreamStats(merge.stats)

  if (!commitRequired && current.manifest && args.currentRead.status === 'ready') {
    const statusUpdatedAtMs = Date.now()
    await writeRequiredSyncStatus({
      redis: args.redis,
      walletHash: args.walletHash,
      lock: args.lock,
      status: getSyncStatus({
        state: 'complete',
        sourceGeneration: current.manifest.sourceGeneration,
        revision: current.manifest.revision,
        reasonCode: null,
        updatedAtMs: statusUpdatedAtMs
      })
    })
    const completedAtMs = Date.now()
    reportLedgerMetric({
      name: 'ledger.manifest',
      outcome: 'success',
      mode: holdingsConfig.ledgerMode,
      walletHash: args.walletHash,
      durationMs: completedAtMs - args.startedAtMs,
      chunkCount: current.manifest.chunks.length,
      indexShardCount: current.manifest.indexes.length,
      recordCount: current.manifest.recordCount,
      encodedBytes: current.manifest.activeEncodedBytes,
      envioPages: fetched.stats.totalPages,
      envioRows: fetched.stats.totalRows,
      envioRequestCount: fetched.stats.totalRequests,
      envioPresenceChainProbeCount: fetched.stats.validationQueries,
      envioPresenceRequestCount: fetched.stats.presenceRequests,
      envioBatchedRequestCount: fetched.stats.batchedRequests,
      envioContinuationRequestCount: fetched.stats.continuationRequests,
      dirtyFromDate: current.manifest.dirtyFromDate ?? undefined,
      dirtyReason: current.manifest.dirtyReasons[0],
      syncReason: getMetricSyncReason(syncType),
      eventCounts: Object.fromEntries(
        LEDGER_STREAMS.map((stream) => [
          stream,
          {
            cached: merge.stats[stream].cached,
            added: merge.stats[stream].added,
            replaced: merge.stats[stream].replaced,
            deleted: merge.stats[stream].deleted
          }
        ])
      )
    })
    debugLog('ledger-sync', 'completed synchronization without a new revision', {
      durationMs: completedAtMs - args.startedAtMs,
      syncType,
      records: current.manifest.recordCount,
      chunks: current.manifest.chunks.length,
      indexShards: current.manifest.indexes.length
    })
    return {
      syncResult: {
        status: 'unchanged',
        syncType,
        revision: current.manifest.revision,
        sourceGeneration: current.manifest.sourceGeneration,
        events,
        streams: merge.stats,
        envio: getEnvioResponseStats(fetched.stats, initialMetadata),
        storage: getStorageStats(current.manifest, 0),
        dirty: {
          fromTimestamp: current.manifest.dirtyFromTimestamp,
          fromDate: current.manifest.dirtyFromDate,
          reasons: current.manifest.dirtyReasons
        },
        parity,
        durationMs: completedAtMs - args.startedAtMs
      },
      verifiedRevision: args.currentRead.verified,
      headSource: args.currentRead.headSource
    }
  }

  const getVerificationDurationMs = startHoldingsDebugTimer()
  const verified =
    content.mode === 'reused-verified'
      ? verifyLedgerRevisionWithReusedContent(content.previous, candidate)
      : verifyLedgerRevision(
          candidate,
          getStoredChunks(args.walletHash, content.chunks),
          getStoredIndexes(args.walletHash, content.indexes)
        )
  debugLog('ledger-sync', 'verified candidate revision', {
    durationMs: getVerificationDurationMs(),
    contentMode: content.mode,
    records: candidate.recordCount,
    chunks: candidate.chunks.length,
    indexShards: candidate.indexes.length
  })
  const newBlobs =
    content.mode === 'reused-verified'
      ? []
      : getNewImmutableBlobs({
          walletHash: args.walletHash,
          current: current.manifest,
          chunks: content.chunks,
          indexes: content.indexes
        })
  const getBlobWriteDurationMs = startHoldingsDebugTimer()
  const blobResults =
    newBlobs.length === 0 ? [] : await writeImmutableLedgerBlobs({ redis: args.redis, items: newBlobs })
  debugLog('ledger-sync', 'published immutable revision blobs', {
    durationMs: getBlobWriteDurationMs(),
    contentMode: content.mode,
    referenced: candidate.chunks.length + candidate.indexes.length,
    attempted: newBlobs.length,
    written: blobResults.filter(({ status }) => status === 'written').length,
    verifiedExisting: blobResults.filter(({ status }) => status === 'exists').length,
    reusedVerifiedReferences:
      content.mode === 'reused-verified' ? candidate.chunks.length + candidate.indexes.length : 0
  })
  if (blobResults.some(({ status }) => status !== 'written' && status !== 'exists')) {
    throw new HoldingsLedgerSyncError('storage_failed', 500)
  }
  await assertLockRenewed(args.redis, args.walletHash, args.lock)
  const statusUpdatedAtMs = Date.now()
  const completeStatus = getSyncStatus({
    state: 'complete',
    sourceGeneration,
    revision: candidate.revision,
    reasonCode: null,
    updatedAtMs: statusUpdatedAtMs
  })
  const getCommitDurationMs = startHoldingsDebugTimer()
  const commit = await commitVerifiedLedgerRevision({
    redis: args.redis,
    lock: args.lock,
    expectedHead: current.head,
    revision: verified,
    syncStatus: completeStatus
  })
  debugLog('ledger-sync', 'completed fenced revision head commit', {
    durationMs: getCommitDurationMs(),
    status: commit.status
  })
  if (commit.status === 'lock_lost') {
    throw new HoldingsLedgerSyncError('stale_fence', 409)
  }
  if (commit.status === 'head_conflict') {
    throw new HoldingsLedgerSyncError('cas_rejected', 409)
  }
  if (commit.status === 'manifest_exists') {
    throw new HoldingsLedgerSyncError('storage_failed', 500)
  }
  const completedAtMs = Date.now()

  reportLedgerMetric({
    name: 'ledger.manifest',
    outcome: 'success',
    mode: holdingsConfig.ledgerMode,
    walletHash: args.walletHash,
    durationMs: completedAtMs - args.startedAtMs,
    chunkCount: candidate.chunks.length,
    indexShardCount: candidate.indexes.length,
    recordCount: candidate.recordCount,
    encodedBytes: candidate.activeEncodedBytes,
    envioPages: fetched.stats.totalPages,
    envioRows: fetched.stats.totalRows,
    envioRequestCount: fetched.stats.totalRequests,
    envioPresenceChainProbeCount: fetched.stats.validationQueries,
    envioPresenceRequestCount: fetched.stats.presenceRequests,
    envioBatchedRequestCount: fetched.stats.batchedRequests,
    envioContinuationRequestCount: fetched.stats.continuationRequests,
    dirtyFromDate: candidate.dirtyFromDate ?? undefined,
    dirtyReason: candidate.dirtyReasons[0],
    syncReason: getMetricSyncReason(syncType),
    eventCounts: Object.fromEntries(
      LEDGER_STREAMS.map((stream) => [
        stream,
        {
          cached: merge.stats[stream].cached,
          added: merge.stats[stream].added,
          replaced: merge.stats[stream].replaced,
          deleted: merge.stats[stream].deleted
        }
      ])
    )
  })
  debugLog('ledger-sync', 'completed synchronization with a new revision', {
    durationMs: completedAtMs - args.startedAtMs,
    syncType,
    records: candidate.recordCount,
    chunks: candidate.chunks.length,
    indexShards: candidate.indexes.length,
    encodedBytes: candidate.activeEncodedBytes,
    newBlobs: newBlobs.length,
    contentMode: content.mode
  })

  return {
    syncResult: {
      status: 'updated',
      syncType,
      revision: candidate.revision,
      sourceGeneration,
      events,
      streams: merge.stats,
      envio: getEnvioResponseStats(fetched.stats, initialMetadata),
      storage: getStorageStats(candidate, newBlobs.length),
      dirty: {
        fromTimestamp: candidate.dirtyFromTimestamp,
        fromDate: candidate.dirtyFromDate,
        reasons: candidate.dirtyReasons
      },
      parity,
      durationMs: completedAtMs - args.startedAtMs
    },
    verifiedRevision: verified,
    headSource: 'active'
  }
}

async function runHoldingsLedgerSync<TConsumed>(
  args: TLedgerSyncArguments,
  consume: (context: TSynchronizedHoldingsLedgerRevision) => Promise<TConsumed>
): Promise<TWithSynchronizedHoldingsLedgerRevisionResult<TConsumed>> {
  const startedAtMs = Date.now()
  const getTotalDurationMs = startHoldingsDebugTimer()
  const walletHash = hashLedgerWalletAddress(args.address)
  const redis = getHoldingsLedgerRedisClient() as TLedgerPipelineRedis | null
  if (!redis) {
    throw new HoldingsLedgerSyncError('storage_failed', 503)
  }
  const owner = `ledger-sync-${randomUUID()}`
  const getLockDurationMs = startHoldingsDebugTimer()
  const lockResult = await acquireLedgerLock({
    redis,
    lockKey: getLedgerLockKey(walletHash),
    fenceKey: getLedgerFenceKey(walletHash),
    owner,
    ttlMs: LEDGER_SYNC_LOCK_TTL_MS
  })
  debugLog('ledger-sync', 'attempted wallet synchronization lock acquisition', {
    durationMs: getLockDurationMs(),
    status: lockResult.status
  })
  if (lockResult.status === 'busy') {
    reportLedgerMetric({
      name: 'ledger.lock',
      outcome: 'lock-contention',
      mode: holdingsConfig.ledgerMode,
      walletHash,
      durationMs: Date.now() - startedAtMs
    })
    debugLog('ledger-sync', 'completed wallet synchronization', {
      durationMs: getTotalDurationMs(),
      status: 'syncing',
      reasonCode: 'lock_busy'
    })
    return { kind: 'busy', syncResult: { status: 'syncing', reasonCode: 'lock_busy' } }
  }

  try {
    const completion = await (async (): Promise<TLedgerSyncCompletion> => {
      const forceRebuild = args.forceRebuild ?? false
      const getRevisionReadDurationMs = startHoldingsDebugTimer()
      const currentRead = await readCurrentRevisionForSync({
        redis,
        walletHash,
        lock: lockResult.lock,
        forceRebuild,
        startedAtMs
      })
      debugLog('ledger-sync', 'read and verified current wallet revision', {
        durationMs: getRevisionReadDurationMs(),
        status: currentRead.status,
        headSource: currentRead.status === 'ready' ? currentRead.headSource : undefined
      })
      const current = getCurrentRevision(currentRead)
      const attemptState = { sourceGeneration: current.manifest?.sourceGeneration ?? 1 }
      try {
        const result = await performLedgerSync({
          address: args.address,
          forceRebuild,
          compareLegacy: args.compareLegacy ?? false,
          redis,
          walletHash,
          lock: lockResult.lock,
          currentRead,
          attemptState,
          startedAtMs
        })
        debugLog('ledger-sync', 'completed wallet synchronization', {
          durationMs: getTotalDurationMs(),
          status: result.syncResult.status,
          syncType: result.syncResult.syncType
        })
        return result
      } catch (error) {
        const syncError = normalizeSyncError(error)
        const failedStatus = getSyncStatus({
          state: 'failed',
          sourceGeneration: attemptState.sourceGeneration,
          revision: current.manifest?.revision ?? null,
          reasonCode: syncError.reasonCode,
          updatedAtMs: Date.now()
        })
        await writeLedgerSyncStatus({
          redis,
          walletHash,
          lock: lockResult.lock,
          status: failedStatus
        }).catch(() => undefined)
        reportLedgerMetric({
          name: 'ledger.manifest',
          outcome:
            syncError.reasonCode === 'stale_fence'
              ? 'stale-writer'
              : syncError.reasonCode === 'cas_rejected'
                ? 'head-conflict'
                : 'error',
          mode: holdingsConfig.ledgerMode,
          walletHash,
          durationMs: Date.now() - startedAtMs
        })
        debugLog('ledger-sync', 'wallet synchronization failed', {
          durationMs: getTotalDurationMs(),
          reasonCode: syncError.reasonCode,
          errorClass: error instanceof Error ? error.name : 'UnknownError'
        })
        throw syncError
      }
    })().catch((error) => {
      throw normalizeSyncError(error)
    })

    const consumed = await consume({
      syncResult: completion.syncResult,
      verifiedRevision: completion.verifiedRevision,
      headSource: completion.headSource,
      redis,
      walletHash
    })
    return { kind: 'completed', syncResult: completion.syncResult, consumed }
  } finally {
    const getLockReleaseDurationMs = startHoldingsDebugTimer()
    const release = await releaseLedgerLock({
      redis,
      lockKey: getLedgerLockKey(walletHash),
      lock: lockResult.lock
    }).catch(() => ({ status: 'failed' as const }))
    debugLog('ledger-sync', 'released wallet synchronization lock', {
      durationMs: getLockReleaseDurationMs(),
      status: release.status
    })
  }
}

export async function syncHoldingsLedger(args: TLedgerSyncArguments): Promise<TLedgerSyncResult> {
  const result = await runHoldingsLedgerSync(args, async () => undefined)
  return result.syncResult
}

export function withSynchronizedHoldingsLedgerRevision<TConsumed>(
  args: TLedgerSyncArguments,
  consume: (context: TSynchronizedHoldingsLedgerRevision) => Promise<TConsumed>
): Promise<TWithSynchronizedHoldingsLedgerRevisionResult<TConsumed>> {
  return runHoldingsLedgerSync(args, consume)
}
