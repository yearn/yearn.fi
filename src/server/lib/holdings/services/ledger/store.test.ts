import { createHash } from 'node:crypto'
import type { SetCommandOptions } from '@upstash/redis'
import { describe, expect, it, vi } from 'vitest'
import {
  createLedgerRevisionManifest,
  encodeLedgerIndexShards,
  parseLedgerSyncStatus,
  stringifyCanonicalLedgerValue,
  type TLedgerVerifiedRevisionV1,
  verifyLedgerRevision
} from '@/server/lib/holdings/services/ledger/codec'
import { getLedgerChunkKey, getLedgerIndexShardKey } from '@/server/lib/holdings/services/ledger/keys'
import type { TLedgerLock } from '@/server/lib/holdings/services/ledger/lock'
import {
  commitVerifiedLedgerRevision,
  readLedgerValue,
  readLedgerValues,
  recoverCorruptLedgerHeadFromPrevious,
  type TLedgerPipelineRedis,
  type TLedgerRedis,
  type TLedgerRedisPipeline,
  writeImmutableLedgerBlobs,
  writeImmutableLedgerChunk,
  writeImmutableLedgerIndexShard,
  writeLedgerSyncStatus
} from '@/server/lib/holdings/services/ledger/store'
import {
  LEDGER_MAX_ACTIVE_REVISION_BYTES,
  LEDGER_MAX_ENCODED_CHUNK_BYTES,
  LEDGER_SCHEMA_VERSION,
  LEDGER_STREAMS,
  type TLedgerStreamCoverageV1,
  type TLedgerSyncStatusV1,
  type TStoredLedgerIndexShardV1
} from '@/server/lib/holdings/services/ledger/types'

const WALLET_HASH = 'a'.repeat(64)

function ledgerKey(suffix: string): string {
  return `holdings:ledger:v1:{${WALLET_HASH}}:${suffix}`
}

const LOCK_KEY = ledgerKey('lock')
const HEAD_KEY = ledgerKey('head')
const PREVIOUS_HEAD_KEY = ledgerKey('head:previous')
const SYNC_STATUS_KEY = ledgerKey('sync-status')
const MANIFEST_ONE_KEY = ledgerKey('manifest:1:revision-1')
const MANIFEST_TWO_KEY = ledgerKey('manifest:1:revision-2')
const STALE_MANIFEST_KEY = ledgerKey('manifest:1:stale')

function autoDeserialize(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

type TPipelineCommand =
  | Readonly<{ type: 'get'; key: string }>
  | Readonly<{ type: 'set'; key: string; value: unknown; options?: SetCommandOptions }>

class FakeLedgerStoreRedis implements TLedgerPipelineRedis {
  readonly values = new Map<string, unknown>()
  readonly setOptions = new Map<string, SetCommandOptions | undefined>()
  readonly pipelineExecutions: TPipelineCommand[][] = []

  get<TData>(key: string): Promise<TData | null> {
    if (!this.values.has(key)) {
      return Promise.resolve(null)
    }

    return Promise.resolve(autoDeserialize(this.values.get(key)) as TData)
  }

  set<TData>(key: string, value: TData, options?: SetCommandOptions): Promise<'OK' | TData | null> {
    if (options?.nx && this.values.has(key)) {
      return Promise.resolve(null)
    }

    this.values.set(key, value)
    this.setOptions.set(key, options)
    return Promise.resolve('OK')
  }

  pipeline(): TLedgerRedisPipeline {
    const commands: TPipelineCommand[] = []
    const pipeline: TLedgerRedisPipeline = {
      get: <_TData>(key: string) => {
        commands.push({ type: 'get', key })
        return pipeline
      },
      set: <TData>(key: string, value: TData, options?: SetCommandOptions) => {
        commands.push({ type: 'set', key, value, options })
        return pipeline
      },
      exec: async <TResults extends unknown[] = unknown[]>() => {
        this.pipelineExecutions.push([...commands])
        const results = await Promise.all(
          commands.map((command) =>
            command.type === 'get'
              ? this.get<unknown>(command.key)
              : this.set(command.key, command.value, command.options)
          )
        )
        return results as TResults
      }
    }
    return pipeline
  }

  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData> {
    const result = script.includes('holdings-ledger-head-commit-v1')
      ? this.commit(keys, args)
      : script.includes('holdings-ledger-sync-status-write-v1')
        ? this.writeSyncStatus(keys, args)
        : script.includes('holdings-ledger-head-recovery-v1')
          ? this.recoverHead(keys, args)
          : -1
    return Promise.resolve(result as TData)
  }

  private commit(keys: string[], args: unknown[]): number {
    const lockKey = keys[0] ?? ''
    const headKey = keys[1] ?? ''
    const previousHeadKey = keys[2] ?? ''
    const manifestKey = keys[3] ?? ''
    const syncStatusKey = keys[4] ?? ''
    const lockToken = String(args[0])
    const expectsHead = args[1] === '1'
    const expectedHead = String(args[2])
    const nextHead = String(args[3])
    const manifestValue = String(args[4])
    const writesSyncStatus = args[5] === '1'
    const syncStatusValue = String(args[6])
    const currentHead = this.values.get(headKey)
    const currentManifest = this.values.get(manifestKey)

    if (currentHead === nextHead && currentManifest === manifestValue) {
      if (writesSyncStatus) {
        if (this.values.get(lockKey) !== lockToken) {
          return 1
        }
        this.values.set(syncStatusKey, syncStatusValue)
      }
      return 4
    }

    if (this.values.get(lockKey) !== lockToken) {
      return 1
    }

    const headConflicts = expectsHead ? currentHead !== expectedHead : currentHead !== undefined
    if (headConflicts) {
      return 2
    }

    if (this.values.has(manifestKey)) {
      return 3
    }

    this.values.set(manifestKey, manifestValue)
    if (currentHead === undefined) {
      this.values.delete(previousHeadKey)
    } else {
      this.values.set(previousHeadKey, currentHead)
    }
    this.values.set(headKey, nextHead)
    if (writesSyncStatus) {
      this.values.set(syncStatusKey, syncStatusValue)
    }
    return 0
  }

  private writeSyncStatus(keys: string[], args: unknown[]): number {
    const lockKey = keys[0] ?? ''
    const syncStatusKey = keys[1] ?? ''
    if (this.values.get(lockKey) !== String(args[0])) {
      return 0
    }
    this.values.set(syncStatusKey, String(args[1]))
    return 1
  }

  private recoverHead(keys: string[], args: unknown[]): number {
    const lockKey = keys[0] ?? ''
    const headKey = keys[1] ?? ''
    const previousHeadKey = keys[2] ?? ''
    const syncStatusKey = keys[3] ?? ''
    if (this.values.get(lockKey) !== String(args[0])) {
      return 1
    }
    if (!this.values.has(headKey)) {
      return 2
    }
    const previousHead = this.values.get(previousHeadKey)
    if (previousHead === undefined || previousHead !== String(args[1])) {
      return 3
    }
    this.values.set(headKey, previousHead)
    this.values.delete(previousHeadKey)
    this.values.set(syncStatusKey, String(args[2]))
    return 0
  }
}

const LOCK: TLedgerLock = { owner: 'worker-a', fence: 7 }

function testChecksum(index: number): string {
  return index.toString(16).padStart(64, '0')
}

function checksum(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function createSyncStatus(
  args:
    | { state: 'complete'; revision: string; updatedAtMs: number }
    | { state: 'syncing' | 'failed'; revision: string | null; updatedAtMs: number }
): TLedgerSyncStatusV1 {
  return args.state === 'failed'
    ? {
        schemaVersion: LEDGER_SCHEMA_VERSION,
        state: args.state,
        sourceGeneration: 1,
        revision: args.revision,
        reasonCode: 'stale_fence',
        updatedAtMs: args.updatedAtMs
      }
    : args.state === 'complete'
      ? {
          schemaVersion: LEDGER_SCHEMA_VERSION,
          state: args.state,
          sourceGeneration: 1,
          revision: args.revision,
          reasonCode: null,
          updatedAtMs: args.updatedAtMs
        }
      : {
          schemaVersion: LEDGER_SCHEMA_VERSION,
          state: args.state,
          sourceGeneration: 1,
          revision: args.revision,
          reasonCode: null,
          updatedAtMs: args.updatedAtMs
        }
}

function createEmptyCoverage(): TLedgerStreamCoverageV1[] {
  return LEDGER_STREAMS.map((stream) => ({
    stream,
    chainId: 1,
    status: 'valid_empty',
    coverageStartTimestamp: 0,
    completeThroughTimestamp: 2_000_000_000,
    coverageStartBlock: 0,
    completeThroughBlock: 30_000_000,
    cursor: null,
    checkpoint: null,
    checkpointState: 'unpinned',
    count: 0,
    checksum: checksum(stringifyCanonicalLedgerValue([stream, 1, []]))
  }))
}

function createVerifiedEmptyRevision(args: {
  revision: string
  parentRevision: string | null
  timestampMs: number
}): TLedgerVerifiedRevisionV1 {
  const encodedIndexes = encodeLedgerIndexShards([])
  const manifest = createLedgerRevisionManifest({
    calculationVersion: 'store-test-v1',
    walletHash: WALLET_HASH,
    sourceFingerprint: checksum('store-test-source'),
    sourceGeneration: 1,
    revision: args.revision,
    parentRevision: args.parentRevision,
    chainScope: [1],
    coverage: createEmptyCoverage(),
    chunks: [],
    indexes: encodedIndexes,
    dependencies: [],
    invalidationEpochs: { global: 0, source: 0, address: 0, vault: 0, schema: 0, metadata: 0 },
    dirtyFromTimestamp: null,
    dirtyFromDate: null,
    dirtyReasons: [],
    createdAtMs: args.timestampMs,
    updatedAtMs: args.timestampMs,
    reconciledAtMs: args.timestampMs
  })
  const indexes: TStoredLedgerIndexShardV1[] = encodedIndexes.map((index) => ({
    ...index,
    key: getLedgerIndexShardKey(WALLET_HASH, index.descriptor.shard, index.descriptor.checksum)
  }))
  return verifyLedgerRevision(manifest, [], indexes)
}

describe('ledger store', () => {
  it('rejects an unverified revision before attempting head CAS', async () => {
    const redis = new FakeLedgerStoreRedis()

    await expect(
      commitVerifiedLedgerRevision({
        redis,
        lock: LOCK,
        expectedHead: null,
        revision: {} as TLedgerVerifiedRevisionV1
      })
    ).rejects.toThrow(/complete manifest-bound verification/i)
    expect(redis.values.size).toBe(0)
  })

  it('writes chunks and index shards immutably with symmetric opaque-string encoding', async () => {
    const redis = new FakeLedgerStoreRedis()
    const chunkKey = ledgerKey('chunk:plain')
    const indexKey = ledgerKey('index:plain')

    expect(await writeImmutableLedgerChunk({ redis, key: chunkKey, value: 'plain payload' })).toEqual({
      status: 'written'
    })
    expect(await writeImmutableLedgerIndexShard({ redis, key: indexKey, value: '{"schema":1,"chunks":[]}' })).toEqual({
      status: 'written'
    })
    expect(await writeImmutableLedgerChunk({ redis, key: chunkKey, value: 'plain payload' })).toEqual({
      status: 'exists'
    })
    expect(await writeImmutableLedgerChunk({ redis, key: chunkKey, value: 'replacement' })).toEqual({
      status: 'conflict'
    })

    expect(await readLedgerValue({ redis, key: chunkKey })).toEqual({
      status: 'ok',
      value: 'plain payload'
    })
    expect(await readLedgerValue({ redis, key: indexKey })).toEqual({
      status: 'ok',
      value: '{"schema":1,"chunks":[]}'
    })
    expect(redis.setOptions.get(chunkKey)).toEqual({ nx: true })
  })

  it('reads an opaque same-wallet value batch in one ordered pipeline', async () => {
    const redis = new FakeLedgerStoreRedis()
    const firstKey = ledgerKey('chunk:batch-first')
    const missingKey = ledgerKey('chunk:batch-missing')
    const corruptKey = ledgerKey('chunk:batch-corrupt')
    const otherWalletKey = `holdings:ledger:v1:{${'b'.repeat(64)}}:chunk:other-wallet`
    const onCorrupt = vi.fn()
    await writeImmutableLedgerChunk({ redis, key: firstKey, value: 'first-value' })
    redis.values.set(corruptKey, '{"not":"opaque"}')

    expect(
      await readLedgerValues({
        redis,
        keys: [firstKey, missingKey, corruptKey],
        onCorrupt
      })
    ).toEqual([
      { status: 'ok', value: 'first-value' },
      { status: 'missing' },
      { status: 'corrupt', reason: 'encoding' }
    ])
    expect(redis.pipelineExecutions).toEqual([
      [
        { type: 'get', key: firstKey },
        { type: 'get', key: missingKey },
        { type: 'get', key: corruptKey }
      ]
    ])
    expect(onCorrupt).toHaveBeenCalledWith({ key: corruptKey, reason: 'encoding' })

    await expect(readLedgerValues({ redis, keys: [firstKey, otherWalletKey] })).rejects.toThrow(/same hashed wallet/i)
    expect(await readLedgerValues({ redis, keys: [] })).toEqual([])
    expect(redis.pipelineExecutions).toHaveLength(1)
  })

  it('writes a validated chunk and index batch in one Redis pipeline', async () => {
    const redis = new FakeLedgerStoreRedis()
    const chunkChecksum = testChecksum(1)
    const indexChecksum = testChecksum(2)
    const chunkKey = getLedgerChunkKey(WALLET_HASH, chunkChecksum)
    const indexKey = getLedgerIndexShardKey(WALLET_HASH, 3, indexChecksum)

    const result = await writeImmutableLedgerBlobs({
      redis,
      items: [
        { kind: 'chunk', key: chunkKey, checksum: chunkChecksum, value: 'encoded-chunk' },
        { kind: 'index', key: indexKey, checksum: indexChecksum, shard: 3, value: 'encoded-index' }
      ]
    })

    expect(result).toEqual([
      { kind: 'chunk', key: chunkKey, checksum: chunkChecksum, status: 'written' },
      { kind: 'index', key: indexKey, checksum: indexChecksum, status: 'written' }
    ])
    expect(redis.pipelineExecutions).toHaveLength(1)
    expect(
      redis.pipelineExecutions[0]?.map((command) =>
        command.type === 'set' ? { type: command.type, key: command.key, options: command.options } : command
      )
    ).toEqual([
      { type: 'set', key: chunkKey, options: { nx: true } },
      { type: 'set', key: indexKey, options: { nx: true } }
    ])
    expect(await readLedgerValue({ redis, key: chunkKey })).toEqual({ status: 'ok', value: 'encoded-chunk' })
    expect(await readLedgerValue({ redis, key: indexKey })).toEqual({ status: 'ok', value: 'encoded-index' })
    expect(redis.values.has(HEAD_KEY)).toBe(false)
    expect(redis.values.has(MANIFEST_ONE_KEY)).toBe(false)
  })

  it('verifies only pre-existing batch keys in one follow-up pipeline', async () => {
    const redis = new FakeLedgerStoreRedis()
    const sameChecksum = testChecksum(3)
    const conflictChecksum = testChecksum(4)
    const corruptChecksum = testChecksum(5)
    const newIndexChecksum = testChecksum(6)
    const sameKey = getLedgerChunkKey(WALLET_HASH, sameChecksum)
    const conflictKey = getLedgerChunkKey(WALLET_HASH, conflictChecksum)
    const corruptKey = getLedgerChunkKey(WALLET_HASH, corruptChecksum)
    const newIndexKey = getLedgerIndexShardKey(WALLET_HASH, 4, newIndexChecksum)
    await writeImmutableLedgerChunk({ redis, key: sameKey, value: 'same' })
    await writeImmutableLedgerChunk({ redis, key: conflictKey, value: 'old' })
    redis.values.set(corruptKey, 'not-an-opaque-ledger-value')

    const result = await writeImmutableLedgerBlobs({
      redis,
      items: [
        { kind: 'chunk', key: sameKey, checksum: sameChecksum, value: 'same' },
        { kind: 'chunk', key: conflictKey, checksum: conflictChecksum, value: 'new' },
        { kind: 'chunk', key: corruptKey, checksum: corruptChecksum, value: 'expected' },
        { kind: 'index', key: newIndexKey, checksum: newIndexChecksum, shard: 4, value: 'new-index' }
      ]
    })

    expect(result).toEqual([
      { kind: 'chunk', key: sameKey, checksum: sameChecksum, status: 'exists' },
      { kind: 'chunk', key: conflictKey, checksum: conflictChecksum, status: 'conflict' },
      { kind: 'chunk', key: corruptKey, checksum: corruptChecksum, status: 'corrupt' },
      { kind: 'index', key: newIndexKey, checksum: newIndexChecksum, status: 'written' }
    ])
    expect(redis.pipelineExecutions).toHaveLength(2)
    expect(redis.pipelineExecutions[1]).toEqual([
      { type: 'get', key: sameKey },
      { type: 'get', key: conflictKey },
      { type: 'get', key: corruptKey }
    ])
  })

  it('validates every batch item before creating a write pipeline', async () => {
    const redis = new FakeLedgerStoreRedis()
    const checksum = testChecksum(7)
    const otherChecksum = testChecksum(8)
    const chunkKey = getLedgerChunkKey(WALLET_HASH, checksum)
    const otherWalletHash = 'b'.repeat(64)

    await expect(
      writeImmutableLedgerBlobs({
        redis,
        items: [
          { kind: 'chunk', key: chunkKey, checksum, value: 'valid' },
          {
            kind: 'chunk',
            key: getLedgerChunkKey(WALLET_HASH, otherChecksum),
            checksum: otherChecksum,
            value: 'x'.repeat(LEDGER_MAX_ENCODED_CHUNK_BYTES + 1)
          }
        ]
      })
    ).rejects.toThrow('Immutable ledger chunk exceeds its encoded byte limit')
    await expect(
      writeImmutableLedgerBlobs({
        redis,
        items: [
          { kind: 'chunk', key: chunkKey, checksum, value: 'first' },
          { kind: 'chunk', key: chunkKey, checksum, value: 'second' }
        ]
      })
    ).rejects.toThrow('Immutable ledger blob keys must be unique')
    await expect(
      writeImmutableLedgerBlobs({
        redis,
        items: [
          { kind: 'chunk', key: chunkKey, checksum, value: 'first' },
          {
            kind: 'chunk',
            key: getLedgerChunkKey(otherWalletHash, otherChecksum),
            checksum: otherChecksum,
            value: 'second'
          }
        ]
      })
    ).rejects.toThrow('Ledger Redis keys must belong to the same hashed wallet')
    await expect(
      writeImmutableLedgerBlobs({
        redis,
        items: [{ kind: 'chunk', key: chunkKey, checksum: otherChecksum, value: 'mismatched' }]
      })
    ).rejects.toThrow('Immutable ledger chunk key does not match its checksum')
    await expect(
      writeImmutableLedgerBlobs({
        redis,
        items: [{ kind: 'chunk', key: chunkKey, checksum: 'not-a-checksum', value: 'invalid-checksum' }]
      })
    ).rejects.toThrow('Ledger content checksum must be a lowercase SHA-256 digest')
    await expect(
      writeImmutableLedgerBlobs({
        redis,
        items: [{ kind: 'chunk', key: MANIFEST_ONE_KEY, checksum, value: 'manifest' }]
      })
    ).rejects.toThrow('Immutable ledger chunk key does not match its checksum')

    expect(redis.pipelineExecutions).toEqual([])
    expect(redis.values.size).toBe(0)
  })

  it('rejects a combined blob batch above the active revision limit before writing', async () => {
    const redis = new FakeLedgerStoreRedis()
    const value = 'x'.repeat(LEDGER_MAX_ENCODED_CHUNK_BYTES)
    const itemCount = Math.floor(LEDGER_MAX_ACTIVE_REVISION_BYTES / LEDGER_MAX_ENCODED_CHUNK_BYTES) + 1
    const items = Array.from({ length: itemCount }, (_, index) => {
      const checksum = testChecksum(index + 16)
      return {
        kind: 'chunk' as const,
        key: getLedgerChunkKey(WALLET_HASH, checksum),
        checksum,
        value
      }
    })

    await expect(writeImmutableLedgerBlobs({ redis, items })).rejects.toThrow(
      'Immutable ledger blob batch exceeds the active revision byte limit'
    )
    expect(redis.pipelineExecutions).toEqual([])
    expect(redis.values.size).toBe(0)
  })

  it('sanitizes rejected immutable blob pipeline commands', async () => {
    const payload = 'private-batched-ledger-payload'
    const checksum = testChecksum(40)
    const key = getLedgerChunkKey(WALLET_HASH, checksum)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failingPipeline: TLedgerRedisPipeline = {
      get: () => failingPipeline,
      set: () => failingPipeline,
      exec: () => Promise.reject(new Error(`network failure, command was: ${payload}`))
    }
    const redis = {
      pipeline: () => failingPipeline
    } as unknown as TLedgerPipelineRedis

    await expect(
      writeImmutableLedgerBlobs({
        redis,
        items: [{ kind: 'chunk', key, checksum, value: 'safe-test-value' }]
      })
    ).rejects.toMatchObject({
      name: 'HoldingsLedgerRedisOperationError',
      message: 'Holdings ledger Redis write failed'
    })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(payload)
    errorSpy.mockRestore()
  })

  it('rejects corrupt data already stored under an immutable key', async () => {
    const redis = new FakeLedgerStoreRedis()
    const chunkKey = ledgerKey('chunk:corrupt')
    redis.values.set(chunkKey, '{"unwrapped":true}')

    expect(await writeImmutableLedgerChunk({ redis, key: chunkKey, value: '{"unwrapped":true}' })).toEqual({
      status: 'corrupt'
    })
  })

  it('validates checksums on the decoded payload before parsing it', async () => {
    const redis = new FakeLedgerStoreRedis()
    const payload = '{"schema":1}'
    const indexKey = ledgerKey('index:checksum')
    const validateChecksum = vi.fn((value: string) => value === payload)
    await writeImmutableLedgerIndexShard({ redis, key: indexKey, value: payload })

    const result = await readLedgerValue<{ schema: number }>({
      redis,
      key: indexKey,
      validateChecksum,
      parse: (value) => JSON.parse(value) as { schema: number }
    })

    expect(result).toEqual({ status: 'ok', value: { schema: 1 } })
    expect(validateChecksum).toHaveBeenCalledWith(payload)
  })

  it('reports checksum, parse, and non-opaque encoding corruption without throwing', async () => {
    const redis = new FakeLedgerStoreRedis()
    const onCorrupt = vi.fn()
    const badChecksumKey = ledgerKey('index:bad-checksum')
    const badJsonKey = ledgerKey('index:bad-json')
    const unwrappedKey = ledgerKey('index:unwrapped-json')
    await writeImmutableLedgerIndexShard({ redis, key: badChecksumKey, value: '{"schema":1}' })
    await writeImmutableLedgerIndexShard({ redis, key: badJsonKey, value: '{' })
    redis.values.set(unwrappedKey, '{"schema":1}')

    const checksumResult = await readLedgerValue({
      redis,
      key: badChecksumKey,
      validateChecksum: () => false,
      onCorrupt
    })
    const parseResult = await readLedgerValue({
      redis,
      key: badJsonKey,
      parse: (value) => JSON.parse(value),
      onCorrupt
    })
    const encodingResult = await readLedgerValue({ redis, key: unwrappedKey, onCorrupt })

    expect(checksumResult).toEqual({ status: 'corrupt', reason: 'checksum' })
    expect(parseResult).toEqual({ status: 'corrupt', reason: 'parse' })
    expect(encodingResult).toEqual({ status: 'corrupt', reason: 'encoding' })
    expect(onCorrupt).toHaveBeenNthCalledWith(1, { key: badChecksumKey, reason: 'checksum' })
    expect(onCorrupt).toHaveBeenNthCalledWith(2, { key: badJsonKey, reason: 'parse' })
    expect(onCorrupt).toHaveBeenNthCalledWith(3, { key: unwrappedKey, reason: 'encoding' })
  })

  it('writes mutable sync status only while the caller owns the canonical wallet lock', async () => {
    const redis = new FakeLedgerStoreRedis()
    const syncingStatus = createSyncStatus({ state: 'syncing', revision: null, updatedAtMs: 1_000 })
    const staleStatus = createSyncStatus({ state: 'failed', revision: null, updatedAtMs: 2_000 })
    redis.values.set(LOCK_KEY, 'worker-a:7')

    expect(
      await writeLedgerSyncStatus({
        redis,
        walletHash: WALLET_HASH,
        lock: LOCK,
        status: syncingStatus
      })
    ).toEqual({ status: 'written' })
    expect(
      await readLedgerValue({
        redis,
        key: SYNC_STATUS_KEY,
        parse: parseLedgerSyncStatus
      })
    ).toEqual({ status: 'ok', value: syncingStatus })

    redis.values.set(LOCK_KEY, 'worker-b:8')
    expect(
      await writeLedgerSyncStatus({
        redis,
        walletHash: WALLET_HASH,
        lock: LOCK,
        status: staleStatus
      })
    ).toEqual({ status: 'lock_lost' })
    expect(
      await readLedgerValue({
        redis,
        key: SYNC_STATUS_KEY,
        parse: parseLedgerSyncStatus
      })
    ).toEqual({ status: 'ok', value: syncingStatus })
  })

  it('atomically commits a manifest and preserves the prior head', async () => {
    const redis = new FakeLedgerStoreRedis()
    const firstRevision = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: 1_000
    })
    const secondRevision = createVerifiedEmptyRevision({
      revision: 'revision-2',
      parentRevision: 'revision-1',
      timestampMs: 2_000
    })
    const completeStatus = createSyncStatus({ state: 'complete', revision: 'revision-2', updatedAtMs: 2_000 })
    redis.values.set(LOCK_KEY, 'worker-a:7')

    const first = await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: null,
      revision: firstRevision
    })
    expect(redis.values.has(SYNC_STATUS_KEY)).toBe(false)
    const second = await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: firstRevision.head,
      revision: secondRevision,
      syncStatus: completeStatus
    })

    expect(first).toEqual({ status: 'committed', head: firstRevision.headValue, previousHead: null })
    expect(second).toEqual({
      status: 'committed',
      head: secondRevision.headValue,
      previousHead: firstRevision.headValue
    })
    expect(await readLedgerValue({ redis, key: HEAD_KEY })).toEqual({
      status: 'ok',
      value: secondRevision.headValue
    })
    expect(await readLedgerValue({ redis, key: PREVIOUS_HEAD_KEY })).toEqual({
      status: 'ok',
      value: firstRevision.headValue
    })
    expect(await readLedgerValue({ redis, key: MANIFEST_TWO_KEY })).toEqual({
      status: 'ok',
      value: secondRevision.manifestValue
    })
    expect(
      await readLedgerValue({
        redis,
        key: SYNC_STATUS_KEY,
        parse: parseLedgerSyncStatus
      })
    ).toEqual({ status: 'ok', value: completeStatus })

    redis.values.set(LOCK_KEY, 'worker-b:8')
    expect(
      await commitVerifiedLedgerRevision({
        redis,
        lock: LOCK,
        expectedHead: firstRevision.head,
        revision: secondRevision
      })
    ).toEqual({ status: 'already_committed', head: secondRevision.headValue })
    const staleCompleteStatus = createSyncStatus({
      state: 'complete',
      revision: 'revision-2',
      updatedAtMs: 9_000
    })
    expect(
      await commitVerifiedLedgerRevision({
        redis,
        lock: LOCK,
        expectedHead: firstRevision.head,
        revision: secondRevision,
        syncStatus: staleCompleteStatus
      })
    ).toEqual({ status: 'lock_lost' })
    expect(
      await readLedgerValue({
        redis,
        key: SYNC_STATUS_KEY,
        parse: parseLedgerSyncStatus
      })
    ).toEqual({ status: 'ok', value: completeStatus })
  })

  it('recovers a corrupt active head only from the exact fully verified previous revision under the lock', async () => {
    const redis = new FakeLedgerStoreRedis()
    const firstRevision = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: 1_000
    })
    const secondRevision = createVerifiedEmptyRevision({
      revision: 'revision-2',
      parentRevision: 'revision-1',
      timestampMs: 2_000
    })
    const recoveryStatus = createSyncStatus({ state: 'syncing', revision: 'revision-1', updatedAtMs: 3_000 })
    redis.values.set(LOCK_KEY, 'worker-a:7')
    await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: null,
      revision: firstRevision
    })
    await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: firstRevision.head,
      revision: secondRevision
    })
    const exactPreviousHead = redis.values.get(PREVIOUS_HEAD_KEY)
    redis.values.set(HEAD_KEY, 'corrupt-active-head')

    redis.values.set(LOCK_KEY, 'worker-b:8')
    expect(
      await recoverCorruptLedgerHeadFromPrevious({
        redis,
        lock: LOCK,
        previousRevision: firstRevision,
        syncStatus: recoveryStatus
      })
    ).toEqual({
      status: 'lock_lost'
    })
    expect(redis.values.get(HEAD_KEY)).toBe('corrupt-active-head')

    redis.values.set(LOCK_KEY, 'worker-a:7')
    redis.values.set(PREVIOUS_HEAD_KEY, 'changed-previous-head')
    expect(
      await recoverCorruptLedgerHeadFromPrevious({
        redis,
        lock: LOCK,
        previousRevision: firstRevision,
        syncStatus: recoveryStatus
      })
    ).toEqual({
      status: 'previous_changed'
    })
    expect(redis.values.get(HEAD_KEY)).toBe('corrupt-active-head')

    redis.values.set(PREVIOUS_HEAD_KEY, exactPreviousHead)
    expect(
      await recoverCorruptLedgerHeadFromPrevious({
        redis,
        lock: LOCK,
        previousRevision: firstRevision,
        syncStatus: recoveryStatus
      })
    ).toEqual({
      status: 'recovered'
    })
    expect(await readLedgerValue({ redis, key: HEAD_KEY })).toEqual({
      status: 'ok',
      value: firstRevision.headValue
    })
    expect(redis.values.has(PREVIOUS_HEAD_KEY)).toBe(false)
    expect(await readLedgerValue({ redis, key: SYNC_STATUS_KEY, parse: parseLedgerSyncStatus })).toEqual({
      status: 'ok',
      value: recoveryStatus
    })
  })

  it('does not synthesize an active head during recovery and rejects unverified rollback input', async () => {
    const redis = new FakeLedgerStoreRedis()
    const revision = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: 1_000
    })
    const recoveryStatus = createSyncStatus({ state: 'syncing', revision: 'revision-1', updatedAtMs: 2_000 })
    redis.values.set(LOCK_KEY, 'worker-a:7')
    redis.values.set(PREVIOUS_HEAD_KEY, 'opaque-previous-head')

    expect(
      await recoverCorruptLedgerHeadFromPrevious({
        redis,
        lock: LOCK,
        previousRevision: revision,
        syncStatus: recoveryStatus
      })
    ).toEqual({
      status: 'active_missing'
    })
    await expect(
      recoverCorruptLedgerHeadFromPrevious({
        redis,
        lock: LOCK,
        previousRevision: { ...revision } as TLedgerVerifiedRevisionV1,
        syncStatus: recoveryStatus
      })
    ).rejects.toThrow(/complete manifest-bound verification/i)
    await expect(
      recoverCorruptLedgerHeadFromPrevious({
        redis,
        lock: LOCK,
        previousRevision: revision,
        syncStatus: { ...recoveryStatus, revision: 'different-revision' }
      })
    ).rejects.toThrow(/sync status must track the verified previous revision/i)
    expect(redis.values.has(HEAD_KEY)).toBe(false)
  })

  it('returns typed commit failures without exposing an incomplete revision', async () => {
    const redis = new FakeLedgerStoreRedis()
    const firstRevision = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: 1_000
    })
    const secondRevision = createVerifiedEmptyRevision({
      revision: 'revision-2',
      parentRevision: 'revision-1',
      timestampMs: 2_000
    })
    redis.values.set(LOCK_KEY, 'worker-b:8')

    const lockLost = await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: null,
      revision: firstRevision
    })
    expect(redis.values.has(MANIFEST_ONE_KEY)).toBe(false)

    redis.values.set(LOCK_KEY, 'worker-a:7')
    await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: null,
      revision: firstRevision
    })
    const headConflict = await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: secondRevision.head,
      revision: secondRevision
    })
    expect(redis.values.has(MANIFEST_TWO_KEY)).toBe(false)

    redis.values.set(MANIFEST_TWO_KEY, 'already-present')
    const manifestExists = await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: firstRevision.head,
      revision: secondRevision
    })

    expect(lockLost).toEqual({ status: 'lock_lost' })
    expect(headConflict).toEqual({ status: 'head_conflict' })
    expect(manifestExists).toEqual({ status: 'manifest_exists' })
    expect(await readLedgerValue({ redis, key: HEAD_KEY })).toEqual({
      status: 'ok',
      value: firstRevision.headValue
    })
    expect(redis.values.has(PREVIOUS_HEAD_KEY)).toBe(false)
  })

  it('does not overwrite sync status when head CAS fails and rejects a mismatched complete status', async () => {
    const redis = new FakeLedgerStoreRedis()
    const firstRevision = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: 1_000
    })
    const secondRevision = createVerifiedEmptyRevision({
      revision: 'revision-2',
      parentRevision: 'revision-1',
      timestampMs: 2_000
    })
    const syncingStatus = createSyncStatus({ state: 'syncing', revision: 'revision-1', updatedAtMs: 1_500 })
    const completeStatus = createSyncStatus({ state: 'complete', revision: 'revision-2', updatedAtMs: 2_000 })
    redis.values.set(LOCK_KEY, 'worker-a:7')
    await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: null,
      revision: firstRevision
    })
    await writeLedgerSyncStatus({ redis, walletHash: WALLET_HASH, lock: LOCK, status: syncingStatus })

    expect(
      await commitVerifiedLedgerRevision({
        redis,
        lock: LOCK,
        expectedHead: secondRevision.head,
        revision: secondRevision,
        syncStatus: completeStatus
      })
    ).toEqual({ status: 'head_conflict' })
    expect(await readLedgerValue({ redis, key: SYNC_STATUS_KEY, parse: parseLedgerSyncStatus })).toEqual({
      status: 'ok',
      value: syncingStatus
    })

    await expect(
      commitVerifiedLedgerRevision({
        redis,
        lock: LOCK,
        expectedHead: firstRevision.head,
        revision: secondRevision,
        syncStatus: { ...completeStatus, revision: 'different-revision' }
      })
    ).rejects.toThrow(/must complete the verified revision/i)
    expect(redis.values.has(MANIFEST_TWO_KEY)).toBe(false)
    expect(await readLedgerValue({ redis, key: SYNC_STATUS_KEY, parse: parseLedgerSyncStatus })).toEqual({
      status: 'ok',
      value: syncingStatus
    })
  })

  it('rejects a spread copy of a verified revision before attempting head CAS', async () => {
    const redis = new FakeLedgerStoreRedis()
    const verified = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: 1_000
    })
    const forged = { ...verified } as TLedgerVerifiedRevisionV1

    await expect(
      commitVerifiedLedgerRevision({
        redis,
        lock: LOCK,
        expectedHead: null,
        revision: forged
      })
    ).rejects.toThrow(/complete manifest-bound verification/i)
    expect(redis.values.has(HEAD_KEY)).toBe(false)
    expect(redis.values.has(MANIFEST_ONE_KEY)).toBe(false)
  })

  it('rejects a stale writer after lock ownership advances without changing the ledger', async () => {
    const redis = new FakeLedgerStoreRedis()
    const staleRevision = createVerifiedEmptyRevision({
      revision: 'stale',
      parentRevision: null,
      timestampMs: 1_000
    })
    redis.values.set(LOCK_KEY, 'worker-b:8')

    const result = await commitVerifiedLedgerRevision({
      redis,
      lock: LOCK,
      expectedHead: null,
      revision: staleRevision
    })

    expect(result).toEqual({ status: 'lock_lost' })
    expect(redis.values.has(HEAD_KEY)).toBe(false)
    expect(redis.values.has(PREVIOUS_HEAD_KEY)).toBe(false)
    expect(redis.values.has(STALE_MANIFEST_KEY)).toBe(false)
  })

  it('rejects oversized chunks and invalid Redis script statuses', async () => {
    const redis = new FakeLedgerStoreRedis()
    const revision = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: 1_000
    })

    await expect(
      writeImmutableLedgerChunk({
        redis,
        key: ledgerKey('chunk:oversized'),
        value: 'x'.repeat(LEDGER_MAX_ENCODED_CHUNK_BYTES + 1)
      })
    ).rejects.toThrow('Immutable ledger chunk exceeds its encoded byte limit')

    const invalidRedis = {
      eval: () => Promise.resolve(null)
    }
    await expect(
      commitVerifiedLedgerRevision({
        redis: invalidRedis,
        lock: LOCK,
        expectedHead: null,
        revision
      })
    ).rejects.toThrow('Ledger head commit script returned an invalid status')
  })

  it('sanitizes rejected Redis commands at the store boundary', async () => {
    const payload = 'private-ledger-payload'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const redis = {
      get: () => Promise.resolve(null),
      set: () => Promise.reject(new Error(`network failure, command was: ${payload}`)),
      eval: () => Promise.resolve(0)
    } as unknown as TLedgerRedis

    await expect(
      writeImmutableLedgerChunk({ redis, key: ledgerKey('chunk:failed'), value: 'safe-test-value' })
    ).rejects.toMatchObject({
      name: 'HoldingsLedgerRedisOperationError',
      message: 'Holdings ledger Redis write failed'
    })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(payload)
    errorSpy.mockRestore()
  })
})
