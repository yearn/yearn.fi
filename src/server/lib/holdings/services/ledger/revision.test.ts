import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLedgerRevisionManifest,
  encodeLedgerChunks,
  encodeLedgerIndexShards,
  getLedgerSha256,
  stringifyCanonicalLedgerValue,
  verifyLedgerRevision
} from '@/server/lib/holdings/services/ledger/codec'
import type { TEnvioLedgerMetadata } from '@/server/lib/holdings/services/ledger/envio'
import {
  getLedgerChunkKey,
  getLedgerHeadKey,
  getLedgerIndexShardKey,
  getLedgerPreviousHeadKey,
  getLedgerSyncStatusKey
} from '@/server/lib/holdings/services/ledger/keys'
import { readLedgerSyncStatus, readVerifiedLedgerRevision } from '@/server/lib/holdings/services/ledger/revision'
import { createLedgerCoverage } from '@/server/lib/holdings/services/ledger/state'
import type { TLedgerSixStreams, TLedgerSyncStatusV1 } from '@/server/lib/holdings/services/ledger/types'

const CORRUPT_VALUE = Symbol('corrupt-ledger-value')
const WALLET_HASH = getLedgerSha256('revision-reader-wallet')
const ADDRESS = '0x1111111111111111111111111111111111111111'
const TRANSACTION_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const storeState = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  transientCorruptKey: null as string | null
}))

const storeMocks = vi.hoisted(() => ({
  readValue: vi.fn(),
  readValues: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/ledger/store', () => ({
  readLedgerValue: storeMocks.readValue,
  readLedgerValues: storeMocks.readValues
}))

const metadata: TEnvioLedgerMetadata = {
  chainId: 1,
  progressBlock: 1_000,
  eventsProcessed: 1,
  bufferBlock: 1_001,
  firstEventBlock: 900,
  sourceBlock: 1_002,
  readyAt: null,
  isReady: false,
  startBlock: 1,
  endBlock: null
}

function createStreams(): TLedgerSixStreams {
  return {
    v3Deposits: [
      {
        id: 'deposit-1',
        vaultAddress: ADDRESS,
        chainId: 1,
        blockNumber: 900,
        blockTimestamp: 1_700_000_000,
        logIndex: 1,
        transactionHash: TRANSACTION_HASH,
        transactionFrom: ADDRESS,
        owner: ADDRESS,
        sender: ADDRESS,
        assets: '100',
        shares: '90'
      }
    ],
    v3Withdrawals: [],
    v2Deposits: [],
    v2Withdrawals: [],
    transfersIn: [],
    transfersOut: []
  }
}

function createFixture(revision: string) {
  const streams = createStreams()
  const chunks = encodeLedgerChunks(streams)
  const indexes = encodeLedgerIndexShards(chunks)
  const manifest = createLedgerRevisionManifest({
    calculationVersion: 'revision-reader-v1',
    walletHash: WALLET_HASH,
    sourceFingerprint: getLedgerSha256('revision-reader-source'),
    sourceGeneration: 1,
    revision,
    parentRevision: null,
    chainScope: [1],
    coverage: createLedgerCoverage(streams, [metadata]),
    chunks,
    indexes,
    dependencies: [],
    invalidationEpochs: { global: 0, source: 0, address: 0, vault: 0, schema: 0, metadata: 0 },
    dirtyFromTimestamp: null,
    dirtyFromDate: null,
    dirtyReasons: [],
    createdAtMs: 1_000,
    updatedAtMs: 1_000,
    reconciledAtMs: 1_000
  })
  const storedChunks = chunks.map((chunk) => ({
    ...chunk,
    key: getLedgerChunkKey(WALLET_HASH, chunk.descriptor.checksum)
  }))
  const storedIndexes = indexes.map((index) => ({
    ...index,
    key: getLedgerIndexShardKey(WALLET_HASH, index.descriptor.shard, index.descriptor.checksum)
  }))
  return {
    verified: verifyLedgerRevision(manifest, storedChunks, storedIndexes),
    chunks: storedChunks,
    indexes: storedIndexes
  }
}

function installFixture(fixture: ReturnType<typeof createFixture>, headKey = getLedgerHeadKey(WALLET_HASH)): void {
  storeState.values.set(headKey, fixture.verified.headValue)
  storeState.values.set(fixture.verified.head.manifestKey, fixture.verified.manifestValue)
  fixture.chunks.forEach((chunk) => {
    storeState.values.set(chunk.key, chunk.data)
  })
  fixture.indexes.forEach((index) => {
    storeState.values.set(index.key, index.data)
  })
}

function installStoreMocks(): void {
  storeMocks.readValue.mockImplementation(
    ({ key, parse }: { readonly key: string; readonly parse?: (value: string) => unknown }) => {
      const stored = storeState.values.get(key)
      if (storeState.transientCorruptKey === key) {
        storeState.transientCorruptKey = null
        return Promise.resolve({ status: 'corrupt', reason: 'parse' })
      }
      if (stored === undefined) {
        return Promise.resolve({ status: 'missing' })
      }
      if (stored === CORRUPT_VALUE || typeof stored !== 'string') {
        return Promise.resolve({ status: 'corrupt', reason: 'parse' })
      }
      try {
        return Promise.resolve({ status: 'ok', value: parse ? parse(stored) : stored })
      } catch {
        return Promise.resolve({ status: 'corrupt', reason: 'parse' })
      }
    }
  )
  storeMocks.readValues.mockImplementation(({ keys }: { readonly keys: readonly string[] }) =>
    Promise.resolve(
      keys.map((key) => {
        const stored = storeState.values.get(key)
        return typeof stored === 'string'
          ? { status: 'ok', value: stored }
          : stored === undefined
            ? { status: 'missing' }
            : { status: 'corrupt', reason: 'parse' }
      })
    )
  )
}

describe('verified ledger revision reader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.values.clear()
    storeState.transientCorruptKey = null
    installStoreMocks()
  })

  it('returns empty when no active head exists', async () => {
    await expect(readVerifiedLedgerRevision({ redis: {} as never, walletHash: WALLET_HASH })).resolves.toEqual({
      status: 'empty'
    })
  })

  it('reads and fully verifies the active manifest, chunks, and indexes', async () => {
    const fixture = createFixture('active-revision')
    installFixture(fixture)

    const result = await readVerifiedLedgerRevision({ redis: {} as never, walletHash: WALLET_HASH })

    expect(result).toMatchObject({
      status: 'ready',
      headSource: 'active',
      manifest: { revision: 'active-revision', recordCount: 1 }
    })
    expect(result.status === 'ready' && result.verified.streams).toEqual(createStreams())
  })

  it('retries a temporarily inconsistent head before returning the verified active revision', async () => {
    const fixture = createFixture('retried-revision')
    installFixture(fixture)
    storeState.transientCorruptKey = getLedgerHeadKey(WALLET_HASH)

    const result = await readVerifiedLedgerRevision({
      redis: {} as never,
      walletHash: WALLET_HASH,
      retryIncomplete: true
    })

    expect(result).toMatchObject({ status: 'ready', headSource: 'active' })
    expect(storeMocks.readValue).toHaveBeenCalledTimes(3)
  })

  it('falls back only to a fully verified previous head when requested', async () => {
    const previous = createFixture('previous-revision')
    installFixture(previous, getLedgerPreviousHeadKey(WALLET_HASH))
    storeState.values.set(getLedgerHeadKey(WALLET_HASH), CORRUPT_VALUE)

    const result = await readVerifiedLedgerRevision({
      redis: {} as never,
      walletHash: WALLET_HASH,
      retryIncomplete: false,
      fallbackToPrevious: true
    })

    expect(result).toMatchObject({
      status: 'ready',
      headSource: 'previous',
      manifest: { revision: 'previous-revision' }
    })
  })

  it('rejects a missing or modified immutable blob as corrupt', async () => {
    const fixture = createFixture('corrupt-revision')
    installFixture(fixture)
    storeState.values.set(fixture.chunks[0]?.key as string, 'modified-chunk')

    await expect(
      readVerifiedLedgerRevision({ redis: {} as never, walletHash: WALLET_HASH, retryIncomplete: false })
    ).resolves.toEqual({ status: 'corrupt' })
  })

  it('validates sync status independently of revision data', async () => {
    const status: TLedgerSyncStatusV1 = {
      schemaVersion: 1,
      state: 'complete',
      sourceGeneration: 1,
      revision: 'active-revision',
      reasonCode: null,
      updatedAtMs: 2_000
    }
    storeState.values.set(getLedgerSyncStatusKey(WALLET_HASH), stringifyCanonicalLedgerValue(status))
    await expect(readLedgerSyncStatus({ redis: {} as never, walletHash: WALLET_HASH })).resolves.toEqual({
      status: 'ok',
      value: status
    })

    storeState.values.set(getLedgerSyncStatusKey(WALLET_HASH), '{}')
    await expect(readLedgerSyncStatus({ redis: {} as never, walletHash: WALLET_HASH })).resolves.toEqual({
      status: 'corrupt'
    })
  })
})
