import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  canonicalizeLedgerStreams,
  createLedgerHead,
  createLedgerRevisionManifest,
  decodeCanonicalLedgerTuples,
  decodeLedgerChunk,
  decodeLedgerChunks,
  decodeLedgerIndexShard,
  decodeLedgerRevision,
  encodeLedgerChunks,
  encodeLedgerIndexShards,
  getCanonicalLedgerTupleIdentity,
  getLedgerIndexShard,
  getLedgerSha256,
  getVerifiedLedgerRevisionValues,
  parseLedgerHead,
  parseLedgerRevisionManifest,
  parseLedgerSyncStatus,
  stringifyCanonicalLedgerValue,
  validateLedgerHeadAgainstManifest,
  validateLedgerRevisionManifest,
  validateLedgerSyncStatus,
  verifyLedgerRevision,
  verifyLedgerRevisionWithReusedContent
} from '@/server/lib/holdings/services/ledger/codec'
import { getLedgerChunkKey, getLedgerIndexShardKey } from '@/server/lib/holdings/services/ledger/keys'
import { compareLedgerOrder } from '@/server/lib/holdings/services/ledger/order'
import {
  LEDGER_EVENT_FAMILY_CODES,
  LEDGER_INDEX_SHARD_COUNT,
  LEDGER_MAX_ACTIVE_REVISION_BYTES,
  LEDGER_MAX_CHUNK_RECORDS,
  LEDGER_MAX_DECODED_CHUNK_BYTES,
  LEDGER_MAX_ENCODED_CHUNK_BYTES,
  LEDGER_MAX_MANIFEST_BYTES,
  LEDGER_SCHEMA_VERSION,
  LEDGER_STREAMS,
  LEDGER_TRANSFER_DIRECTIONS,
  type TLedgerBaseSourceEvent,
  type TLedgerDependencyV1,
  type TLedgerRevisionManifestV1,
  type TLedgerSixStreams,
  type TLedgerSourceEvent,
  type TLedgerStream,
  type TLedgerStreamCoverageV1,
  type TLedgerSyncStatusV1,
  type TLedgerTransferSourceEvent,
  type TLedgerV2DepositSourceEvent,
  type TLedgerV2WithdrawalSourceEvent,
  type TLedgerV3DepositSourceEvent,
  type TLedgerV3WithdrawalSourceEvent,
  type TStoredLedgerChunkV1,
  type TStoredLedgerIndexShardV1
} from '@/server/lib/holdings/services/ledger/types'

const JANUARY_2024 = 1_704_067_200
const FEBRUARY_2024 = 1_706_745_600

function createAddress(seed: string): string {
  return `0x${getLedgerSha256(`address:${seed}`).slice(0, 40)}`
}

function createIndexedAddress(index: number): string {
  return `0x${(index + 1).toString(16).padStart(40, '0')}`
}

function createTransactionHash(seed: string): string {
  return `0x${getLedgerSha256(`transaction:${seed}`)}`
}

function createBaseEvent(id: string, overrides: Partial<TLedgerBaseSourceEvent> = {}): TLedgerBaseSourceEvent {
  return {
    id,
    vaultAddress: createAddress(`${id}:vault`),
    chainId: 1,
    blockNumber: 19_000_000,
    blockTimestamp: JANUARY_2024,
    logIndex: 1,
    transactionHash: createTransactionHash(id),
    transactionFrom: createAddress(`${id}:transaction-from`),
    nested: { decimal: '0001.2300', flags: [true, null, 'kept'] },
    ...overrides
  }
}

function createV3Deposit(
  id: string,
  overrides: Partial<TLedgerV3DepositSourceEvent> = {}
): TLedgerV3DepositSourceEvent {
  return {
    ...createBaseEvent(id),
    owner: createAddress(`${id}:owner`),
    sender: createAddress(`${id}:sender`),
    assets: '1000000000000000001',
    shares: '1000000000000000000',
    ...overrides
  }
}

function createV3Withdrawal(
  id: string,
  overrides: Partial<TLedgerV3WithdrawalSourceEvent> = {}
): TLedgerV3WithdrawalSourceEvent {
  return {
    ...createBaseEvent(id),
    owner: createAddress(`${id}:owner`),
    assets: '2000000000000000001',
    shares: '2000000000000000000',
    ...overrides
  }
}

function createV2Deposit(
  id: string,
  overrides: Partial<TLedgerV2DepositSourceEvent> = {}
): TLedgerV2DepositSourceEvent {
  return {
    ...createBaseEvent(id),
    recipient: createAddress(`${id}:recipient`),
    amount: '3000000000000000001',
    shares: '3000000000000000000',
    ...overrides
  }
}

function createV2Withdrawal(
  id: string,
  overrides: Partial<TLedgerV2WithdrawalSourceEvent> = {}
): TLedgerV2WithdrawalSourceEvent {
  return {
    ...createBaseEvent(id),
    recipient: createAddress(`${id}:recipient`),
    amount: '4000000000000000001',
    shares: '4000000000000000000',
    ...overrides
  }
}

function createTransfer(id: string, overrides: Partial<TLedgerTransferSourceEvent> = {}): TLedgerTransferSourceEvent {
  return {
    ...createBaseEvent(id),
    sender: createAddress(`${id}:sender`),
    receiver: createAddress(`${id}:receiver`),
    value: '5000000000000000001',
    ...overrides
  }
}

function createStreams(overrides: Partial<TLedgerSixStreams> = {}): TLedgerSixStreams {
  return {
    v3Deposits: [],
    v3Withdrawals: [],
    v2Deposits: [],
    v2Withdrawals: [],
    transfersIn: [],
    transfersOut: [],
    ...overrides
  }
}

function createSixStreamFixture(): TLedgerSixStreams {
  const walletAddress = createAddress('wallet')
  const selfTransfer = createTransfer('self-transfer', {
    vaultAddress: createAddress('transfer-vault'),
    chainId: 10,
    blockNumber: 22_000_000,
    blockTimestamp: FEBRUARY_2024,
    logIndex: 8,
    transactionHash: createTransactionHash('self-transfer'),
    transactionFrom: walletAddress,
    sender: walletAddress,
    receiver: walletAddress,
    value: '9000000000000000007'
  })

  return createStreams({
    v3Deposits: [createV3Deposit('v3-deposit-b', { logIndex: 2 }), createV3Deposit('v3-deposit-a', { logIndex: 2 })],
    v3Withdrawals: [createV3Withdrawal('v3-withdrawal', { shares: '11.000000000000000001' })],
    v2Deposits: [createV2Deposit('v2-deposit', { amount: '00000042', recipient: walletAddress })],
    v2Withdrawals: [createV2Withdrawal('v2-withdrawal', { amount: '0.000000000000000009', recipient: walletAddress })],
    transfersIn: [selfTransfer],
    transfersOut: [selfTransfer]
  })
}

function getChainScope(streams: TLedgerSixStreams): number[] {
  return Array.from(
    new Set(LEDGER_STREAMS.flatMap((stream) => streams[stream].map((event) => event.chainId)))
  ).toSorted((left, right) => left - right)
}

function createCoverageForStreams(streams: TLedgerSixStreams): TLedgerStreamCoverageV1[] {
  const chainIds = getChainScope(streams)

  return LEDGER_STREAMS.flatMap((stream) =>
    chainIds.map((chainId): TLedgerStreamCoverageV1 => {
      const events = streams[stream].filter((event) => event.chainId === chainId).toSorted(compareLedgerOrder)
      const cursorEvent = events.at(-1)
      return {
        stream,
        chainId,
        status: cursorEvent ? 'complete' : 'valid_empty',
        coverageStartTimestamp: JANUARY_2024,
        completeThroughTimestamp: FEBRUARY_2024,
        coverageStartBlock: 0,
        completeThroughBlock: 30_000_000,
        cursor: cursorEvent
          ? {
              blockTimestamp: cursorEvent.blockTimestamp,
              blockNumber: cursorEvent.blockNumber,
              logIndex: cursorEvent.logIndex,
              id: cursorEvent.id
            }
          : null,
        checkpoint: cursorEvent ? `checkpoint-${chainId}` : null,
        checkpointState: cursorEvent ? 'pinned' : 'unpinned',
        count: events.length,
        checksum: getLedgerSha256(stringifyCanonicalLedgerValue([stream, chainId, events]))
      }
    })
  )
}

interface TManifestFixtureOptions {
  readonly streams?: TLedgerSixStreams
  readonly revision?: string
  readonly parentRevision?: string | null
  readonly dependencies?: readonly TLedgerDependencyV1[]
}

function createManifestFixture(options: TManifestFixtureOptions = {}): TLedgerRevisionManifestV1 {
  const streams = options.streams ?? createSixStreamFixture()
  const chainScope = getChainScope(streams)
  const walletHash = getLedgerSha256('wallet-1')
  const chunks = encodeLedgerChunks(streams)
  const indexes = encodeLedgerIndexShards(chunks)

  return createLedgerRevisionManifest({
    calculationVersion: 'portfolio-ledger-calculation-v1',
    walletHash,
    sourceFingerprint: getLedgerSha256('source-without-secret'),
    sourceGeneration: 3,
    revision: options.revision ?? 'revision_01',
    parentRevision: options.parentRevision === undefined ? 'revision_00' : options.parentRevision,
    chainScope,
    coverage: createCoverageForStreams(streams),
    chunks,
    indexes,
    dependencies:
      options.dependencies ??
      [
        {
          kind: 'vault' as const,
          chainId: 1,
          address: createAddress('dependency-vault'),
          metadataRevision: null,
          firstEventTimestamp: JANUARY_2024
        },
        {
          kind: 'nested-vault' as const,
          chainId: 10,
          address: createAddress('dependency-nested-vault'),
          metadataRevision: 'metadata-2',
          firstEventTimestamp: FEBRUARY_2024
        }
      ].filter((dependency) => chainScope.includes(dependency.chainId)),
    invalidationEpochs: { global: 1, source: 2, address: 3, vault: 4, schema: 5, metadata: 6 },
    dirtyFromTimestamp: JANUARY_2024,
    dirtyFromDate: '2024-01-01',
    dirtyReasons: ['source_generation', 'metadata_changed', 'source_generation'],
    createdAtMs: 1_000,
    updatedAtMs: 2_000,
    reconciledAtMs: 1_500
  })
}

function createStoredRevisionFixture(streams: TLedgerSixStreams = createSixStreamFixture()): {
  readonly streams: TLedgerSixStreams
  readonly manifest: TLedgerRevisionManifestV1
  readonly chunks: readonly TStoredLedgerChunkV1[]
  readonly indexes: readonly TStoredLedgerIndexShardV1[]
} {
  const manifest = createManifestFixture({ streams })
  const encodedChunks = encodeLedgerChunks(streams)
  const encodedIndexes = encodeLedgerIndexShards(encodedChunks)
  return {
    streams,
    manifest,
    chunks: encodedChunks.map((chunk) => ({
      ...chunk,
      key: getLedgerChunkKey(manifest.walletHash, chunk.descriptor.checksum)
    })),
    indexes: encodedIndexes.map((index) => ({
      ...index,
      key: getLedgerIndexShardKey(manifest.walletHash, index.descriptor.shard, index.descriptor.checksum)
    }))
  }
}

function withResolvedActiveBytes(
  manifest: TLedgerRevisionManifestV1,
  attemptsRemaining = 8
): TLedgerRevisionManifestV1 {
  const manifestBytes = Buffer.byteLength(stringifyCanonicalLedgerValue(manifest), 'utf8')
  const activeEncodedBytes =
    manifest.chunks.reduce((total, chunk) => total + chunk.encodedBytes, 0) +
    manifest.indexes.reduce((total, index) => total + index.encodedBytes, 0) +
    manifestBytes
  return activeEncodedBytes === manifest.activeEncodedBytes || attemptsRemaining === 0
    ? manifest
    : withResolvedActiveBytes({ ...manifest, activeEncodedBytes }, attemptsRemaining - 1)
}

describe('portfolio ledger canonical codec', () => {
  it('round-trips all six logical streams and merges transfer direction membership', () => {
    const streams = createSixStreamFixture()
    const tuples = canonicalizeLedgerStreams(streams)
    const transfer = tuples.find((tuple) => tuple[1] === LEDGER_EVENT_FAMILY_CODES.transfer)
    const decoded = decodeCanonicalLedgerTuples(tuples)

    expect(tuples).toHaveLength(6)
    expect(transfer?.[2]).toBe(LEDGER_TRANSFER_DIRECTIONS.both)
    expect(transfer?.[10]).toEqual(expect.objectContaining({ value: '9000000000000000007' }))
    expect(decoded.v3Deposits).toEqual([...streams.v3Deposits].reverse())
    expect(decoded.v3Withdrawals).toEqual(streams.v3Withdrawals)
    expect(decoded.v2Deposits).toEqual(streams.v2Deposits)
    expect(decoded.v2Withdrawals).toEqual(streams.v2Withdrawals)
    expect(decoded.transfersIn).toEqual(streams.transfersIn)
    expect(decoded.transfersOut).toEqual(streams.transfersOut)
    expect(decoded.transfersIn[0]).toEqual(decoded.transfersOut[0])
  })

  it('rejects every missing concrete stream-family field', () => {
    const cases = [
      [
        'v3Deposits',
        createV3Deposit('missing-v3-deposit-field'),
        ['transactionFrom', 'owner', 'sender', 'assets', 'shares']
      ],
      [
        'v3Withdrawals',
        createV3Withdrawal('missing-v3-withdrawal-field'),
        ['transactionFrom', 'owner', 'assets', 'shares']
      ],
      ['v2Deposits', createV2Deposit('missing-v2-deposit-field'), ['transactionFrom', 'recipient', 'amount', 'shares']],
      [
        'v2Withdrawals',
        createV2Withdrawal('missing-v2-withdrawal-field'),
        ['transactionFrom', 'recipient', 'amount', 'shares']
      ],
      ['transfersIn', createTransfer('missing-transfer-in-field'), ['transactionFrom', 'sender', 'receiver', 'value']],
      ['transfersOut', createTransfer('missing-transfer-out-field'), ['transactionFrom', 'sender', 'receiver', 'value']]
    ] as const satisfies ReadonlyArray<
      readonly [stream: TLedgerStream, event: TLedgerSourceEvent, fields: readonly string[]]
    >

    cases.forEach(([stream, event, fields]) => {
      fields.forEach((field) => {
        const invalidEvent = Object.fromEntries(Object.entries(event).filter(([key]) => key !== field))
        const invalidStreams = createStreams({
          [stream]: [invalidEvent]
        } as Partial<TLedgerSixStreams>)

        expect(() => canonicalizeLedgerStreams(invalidStreams)).toThrow(new RegExp(`Ledger ${stream} ${field}`, 'i'))
      })
    })
  })

  it('rejects conflicting source payloads across transfer directions', () => {
    const incoming = createTransfer('conflicting-transfer', {
      sender: createAddress('sender-a'),
      receiver: createAddress('wallet')
    })
    const outgoing = createTransfer('conflicting-transfer', {
      sender: createAddress('sender-b'),
      receiver: createAddress('wallet')
    })

    expect(() =>
      canonicalizeLedgerStreams(createStreams({ transfersIn: [incoming], transfersOut: [outgoing] }))
    ).toThrow(/conflicting payloads/i)
  })

  it('produces deterministic identities, order, canonical JSON, and checksums', () => {
    const streams = createSixStreamFixture()
    const reordered = createStreams({
      ...streams,
      v3Deposits: [...streams.v3Deposits].reverse()
    })
    const left = canonicalizeLedgerStreams(streams)
    const right = canonicalizeLedgerStreams(reordered)
    const leftJson = stringifyCanonicalLedgerValue(left)

    expect(leftJson).toBe(stringifyCanonicalLedgerValue(right))
    expect(getLedgerSha256(leftJson)).toBe(getLedgerSha256(stringifyCanonicalLedgerValue(right)))
    expect(new Set(left.map(getCanonicalLedgerTupleIdentity)).size).toBe(left.length)
    expect(stringifyCanonicalLedgerValue({ z: 1, a: { z: 2, a: 3 } })).toBe('{"a":{"a":3,"z":2},"z":1}')
  })

  it('groups by family, chain, and UTC month and enforces both chunk guards', () => {
    const januaryEvents = Array.from({ length: 1_001 }, (_, index) =>
      createV3Deposit(`january-${index.toString().padStart(4, '0')}`, {
        blockNumber: 19_000_000 + index,
        logIndex: index % 16
      })
    )
    const streams = createStreams({
      v3Deposits: [
        ...januaryEvents,
        createV3Deposit('february-chain-10', { chainId: 10, blockTimestamp: FEBRUARY_2024 })
      ],
      v2Deposits: [createV2Deposit('v2-january')]
    })
    const chunks = encodeLedgerChunks(streams)
    const januaryV3 = chunks.filter(
      (chunk) => chunk.descriptor.family === 'v3-deposit' && chunk.descriptor.chainId === 1
    )

    expect(januaryV3.map((chunk) => chunk.descriptor.recordCount)).toEqual([1_000, 1])
    expect(chunks.every((chunk) => chunk.descriptor.recordCount <= LEDGER_MAX_CHUNK_RECORDS)).toBe(true)
    expect(chunks.every((chunk) => chunk.descriptor.encodedBytes <= LEDGER_MAX_ENCODED_CHUNK_BYTES)).toBe(true)
    expect(
      new Set(chunks.map((chunk) => `${chunk.descriptor.family}:${chunk.descriptor.chainId}:${chunk.descriptor.month}`))
    ).toEqual(new Set(['v3-deposit:1:2024-01', 'v3-deposit:10:2024-02', 'v2-deposit:1:2024-01']))
    expect(decodeLedgerChunks(chunks).v3Deposits).toHaveLength(1_002)
    expect(encodeLedgerChunks(streams)).toEqual(chunks)
  })

  it('rejects a single incompressible record that exceeds the encoded chunk limit', () => {
    const payload = randomBytes(300_000).toString('base64')
    const streams = createStreams({ v3Deposits: [createV3Deposit('oversized', { payload })] })

    expect(() => encodeLedgerChunks(streams)).toThrow(/record exceeds/i)
  })

  it('rejects a highly compressible record that exceeds the decoded chunk limit', () => {
    const payload = 'x'.repeat(LEDGER_MAX_DECODED_CHUNK_BYTES)
    const streams = createStreams({ v3Deposits: [createV3Deposit('decoded-oversized', { payload })] })

    expect(() => encodeLedgerChunks(streams)).toThrow(/record exceeds/i)
  })

  it('verifies canonical bytes and SHA-256 checksums during decode', () => {
    const chunk = encodeLedgerChunks(createStreams({ v3Deposits: [createV3Deposit('checksum')] }))[0]
    if (!chunk) {
      throw new Error('Expected an encoded chunk')
    }
    const tampered = {
      ...chunk,
      descriptor: { ...chunk.descriptor, checksum: '0'.repeat(64) }
    }

    expect(decodeLedgerChunk(chunk)).toHaveLength(1)
    expect(() => decodeLedgerChunk(tampered)).toThrow(/does not match/i)
  })
})

describe('portfolio ledger content-addressed ID index', () => {
  it('builds deterministic shards that map identities to content-addressed chunks', () => {
    const chunks = encodeLedgerChunks(createSixStreamFixture())
    const indexes = encodeLedgerIndexShards(chunks)
    const entries = indexes.flatMap(decodeLedgerIndexShard)
    const chunkChecksums = new Set(chunks.map((chunk) => chunk.descriptor.checksum))

    expect(indexes).toHaveLength(LEDGER_INDEX_SHARD_COUNT)
    expect(entries).toHaveLength(6)
    expect(
      entries.every(
        (entry) =>
          getLedgerIndexShard(entry[0]) ===
          indexes.find((index) => index.descriptor.shard === getLedgerIndexShard(entry[0]))?.descriptor.shard
      )
    ).toBe(true)
    expect(entries.every((entry) => chunkChecksums.has(entry[1]))).toBe(true)
    expect(encodeLedgerIndexShards(chunks)).toEqual(indexes)
  })

  it('reuses unchanged shard content and leaves full reads independent of the index', () => {
    const baseChunks = encodeLedgerChunks(createSixStreamFixture())
    const baseIndexes = encodeLedgerIndexShards(baseChunks)
    const nextStreams = createSixStreamFixture()
    const nextChunks = encodeLedgerChunks(
      createStreams({
        ...nextStreams,
        v3Deposits: [
          ...nextStreams.v3Deposits,
          createV3Deposit('new-isolated-group', { chainId: 42161, blockTimestamp: FEBRUARY_2024 })
        ]
      })
    )
    const nextIndexes = encodeLedgerIndexShards(nextChunks)
    const unchangedShards = baseIndexes.filter(
      (index) => index.descriptor.checksum === nextIndexes[index.descriptor.shard]?.descriptor.checksum
    )

    expect(unchangedShards).toHaveLength(LEDGER_INDEX_SHARD_COUNT - 1)
    expect(decodeLedgerChunks(baseChunks)).toEqual(decodeCanonicalLedgerTuples(canonicalizeLedgerStreams(nextStreams)))
  })
})

describe('portfolio ledger sync status codec', () => {
  const statuses = [
    {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      state: 'idle',
      sourceGeneration: 3,
      revision: null,
      reasonCode: null,
      updatedAtMs: 1_000
    },
    {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      state: 'syncing',
      sourceGeneration: 3,
      revision: 'revision_01',
      reasonCode: null,
      updatedAtMs: 2_000
    },
    {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      state: 'complete',
      sourceGeneration: 3,
      revision: 'revision_02',
      reasonCode: null,
      updatedAtMs: 3_000
    },
    {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      state: 'failed',
      sourceGeneration: 3,
      revision: 'revision_01',
      reasonCode: 'stale_fence',
      updatedAtMs: 4_000
    }
  ] as const satisfies readonly TLedgerSyncStatusV1[]

  it('round-trips every state from strict canonical JSON', () => {
    statuses.forEach((status) => {
      const serialized = stringifyCanonicalLedgerValue(status)
      expect(parseLedgerSyncStatus(serialized)).toEqual(status)
      expect(() => validateLedgerSyncStatus(status)).not.toThrow()
    })

    expect(() => parseLedgerSyncStatus(JSON.stringify(statuses[2]))).toThrow(/canonical JSON object/i)
  })

  it('rejects unsupported fields, state combinations, revisions, and integer metadata', () => {
    const complete = statuses[2]
    const invalidStatuses = [
      { ...complete, internalError: 'private' },
      { ...complete, state: 'unknown' },
      { ...complete, revision: null },
      { ...complete, reasonCode: 'upstream_failed' },
      { ...statuses[3], reasonCode: 'unknown_reason' },
      { ...complete, revision: '../revision' },
      { ...complete, sourceGeneration: Number.MAX_SAFE_INTEGER + 1 },
      { ...complete, updatedAtMs: -1 }
    ]

    invalidStatuses.forEach((status) => {
      expect(() => validateLedgerSyncStatus(status as unknown as TLedgerSyncStatusV1)).toThrow()
    })
  })
})

describe('portfolio ledger revision manifest', () => {
  it('references content-addressed blobs with exhaustive per-chain coverage and supported invalidation metadata', () => {
    const manifest = createManifestFixture()
    const validation = validateLedgerRevisionManifest(manifest)
    const head = createLedgerHead(manifest)
    const coverageChainIds = [1, 10]

    expect(manifest.indexes).toHaveLength(LEDGER_INDEX_SHARD_COUNT)
    expect(manifest.coverage).toHaveLength(LEDGER_STREAMS.length * 2)
    expect(new Set(manifest.coverage.map((entry) => entry.chainId))).toEqual(new Set([1, 10]))
    coverageChainIds.forEach((chainId) => {
      expect(manifest.coverage.filter((entry) => entry.chainId === chainId).map((entry) => entry.stream)).toEqual(
        LEDGER_STREAMS
      )
    })
    expect(manifest.coverage.find((entry) => entry.stream === 'v3Deposits' && entry.chainId === 10)).toEqual(
      expect.objectContaining({
        status: 'valid_empty',
        coverageStartTimestamp: JANUARY_2024,
        completeThroughTimestamp: FEBRUARY_2024,
        coverageStartBlock: 0,
        completeThroughBlock: 30_000_000,
        checkpointState: 'unpinned'
      })
    )
    expect(manifest.chunks.every((chunk) => chunk.key === getLedgerChunkKey(manifest.walletHash, chunk.checksum))).toBe(
      true
    )
    expect(
      manifest.indexes.every(
        (index) => index.key === getLedgerIndexShardKey(manifest.walletHash, index.shard, index.checksum)
      )
    ).toBe(true)
    expect(manifest.chunks.every((chunk) => !chunk.key.includes(manifest.revision))).toBe(true)
    expect(manifest.dirtyReasons).toEqual(['metadata_changed', 'source_generation'])
    expect(manifest.dependencies.map((dependency) => dependency.kind).toSorted()).toEqual(['nested-vault', 'vault'])
    expect(manifest.invalidationEpochs.vault).toBe(4)
    expect(manifest.dirtyFromTimestamp).toBe(JANUARY_2024)
    expect(manifest.createdAtMs).toBe(1_000)
    expect(validation.manifestBytes).toBeLessThanOrEqual(LEDGER_MAX_MANIFEST_BYTES)
    expect(validation.activeRevisionBytes).toBe(
      [...manifest.chunks, ...manifest.indexes].reduce((total, item) => total + item.encodedBytes, 0) +
        validation.manifestBytes
    )
    expect(head.manifestChecksum).toBe(getLedgerSha256(stringifyCanonicalLedgerValue(manifest)))
  })

  it('parses canonical manifests and heads and cross-validates their identity', () => {
    const manifest = createManifestFixture()
    const parsedManifest = parseLedgerRevisionManifest(stringifyCanonicalLedgerValue(manifest))
    const head = createLedgerHead(parsedManifest)
    const parsedHead = parseLedgerHead(stringifyCanonicalLedgerValue(head))
    const mismatchedHead = { ...parsedHead, manifestChecksum: getLedgerSha256('different-manifest') }

    expect(parsedManifest).toEqual(manifest)
    expect(parsedHead).toEqual(head)
    expect(() => validateLedgerHeadAgainstManifest(parsedHead, parsedManifest)).not.toThrow()
    expect(() => validateLedgerHeadAgainstManifest(mismatchedHead, parsedManifest)).toThrow(/does not match/i)
    expect(() => parseLedgerRevisionManifest(JSON.stringify(manifest))).toThrow(/canonical JSON object/i)
    expect(() => parseLedgerHead(JSON.stringify(head))).toThrow(/canonical JSON object/i)
  })

  it('validates exact block coverage bounds and binds every decoded event block number', () => {
    const manifest = createManifestFixture()
    const invalidOrderCoverage = manifest.coverage.map((entry, index) =>
      index === 0 ? { ...entry, coverageStartBlock: entry.completeThroughBlock + 1 } : entry
    )
    const unsafeCoverage = manifest.coverage.map((entry, index) =>
      index === 0 ? { ...entry, completeThroughBlock: Number.MAX_SAFE_INTEGER + 1 } : entry
    )
    const completeCoverageIndex = manifest.coverage.findIndex((entry) => entry.cursor !== null)
    const cursorOutsideCoverage = manifest.coverage.map((entry, index) =>
      index === completeCoverageIndex && entry.cursor
        ? { ...entry, coverageStartBlock: entry.cursor.blockNumber + 1 }
        : entry
    )
    const eventBoundFixture = createStoredRevisionFixture(
      createStreams({
        v3Deposits: [
          createV3Deposit('block-before-coverage', {
            blockNumber: 18_000_000,
            blockTimestamp: JANUARY_2024
          }),
          createV3Deposit('block-inside-coverage', {
            blockNumber: 19_000_000,
            blockTimestamp: JANUARY_2024 + 1
          })
        ]
      })
    )
    const eventBoundManifest = withResolvedActiveBytes({
      ...eventBoundFixture.manifest,
      coverage: eventBoundFixture.manifest.coverage.map((entry) =>
        entry.stream === 'v3Deposits' && entry.chainId === 1 ? { ...entry, coverageStartBlock: 18_500_000 } : entry
      ),
      activeEncodedBytes: 0
    })

    expect(() => validateLedgerRevisionManifest({ ...manifest, coverage: invalidOrderCoverage })).toThrow(
      /complete-through block/i
    )
    expect(() => validateLedgerRevisionManifest({ ...manifest, coverage: unsafeCoverage })).toThrow(/safe integer/i)
    expect(() => validateLedgerRevisionManifest({ ...manifest, coverage: cursorOutsideCoverage })).toThrow(
      /cursor block number/i
    )
    expect(() => decodeLedgerRevision(eventBoundManifest, eventBoundFixture.chunks, eventBoundFixture.indexes)).toThrow(
      /event block numbers/i
    )
  })

  it('rejects unknown structural metadata and falsy non-null parent revisions', () => {
    const manifest = createManifestFixture()
    const head = createLedgerHead(manifest)
    const manifestWithPrivateField = { ...manifest, indexerUrl: 'https://private-indexer.example' }
    const headWithPrivateField = { ...head, token: 'private-token' }
    const manifestWithNestedPrivateField = {
      ...manifest,
      chunks: manifest.chunks.map((chunk, index) => (index === 0 ? { ...chunk, indexerUrl: 'private' } : chunk))
    }

    expect(() => parseLedgerRevisionManifest(stringifyCanonicalLedgerValue(manifestWithPrivateField))).toThrow(
      /unsupported or missing fields/i
    )
    expect(() => parseLedgerHead(stringifyCanonicalLedgerValue(headWithPrivateField))).toThrow(
      /unsupported or missing fields/i
    )
    expect(() => validateLedgerRevisionManifest(manifestWithNestedPrivateField as TLedgerRevisionManifestV1)).toThrow(
      /unsupported or missing fields/i
    )
    expect(() =>
      parseLedgerRevisionManifest(stringifyCanonicalLedgerValue({ ...manifest, parentRevision: false }))
    ).toThrow(/parent revision/i)
    expect(() => parseLedgerHead(stringifyCanonicalLedgerValue({ ...head, revision: 123 }))).toThrow(/revision/i)
    expect(() => parseLedgerHead(stringifyCanonicalLedgerValue({ ...head, parentRevision: false }))).toThrow(
      /parent revision/i
    )
  })

  it('decodes only a complete manifest-bound revision and binds coverage to its canonical streams', () => {
    const fixture = createStoredRevisionFixture()
    const decoded = decodeLedgerRevision(fixture.manifest, fixture.chunks, fixture.indexes)
    const incompleteChunks = fixture.chunks.slice(1)
    const tamperedCoverage = fixture.manifest.coverage.map((entry, index) =>
      index === 0 ? { ...entry, count: entry.count + 1 } : entry
    )
    const tamperedManifest = withResolvedActiveBytes({
      ...fixture.manifest,
      coverage: tamperedCoverage,
      activeEncodedBytes: 0
    })
    const omittedChainManifest = withResolvedActiveBytes({
      ...fixture.manifest,
      chainScope: [1],
      coverage: fixture.manifest.coverage.filter((entry) => entry.chainId === 1),
      activeEncodedBytes: 0
    })

    expect(canonicalizeLedgerStreams(decoded)).toEqual(canonicalizeLedgerStreams(fixture.streams))
    expect(() => decodeLedgerRevision(fixture.manifest, incompleteChunks, fixture.indexes)).toThrow(/count/i)
    expect(() => decodeLedgerRevision(tamperedManifest, fixture.chunks, fixture.indexes)).toThrow(/coverage count/i)
    expect(() => decodeLedgerRevision(omittedChainManifest, fixture.chunks, fixture.indexes)).toThrow(/chain scope/i)
  })

  it('rejects stale reused index refs before a mixed incremental revision can be consumed', () => {
    const base = createStoredRevisionFixture()
    const extraStreams = createStreams({
      v3Deposits: [createV3Deposit('mixed-extra', { chainId: 42161, blockTimestamp: FEBRUARY_2024 })]
    })
    const combinedStreams = createStreams({
      v3Deposits: [...base.streams.v3Deposits, ...extraStreams.v3Deposits],
      v3Withdrawals: base.streams.v3Withdrawals,
      v2Deposits: base.streams.v2Deposits,
      v2Withdrawals: base.streams.v2Withdrawals,
      transfersIn: base.streams.transfersIn,
      transfersOut: base.streams.transfersOut
    })
    const extraChunks = encodeLedgerChunks(extraStreams)
    const mixedManifest = createLedgerRevisionManifest({
      calculationVersion: base.manifest.calculationVersion,
      walletHash: base.manifest.walletHash,
      sourceFingerprint: base.manifest.sourceFingerprint,
      sourceGeneration: base.manifest.sourceGeneration,
      revision: 'revision_mixed',
      parentRevision: base.manifest.revision,
      chainScope: getChainScope(combinedStreams),
      coverage: createCoverageForStreams(combinedStreams),
      chunks: [...base.manifest.chunks, ...extraChunks],
      indexes: base.manifest.indexes,
      dependencies: base.manifest.dependencies,
      invalidationEpochs: base.manifest.invalidationEpochs,
      dirtyFromTimestamp: FEBRUARY_2024,
      dirtyFromDate: '2024-02-01',
      dirtyReasons: ['tail_append'],
      createdAtMs: 3_000,
      updatedAtMs: 3_000,
      reconciledAtMs: 3_000
    })
    const mixedStoredChunks = [
      ...base.chunks,
      ...extraChunks.map((chunk) => ({
        ...chunk,
        key: getLedgerChunkKey(mixedManifest.walletHash, chunk.descriptor.checksum)
      }))
    ]

    expect(() => decodeLedgerRevision(mixedManifest, mixedStoredChunks, base.indexes)).toThrow(
      /indexes do not describe/i
    )
  })

  it('reuses existing chunk and index refs in a new manifest revision', () => {
    const baseManifest = createManifestFixture()
    const nextManifest = createLedgerRevisionManifest({
      calculationVersion: baseManifest.calculationVersion,
      walletHash: baseManifest.walletHash,
      sourceFingerprint: baseManifest.sourceFingerprint,
      sourceGeneration: baseManifest.sourceGeneration,
      revision: 'revision_02',
      parentRevision: baseManifest.revision,
      chainScope: baseManifest.chainScope,
      coverage: baseManifest.coverage,
      chunks: baseManifest.chunks,
      indexes: baseManifest.indexes,
      dependencies: baseManifest.dependencies,
      invalidationEpochs: baseManifest.invalidationEpochs,
      dirtyFromTimestamp: FEBRUARY_2024,
      dirtyFromDate: '2024-02-01',
      dirtyReasons: ['tail_append'],
      createdAtMs: 3_000,
      updatedAtMs: 3_000,
      reconciledAtMs: 3_000
    })

    expect(nextManifest.parentRevision).toBe(baseManifest.revision)
    expect(nextManifest.chunks).toEqual(baseManifest.chunks)
    expect(nextManifest.indexes).toEqual(baseManifest.indexes)
    expect(nextManifest.chunksChecksum).toBe(baseManifest.chunksChecksum)
    expect(nextManifest.indexesChecksum).toBe(baseManifest.indexesChecksum)
  })

  it('transitively verifies advanced coverage over unchanged verified content', () => {
    const base = createStoredRevisionFixture()
    const previous = verifyLedgerRevision(base.manifest, base.chunks, base.indexes)
    const nextManifest = createLedgerRevisionManifest({
      calculationVersion: base.manifest.calculationVersion,
      walletHash: base.manifest.walletHash,
      sourceFingerprint: base.manifest.sourceFingerprint,
      sourceGeneration: base.manifest.sourceGeneration,
      revision: 'revision_02',
      parentRevision: base.manifest.revision,
      chainScope: base.manifest.chainScope,
      coverage: base.manifest.coverage.map((entry) => ({
        ...entry,
        completeThroughTimestamp: entry.completeThroughTimestamp + 1,
        completeThroughBlock: entry.completeThroughBlock + 1
      })),
      chunks: base.manifest.chunks,
      indexes: base.manifest.indexes,
      dependencies: base.manifest.dependencies,
      invalidationEpochs: base.manifest.invalidationEpochs,
      dirtyFromTimestamp: base.manifest.dirtyFromTimestamp,
      dirtyFromDate: base.manifest.dirtyFromDate,
      dirtyReasons: base.manifest.dirtyReasons,
      createdAtMs: base.manifest.createdAtMs,
      updatedAtMs: base.manifest.updatedAtMs + 1,
      reconciledAtMs: base.manifest.reconciledAtMs
    })

    const reused = verifyLedgerRevisionWithReusedContent(previous, nextManifest)

    expect(getVerifiedLedgerRevisionValues(reused).manifest).toBe(nextManifest)
    expect(reused.streams).toBe(previous.streams)
    expect(reused.manifest.chunks).toEqual(previous.manifest.chunks)
    expect(reused.manifest.indexes).toEqual(previous.manifest.indexes)
  })

  it('rejects forged parents, changed refs, and coverage that does not describe reused streams', () => {
    const base = createStoredRevisionFixture()
    const previous = verifyLedgerRevision(base.manifest, base.chunks, base.indexes)
    const createNextManifest = (overrides: {
      readonly chunks?: TLedgerRevisionManifestV1['chunks']
      readonly indexes?: TLedgerRevisionManifestV1['indexes']
      readonly coverage?: TLedgerRevisionManifestV1['coverage']
    }) =>
      createLedgerRevisionManifest({
        calculationVersion: base.manifest.calculationVersion,
        walletHash: base.manifest.walletHash,
        sourceFingerprint: base.manifest.sourceFingerprint,
        sourceGeneration: base.manifest.sourceGeneration,
        revision: 'revision_02',
        parentRevision: base.manifest.revision,
        chainScope: base.manifest.chainScope,
        coverage: overrides.coverage ?? base.manifest.coverage,
        chunks: overrides.chunks ?? base.manifest.chunks,
        indexes: overrides.indexes ?? base.manifest.indexes,
        dependencies: base.manifest.dependencies,
        invalidationEpochs: base.manifest.invalidationEpochs,
        dirtyFromTimestamp: base.manifest.dirtyFromTimestamp,
        dirtyFromDate: base.manifest.dirtyFromDate,
        dirtyReasons: base.manifest.dirtyReasons,
        createdAtMs: base.manifest.createdAtMs,
        updatedAtMs: base.manifest.updatedAtMs + 1,
        reconciledAtMs: base.manifest.reconciledAtMs
      })
    const validNext = createNextManifest({})
    const different = createStoredRevisionFixture(createStreams({ v3Deposits: [createV3Deposit('different-content')] }))
    const changedRefs = createNextManifest({ chunks: different.manifest.chunks, indexes: different.manifest.indexes })
    const invalidCoverage = createNextManifest({
      coverage: base.manifest.coverage.map((entry, index) =>
        index === 0 ? { ...entry, count: entry.count + 1 } : entry
      )
    })

    expect(() => verifyLedgerRevisionWithReusedContent({ ...previous }, validNext)).toThrow(/verification/i)
    expect(() => verifyLedgerRevisionWithReusedContent(previous, changedRefs)).toThrow(/identical verified content/i)
    expect(() => verifyLedgerRevisionWithReusedContent(previous, invalidCoverage)).toThrow(/coverage count/i)
  })

  it('accepts manifests between 128 and 256 KiB while enforcing active and manifest limits', () => {
    const manifest = createManifestFixture({
      streams: createStreams({ v3Deposits: [createV3Deposit('limits')] }),
      revision: 'revision_limits',
      parentRevision: null
    })
    const oversizedIndexes = manifest.indexes.map((index, position) => ({
      ...index,
      encodedBytes: position < 17 ? LEDGER_MAX_ENCODED_CHUNK_BYTES : index.encodedBytes
    }))
    const oversizedActiveBytes =
      manifest.chunks.reduce((total, chunk) => total + chunk.encodedBytes, 0) +
      oversizedIndexes.reduce((total, index) => total + index.encodedBytes, 0)
    const oversizedActiveManifest = withResolvedActiveBytes({
      ...manifest,
      indexes: oversizedIndexes,
      activeEncodedBytes: 0,
      indexesChecksum: getLedgerSha256(stringifyCanonicalLedgerValue(oversizedIndexes))
    })
    const oversizedDependencies: TLedgerDependencyV1[] = Array.from({ length: 2_000 }, (_, index) => ({
      kind: 'vault',
      chainId: 1,
      address: createIndexedAddress(index),
      metadataRevision: null,
      firstEventTimestamp: JANUARY_2024
    }))
    const expandedManifest = withResolvedActiveBytes({
      ...manifest,
      dependencies: oversizedDependencies.slice(0, 800)
    })
    const oversizedManifest = withResolvedActiveBytes({
      ...manifest,
      dependencies: oversizedDependencies
    })

    expect(new Set(oversizedDependencies.map((dependency) => dependency.address))).toHaveLength(
      oversizedDependencies.length
    )
    expect(oversizedDependencies.every((dependency) => /^0x[a-f0-9]{40}$/.test(dependency.address))).toBe(true)
    expect(oversizedActiveBytes).toBeGreaterThan(LEDGER_MAX_ACTIVE_REVISION_BYTES)
    expect(() => validateLedgerRevisionManifest(oversizedActiveManifest)).toThrow(/active revision/i)
    expect(Buffer.byteLength(stringifyCanonicalLedgerValue(expandedManifest), 'utf8')).toBeGreaterThan(128 * 1024)
    expect(Buffer.byteLength(stringifyCanonicalLedgerValue(expandedManifest), 'utf8')).toBeLessThanOrEqual(
      LEDGER_MAX_MANIFEST_BYTES
    )
    expect(validateLedgerRevisionManifest(expandedManifest).manifestBytes).toBeGreaterThan(128 * 1024)
    expect(parseLedgerRevisionManifest(stringifyCanonicalLedgerValue(expandedManifest))).toEqual(expandedManifest)
    expect(Buffer.byteLength(stringifyCanonicalLedgerValue(oversizedManifest), 'utf8')).toBeGreaterThan(
      LEDGER_MAX_MANIFEST_BYTES
    )
    expect(() => validateLedgerRevisionManifest(oversizedManifest)).toThrow(/manifest exceeds/i)
  })
})
