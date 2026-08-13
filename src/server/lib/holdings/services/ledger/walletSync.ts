import { randomUUID } from 'node:crypto'
import { holdingsConfig } from '@/server/lib/holdings/config'
import { debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import { timestampToDateString } from '@/server/lib/holdings/services/holdings'
import {
  fetchEnvioLedgerMetadata,
  fetchEnvioLedgerSource,
  fetchEnvioLedgerVaultStreams,
  rereadEnvioLedgerMetadata,
  type TEnvioLedgerChainWindow,
  type TEnvioLedgerFetchStats,
  type TEnvioLedgerMetadata
} from '@/server/lib/holdings/services/ledger/envio'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import {
  mergeLedgerStreams,
  type TLedgerAuthoritativeWindow,
  type TLedgerMergeResult,
  type TLedgerStreamMergeStats
} from '@/server/lib/holdings/services/ledger/merge'
import { getLedgerSourceFingerprint, LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'
import {
  LEDGER_STREAMS,
  type TLedgerSixStreams,
  type TLedgerSourceEvent,
  type TLedgerStream
} from '@/server/lib/holdings/services/ledger/types'
import { encodeWalletLedgerPayload } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  groupWalletLedgerInvalidationVaults,
  readPendingWalletLedgerInvalidations,
  readWalletLedgerInvalidationHead,
  type TPendingWalletLedgerInvalidations
} from '@/server/lib/holdings/services/ledger/walletInvalidation'
import {
  acquireWalletLedgerLock,
  commitStoredWalletLedger,
  commitWalletLedgerCheckedMarker,
  readStoredWalletLedger,
  readVerifiedWalletLedgerHeader,
  readWalletLedgerCheckedMarker,
  releaseWalletLedgerLock,
  renewWalletLedgerLock,
  type TWalletLedgerLock,
  type TWalletLedgerRedis,
  verifyWalletLedgerSnapshotUnderLock
} from '@/server/lib/holdings/services/ledger/walletStore'
import { createWalletLedgerDailyUsdCacheCommitTransitions } from '@/server/lib/holdings/services/ledger/walletTotalsCache'
import {
  type TWalletLedgerCheckedMarkerReadResult,
  type TWalletLedgerCheckedMarkerV2,
  type TWalletLedgerCompletedSyncResult,
  type TWalletLedgerCoverageV1,
  type TWalletLedgerEventStats,
  type TWalletLedgerReadResult,
  type TWalletLedgerState,
  type TWalletLedgerSyncResult,
  type TWalletLedgerSyncType,
  type TWalletLedgerVerifiedHeaderReadResult,
  type TWithSynchronizedWalletLedgerResult,
  WALLET_LEDGER_EMPTY_TTL_MS,
  WALLET_LEDGER_FRESHNESS_MS,
  WALLET_LEDGER_LOCK_HEARTBEAT_MS,
  WALLET_LEDGER_LOCK_TTL_MS,
  WALLET_LEDGER_SCHEMA_VERSION,
  WalletLedgerError
} from '@/server/lib/holdings/services/ledger/walletTypes'
import {
  getNestedVaultPpsIdentifiersFromPriceRequests,
  resolveNestedVaultAssetMetadata
} from '@/server/lib/holdings/services/nestedVaultPrices'
import { toVaultKey } from '@/server/lib/holdings/services/pnlShared'
import { fetchMultipleVaultsMetadata, getVaultMetadataFetchFailedVaults } from '@/server/lib/holdings/services/vaults'
import {
  getHoldingsLedgerRedisClient,
  HoldingsLedgerRedisOperationError
} from '@/server/lib/holdings/storage/ledgerRedis'

export interface TWalletLedgerSyncArguments {
  readonly address: string
  readonly forceRebuild?: boolean
  readonly nowMs?: number
  readonly prefetchVaultMetadata?: boolean
  readonly onVaultsDiscovered?: (vaults: readonly TWalletLedgerVaultIdentifier[]) => void | Promise<void>
}

export interface TWalletLedgerVaultIdentifier {
  readonly chainId: number
  readonly vaultAddress: string
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

function isFreshCompatibleLedger(
  ledger: TWalletLedgerState,
  markerRead: TWalletLedgerCheckedMarkerReadResult,
  nowMs: number,
  forceRebuild: boolean,
  invalidationHead: number
): boolean {
  const marker = getMatchingCheckedMarker(ledger, markerRead, nowMs)
  return (
    marker !== null &&
    !forceRebuild &&
    isWalletLedgerCompatible(ledger) &&
    ledger.appliedInvalidationSequence === invalidationHead &&
    nowMs >= ledger.updatedAtMs &&
    nowMs - marker.checkedAtMs < WALLET_LEDGER_FRESHNESS_MS &&
    nowMs - marker.reconciledAtMs < holdingsConfig.ledgerReconcileIntervalMs
  )
}

function getMatchingCheckedMarker(
  ledger: TWalletLedgerState,
  markerRead: TWalletLedgerCheckedMarkerReadResult,
  nowMs: number
): TWalletLedgerCheckedMarkerV2 | null {
  if (
    markerRead.status !== 'ready' ||
    markerRead.marker.revision !== ledger.revision ||
    markerRead.marker.checkedAtMs > nowMs ||
    markerRead.marker.reconciledAtMs > nowMs ||
    !hasCompatibleCoverage(ledger.coverage, markerRead.marker.coverage)
  ) {
    return null
  }
  return markerRead.marker
}

function hasCompatibleCoverage(
  stored: readonly TWalletLedgerCoverageV1[],
  checked: readonly TWalletLedgerCoverageV1[]
): boolean {
  return (
    stored.length === checked.length &&
    stored.every((entry, index) => {
      const candidate = checked[index]
      return (
        candidate !== undefined &&
        entry.chainId === candidate.chainId &&
        entry.startBlock === candidate.startBlock &&
        entry.endBlock === candidate.endBlock &&
        entry.completeThroughBlock <= candidate.completeThroughBlock
      )
    })
  )
}

function getEffectiveCoverage(
  ledger: TWalletLedgerState,
  markerRead: TWalletLedgerCheckedMarkerReadResult,
  nowMs: number
): readonly TWalletLedgerCoverageV1[] {
  return getMatchingCheckedMarker(ledger, markerRead, nowMs)?.coverage ?? ledger.coverage
}

function getEffectiveCoveredAtMs(
  ledger: TWalletLedgerState,
  markerRead: TWalletLedgerCheckedMarkerReadResult,
  nowMs: number
): number {
  return getMatchingCheckedMarker(ledger, markerRead, nowMs)?.coveredAtMs ?? ledger.updatedAtMs
}

function getEffectiveReconciledAtMs(
  ledger: TWalletLedgerState,
  markerRead: TWalletLedgerCheckedMarkerReadResult,
  nowMs: number
): number {
  return getMatchingCheckedMarker(ledger, markerRead, nowMs)?.reconciledAtMs ?? ledger.reconciledAtMs
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
  readonly nowMs: number
  readonly effectiveReconciledAtMs: number | null
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
  if (
    args.effectiveReconciledAtMs !== null &&
    args.nowMs - args.effectiveReconciledAtMs >= holdingsConfig.ledgerReconcileIntervalMs
  ) {
    return 'reconcile'
  }
  return 'warm'
}

function getLowerBlocks(args: {
  readonly metadata: readonly TEnvioLedgerMetadata[]
  readonly current: TWalletLedgerState | null
  readonly effectiveCoverage: readonly TWalletLedgerCoverageV1[]
  readonly syncType: TWalletLedgerSyncType
}): Readonly<Record<number, number>> {
  const currentByChain = new Map(args.effectiveCoverage.map((entry) => [entry.chainId, entry]))
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

function getInvalidationWindows(
  invalidations: Extract<TPendingWalletLedgerInvalidations, { readonly status: 'ready' }>,
  metadata: readonly TEnvioLedgerMetadata[]
): readonly TEnvioLedgerChainWindow[] {
  const metadataByChain = new Map(metadata.map((entry) => [entry.chainId, entry]))
  return Array.from(groupWalletLedgerInvalidationVaults(invalidations.records).entries()).flatMap(
    ([chainId, scope]) => {
      const chain = metadataByChain.get(chainId)
      if (!chain) {
        return []
      }
      const lowerBlock = Math.max(chain.startBlock, scope.lowerBlock)
      if (lowerBlock > chain.progressBlock) {
        throw new WalletLedgerError('source_lagging', 503)
      }
      return [
        {
          chainId,
          lowerBlock,
          upperBlock: chain.progressBlock,
          vaultAddresses: scope.vaultAddresses
        }
      ]
    }
  )
}

function getVaultAuthoritativeWindows(windows: readonly TEnvioLedgerChainWindow[]): TLedgerAuthoritativeWindow[] {
  return LEDGER_STREAMS.flatMap((stream) =>
    windows.map((window) => ({
      stream,
      chainId: window.chainId,
      lowerBlock: window.lowerBlock,
      upperBlock: window.upperBlock,
      vaultAddresses: window.vaultAddresses
    }))
  )
}

function getScopedEarliestTimestamp(
  streams: TLedgerSixStreams,
  windows: readonly TEnvioLedgerChainWindow[]
): number | null {
  const windowsByChain = new Map(
    windows.map((window) => [
      window.chainId,
      {
        lowerBlock: window.lowerBlock,
        upperBlock: window.upperBlock,
        vaultAddresses: new Set(window.vaultAddresses?.map((address) => address.toLowerCase()) ?? [])
      }
    ])
  )
  return LEDGER_STREAMS.reduce<number | null>(
    (earliestAcrossStreams, stream) =>
      streams[stream].reduce<number | null>((earliest, event) => {
        const window = windowsByChain.get(event.chainId)
        const matches =
          window !== undefined &&
          event.blockNumber >= window.lowerBlock &&
          event.blockNumber <= window.upperBlock &&
          window.vaultAddresses.has(event.vaultAddress.toLowerCase())
        if (!matches) {
          return earliest
        }
        return earliest === null ? event.blockTimestamp : Math.min(earliest, event.blockTimestamp)
      }, earliestAcrossStreams),
    null
  )
}

function minTimestamp(...timestamps: readonly (number | null)[]): number | null {
  const values = timestamps.filter((timestamp): timestamp is number => timestamp !== null)
  return values.length === 0 ? null : Math.min(...values)
}

function getLedgerVaultIdentifiers(streams: TLedgerSixStreams): readonly TWalletLedgerVaultIdentifier[] {
  return Array.from(
    new Map(
      LEDGER_STREAMS.flatMap((stream) => [...streams[stream]] as TLedgerSourceEvent[]).map((event) => [
        toVaultKey(event.chainId, event.vaultAddress),
        { chainId: event.chainId, vaultAddress: event.vaultAddress.toLowerCase() }
      ])
    ).values()
  )
}

function notifyVaultsDiscovered(
  streams: TLedgerSixStreams,
  callback: TWalletLedgerSyncArguments['onVaultsDiscovered']
): void {
  if (!callback) {
    return
  }

  const vaults = getLedgerVaultIdentifiers(streams)
  if (vaults.length === 0) {
    return
  }

  const logFailure = (error: unknown): void => {
    debugLog('wallet-ledger-sync', 'wallet vault discovery callback failed without blocking synchronization', {
      requested: vaults.length,
      errorClass: error instanceof Error ? error.name : 'UnknownError'
    })
  }
  try {
    void Promise.resolve(callback(vaults)).catch(logFailure)
  } catch (error) {
    logFailure(error)
  }
}

function startLedgerVaultMetadataPrefetch(streams: TLedgerSixStreams, enabled: boolean): void {
  if (!enabled) {
    return
  }

  const vaults = getLedgerVaultIdentifiers(streams)
  if (vaults.length === 0) {
    return
  }

  const getDurationMs = startHoldingsDebugTimer()
  void fetchMultipleVaultsMetadata([...vaults])
    .then((metadata) => {
      debugLog('wallet-ledger-sync', 'prefetched wallet vault metadata during ledger persistence', {
        durationMs: getDurationMs(),
        requested: vaults.length,
        resolved: metadata.size,
        failed: getVaultMetadataFetchFailedVaults(metadata)
      })
    })
    .catch((error) => {
      debugLog('wallet-ledger-sync', 'wallet vault metadata prefetch failed without blocking synchronization', {
        durationMs: getDurationMs(),
        requested: vaults.length,
        errorClass: error instanceof Error ? error.name : 'UnknownError'
      })
    })
}

function getEarliestLedgerTimestamp(streams: TLedgerSixStreams, vaultKeys?: ReadonlySet<string>): number | null {
  return LEDGER_STREAMS.reduce<number | null>(
    (earliestAcrossStreams, stream) =>
      streams[stream].reduce<number | null>((earliest, event) => {
        if (vaultKeys && !vaultKeys.has(toVaultKey(event.chainId, event.vaultAddress))) {
          return earliest
        }
        return earliest === null ? event.blockTimestamp : Math.min(earliest, event.blockTimestamp)
      }, earliestAcrossStreams),
    null
  )
}

function getInvalidatedVaultKeys(
  invalidations: Extract<TPendingWalletLedgerInvalidations, { readonly status: 'ready' }>
): ReadonlySet<string> {
  return new Set(
    invalidations.records.flatMap(({ vaults }) => vaults.map((vault) => toVaultKey(vault.chainId, vault.address)))
  )
}

async function getNestedDependencyDirtyTimestamp(args: {
  readonly streams: TLedgerSixStreams
  readonly invalidations: Extract<TPendingWalletLedgerInvalidations, { readonly status: 'ready' }>
  readonly heartbeat: () => Promise<void>
}): Promise<{ readonly timestamp: number | null; readonly status: 'unaffected' | 'affected' | 'conservative' }> {
  const directVaults = getLedgerVaultIdentifiers(args.streams)
  if (args.invalidations.records.length === 0 || directVaults.length === 0) {
    return { timestamp: null, status: 'unaffected' }
  }

  const earliestLedgerTimestamp = getEarliestLedgerTimestamp(args.streams)
  try {
    await args.heartbeat()
    const baseMetadata = await fetchMultipleVaultsMetadata([...directVaults])
    await args.heartbeat()
    const resolvedMetadata = await resolveNestedVaultAssetMetadata(baseMetadata, 4, async (vaults) => {
      await args.heartbeat()
      const metadata = await fetchMultipleVaultsMetadata(vaults)
      await args.heartbeat()
      return metadata
    })
    const hasIncompleteMetadata =
      getVaultMetadataFetchFailedVaults(resolvedMetadata) > 0 ||
      directVaults.some((vault) => !resolvedMetadata.has(toVaultKey(vault.chainId, vault.vaultAddress)))
    if (hasIncompleteMetadata) {
      return { timestamp: earliestLedgerTimestamp, status: 'conservative' }
    }

    const invalidatedVaultKeys = getInvalidatedVaultKeys(args.invalidations)
    const affectedParentKeys = new Set(
      directVaults.flatMap((vault) => {
        const parentKey = toVaultKey(vault.chainId, vault.vaultAddress)
        const metadata = resolvedMetadata.get(parentKey)
        if (!metadata) {
          return []
        }
        const underlyingRequest = {
          chainId: metadata.chainId,
          address: metadata.token.address,
          timestamps: []
        }
        const dependencyKeys = new Set([
          toVaultKey(underlyingRequest.chainId, underlyingRequest.address),
          ...getNestedVaultPpsIdentifiersFromPriceRequests([underlyingRequest], resolvedMetadata).map((dependency) =>
            toVaultKey(dependency.chainId, dependency.vaultAddress)
          )
        ])
        return Array.from(dependencyKeys).some((dependencyKey) => invalidatedVaultKeys.has(dependencyKey))
          ? [parentKey]
          : []
      })
    )
    const timestamp = getEarliestLedgerTimestamp(args.streams, affectedParentKeys)
    return { timestamp, status: timestamp === null ? 'unaffected' : 'affected' }
  } catch {
    return { timestamp: earliestLedgerTimestamp, status: 'conservative' }
  }
}

function combineMerges(
  cached: TLedgerSixStreams,
  primary: TLedgerMergeResult,
  repair: TLedgerMergeResult | null
): {
  readonly streams: TLedgerSixStreams
  readonly stats: Readonly<Record<TLedgerStream, TLedgerStreamMergeStats>>
} {
  if (!repair) {
    return { streams: primary.streams, stats: primary.stats }
  }
  return {
    streams: repair.streams,
    stats: Object.fromEntries(
      LEDGER_STREAMS.map((stream) => [
        stream,
        {
          cached: cached[stream].length,
          fetched: primary.stats[stream].fetched + repair.stats[stream].fetched,
          added: primary.stats[stream].added + repair.stats[stream].added,
          replaced: primary.stats[stream].replaced + repair.stats[stream].replaced,
          deleted: primary.stats[stream].deleted + repair.stats[stream].deleted,
          total: repair.stats[stream].total
        }
      ])
    ) as Record<TLedgerStream, TLedgerStreamMergeStats>
  }
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

type TEnvioSourceRevalidationResult =
  | { readonly status: 'ready' }
  | { readonly status: 'failed'; readonly error: unknown }

function startEnvioSourceRevalidation(args: {
  readonly metadata: readonly TEnvioLedgerMetadata[]
  readonly redis: TWalletLedgerRedis
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
}): Promise<TEnvioSourceRevalidationResult> {
  const getDurationMs = startHoldingsDebugTimer()
  return Promise.all([
    rereadEnvioLedgerMetadata(args.metadata).catch(() => {
      throw new WalletLedgerError('upstream_failed', 502)
    }),
    assertLockRenewed(args.redis, args.walletHash, args.lock)
  ]).then(
    () => {
      debugLog('wallet-ledger-sync', 'revalidated Envio metadata and lock ownership', {
        durationMs: getDurationMs()
      })
      return { status: 'ready' as const }
    },
    (error: unknown) => ({ status: 'failed' as const, error })
  )
}

async function awaitEnvioSourceRevalidation(revalidation: Promise<TEnvioSourceRevalidationResult>): Promise<void> {
  const result = await revalidation
  if (result.status === 'failed') {
    throw result.error
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

function createFreshSyncResult(
  ledger: TWalletLedgerState,
  markerRead: TWalletLedgerCheckedMarkerReadResult,
  nowMs: number,
  startedAt: number
): TWalletLedgerCompletedSyncResult {
  const streams = getFreshStreamStats(ledger.streams)
  return {
    status: 'ready',
    outcome: 'fresh',
    syncType: 'fresh',
    ledger,
    effectiveCoverage: getEffectiveCoverage(ledger, markerRead, nowMs),
    coveredAtMs: getEffectiveCoveredAtMs(ledger, markerRead, nowMs),
    events: sumEventStats(streams),
    streams,
    envio: { pages: 0, rows: 0, requests: 0, strategy: 'none' },
    transition: {
      previousEventRevision: ledger.eventRevision,
      previousAppliedInvalidationSequence: ledger.appliedInvalidationSequence,
      dirtyFromTimestamp: null
    },
    durationMs: getDurationMs(startedAt)
  }
}

function getSyncOutcome(args: {
  readonly syncType: TWalletLedgerSyncType
  readonly current: TWalletLedgerState | null
  readonly streamsChanged: boolean
}): 'unchanged' | 'updated' {
  return (args.syncType === 'warm' || args.syncType === 'reconcile') && args.current && !args.streamsChanged
    ? 'unchanged'
    : 'updated'
}

interface TPerformedWalletLedgerSync {
  readonly sync: TWalletLedgerCompletedSyncResult
  readonly lockReleasedAtomically: boolean
}

async function performWalletLedgerSync(args: {
  readonly address: string
  readonly forceRebuild: boolean
  readonly nowMs: number
  readonly redis: TWalletLedgerRedis
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly currentRead: TWalletLedgerReadResult
  readonly currentMarkerRead: TWalletLedgerCheckedMarkerReadResult
  readonly startedAt: number
  readonly getCompletionNowMs: () => number
  readonly releaseLockOnCommit: boolean
  readonly prefetchVaultMetadata: boolean
  readonly onVaultsDiscovered: TWalletLedgerSyncArguments['onVaultsDiscovered']
}): Promise<TPerformedWalletLedgerSync> {
  if (args.currentRead.status === 'corrupt' && !args.forceRebuild) {
    throw new WalletLedgerError('decode_failed', 500)
  }
  const current = args.currentRead.status === 'ready' ? args.currentRead.ledger : null
  const getInvalidationDurationMs = startHoldingsDebugTimer()
  const invalidations = await readPendingWalletLedgerInvalidations({
    redis: args.redis,
    appliedSequence: current?.appliedInvalidationSequence ?? 0
  })
  debugLog('wallet-ledger-sync', 'read pending wallet ledger invalidations', {
    durationMs: getInvalidationDurationMs(),
    status: invalidations.status,
    appliedSequence: current?.appliedInvalidationSequence ?? 0,
    headSequence: invalidations.headSequence,
    pending: invalidations.status === 'ready' ? invalidations.records.length : null
  })
  if (
    current &&
    invalidations.status === 'ready' &&
    invalidations.records.length === 0 &&
    isFreshCompatibleLedger(current, args.currentMarkerRead, args.nowMs, args.forceRebuild, invalidations.headSequence)
  ) {
    startLedgerVaultMetadataPrefetch(current.streams, args.prefetchVaultMetadata)
    notifyVaultsDiscovered(current.streams, args.onVaultsDiscovered)
    debugLog('wallet-ledger-sync', 'used fresh wallet ledger after lock acquisition', {
      records: getRecordCount(current.streams),
      encodedBytes: current.encodedBytes
    })
    return {
      sync: createFreshSyncResult(current, args.currentMarkerRead, args.nowMs, args.startedAt),
      lockReleasedAtomically: false
    }
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
    forceRebuild: args.forceRebuild || invalidations.status === 'gap',
    nowMs: args.nowMs,
    effectiveReconciledAtMs: current ? getEffectiveReconciledAtMs(current, args.currentMarkerRead, args.nowMs) : null
  })
  const effectiveCoverage = current ? getEffectiveCoverage(current, args.currentMarkerRead, args.nowMs) : []
  const lowerBlockByChain = getLowerBlocks({ metadata, current, effectiveCoverage, syncType })
  const strategy = syncType === 'warm' ? 'warm-batched' : 'cold-batched'
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
    presenceChainProbes: fetched.stats.validationQueries,
    presenceHttpRequests: fetched.stats.presenceRequests,
    presenceRequests: fetched.stats.presenceRequests,
    batchedRequests: fetched.stats.batchedRequests,
    continuationRequests: fetched.stats.continuationRequests,
    blockPartitionCount: fetched.stats.blockPartitionCount ?? 0,
    blockPartitionRequests: fetched.stats.blockPartitionRequests ?? 0
  })
  const invalidationWindows = invalidations.status === 'ready' ? getInvalidationWindows(invalidations, metadata) : []
  const targetedInvalidationWindows = syncType === 'warm' ? invalidationWindows : []
  const getInvalidationSourceDurationMs = startHoldingsDebugTimer()
  const invalidationFetched =
    targetedInvalidationWindows.length > 0
      ? await fetchEnvioLedgerVaultStreams({
          address: args.address,
          windows: targetedInvalidationWindows,
          onPage: heartbeat
        }).catch((error) => {
          if (error instanceof WalletLedgerError) {
            throw error
          }
          throw new WalletLedgerError('upstream_failed', 502)
        })
      : null
  debugLog('wallet-ledger-sync', 'fetched targeted invalidated vault events', {
    durationMs: getInvalidationSourceDurationMs(),
    chains: targetedInvalidationWindows.length,
    vaults: targetedInvalidationWindows.reduce((total, window) => total + (window.vaultAddresses?.length ?? 0), 0),
    requests: invalidationFetched?.stats.totalRequests ?? 0,
    rows: invalidationFetched?.stats.totalRows ?? 0
  })
  const sourceRevalidation = startEnvioSourceRevalidation({
    metadata,
    redis: args.redis,
    walletHash: args.walletHash,
    lock: args.lock
  })

  const getMergeDurationMs = startHoldingsDebugTimer()
  const cachedStreams =
    (syncType === 'warm' || syncType === 'reconcile') && current ? current.streams : emptyLedgerStreams()
  const primaryMerge = mergeLedgerStreams({
    cached: cachedStreams,
    fetched: fetched.streams,
    windows: getAuthoritativeWindows(fetched.windows)
  })
  const invalidationDirtyFromTimestamp = minTimestamp(
    getScopedEarliestTimestamp(primaryMerge.streams, invalidationWindows),
    invalidationFetched ? getScopedEarliestTimestamp(invalidationFetched.streams, invalidationWindows) : null
  )
  const repairMerge = invalidationFetched
    ? mergeLedgerStreams({
        cached: primaryMerge.streams,
        fetched: invalidationFetched.streams,
        windows: getVaultAuthoritativeWindows(targetedInvalidationWindows)
      })
    : null
  const merge = combineMerges(cachedStreams, primaryMerge, repairMerge)
  startLedgerVaultMetadataPrefetch(merge.streams, args.prefetchVaultMetadata)
  notifyVaultsDiscovered(merge.streams, args.onVaultsDiscovered)
  const getDependencyInvalidationDurationMs = startHoldingsDebugTimer()
  const nestedDependencyDirty =
    (syncType === 'warm' || syncType === 'reconcile') && invalidations.status === 'ready'
      ? await getNestedDependencyDirtyTimestamp({ streams: merge.streams, invalidations, heartbeat })
      : { timestamp: null, status: 'unaffected' as const }
  debugLog('wallet-ledger-sync', 'resolved nested vault invalidation dependencies', {
    durationMs: getDependencyInvalidationDurationMs(),
    status: nestedDependencyDirty.status,
    dirtyFromTimestamp: nestedDependencyDirty.timestamp
  })
  const dirtyFromTimestamp = minTimestamp(
    primaryMerge.earliestChangedTimestamp,
    repairMerge?.earliestChangedTimestamp ?? null,
    invalidationDirtyFromTimestamp,
    nestedDependencyDirty.timestamp
  )
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
  const sourceGeneration = current
    ? current.sourceGeneration + (syncType === 'source-reset' || syncType === 'forced-reset' ? 1 : 0)
    : 1
  const canCommitCheckedMarkerOnly =
    syncType === 'warm' &&
    current !== null &&
    current.calculationVersion === LEDGER_CALCULATION_VERSION &&
    current.sourceFingerprint === sourceFingerprint &&
    current.sourceGeneration === sourceGeneration &&
    current.appliedInvalidationSequence === invalidations.headSequence &&
    invalidations.status === 'ready' &&
    invalidations.records.length === 0 &&
    !streamsChanged &&
    dirtyFromTimestamp === null
  if (canCommitCheckedMarkerOnly) {
    await awaitEnvioSourceRevalidation(sourceRevalidation)
    await assertLockRenewed(args.redis, args.walletHash, args.lock)
    const getMarkerCommitDurationMs = startHoldingsDebugTimer()
    const markerCommit = await commitWalletLedgerCheckedMarker({
      redis: args.redis,
      walletHash: args.walletHash,
      lock: args.lock,
      ledger: current,
      checkedAtMs: args.getCompletionNowMs(),
      effectiveReconciledAtMs: getEffectiveReconciledAtMs(current, args.currentMarkerRead, args.nowMs),
      coveredAtMs: args.nowMs,
      coverage,
      releaseLockOnSuccess: args.releaseLockOnCommit
    })
    debugLog('wallet-ledger-sync', 'committed unchanged wallet ledger checked marker', {
      durationMs: getMarkerCommitDurationMs(),
      status: markerCommit.status,
      lockRelease: args.releaseLockOnCommit && markerCommit.status === 'ok' ? 'atomic' : 'deferred',
      records: getRecordCount(current.streams),
      encodedBytesAvoided: current.encodedBytes
    })
    if (markerCommit.status !== 'ok') {
      throw new WalletLedgerError('stale_lock', 409)
    }
    return {
      sync: {
        status: 'ready',
        outcome: 'unchanged',
        syncType,
        ledger: current,
        effectiveCoverage: coverage,
        coveredAtMs: args.nowMs,
        events: sumEventStats(merge.stats),
        streams: merge.stats,
        envio: {
          ...getEnvioStats(fetched.stats),
          pages: fetched.stats.totalPages + (invalidationFetched?.stats.totalPages ?? 0),
          rows: fetched.stats.totalRows + (invalidationFetched?.stats.totalRows ?? 0),
          requests: fetched.stats.totalRequests + (invalidationFetched?.stats.totalRequests ?? 0)
        },
        transition: {
          previousEventRevision: current.eventRevision,
          previousAppliedInvalidationSequence: current.appliedInvalidationSequence,
          dirtyFromTimestamp: null
        },
        durationMs: getDurationMs(args.startedAt)
      },
      lockReleasedAtomically: args.releaseLockOnCommit
    }
  }
  const getEncodeDurationMs = startHoldingsDebugTimer()
  const encoded = encodeWalletLedgerPayload({
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: LEDGER_CALCULATION_VERSION,
    walletHash: args.walletHash,
    sourceFingerprint,
    sourceGeneration,
    appliedInvalidationSequence: invalidations.headSequence,
    coverage,
    streams: merge.streams,
    createdAtMs: current?.createdAtMs ?? args.nowMs,
    updatedAtMs: args.nowMs,
    reconciledAtMs: syncType === 'warm' && current ? current.reconciledAtMs : args.nowMs
  })
  debugLog('wallet-ledger-sync', 'encoded complete wallet ledger value', {
    durationMs: getEncodeDurationMs(),
    records: getRecordCount(encoded.ledger.streams),
    encodedBytes: encoded.ledger.encodedBytes,
    decodedBytes: encoded.ledger.decodedBytes
  })
  await awaitEnvioSourceRevalidation(sourceRevalidation)
  const resetDailyUsdCaches = syncType === 'bootstrap' || syncType === 'forced-reset' || syncType === 'source-reset'
  const dailyUsdCacheTransitions = createWalletLedgerDailyUsdCacheCommitTransitions({
    previous: current,
    current: encoded.ledger,
    dirtyFromDate: dirtyFromTimestamp === null ? null : timestampToDateString(dirtyFromTimestamp),
    reset: resetDailyUsdCaches
  })
  await assertLockRenewed(args.redis, args.walletHash, args.lock)
  const getCommitDurationMs = startHoldingsDebugTimer()
  const checkedAtMs = args.getCompletionNowMs()
  const commit = await commitStoredWalletLedger({
    redis: args.redis,
    walletHash: args.walletHash,
    lock: args.lock,
    value: encoded.value,
    cacheTransitions: dailyUsdCacheTransitions,
    checkedAtMs,
    effectiveReconciledAtMs:
      syncType === 'warm' && current
        ? getEffectiveReconciledAtMs(current, args.currentMarkerRead, args.nowMs)
        : checkedAtMs,
    releaseLockOnSuccess: args.releaseLockOnCommit,
    ...(getRecordCount(encoded.ledger.streams) === 0 ? { ttlMs: WALLET_LEDGER_EMPTY_TTL_MS } : {})
  })
  debugLog('wallet-ledger-sync', 'committed complete wallet ledger value', {
    durationMs: getCommitDurationMs(),
    status: commit.status,
    lockRelease: args.releaseLockOnCommit && commit.status === 'ok' ? 'atomic' : 'deferred',
    appliedInvalidationSequence: invalidations.headSequence,
    dirtyFromTimestamp,
    dailyUsdCaches: dailyUsdCacheTransitions.length
  })
  if (commit.status !== 'ok') {
    throw new WalletLedgerError('stale_lock', 409)
  }
  return {
    sync: {
      status: 'ready',
      outcome: getSyncOutcome({ syncType, current, streamsChanged }),
      syncType,
      ledger: encoded.ledger,
      effectiveCoverage: encoded.ledger.coverage,
      coveredAtMs: encoded.ledger.updatedAtMs,
      events: sumEventStats(merge.stats),
      streams: merge.stats,
      envio: {
        ...getEnvioStats(fetched.stats),
        pages: fetched.stats.totalPages + (invalidationFetched?.stats.totalPages ?? 0),
        rows: fetched.stats.totalRows + (invalidationFetched?.stats.totalRows ?? 0),
        requests: fetched.stats.totalRequests + (invalidationFetched?.stats.totalRequests ?? 0)
      },
      transition: {
        previousEventRevision: current?.eventRevision ?? null,
        previousAppliedInvalidationSequence: current?.appliedInvalidationSequence ?? null,
        dirtyFromTimestamp
      },
      durationMs: getDurationMs(args.startedAt)
    },
    lockReleasedAtomically: args.releaseLockOnCommit
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

export async function readVerifiedWalletLedgerHeaderForAddress(args: {
  readonly address: string
}): Promise<TWalletLedgerVerifiedHeaderReadResult> {
  try {
    return await readVerifiedWalletLedgerHeader({
      redis: getRedisClient(),
      walletHash: hashLedgerWalletAddress(args.address)
    })
  } catch (error) {
    throw normalizeWalletLedgerError(error)
  }
}

async function runWithSynchronizedWalletLedger<TConsumed>(
  args: TWalletLedgerSyncArguments,
  consume: (context: TSynchronizedWalletLedgerContext) => Promise<TConsumed>,
  releaseLockOnCommit: boolean
): Promise<TWithSynchronizedWalletLedgerResult<TConsumed>> {
  const startedAt = performance.now()
  const nowMs = getNowMs(args.nowMs)
  const getCompletionNowMs = () => getNowMs(args.nowMs)
  const forceRebuild = args.forceRebuild ?? false
  const walletHash = hashLedgerWalletAddress(args.address)
  const redis = getRedisClient()
  const getInitialReadDurationMs = startHoldingsDebugTimer()
  const [preliminary, preliminaryMarker, invalidationHead] = await Promise.all([
    readStoredWalletLedger({ redis, walletHash }),
    readWalletLedgerCheckedMarker({ redis, walletHash }),
    readWalletLedgerInvalidationHead({ redis })
  ]).catch((error) => {
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
  debugLog('wallet-ledger-sync', 'read wallet ledger invalidation head', {
    durationMs: getInitialReadDurationMs(),
    appliedSequence: preliminary.status === 'ready' ? preliminary.ledger.appliedInvalidationSequence : undefined,
    headSequence: invalidationHead
  })
  debugLog('wallet-ledger-sync', 'read wallet ledger checked marker', {
    durationMs: getInitialReadDurationMs(),
    status: preliminaryMarker.status,
    usable:
      preliminary.status === 'ready'
        ? getMatchingCheckedMarker(preliminary.ledger, preliminaryMarker, nowMs) !== null
        : false,
    revisionMatches:
      preliminary.status === 'ready' && preliminaryMarker.status === 'ready'
        ? preliminaryMarker.marker.revision === preliminary.ledger.revision
        : undefined
  })
  if (
    preliminary.status === 'ready' &&
    isFreshCompatibleLedger(preliminary.ledger, preliminaryMarker, nowMs, forceRebuild, invalidationHead)
  ) {
    startLedgerVaultMetadataPrefetch(preliminary.ledger.streams, args.prefetchVaultMetadata ?? false)
    notifyVaultsDiscovered(preliminary.ledger.streams, args.onVaultsDiscovered)
    const sync = createFreshSyncResult(preliminary.ledger, preliminaryMarker, nowMs, startedAt)
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

  const atomicReleaseState = { completed: false }
  try {
    const performed = await (async () => {
      try {
        const getLockedReadDurationMs = startHoldingsDebugTimer()
        const lockedSnapshot = await (async (): Promise<{
          readonly currentRead: TWalletLedgerReadResult
          readonly currentMarkerRead: TWalletLedgerCheckedMarkerReadResult
          readonly source: 'verified_preliminary' | 'reread'
        }> => {
          if (preliminary.status !== 'corrupt') {
            const verification = await verifyWalletLedgerSnapshotUnderLock({
              redis,
              walletHash,
              lock: acquired.lock,
              expectedRevision: preliminary.status === 'ready' ? preliminary.ledger.revision : null,
              expectedEncodedBytes: preliminary.status === 'ready' ? preliminary.ledger.encodedBytes : null
            })
            if (verification.status === 'lock_lost') {
              throw new WalletLedgerError('stale_lock', 409)
            }
            if (verification.status === 'unchanged') {
              return {
                currentRead: preliminary,
                currentMarkerRead: verification.marker,
                source: 'verified_preliminary'
              }
            }
          }
          const [currentRead, currentMarkerRead] = await Promise.all([
            readStoredWalletLedger({ redis, walletHash }),
            readWalletLedgerCheckedMarker({ redis, walletHash })
          ])
          return { currentRead, currentMarkerRead, source: 'reread' }
        })()
        const { currentRead, currentMarkerRead } = lockedSnapshot
        debugLog('wallet-ledger-sync', 'verified wallet ledger while holding its lock', {
          durationMs: getLockedReadDurationMs(),
          source: lockedSnapshot.source,
          status: currentRead.status,
          checkedMarkerStatus: currentMarkerRead.status,
          checkedMarkerUsable:
            currentRead.status === 'ready'
              ? getMatchingCheckedMarker(currentRead.ledger, currentMarkerRead, nowMs) !== null
              : false,
          checkedMarkerRevisionMatches:
            currentRead.status === 'ready' && currentMarkerRead.status === 'ready'
              ? currentMarkerRead.marker.revision === currentRead.ledger.revision
              : undefined
        })
        return await performWalletLedgerSync({
          address: args.address,
          forceRebuild,
          nowMs,
          redis,
          walletHash,
          lock: acquired.lock,
          currentRead,
          currentMarkerRead,
          startedAt,
          getCompletionNowMs,
          releaseLockOnCommit,
          prefetchVaultMetadata: args.prefetchVaultMetadata ?? false,
          onVaultsDiscovered: args.onVaultsDiscovered
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
    if (performed.lockReleasedAtomically) {
      atomicReleaseState.completed = true
    }
    const sync = performed.sync
    const consumed = await consume({ ledger: sync.ledger, sync })
    debugLog('wallet-ledger-sync', 'completed wallet ledger synchronization', {
      durationMs: sync.durationMs,
      outcome: sync.outcome,
      syncType: sync.syncType,
      records: sync.events.total
    })
    return { kind: 'completed', sync, consumed }
  } finally {
    if (atomicReleaseState.completed) {
      debugLog('wallet-ledger-sync', 'released wallet ledger lock', {
        durationMs: 0,
        status: 'released_atomically'
      })
    } else {
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
}

export function withSynchronizedWalletLedger<TConsumed>(
  args: TWalletLedgerSyncArguments,
  consume: (context: TSynchronizedWalletLedgerContext) => Promise<TConsumed>
): Promise<TWithSynchronizedWalletLedgerResult<TConsumed>> {
  return runWithSynchronizedWalletLedger(args, consume, false)
}

export async function synchronizeWalletLedger(args: TWalletLedgerSyncArguments): Promise<TWalletLedgerSyncResult> {
  const result = await runWithSynchronizedWalletLedger(args, async () => undefined, true)
  return result.sync
}

export function getWalletLedgerRecordCount(ledger: TWalletLedgerState): number {
  return getRecordCount(ledger.streams)
}
