import { debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import {
  parseLedgerHead,
  parseLedgerRevisionManifest,
  parseLedgerSyncStatus,
  type TLedgerVerifiedRevisionV1,
  validateLedgerHeadAgainstManifest,
  verifyLedgerRevision
} from '@/server/lib/holdings/services/ledger/codec'
import {
  getLedgerHeadKey,
  getLedgerPreviousHeadKey,
  getLedgerSyncStatusKey
} from '@/server/lib/holdings/services/ledger/keys'
import {
  readLedgerValue,
  readLedgerValues,
  type TLedgerPipelineRedis
} from '@/server/lib/holdings/services/ledger/store'
import type {
  TLedgerChunkRefV1,
  TLedgerHeadV1,
  TLedgerIndexShardRefV1,
  TLedgerRevisionManifestV1,
  TLedgerSyncStatusV1,
  TStoredLedgerChunkV1,
  TStoredLedgerIndexShardV1
} from '@/server/lib/holdings/services/ledger/types'

export type TLedgerRevisionReadResult =
  | { readonly status: 'empty' }
  | { readonly status: 'corrupt' }
  | {
      readonly status: 'ready'
      readonly headSource: 'active' | 'previous'
      readonly head: TLedgerHeadV1
      readonly manifest: TLedgerRevisionManifestV1
      readonly verified: TLedgerVerifiedRevisionV1
    }

export type TLedgerSyncStatusReadResult =
  | { readonly status: 'missing' }
  | { readonly status: 'corrupt' }
  | { readonly status: 'ok'; readonly value: TLedgerSyncStatusV1 }

function createStoredChunk(reference: TLedgerChunkRefV1, data: string): TStoredLedgerChunkV1 {
  const { key, ...descriptor } = reference
  return { key, descriptor, data }
}

function createStoredIndex(reference: TLedgerIndexShardRefV1, data: string): TStoredLedgerIndexShardV1 {
  const { key, ...descriptor } = reference
  return { key, descriptor, data }
}

function hasOnlyOkValues(
  values: Awaited<ReturnType<typeof readLedgerValues>>
): values is Array<{ readonly status: 'ok'; readonly value: string }> {
  return values.every((value) => value.status === 'ok')
}

export async function readVerifiedLedgerRevisionForHead(args: {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
  readonly head: TLedgerHeadV1
  readonly headSource: 'active' | 'previous'
}): Promise<TLedgerRevisionReadResult> {
  if (args.head.walletHash !== args.walletHash) {
    debugLog('ledger-revision', 'rejected revision with mismatched wallet scope', { headSource: args.headSource })
    return { status: 'corrupt' }
  }
  const getManifestDurationMs = startHoldingsDebugTimer()
  const manifestResult = await readLedgerValue({
    redis: args.redis,
    key: args.head.manifestKey,
    parse: parseLedgerRevisionManifest
  })
  debugLog('ledger-revision', 'read revision manifest', {
    durationMs: getManifestDurationMs(),
    headSource: args.headSource,
    status: manifestResult.status
  })
  if (manifestResult.status !== 'ok') {
    return { status: 'corrupt' }
  }
  const manifest = manifestResult.value
  try {
    validateLedgerHeadAgainstManifest(args.head, manifest)
  } catch {
    return { status: 'corrupt' }
  }

  const references = [...manifest.chunks, ...manifest.indexes]
  const getBlobReadDurationMs = startHoldingsDebugTimer()
  const blobResults = await readLedgerValues({ redis: args.redis, keys: references.map(({ key }) => key) })
  const blobsReady = hasOnlyOkValues(blobResults)
  debugLog('ledger-revision', 'read immutable revision blobs', {
    durationMs: getBlobReadDurationMs(),
    status: blobsReady ? 'ready' : 'corrupt',
    chunks: manifest.chunks.length,
    indexShards: manifest.indexes.length,
    encodedBytes: manifest.activeEncodedBytes
  })
  if (!blobsReady) {
    return { status: 'corrupt' }
  }
  const chunkValues = blobResults.slice(0, manifest.chunks.length)
  const indexValues = blobResults.slice(manifest.chunks.length)

  const getVerificationDurationMs = startHoldingsDebugTimer()
  try {
    const chunks = manifest.chunks.map((reference, index) =>
      createStoredChunk(reference, (chunkValues[index] as { readonly value: string }).value)
    )
    const indexes = manifest.indexes.map((reference, index) =>
      createStoredIndex(reference, (indexValues[index] as { readonly value: string }).value)
    )
    const verified = verifyLedgerRevision(manifest, chunks, indexes)
    debugLog('ledger-revision', 'decoded and verified complete revision', {
      durationMs: getVerificationDurationMs(),
      records: manifest.recordCount,
      chunks: manifest.chunks.length,
      indexShards: manifest.indexes.length
    })
    return {
      status: 'ready',
      headSource: args.headSource,
      head: args.head,
      manifest,
      verified
    }
  } catch {
    debugLog('ledger-revision', 'revision decode or verification failed', {
      durationMs: getVerificationDurationMs(),
      records: manifest.recordCount,
      chunks: manifest.chunks.length,
      indexShards: manifest.indexes.length
    })
    return { status: 'corrupt' }
  }
}

async function readLedgerRevisionOnce(args: {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
  readonly usePreviousHead: boolean
}): Promise<TLedgerRevisionReadResult> {
  const headKey = args.usePreviousHead ? getLedgerPreviousHeadKey(args.walletHash) : getLedgerHeadKey(args.walletHash)
  const getHeadReadDurationMs = startHoldingsDebugTimer()
  const headResult = await readLedgerValue({ redis: args.redis, key: headKey, parse: parseLedgerHead })
  debugLog('ledger-revision', 'read ledger head', {
    durationMs: getHeadReadDurationMs(),
    headSource: args.usePreviousHead ? 'previous' : 'active',
    status: headResult.status
  })
  if (headResult.status === 'missing') {
    return { status: 'empty' }
  }
  if (headResult.status === 'corrupt') {
    return { status: 'corrupt' }
  }
  return readVerifiedLedgerRevisionForHead({
    redis: args.redis,
    walletHash: args.walletHash,
    head: headResult.value,
    headSource: args.usePreviousHead ? 'previous' : 'active'
  })
}

async function readPreviousRevisionFallback(args: {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
  readonly original: TLedgerRevisionReadResult
}): Promise<TLedgerRevisionReadResult> {
  const previous = await readLedgerRevisionOnce({
    redis: args.redis,
    walletHash: args.walletHash,
    usePreviousHead: true
  })
  return previous.status === 'ready' ? previous : args.original
}

export async function readVerifiedLedgerRevision(args: {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
  readonly usePreviousHead?: boolean
  readonly retryIncomplete?: boolean
  readonly fallbackToPrevious?: boolean
}): Promise<TLedgerRevisionReadResult> {
  const usePreviousHead = args.usePreviousHead ?? false
  const first = await readLedgerRevisionOnce({
    redis: args.redis,
    walletHash: args.walletHash,
    usePreviousHead
  })
  if (first.status === 'ready' || usePreviousHead) {
    return first
  }
  if (first.status === 'empty') {
    return args.fallbackToPrevious
      ? readPreviousRevisionFallback({ redis: args.redis, walletHash: args.walletHash, original: first })
      : first
  }
  const retried = await (async () => {
    if (args.retryIncomplete === false) {
      return first
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
    return readLedgerRevisionOnce({ redis: args.redis, walletHash: args.walletHash, usePreviousHead: false })
  })()
  if (retried.status !== 'corrupt' || !args.fallbackToPrevious) {
    return retried
  }
  return readPreviousRevisionFallback({ redis: args.redis, walletHash: args.walletHash, original: retried })
}

export async function readLedgerSyncStatus(args: {
  readonly redis: TLedgerPipelineRedis
  readonly walletHash: string
}): Promise<TLedgerSyncStatusReadResult> {
  const result = await readLedgerValue({
    redis: args.redis,
    key: getLedgerSyncStatusKey(args.walletHash),
    parse: parseLedgerSyncStatus
  })
  return result.status === 'ok'
    ? { status: 'ok', value: result.value }
    : result.status === 'missing'
      ? { status: 'missing' }
      : { status: 'corrupt' }
}
