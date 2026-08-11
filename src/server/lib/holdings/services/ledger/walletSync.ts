import { randomUUID } from 'node:crypto'
import { holdingsConfig } from '@/server/lib/holdings/config'
import { debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import {
  fetchEnvioLedgerMetadata,
  fetchEnvioLedgerSource,
  rereadEnvioLedgerMetadata,
  type TEnvioLedgerFetchStats,
  type TEnvioLedgerMetadata
} from '@/server/lib/holdings/services/ledger/envio'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import {
  mergeLedgerStreams,
  type TLedgerAuthoritativeWindow,
  type TLedgerStreamMergeStats
} from '@/server/lib/holdings/services/ledger/merge'
import { getLedgerSourceFingerprint, LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'
import { LEDGER_STREAMS, type TLedgerSixStreams, type TLedgerStream } from '@/server/lib/holdings/services/ledger/types'
import { encodeWalletLedgerPayload } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  acquireWalletLedgerLock,
  commitStoredWalletLedger,
  readStoredWalletLedger,
  releaseWalletLedgerLock,
  renewWalletLedgerLock,
  type TWalletLedgerLock,
  type TWalletLedgerRedis
} from '@/server/lib/holdings/services/ledger/walletStore'
import {
  type TWalletLedgerCompletedSyncResult,
  type TWalletLedgerCoverageV1,
  type TWalletLedgerEventStats,
  type TWalletLedgerReadResult,
  type TWalletLedgerState,
  type TWalletLedgerSyncResult,
  type TWalletLedgerSyncType,
  type TWithSynchronizedWalletLedgerResult,
  WALLET_LEDGER_EMPTY_TTL_MS,
  WALLET_LEDGER_FRESHNESS_MS,
  WALLET_LEDGER_LOCK_HEARTBEAT_MS,
  WALLET_LEDGER_LOCK_TTL_MS,
  WALLET_LEDGER_SCHEMA_VERSION,
  WalletLedgerError
} from '@/server/lib/holdings/services/ledger/walletTypes'
import {
  getHoldingsLedgerRedisClient,
  HoldingsLedgerRedisOperationError
} from '@/server/lib/holdings/storage/ledgerRedis'

export interface TWalletLedgerSyncArguments {
  readonly address: string
  readonly forceRebuild?: boolean
  readonly nowMs?: number
}

export interface TSynchronizedWalletLedgerContext {
  readonly ledger: TWalletLedgerState
  readonly sync: TWalletLedgerCompletedSyncResult
}

function getNowMs(value: number | undefined): number {
  const nowMs = value ?? Date.now()
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('Wallet ledger current timestamp must be a non-negative safe integer')
  }
  return nowMs
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

function getRecordCount(streams: TLedgerSixStreams): number {
  return LEDGER_STREAMS.reduce((total, stream) => total + streams[stream].length, 0)
}

function getFreshStreamStats(streams: TLedgerSixStreams): Readonly<Record<TLedgerStream, TLedgerStreamMergeStats>> {
  return Object.fromEntries(
    LEDGER_STREAMS.map((stream) => [
      stream,
      {
        cached: streams[stream].length,
        fetched: 0,
        added: 0,
        replaced: 0,
        deleted: 0,
        total: streams[stream].length
      }
    ])
  ) as Record<TLedgerStream, TLedgerStreamMergeStats>
}

function sumEventStats(streams: Readonly<Record<TLedgerStream, TLedgerStreamMergeStats>>): TWalletLedgerEventStats {
  return LEDGER_STREAMS.reduce<TWalletLedgerEventStats>(
    (total, stream) => ({
      cached: total.cached + streams[stream].cached,
      fetched: total.fetched + streams[stream].fetched,
      added: total.added + streams[stream].added,
      replaced: total.replaced + streams[stream].replaced,
      deleted: total.deleted + streams[stream].deleted,
      total: total.total + streams[stream].total
    }),
    { cached: 0, fetched: 0, added: 0, replaced: 0, deleted: 0, total: 0 }
  )
}

function getConfiguredChainIds(): readonly number[] {
  return [...holdingsConfig.ledgerChainIds].toSorted((left, right) => left - right)
}

function hasConfiguredChainScope(ledger: TWalletLedgerState): boolean {
  const expected = getConfiguredChainIds()
  const actual = ledger.coverage.map(({ chainId }) => chainId)
  return expected.length === actual.length && expected.every((chainId, index) => chainId === actual[index])
}

export function isWalletLedgerCompatible(ledger: TWalletLedgerState): boolean {
  return ledger.calculationVersion === LEDGER_CALCULATION_VERSION && hasConfiguredChainScope(ledger)
}

function isFreshCompatibleLedger(ledger: TWalletLedgerState, nowMs: number, forceRebuild: boolean): boolean {
  return (
    !forceRebuild &&
    isWalletLedgerCompatible(ledger) &&
    nowMs >= ledger.updatedAtMs &&
    nowMs - ledger.updatedAtMs < WALLET_LEDGER_FRESHNESS_MS
  )
}

function selectConfiguredMetadata(metadata: readonly TEnvioLedgerMetadata[]): readonly TEnvioLedgerMetadata[] {
  const metadataByChain = new Map(metadata.map((entry) => [entry.chainId, entry]))
  const selected = getConfiguredChainIds().map((chainId) => metadataByChain.get(chainId))
  if (selected.length === 0 || selected.some((entry) => entry === undefined)) {
    throw new WalletLedgerError('upstream_failed', 502)
  }
  const configured = selected as TEnvioLedgerMetadata[]
  if (configured.some(({ isReady }) => !isReady)) {
    throw new WalletLedgerError('source_lagging', 503)
  }
  return configured
}

function getCoverage(metadata: readonly TEnvioLedgerMetadata[]): TWalletLedgerCoverageV1[] {
  return metadata.map(({ chainId, startBlock, endBlock, progressBlock }) => ({
    chainId,
    startBlock,
    endBlock,
    completeThroughBlock: progressBlock
  }))
}

function hasMatchingSourceContract(ledger: TWalletLedgerState, metadata: readonly TEnvioLedgerMetadata[]): boolean {
  const next = getCoverage(metadata)
  return (
    ledger.coverage.length === next.length &&
    ledger.coverage.every((coverage, index) => {
      const candidate = next[index]
      return (
        candidate !== undefined &&
        coverage.chainId === candidate.chainId &&
        coverage.startBlock === candidate.startBlock &&
        coverage.endBlock === candidate.endBlock
      )
    })
  )
}

function getSyncType(args: {
  readonly current: TWalletLedgerState | null
  readonly sourceFingerprint: string
  readonly metadata: readonly TEnvioLedgerMetadata[]
  readonly forceRebuild: boolean
}): TWalletLedgerSyncType {
  if (!args.current) {
    return 'bootstrap'
  }
  if (
    args.current.sourceFingerprint !== args.sourceFingerprint ||
    !hasMatchingSourceContract(args.current, args.metadata)
  ) {
    return 'source-reset'
  }
  if (args.forceRebuild || args.current.calculationVersion !== LEDGER_CALCULATION_VERSION) {
    return 'forced-reset'
  }
  return 'warm'
}

function getLowerBlocks(args: {
  readonly metadata: readonly TEnvioLedgerMetadata[]
  readonly current: TWalletLedgerState | null
  readonly syncType: TWalletLedgerSyncType
}): Readonly<Record<number, number>> {
  const currentByChain = new Map(args.current?.coverage.map((entry) => [entry.chainId, entry]) ?? [])
  return Object.fromEntries(
    args.metadata.map((metadata) => {
      const previous = currentByChain.get(metadata.chainId)
      if (args.syncType === 'warm' && !previous) {
        throw new WalletLedgerError('decode_failed', 500)
      }
      if (previous && args.syncType !== 'source-reset' && previous.completeThroughBlock > metadata.progressBlock) {
        throw new WalletLedgerError('upstream_failed', 502)
      }
      return [
        metadata.chainId,
        args.syncType === 'warm' && previous
          ? Math.max(metadata.startBlock, previous.completeThroughBlock - holdingsConfig.ledgerOverlapBlocks)
          : metadata.startBlock
      ]
    })
  )
}

function getAuthoritativeWindows(
  windows: readonly { readonly chainId: number; readonly lowerBlock: number; readonly upperBlock: number }[]
): TLedgerAuthoritativeWindow[] {
  return LEDGER_STREAMS.flatMap((stream) => windows.map((window) => ({ stream, ...window })))
}

async function assertLockRenewed(
  redis: TWalletLedgerRedis,
  walletHash: string,
  lock: TWalletLedgerLock
): Promise<void> {
  const renewed = await renewWalletLedgerLock({
    redis,
    walletHash,
    lock,
    ttlMs: WALLET_LEDGER_LOCK_TTL_MS
  })
  if (renewed.status !== 'ok') {
    throw new WalletLedgerError('stale_lock', 409)
  }
}

function createLockHeartbeat(args: {
  readonly redis: TWalletLedgerRedis
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
}): () => Promise<void> {
  const state = {
    renewedAtMs: Date.now(),
    inFlight: null as Promise<void> | null
  }
  return async () => {
    if (Date.now() - state.renewedAtMs < WALLET_LEDGER_LOCK_HEARTBEAT_MS) {
      return
    }
    if (state.inFlight) {
      await state.inFlight
      return
    }
    const renewal = assertLockRenewed(args.redis, args.walletHash, args.lock)
      .then(() => {
        state.renewedAtMs = Date.now()
      })
      .finally(() => {
        state.inFlight = null
      })
    state.inFlight = renewal
    await renewal
  }
}

function getEnvioStats(stats: TEnvioLedgerFetchStats) {
  return {
    pages: stats.totalPages,
    rows: stats.totalRows,
    requests: stats.totalRequests,
    strategy: stats.strategy
  }
}

function getDurationMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100
}

function createFreshSyncResult(ledger: TWalletLedgerState, startedAt: number): TWalletLedgerCompletedSyncResult {
  const streams = getFreshStreamStats(ledger.streams)
  return {
    status: 'ready',
    outcome: 'fresh',
    syncType: 'fresh',
    ledger,
    events: sumEventStats(streams),
    streams,
    envio: { pages: 0, rows: 0, requests: 0, strategy: 'none' },
    durationMs: getDurationMs(startedAt)
  }
}

function getSyncOutcome(args: {
  readonly syncType: TWalletLedgerSyncType
  readonly current: TWalletLedgerState | null
  readonly coverage: readonly TWalletLedgerCoverageV1[]
  readonly streamsChanged: boolean
}): 'unchanged' | 'updated' {
  if (args.syncType !== 'warm' || !args.current || args.streamsChanged) {
    return 'updated'
  }
  const coverageChanged = args.current.coverage.some(
    (entry, index) => entry.completeThroughBlock !== args.coverage[index]?.completeThroughBlock
  )
  return coverageChanged ? 'updated' : 'unchanged'
}

async function performWalletLedgerSync(args: {
  readonly address: string
  readonly forceRebuild: boolean
  readonly nowMs: number
  readonly redis: TWalletLedgerRedis
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly currentRead: TWalletLedgerReadResult
  readonly startedAt: number
}): Promise<TWalletLedgerCompletedSyncResult> {
  if (args.currentRead.status === 'corrupt' && !args.forceRebuild) {
    throw new WalletLedgerError('decode_failed', 500)
  }
  const current = args.currentRead.status === 'ready' ? args.currentRead.ledger : null
  if (current && isFreshCompatibleLedger(current, args.nowMs, args.forceRebuild)) {
    debugLog('wallet-ledger-sync', 'used fresh wallet ledger after lock acquisition', {
      records: getRecordCount(current.streams),
      encodedBytes: current.encodedBytes
    })
    return createFreshSyncResult(current, args.startedAt)
  }

  const getMetadataDurationMs = startHoldingsDebugTimer()
  const metadata = selectConfiguredMetadata(
    await fetchEnvioLedgerMetadata().catch(() => {
      throw new WalletLedgerError('upstream_failed', 502)
    })
  )
  debugLog('wallet-ledger-sync', 'fetched Envio synchronization metadata', {
    durationMs: getMetadataDurationMs(),
    chains: metadata.length,
    readyChains: metadata.filter(({ isReady }) => isReady).length
  })
  const sourceFingerprint = getLedgerSourceFingerprint(holdingsConfig.envioGraphqlUrl, metadata)
  const syncType = getSyncType({
    current,
    sourceFingerprint,
    metadata,
    forceRebuild: args.forceRebuild
  })
  const lowerBlockByChain = getLowerBlocks({ metadata, current, syncType })
  const strategy = syncType === 'warm' ? 'warm-batched' : 'faceted-batched'
  const heartbeat = createLockHeartbeat({ redis: args.redis, walletHash: args.walletHash, lock: args.lock })
  const getSourceDurationMs = startHoldingsDebugTimer()
  const fetched = await fetchEnvioLedgerSource({
    address: args.address,
    metadata,
    lowerBlockByChain,
    strategy,
    onPage: heartbeat
  }).catch((error) => {
    if (error instanceof WalletLedgerError) {
      throw error
    }
    throw new WalletLedgerError('upstream_failed', 502)
  })
  debugLog('wallet-ledger-sync', 'fetched authoritative Envio event windows', {
    durationMs: getSourceDurationMs(),
    strategy: fetched.stats.strategy,
    pages: fetched.stats.totalPages,
    rows: fetched.stats.totalRows,
    requests: fetched.stats.totalRequests,
    presenceRequests: fetched.stats.presenceRequests,
    batchedRequests: fetched.stats.batchedRequests,
    continuationRequests: fetched.stats.continuationRequests
  })
  const getRevalidationDurationMs = startHoldingsDebugTimer()
  await rereadEnvioLedgerMetadata(metadata).catch(() => {
    throw new WalletLedgerError('upstream_failed', 502)
  })
  await assertLockRenewed(args.redis, args.walletHash, args.lock)
  debugLog('wallet-ledger-sync', 'revalidated Envio metadata and lock ownership', {
    durationMs: getRevalidationDurationMs()
  })

  const getMergeDurationMs = startHoldingsDebugTimer()
  const merge = mergeLedgerStreams({
    cached: syncType === 'warm' && current ? current.streams : emptyLedgerStreams(),
    fetched: fetched.streams,
    windows: getAuthoritativeWindows(fetched.windows)
  })
  const streamsChanged = LEDGER_STREAMS.some((stream) => {
    const stats = merge.stats[stream]
    return stats.added > 0 || stats.replaced > 0 || stats.deleted > 0
  })
  debugLog('wallet-ledger-sync', 'merged authoritative wallet event windows', {
    durationMs: getMergeDurationMs(),
    cachedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].cached, 0),
    fetchedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].fetched, 0),
    addedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].added, 0),
    replacedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].replaced, 0),
    deletedEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].deleted, 0),
    totalEvents: LEDGER_STREAMS.reduce((total, stream) => total + merge.stats[stream].total, 0)
  })
  const coverage = getCoverage(metadata)
  const sourceGeneration = current ? current.sourceGeneration + (syncType === 'source-reset' ? 1 : 0) : 1
  const getEncodeDurationMs = startHoldingsDebugTimer()
  const encoded = encodeWalletLedgerPayload({
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: LEDGER_CALCULATION_VERSION,
    walletHash: args.walletHash,
    sourceFingerprint,
    sourceGeneration,
    coverage,
    streams: merge.streams,
    createdAtMs: current?.createdAtMs ?? args.nowMs,
    updatedAtMs: args.nowMs
  })
  debugLog('wallet-ledger-sync', 'encoded complete wallet ledger value', {
    durationMs: getEncodeDurationMs(),
    records: getRecordCount(encoded.ledger.streams),
    encodedBytes: encoded.ledger.encodedBytes,
    decodedBytes: encoded.ledger.decodedBytes
  })
  const getCommitDurationMs = startHoldingsDebugTimer()
  const commit = await commitStoredWalletLedger({
    redis: args.redis,
    walletHash: args.walletHash,
    lock: args.lock,
    value: encoded.value,
    ...(getRecordCount(encoded.ledger.streams) === 0 ? { ttlMs: WALLET_LEDGER_EMPTY_TTL_MS } : {})
  })
  debugLog('wallet-ledger-sync', 'committed complete wallet ledger value', {
    durationMs: getCommitDurationMs(),
    status: commit.status
  })
  if (commit.status !== 'ok') {
    throw new WalletLedgerError('stale_lock', 409)
  }
  return {
    status: 'ready',
    outcome: getSyncOutcome({ syncType, current, coverage, streamsChanged }),
    syncType,
    ledger: encoded.ledger,
    events: sumEventStats(merge.stats),
    streams: merge.stats,
    envio: getEnvioStats(fetched.stats),
    durationMs: getDurationMs(args.startedAt)
  }
}

function normalizeWalletLedgerError(error: unknown): WalletLedgerError {
  if (error instanceof WalletLedgerError) {
    return error
  }
  if (error instanceof HoldingsLedgerRedisOperationError) {
    return new WalletLedgerError('storage_failed', 503)
  }
  return new WalletLedgerError('storage_failed', 500)
}

function getRedisClient(): TWalletLedgerRedis {
  const redis = getHoldingsLedgerRedisClient() as TWalletLedgerRedis | null
  if (!redis) {
    throw new WalletLedgerError('storage_failed', 503)
  }
  return redis
}

export async function readWalletLedger(args: { readonly address: string }): Promise<TWalletLedgerReadResult> {
  try {
    return await readStoredWalletLedger({
      redis: getRedisClient(),
      walletHash: hashLedgerWalletAddress(args.address)
    })
  } catch (error) {
    throw normalizeWalletLedgerError(error)
  }
}

async function runWithSynchronizedWalletLedger<TConsumed>(
  args: TWalletLedgerSyncArguments,
  consume: (context: TSynchronizedWalletLedgerContext) => Promise<TConsumed>
): Promise<TWithSynchronizedWalletLedgerResult<TConsumed>> {
  const startedAt = performance.now()
  const nowMs = getNowMs(args.nowMs)
  const forceRebuild = args.forceRebuild ?? false
  const walletHash = hashLedgerWalletAddress(args.address)
  const redis = getRedisClient()
  const getInitialReadDurationMs = startHoldingsDebugTimer()
  const preliminary = await readStoredWalletLedger({ redis, walletHash }).catch((error) => {
    const normalized = normalizeWalletLedgerError(error)
    debugLog('wallet-ledger-sync', 'wallet ledger initial read failed', {
      durationMs: getInitialReadDurationMs(),
      reasonCode: normalized.reasonCode
    })
    throw normalized
  })
  debugLog('wallet-ledger-sync', 'read current wallet ledger value', {
    durationMs: getInitialReadDurationMs(),
    status: preliminary.status,
    records: preliminary.status === 'ready' ? getRecordCount(preliminary.ledger.streams) : undefined,
    encodedBytes: preliminary.status === 'ready' ? preliminary.ledger.encodedBytes : undefined
  })
  if (preliminary.status === 'ready' && isFreshCompatibleLedger(preliminary.ledger, nowMs, forceRebuild)) {
    const sync = createFreshSyncResult(preliminary.ledger, startedAt)
    debugLog('wallet-ledger-sync', 'used five-minute wallet ledger freshness fast path', {
      records: sync.events.total,
      encodedBytes: sync.ledger.encodedBytes
    })
    const consumed = await consume({ ledger: sync.ledger, sync })
    debugLog('wallet-ledger-sync', 'completed wallet ledger synchronization', {
      durationMs: sync.durationMs,
      outcome: sync.outcome,
      syncType: sync.syncType,
      records: sync.events.total
    })
    return { kind: 'completed', sync, consumed }
  }
  if (preliminary.status === 'corrupt' && !forceRebuild) {
    debugLog('wallet-ledger-sync', 'wallet ledger synchronization failed', {
      durationMs: getDurationMs(startedAt),
      reasonCode: 'decode_failed',
      errorClass: 'WalletLedgerCorruption'
    })
    throw new WalletLedgerError('decode_failed', 500)
  }

  const token = `wallet-ledger-${randomUUID().replaceAll('-', '')}`
  const getLockDurationMs = startHoldingsDebugTimer()
  const acquired = await acquireWalletLedgerLock({
    redis,
    walletHash,
    token,
    ttlMs: WALLET_LEDGER_LOCK_TTL_MS
  }).catch((error) => {
    const normalized = normalizeWalletLedgerError(error)
    debugLog('wallet-ledger-sync', 'wallet ledger lock acquisition failed', {
      durationMs: getLockDurationMs(),
      reasonCode: normalized.reasonCode
    })
    throw normalized
  })
  debugLog('wallet-ledger-sync', 'attempted wallet ledger lock acquisition', {
    durationMs: getLockDurationMs(),
    status: acquired.status
  })
  if (acquired.status === 'busy') {
    debugLog('wallet-ledger-sync', 'completed wallet ledger synchronization', {
      durationMs: getDurationMs(startedAt),
      outcome: 'lock_busy'
    })
    return { kind: 'busy', sync: { status: 'syncing', reasonCode: 'lock_busy' } }
  }

  try {
    const sync = await (async () => {
      try {
        const getLockedReadDurationMs = startHoldingsDebugTimer()
        const currentRead = await readStoredWalletLedger({ redis, walletHash })
        debugLog('wallet-ledger-sync', 'reread wallet ledger while holding its lock', {
          durationMs: getLockedReadDurationMs(),
          status: currentRead.status
        })
        return await performWalletLedgerSync({
          address: args.address,
          forceRebuild,
          nowMs,
          redis,
          walletHash,
          lock: acquired.lock,
          currentRead,
          startedAt
        })
      } catch (error) {
        const normalized = normalizeWalletLedgerError(error)
        debugLog('wallet-ledger-sync', 'wallet ledger synchronization failed', {
          durationMs: getDurationMs(startedAt),
          reasonCode: normalized.reasonCode,
          errorClass: error instanceof Error ? error.name : 'UnknownError'
        })
        throw normalized
      }
    })()
    const consumed = await consume({ ledger: sync.ledger, sync })
    debugLog('wallet-ledger-sync', 'completed wallet ledger synchronization', {
      durationMs: sync.durationMs,
      outcome: sync.outcome,
      syncType: sync.syncType,
      records: sync.events.total
    })
    return { kind: 'completed', sync, consumed }
  } finally {
    const getReleaseDurationMs = startHoldingsDebugTimer()
    const released = await releaseWalletLedgerLock({ redis, walletHash, lock: acquired.lock }).catch(() => ({
      status: 'lock_lost' as const
    }))
    debugLog('wallet-ledger-sync', 'released wallet ledger lock', {
      durationMs: getReleaseDurationMs(),
      status: released.status
    })
  }
}

export function withSynchronizedWalletLedger<TConsumed>(
  args: TWalletLedgerSyncArguments,
  consume: (context: TSynchronizedWalletLedgerContext) => Promise<TConsumed>
): Promise<TWithSynchronizedWalletLedgerResult<TConsumed>> {
  return runWithSynchronizedWalletLedger(args, consume)
}

export async function synchronizeWalletLedger(args: TWalletLedgerSyncArguments): Promise<TWalletLedgerSyncResult> {
  const result = await runWithSynchronizedWalletLedger(args, async () => undefined)
  return result.sync
}

export function getWalletLedgerRecordCount(ledger: TWalletLedgerState): number {
  return getRecordCount(ledger.streams)
}
