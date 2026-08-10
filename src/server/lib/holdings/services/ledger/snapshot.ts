import { randomBytes } from 'node:crypto'
import { debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import {
  getVerifiedLedgerRevisionValues,
  isLedgerSnapshotId,
  stringifyCanonicalLedgerValue,
  type TLedgerVerifiedRevisionV1,
  validateLedgerSnapshotPin
} from '@/server/lib/holdings/services/ledger/codec'
import {
  readVerifiedLedgerRevision,
  readVerifiedLedgerRevisionForHead
} from '@/server/lib/holdings/services/ledger/revision'
import {
  readLedgerSnapshotPin,
  type TLedgerPipelineRedis,
  writeLedgerSnapshotPin
} from '@/server/lib/holdings/services/ledger/store'
import {
  LEDGER_SNAPSHOT_TTL_SECONDS,
  type TLedgerHeadV1,
  type TLedgerRevisionManifestV1,
  type TLedgerSnapshotPinV1
} from '@/server/lib/holdings/services/ledger/types'

const SECONDS_PER_DAY = 24 * 60 * 60

export type TLedgerSnapshotIncompatibilityReason = 'calculation_version' | 'chain_scope'

export interface TLedgerVerifiedSnapshotV1 {
  readonly pin: TLedgerSnapshotPinV1
  readonly headSource: 'active' | 'previous'
  readonly head: TLedgerHeadV1
  readonly manifest: TLedgerRevisionManifestV1
  readonly verified: TLedgerVerifiedRevisionV1
}

export type TCreateVerifiedLedgerSnapshotResult =
  | ({ readonly status: 'ready' } & TLedgerVerifiedSnapshotV1)
  | { readonly status: 'empty' }
  | { readonly status: 'corrupt' }
  | { readonly status: 'conflict' }
  | { readonly status: 'incompatible'; readonly reason: TLedgerSnapshotIncompatibilityReason }

export type TLoadVerifiedLedgerSnapshotResult =
  | ({ readonly status: 'ready' } & TLedgerVerifiedSnapshotV1)
  | { readonly status: 'missing' }
  | { readonly status: 'expired' }
  | { readonly status: 'corrupt' }
  | { readonly status: 'incompatible'; readonly reason: TLedgerSnapshotIncompatibilityReason }

type TLedgerSnapshotCompatibility = Readonly<{
  expectedCalculationVersion: string
  expectedChainIds: readonly number[]
}>

function getNowMs(value: number | undefined): number {
  const nowMs = value ?? Date.now()
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('Ledger snapshot current timestamp must be a non-negative safe integer')
  }
  return nowMs
}

function normalizeCompatibility(args: TLedgerSnapshotCompatibility): TLedgerSnapshotCompatibility {
  if (!args.expectedCalculationVersion || args.expectedCalculationVersion.trim() !== args.expectedCalculationVersion) {
    throw new Error('Ledger snapshot expected calculation version must be a non-empty normalized string')
  }
  if (
    args.expectedChainIds.length === 0 ||
    args.expectedChainIds.some((chainId) => !Number.isSafeInteger(chainId) || chainId <= 0) ||
    new Set(args.expectedChainIds).size !== args.expectedChainIds.length
  ) {
    throw new Error('Ledger snapshot expected chain scope must contain unique positive safe integers')
  }
  return {
    expectedCalculationVersion: args.expectedCalculationVersion,
    expectedChainIds: [...args.expectedChainIds].toSorted((left, right) => left - right)
  }
}

function getIncompatibilityReason(
  manifest: TLedgerRevisionManifestV1,
  compatibility: TLedgerSnapshotCompatibility
): TLedgerSnapshotIncompatibilityReason | null {
  if (manifest.calculationVersion !== compatibility.expectedCalculationVersion) {
    return 'calculation_version'
  }
  return stringifyCanonicalLedgerValue(manifest.chainScope) ===
    stringifyCanonicalLedgerValue(compatibility.expectedChainIds)
    ? null
    : 'chain_scope'
}

function createReadySnapshot(args: {
  pin: TLedgerSnapshotPinV1
  head: TLedgerHeadV1
  manifest: TLedgerRevisionManifestV1
  verified: TLedgerVerifiedRevisionV1
}): { readonly status: 'ready' } & TLedgerVerifiedSnapshotV1 {
  return {
    status: 'ready',
    pin: args.pin,
    headSource: args.pin.headSource,
    head: args.head,
    manifest: args.manifest,
    verified: args.verified
  }
}

function getRevisionBoundCutoffs(args: {
  readonly head: TLedgerHeadV1
  readonly latestSettledDayTimestamp: number
  readonly eventUpperTimestamp: number
}): { readonly latestSettledDayTimestamp: number; readonly eventUpperTimestamp: number } {
  const revisionUpperTimestamp = Math.floor(args.head.updatedAtMs / 1000)
  const eventUpperTimestamp = Math.min(args.eventUpperTimestamp, revisionUpperTimestamp)
  const revisionLatestSettledDayTimestamp = Math.max(
    Math.floor(eventUpperTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY - SECONDS_PER_DAY,
    0
  )
  return {
    latestSettledDayTimestamp: Math.min(args.latestSettledDayTimestamp, revisionLatestSettledDayTimestamp),
    eventUpperTimestamp
  }
}

export function createLedgerSnapshotId(): string {
  const snapshotId = `snapshot_${randomBytes(16).toString('hex')}`
  if (!isLedgerSnapshotId(snapshotId)) {
    throw new Error('Generated ledger snapshot id is invalid')
  }
  return snapshotId
}

interface TLedgerSnapshotCreationArguments {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
  readonly expectedCalculationVersion: string
  readonly expectedChainIds: readonly number[]
  readonly latestSettledDayTimestamp: number
  readonly eventUpperTimestamp: number
  readonly nowMs?: number
}

async function pinVerifiedLedgerSnapshot(
  args: TLedgerSnapshotCreationArguments & {
    readonly compatibility: TLedgerSnapshotCompatibility
    readonly nowMsValue: number
    readonly verifiedRevision: TLedgerVerifiedRevisionV1
    readonly headSource: 'active' | 'previous'
    readonly getTotalDurationMs: () => number
  }
): Promise<TCreateVerifiedLedgerSnapshotResult> {
  const verified = (() => {
    try {
      return getVerifiedLedgerRevisionValues(args.verifiedRevision)
    } catch {
      return null
    }
  })()
  if (verified === null || verified.head.walletHash !== args.walletHash) {
    debugLog('ledger-snapshot', 'snapshot creation completed', {
      durationMs: args.getTotalDurationMs(),
      status: 'corrupt'
    })
    return { status: 'corrupt' }
  }
  const incompatibilityReason = getIncompatibilityReason(verified.manifest, args.compatibility)
  if (incompatibilityReason) {
    debugLog('ledger-snapshot', 'snapshot creation completed', {
      durationMs: args.getTotalDurationMs(),
      status: 'incompatible',
      reason: incompatibilityReason
    })
    return { status: 'incompatible', reason: incompatibilityReason }
  }
  const cutoffs = getRevisionBoundCutoffs({
    head: verified.head,
    latestSettledDayTimestamp: args.latestSettledDayTimestamp,
    eventUpperTimestamp: args.eventUpperTimestamp
  })
  const pin: TLedgerSnapshotPinV1 = {
    snapshotVersion: 1,
    snapshotId: createLedgerSnapshotId(),
    headSource: args.headSource,
    head: verified.head,
    latestSettledDayTimestamp: cutoffs.latestSettledDayTimestamp,
    eventUpperTimestamp: cutoffs.eventUpperTimestamp,
    createdAtMs: args.nowMsValue,
    expiresAtMs: args.nowMsValue + LEDGER_SNAPSHOT_TTL_SECONDS * 1000
  }
  validateLedgerSnapshotPin(pin)
  const getPinWriteDurationMs = startHoldingsDebugTimer()
  const writeResult = await writeLedgerSnapshotPin({
    redis: args.redis,
    walletHash: args.walletHash,
    pin
  })
  debugLog('ledger-snapshot', 'wrote snapshot pointer', {
    durationMs: getPinWriteDurationMs(),
    status: writeResult.status,
    headSource: args.headSource
  })
  if (writeResult.status === 'exists') {
    debugLog('ledger-snapshot', 'snapshot creation completed', {
      durationMs: args.getTotalDurationMs(),
      status: 'conflict'
    })
    return { status: 'conflict' }
  }
  if (writeResult.status === 'corrupt') {
    debugLog('ledger-snapshot', 'snapshot creation completed', {
      durationMs: args.getTotalDurationMs(),
      status: 'corrupt'
    })
    return { status: 'corrupt' }
  }
  const getPinReadbackDurationMs = startHoldingsDebugTimer()
  const persisted = await readLedgerSnapshotPin({
    redis: args.redis,
    walletHash: args.walletHash,
    snapshotId: pin.snapshotId
  })
  debugLog('ledger-snapshot', 'verified snapshot pointer readback', {
    durationMs: getPinReadbackDurationMs(),
    status: persisted.status
  })
  if (
    persisted.status !== 'ok' ||
    stringifyCanonicalLedgerValue(persisted.pin) !== stringifyCanonicalLedgerValue(pin)
  ) {
    debugLog('ledger-snapshot', 'snapshot creation completed', {
      durationMs: args.getTotalDurationMs(),
      status: 'corrupt'
    })
    return { status: 'corrupt' }
  }
  debugLog('ledger-snapshot', 'snapshot creation completed', {
    durationMs: args.getTotalDurationMs(),
    status: 'ready',
    headSource: args.headSource,
    records: verified.manifest.recordCount,
    chunks: verified.manifest.chunks.length,
    indexShards: verified.manifest.indexes.length
  })
  return createReadySnapshot({
    pin: persisted.pin,
    head: verified.head,
    manifest: verified.manifest,
    verified: args.verifiedRevision
  })
}

/**
 * Pins a revision already verified against this Redis wallet while its synchronization lock is held.
 * Standalone callers must use createVerifiedLedgerSnapshot so storage is read and verified first.
 */
export function createVerifiedLedgerSnapshotFromSynchronizedRevision(
  args: TLedgerSnapshotCreationArguments & {
    readonly verifiedRevision: TLedgerVerifiedRevisionV1
    readonly headSource: 'active' | 'previous'
  }
): Promise<TCreateVerifiedLedgerSnapshotResult> {
  const getTotalDurationMs = startHoldingsDebugTimer()
  return pinVerifiedLedgerSnapshot({
    ...args,
    compatibility: normalizeCompatibility(args),
    nowMsValue: getNowMs(args.nowMs),
    getTotalDurationMs
  })
}

export async function createVerifiedLedgerSnapshot(
  args: TLedgerSnapshotCreationArguments & {
    readonly fallbackToPrevious?: boolean
  }
): Promise<TCreateVerifiedLedgerSnapshotResult> {
  const getTotalDurationMs = startHoldingsDebugTimer()
  const compatibility = normalizeCompatibility(args)
  const nowMs = getNowMs(args.nowMs)
  const getRevisionDurationMs = startHoldingsDebugTimer()
  const revision = await readVerifiedLedgerRevision({
    redis: args.redis,
    walletHash: args.walletHash,
    retryIncomplete: true,
    fallbackToPrevious: args.fallbackToPrevious ?? true
  })
  debugLog('ledger-snapshot', 'verified revision before snapshot pin', {
    durationMs: getRevisionDurationMs(),
    status: revision.status,
    headSource: revision.status === 'ready' ? revision.headSource : undefined
  })
  if (revision.status !== 'ready') {
    debugLog('ledger-snapshot', 'snapshot creation completed', {
      durationMs: getTotalDurationMs(),
      status: revision.status
    })
    return revision
  }
  return pinVerifiedLedgerSnapshot({
    ...args,
    compatibility,
    nowMsValue: nowMs,
    verifiedRevision: revision.verified,
    headSource: revision.headSource,
    getTotalDurationMs
  })
}

export async function loadVerifiedLedgerSnapshot(args: {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
  readonly snapshotId: string
  readonly expectedCalculationVersion: string
  readonly expectedChainIds: readonly number[]
  readonly nowMs?: number
}): Promise<TLoadVerifiedLedgerSnapshotResult> {
  const getTotalDurationMs = startHoldingsDebugTimer()
  const compatibility = normalizeCompatibility(args)
  const nowMs = getNowMs(args.nowMs)
  const getPinReadDurationMs = startHoldingsDebugTimer()
  const pinResult = await readLedgerSnapshotPin({
    redis: args.redis,
    walletHash: args.walletHash,
    snapshotId: args.snapshotId
  })
  debugLog('ledger-snapshot', 'read snapshot pointer', {
    durationMs: getPinReadDurationMs(),
    status: pinResult.status
  })
  if (pinResult.status !== 'ok') {
    debugLog('ledger-snapshot', 'snapshot load completed', {
      durationMs: getTotalDurationMs(),
      status: pinResult.status
    })
    return pinResult
  }
  if (pinResult.pin.expiresAtMs <= nowMs) {
    debugLog('ledger-snapshot', 'snapshot load completed', {
      durationMs: getTotalDurationMs(),
      status: 'expired'
    })
    return { status: 'expired' }
  }
  if (pinResult.pin.head.calculationVersion !== compatibility.expectedCalculationVersion) {
    debugLog('ledger-snapshot', 'snapshot load completed', {
      durationMs: getTotalDurationMs(),
      status: 'incompatible',
      reason: 'calculation_version'
    })
    return { status: 'incompatible', reason: 'calculation_version' }
  }
  const getRevisionDurationMs = startHoldingsDebugTimer()
  const revision = await readVerifiedLedgerRevisionForHead({
    redis: args.redis,
    walletHash: args.walletHash,
    head: pinResult.pin.head,
    headSource: pinResult.pin.headSource
  })
  debugLog('ledger-snapshot', 'verified pinned revision', {
    durationMs: getRevisionDurationMs(),
    status: revision.status,
    headSource: pinResult.pin.headSource
  })
  if (revision.status !== 'ready') {
    debugLog('ledger-snapshot', 'snapshot load completed', {
      durationMs: getTotalDurationMs(),
      status: 'corrupt'
    })
    return { status: 'corrupt' }
  }
  const incompatibilityReason = getIncompatibilityReason(revision.manifest, compatibility)
  if (incompatibilityReason) {
    debugLog('ledger-snapshot', 'snapshot load completed', {
      durationMs: getTotalDurationMs(),
      status: 'incompatible',
      reason: incompatibilityReason
    })
    return { status: 'incompatible', reason: incompatibilityReason }
  }
  debugLog('ledger-snapshot', 'snapshot load completed', {
    durationMs: getTotalDurationMs(),
    status: 'ready',
    headSource: pinResult.pin.headSource,
    records: revision.manifest.recordCount,
    chunks: revision.manifest.chunks.length,
    indexShards: revision.manifest.indexes.length
  })
  return createReadySnapshot({
    pin: pinResult.pin,
    head: revision.head,
    manifest: revision.manifest,
    verified: revision.verified
  })
}
