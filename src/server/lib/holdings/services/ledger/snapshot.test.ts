import { createHash } from 'node:crypto'
import type { SetCommandOptions } from '@upstash/redis'
import { describe, expect, it } from 'vitest'
import {
  createLedgerRevisionManifest,
  encodeLedgerIndexShards,
  isLedgerSnapshotId,
  parseLedgerSnapshotPin,
  stringifyCanonicalLedgerValue,
  verifyLedgerRevision
} from '@/server/lib/holdings/services/ledger/codec'
import {
  getLedgerHeadKey,
  getLedgerIndexShardKey,
  getLedgerSnapshotKey
} from '@/server/lib/holdings/services/ledger/keys'
import {
  createLedgerSnapshotId,
  createVerifiedLedgerSnapshot,
  createVerifiedLedgerSnapshotFromSynchronizedRevision,
  loadVerifiedLedgerSnapshot
} from '@/server/lib/holdings/services/ledger/snapshot'
import {
  type TLedgerPipelineRedis,
  type TLedgerRedisPipeline,
  writeLedgerSnapshotPin
} from '@/server/lib/holdings/services/ledger/store'
import {
  LEDGER_SNAPSHOT_TTL_SECONDS,
  LEDGER_STREAMS,
  type TLedgerSnapshotPinV1,
  type TLedgerStreamCoverageV1,
  type TStoredLedgerIndexShardV1
} from '@/server/lib/holdings/services/ledger/types'

const WALLET_HASH = createHash('sha256').update('snapshot-test-wallet').digest('hex')
const OTHER_WALLET_HASH = createHash('sha256').update('snapshot-test-other-wallet').digest('hex')
const OPAQUE_PREFIX = 'holdings-ledger:opaque:v1:'
const CALCULATION_VERSION = 'snapshot-test-v1'
const LATEST_SETTLED_DAY_TIMESTAMP = Math.floor(Date.UTC(2027, 0, 15) / 1000)
const EVENT_UPPER_TIMESTAMP = LATEST_SETTLED_DAY_TIMESTAMP + 24 * 60 * 60
const NOW_MS = (EVENT_UPPER_TIMESTAMP + 60) * 1000

type TPipelineCommand = Readonly<{ type: 'get'; key: string }>

class FakeSnapshotRedis implements TLedgerPipelineRedis {
  readonly values = new Map<string, unknown>()
  readonly setOptions = new Map<string, SetCommandOptions | undefined>()
  readonly getKeys: string[] = []

  get<TData>(key: string): Promise<TData | null> {
    this.getKeys.push(key)
    return Promise.resolve((this.values.get(key) as TData | undefined) ?? null)
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
      set: () => {
        throw new Error('Snapshot revision reads do not issue pipeline writes')
      },
      exec: async <TResults extends unknown[] = unknown[]>() => {
        const results = await Promise.all(commands.map((command) => this.get<unknown>(command.key)))
        return results as TResults
      }
    }
    return pipeline
  }

  eval<TArgs extends unknown[], TData = unknown>(_script: string, _keys: string[], _args: TArgs): Promise<TData> {
    return Promise.reject(new Error('Snapshot tests do not execute ledger scripts'))
  }
}

function checksum(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function createEmptyCoverage(chainId = 1): TLedgerStreamCoverageV1[] {
  return LEDGER_STREAMS.map((stream) => ({
    stream,
    chainId,
    status: 'valid_empty',
    coverageStartTimestamp: 0,
    completeThroughTimestamp: EVENT_UPPER_TIMESTAMP,
    coverageStartBlock: 1,
    completeThroughBlock: 30_000_000,
    cursor: null,
    checkpoint: null,
    checkpointState: 'unpinned',
    count: 0,
    checksum: checksum(stringifyCanonicalLedgerValue([stream, chainId, []]))
  }))
}

function createVerifiedEmptyRevision(args: {
  revision: string
  parentRevision: string | null
  calculationVersion?: string
  chainScope?: readonly number[]
  timestampMs: number
}) {
  const chainScope = args.chainScope ?? [1]
  const indexes = encodeLedgerIndexShards([])
  const manifest = createLedgerRevisionManifest({
    calculationVersion: args.calculationVersion ?? CALCULATION_VERSION,
    walletHash: WALLET_HASH,
    sourceFingerprint: checksum('snapshot-test-source'),
    sourceGeneration: 1,
    revision: args.revision,
    parentRevision: args.parentRevision,
    chainScope,
    coverage: chainScope.flatMap((chainId) => createEmptyCoverage(chainId)),
    chunks: [],
    indexes,
    dependencies: [],
    invalidationEpochs: { global: 0, source: 0, address: 0, vault: 0, schema: 0, metadata: 0 },
    dirtyFromTimestamp: null,
    dirtyFromDate: null,
    dirtyReasons: [],
    createdAtMs: args.timestampMs,
    updatedAtMs: args.timestampMs,
    reconciledAtMs: args.timestampMs
  })
  const storedIndexes: TStoredLedgerIndexShardV1[] = indexes.map((index) => ({
    ...index,
    key: getLedgerIndexShardKey(WALLET_HASH, index.descriptor.shard, index.descriptor.checksum)
  }))
  return {
    verified: verifyLedgerRevision(manifest, [], storedIndexes),
    indexes: storedIndexes
  }
}

function installRevision(
  redis: FakeSnapshotRedis,
  fixture: ReturnType<typeof createVerifiedEmptyRevision>,
  installHead: boolean
): void {
  if (installHead) {
    redis.values.set(getLedgerHeadKey(WALLET_HASH), `${OPAQUE_PREFIX}${fixture.verified.headValue}`)
  }
  redis.values.set(fixture.verified.head.manifestKey, `${OPAQUE_PREFIX}${fixture.verified.manifestValue}`)
  fixture.indexes.forEach((index) => {
    redis.values.set(index.key, `${OPAQUE_PREFIX}${index.data}`)
  })
}

describe('verified ledger snapshots', () => {
  it('generates only strict server-issued snapshot ids', () => {
    const ids = Array.from({ length: 16 }, () => createLedgerSnapshotId())

    expect(ids.every(isLedgerSnapshotId)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(isLedgerSnapshotId('request_01')).toBe(false)
    expect(isLedgerSnapshotId('snapshot_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe(false)
  })

  it('pins a fully verified revision with a fixed cutoff and a 30 minute NX/EX lifetime', async () => {
    const redis = new FakeSnapshotRedis()
    const fixture = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: NOW_MS - 1_000
    })
    installRevision(redis, fixture, true)

    const result = await createVerifiedLedgerSnapshot({
      redis,
      walletHash: WALLET_HASH,
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
      eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
      nowMs: NOW_MS
    })

    expect(result).toMatchObject({
      status: 'ready',
      headSource: 'active',
      manifest: { revision: 'revision-1' },
      pin: {
        snapshotVersion: 1,
        latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
        eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
        createdAtMs: NOW_MS,
        expiresAtMs: NOW_MS + LEDGER_SNAPSHOT_TTL_SECONDS * 1000
      }
    })
    if (result.status !== 'ready') {
      throw new Error('Expected a ready ledger snapshot')
    }
    const snapshotKey = getLedgerSnapshotKey(WALLET_HASH, result.pin.snapshotId)
    expect(redis.setOptions.get(snapshotKey)).toEqual({ nx: true, ex: LEDGER_SNAPSHOT_TTL_SECONDS })
    expect(parseLedgerSnapshotPin(String(redis.values.get(snapshotKey)).slice(OPAQUE_PREFIX.length))).toEqual(
      result.pin
    )
    await expect(writeLedgerSnapshotPin({ redis, walletHash: WALLET_HASH, pin: result.pin })).resolves.toEqual({
      status: 'exists'
    })
  })

  it('pins an in-memory verified revision without rereading its head, manifest, or blobs', async () => {
    const redis = new FakeSnapshotRedis()
    const fixture = createVerifiedEmptyRevision({
      revision: 'revision-direct',
      parentRevision: null,
      timestampMs: NOW_MS - 1_000
    })

    installRevision(redis, fixture, true)
    redis.getKeys.length = 0

    const result = await createVerifiedLedgerSnapshotFromSynchronizedRevision({
      redis,
      walletHash: WALLET_HASH,
      verifiedRevision: fixture.verified,
      headSource: 'active',
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
      eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
      nowMs: NOW_MS
    })

    expect(result).toMatchObject({ status: 'ready', head: { revision: 'revision-direct' } })
    if (result.status !== 'ready') {
      throw new Error('Expected a ready direct ledger snapshot')
    }
    expect(redis.getKeys).toEqual([getLedgerSnapshotKey(WALLET_HASH, result.pin.snapshotId)])
  })

  it('pins the supplied verified revision even when the active head has already advanced', async () => {
    const redis = new FakeSnapshotRedis()
    const first = createVerifiedEmptyRevision({
      revision: 'revision-direct-1',
      parentRevision: null,
      timestampMs: NOW_MS - 2_000
    })
    const second = createVerifiedEmptyRevision({
      revision: 'revision-direct-2',
      parentRevision: 'revision-direct-1',
      timestampMs: NOW_MS - 1_000
    })
    installRevision(redis, first, false)
    installRevision(redis, second, true)

    const created = await createVerifiedLedgerSnapshotFromSynchronizedRevision({
      redis,
      walletHash: WALLET_HASH,
      verifiedRevision: first.verified,
      headSource: 'active',
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
      eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
      nowMs: NOW_MS
    })
    if (created.status !== 'ready') {
      throw new Error('Expected a ready direct ledger snapshot')
    }

    const loaded = await loadVerifiedLedgerSnapshot({
      redis,
      walletHash: WALLET_HASH,
      snapshotId: created.pin.snapshotId,
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      nowMs: NOW_MS + 1
    })

    expect(created.head.revision).toBe('revision-direct-1')
    expect(loaded).toMatchObject({ status: 'ready', head: { revision: 'revision-direct-1' } })
  })

  it('caps last-known-good cutoffs at the verified revision update time', async () => {
    const redis = new FakeSnapshotRedis()
    const staleRevisionUpperTimestamp = LATEST_SETTLED_DAY_TIMESTAMP - 2 * 24 * 60 * 60 + 12 * 60 * 60
    const fixture = createVerifiedEmptyRevision({
      revision: 'revision-stale',
      parentRevision: null,
      timestampMs: staleRevisionUpperTimestamp * 1000
    })
    installRevision(redis, fixture, true)

    const result = await createVerifiedLedgerSnapshot({
      redis,
      walletHash: WALLET_HASH,
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
      eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
      nowMs: NOW_MS
    })

    expect(result).toMatchObject({
      status: 'ready',
      pin: {
        eventUpperTimestamp: staleRevisionUpperTimestamp,
        latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP - 3 * 24 * 60 * 60
      }
    })
  })

  it('loads the pinned immutable revision after the active head advances', async () => {
    const redis = new FakeSnapshotRedis()
    const first = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: NOW_MS - 2_000
    })
    const second = createVerifiedEmptyRevision({
      revision: 'revision-2',
      parentRevision: 'revision-1',
      timestampMs: NOW_MS - 1_000
    })
    installRevision(redis, first, true)
    const created = await createVerifiedLedgerSnapshot({
      redis,
      walletHash: WALLET_HASH,
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
      eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
      nowMs: NOW_MS
    })
    if (created.status !== 'ready') {
      throw new Error('Expected a ready ledger snapshot')
    }
    installRevision(redis, second, true)

    const loaded = await loadVerifiedLedgerSnapshot({
      redis,
      walletHash: WALLET_HASH,
      snapshotId: created.pin.snapshotId,
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      nowMs: NOW_MS + 1
    })

    expect(loaded).toMatchObject({
      status: 'ready',
      headSource: 'active',
      head: { revision: 'revision-1' },
      manifest: { revision: 'revision-1' },
      pin: created.pin
    })
  })

  it('fails closed for missing, corrupt, expired, and foreign-wallet pins', async () => {
    const redis = new FakeSnapshotRedis()
    const fixture = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: NOW_MS - 1_000
    })
    installRevision(redis, fixture, true)
    const created = await createVerifiedLedgerSnapshot({
      redis,
      walletHash: WALLET_HASH,
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
      eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
      nowMs: NOW_MS
    })
    if (created.status !== 'ready') {
      throw new Error('Expected a ready ledger snapshot')
    }
    const missingId = createLedgerSnapshotId()
    const corruptId = createLedgerSnapshotId()
    redis.values.set(getLedgerSnapshotKey(WALLET_HASH, corruptId), '{}')
    redis.values.set(
      getLedgerSnapshotKey(OTHER_WALLET_HASH, created.pin.snapshotId),
      redis.values.get(getLedgerSnapshotKey(WALLET_HASH, created.pin.snapshotId))
    )

    const common = {
      redis,
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1]
    } as const
    await expect(
      loadVerifiedLedgerSnapshot({ ...common, walletHash: WALLET_HASH, snapshotId: missingId, nowMs: NOW_MS })
    ).resolves.toEqual({ status: 'missing' })
    await expect(
      loadVerifiedLedgerSnapshot({ ...common, walletHash: WALLET_HASH, snapshotId: corruptId, nowMs: NOW_MS })
    ).resolves.toEqual({ status: 'corrupt' })
    await expect(
      loadVerifiedLedgerSnapshot({
        ...common,
        walletHash: WALLET_HASH,
        snapshotId: created.pin.snapshotId,
        nowMs: created.pin.expiresAtMs
      })
    ).resolves.toEqual({ status: 'expired' })
    await expect(
      loadVerifiedLedgerSnapshot({
        ...common,
        walletHash: OTHER_WALLET_HASH,
        snapshotId: created.pin.snapshotId,
        nowMs: NOW_MS
      })
    ).resolves.toEqual({ status: 'corrupt' })
  })

  it('fails closed when an immutable object referenced by the pinned revision disappears', async () => {
    const redis = new FakeSnapshotRedis()
    const fixture = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: NOW_MS - 1_000
    })
    installRevision(redis, fixture, true)
    const created = await createVerifiedLedgerSnapshot({
      redis,
      walletHash: WALLET_HASH,
      expectedCalculationVersion: CALCULATION_VERSION,
      expectedChainIds: [1],
      latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
      eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
      nowMs: NOW_MS
    })
    if (created.status !== 'ready') {
      throw new Error('Expected a ready ledger snapshot')
    }
    redis.values.delete(fixture.indexes[0]?.key as string)

    await expect(
      loadVerifiedLedgerSnapshot({
        redis,
        walletHash: WALLET_HASH,
        snapshotId: created.pin.snapshotId,
        expectedCalculationVersion: CALCULATION_VERSION,
        expectedChainIds: [1],
        nowMs: NOW_MS + 1
      })
    ).resolves.toEqual({ status: 'corrupt' })
  })

  it('rejects calculation and chain incompatibility without publishing a usable snapshot', async () => {
    const redis = new FakeSnapshotRedis()
    const fixture = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: NOW_MS - 1_000
    })
    installRevision(redis, fixture, true)

    await expect(
      createVerifiedLedgerSnapshot({
        redis,
        walletHash: WALLET_HASH,
        expectedCalculationVersion: 'different-calculation',
        expectedChainIds: [1],
        latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
        eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
        nowMs: NOW_MS
      })
    ).resolves.toEqual({ status: 'incompatible', reason: 'calculation_version' })
    await expect(
      createVerifiedLedgerSnapshot({
        redis,
        walletHash: WALLET_HASH,
        expectedCalculationVersion: CALCULATION_VERSION,
        expectedChainIds: [1, 10],
        latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
        eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
        nowMs: NOW_MS
      })
    ).resolves.toEqual({ status: 'incompatible', reason: 'chain_scope' })
    expect(Array.from(redis.values.keys()).filter((key) => key.includes(':snapshot:'))).toEqual([])
  })

  it('rejects non-canonical or malformed snapshot pin payloads', () => {
    const fixture = createVerifiedEmptyRevision({
      revision: 'revision-1',
      parentRevision: null,
      timestampMs: NOW_MS - 1_000
    })
    const pin: TLedgerSnapshotPinV1 = {
      snapshotVersion: 1,
      snapshotId: createLedgerSnapshotId(),
      headSource: 'active',
      head: fixture.verified.head,
      latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
      eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
      createdAtMs: NOW_MS,
      expiresAtMs: NOW_MS + LEDGER_SNAPSHOT_TTL_SECONDS * 1000
    }
    const canonical = stringifyCanonicalLedgerValue(pin)

    expect(parseLedgerSnapshotPin(canonical)).toEqual(pin)
    expect(() => parseLedgerSnapshotPin(JSON.stringify(pin))).toThrow(/canonical/i)
    expect(() => parseLedgerSnapshotPin(stringifyCanonicalLedgerValue({ ...pin, snapshotId: 'request_01' }))).toThrow(
      /snapshot id/i
    )
    expect(() =>
      parseLedgerSnapshotPin(stringifyCanonicalLedgerValue({ ...pin, expiresAtMs: pin.expiresAtMs + 1 }))
    ).toThrow(/TTL/i)
    expect(() =>
      parseLedgerSnapshotPin(
        stringifyCanonicalLedgerValue({ ...pin, latestSettledDayTimestamp: pin.latestSettledDayTimestamp + 1 })
      )
    ).toThrow(/UTC-day aligned/i)
    expect(() => parseLedgerSnapshotPin(stringifyCanonicalLedgerValue({ ...pin, unsupported: true }))).toThrow(
      /unsupported or missing fields/i
    )
  })
})
