import { createHash, randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createLedgerRevisionManifest,
  encodeLedgerIndexShards,
  parseLedgerSyncStatus,
  stringifyCanonicalLedgerValue,
  type TLedgerVerifiedRevisionV1,
  verifyLedgerRevision
} from '@/server/lib/holdings/services/ledger/codec'
import {
  getLedgerChunkKey,
  getLedgerFenceKey,
  getLedgerHeadKey,
  getLedgerIndexShardKey,
  getLedgerLockKey,
  getLedgerPreviousHeadKey,
  getLedgerRevisionManifestKey,
  getLedgerSnapshotKey,
  getLedgerSyncStatusKey
} from '@/server/lib/holdings/services/ledger/keys'
import { acquireLedgerLock, releaseLedgerLock } from '@/server/lib/holdings/services/ledger/lock'
import {
  createVerifiedLedgerSnapshot,
  loadVerifiedLedgerSnapshot
} from '@/server/lib/holdings/services/ledger/snapshot'
import {
  commitVerifiedLedgerRevision,
  readLedgerValue,
  recoverCorruptLedgerHeadFromPrevious,
  writeImmutableLedgerBlobs,
  writeImmutableLedgerChunk
} from '@/server/lib/holdings/services/ledger/store'
import {
  LEDGER_INDEX_SHARD_COUNT,
  LEDGER_SCHEMA_VERSION,
  LEDGER_STREAMS,
  type TLedgerStreamCoverageV1,
  type TStoredLedgerIndexShardV1
} from '@/server/lib/holdings/services/ledger/types'
import { getHoldingsLedgerRedisClient, handleHoldingsLedgerRedisError } from '@/server/lib/holdings/storage/ledgerRedis'

const integrationEnabled = process.env.RUN_HOLDINGS_LEDGER_REDIS_INTEGRATION === '1'
const integrationState = {
  redis: null as Redis | null,
  keys: [] as string[],
  stage: 'not-started'
}

function checksum(value: string): string {
  return createHash('sha256').update(value).digest('hex')
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
  walletHash: string
  revision: string
  parentRevision: string | null
  timestampMs: number
}): { readonly verified: TLedgerVerifiedRevisionV1; readonly indexes: readonly TStoredLedgerIndexShardV1[] } {
  const encodedIndexes = encodeLedgerIndexShards([])
  const manifest = createLedgerRevisionManifest({
    calculationVersion: 'integration-v1',
    walletHash: args.walletHash,
    sourceFingerprint: checksum('integration-source'),
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
  const indexes = encodedIndexes.map((index) => ({
    ...index,
    key: getLedgerIndexShardKey(args.walletHash, index.descriptor.shard, index.descriptor.checksum)
  }))
  return { verified: verifyLedgerRevision(manifest, [], indexes), indexes }
}

async function runRedisScenario(redis: Redis): Promise<void> {
  integrationState.stage = 'fixture-setup'
  const walletHash = checksum(`integration-wallet:${randomUUID()}`)
  const revisionOne = `integration-${randomUUID()}`
  const revisionTwo = `integration-${randomUUID()}`
  const revisionThree = `integration-${randomUUID()}`
  const lockKey = getLedgerLockKey(walletHash)
  const fenceKey = getLedgerFenceKey(walletHash)
  const headKey = getLedgerHeadKey(walletHash)
  const previousHeadKey = getLedgerPreviousHeadKey(walletHash)
  const syncStatusKey = getLedgerSyncStatusKey(walletHash)
  const manifestOneKey = getLedgerRevisionManifestKey(walletHash, 1, revisionOne)
  const manifestTwoKey = getLedgerRevisionManifestKey(walletHash, 1, revisionTwo)
  const manifestThreeKey = getLedgerRevisionManifestKey(walletHash, 1, revisionThree)
  const firstRevision = createVerifiedEmptyRevision({
    walletHash,
    revision: revisionOne,
    parentRevision: null,
    timestampMs: 1_000
  })
  const secondRevision = createVerifiedEmptyRevision({
    walletHash,
    revision: revisionTwo,
    parentRevision: revisionOne,
    timestampMs: 2_000
  })
  const thirdRevision = createVerifiedEmptyRevision({
    walletHash,
    revision: revisionThree,
    parentRevision: revisionOne,
    timestampMs: 3_000
  })
  const chunkPayload = JSON.stringify({ schemaVersion: 1, records: [['test']] })
  const chunkKey = getLedgerChunkKey(walletHash, checksum(chunkPayload))
  const corruptKey = getLedgerChunkKey(walletHash, checksum(`corrupt:${randomUUID()}`))
  const cleanupKeys = [
    lockKey,
    fenceKey,
    headKey,
    previousHeadKey,
    syncStatusKey,
    manifestOneKey,
    manifestTwoKey,
    manifestThreeKey,
    chunkKey,
    corruptKey
  ]
  integrationState.keys.push(...cleanupKeys)

  const batchMarker = randomUUID()
  const chunkItems = Array.from({ length: 100 }, (_, index) => {
    const value = `integration-batch-chunk:${batchMarker}:${index}`
    const itemChecksum = checksum(value)
    return {
      kind: 'chunk' as const,
      key: getLedgerChunkKey(walletHash, itemChecksum),
      checksum: itemChecksum,
      value
    }
  })
  const indexItems = firstRevision.indexes.map((index) => {
    return {
      kind: 'index' as const,
      key: index.key,
      checksum: index.descriptor.checksum,
      shard: index.descriptor.shard,
      value: index.data
    }
  })
  const batchItems = [...chunkItems, ...indexItems]
  integrationState.keys.push(...batchItems.map((item) => item.key))

  integrationState.stage = 'initial-blob-batch'
  const firstBatch = await writeImmutableLedgerBlobs({ redis, items: batchItems })
  expect(firstBatch).toHaveLength(100 + LEDGER_INDEX_SHARD_COUNT)
  expect(firstBatch.every((result) => result.status === 'written')).toBe(true)
  integrationState.stage = 'repeated-blob-batch'
  const repeatedBatch = await writeImmutableLedgerBlobs({ redis, items: batchItems })
  expect(repeatedBatch.every((result) => result.status === 'exists')).toBe(true)

  integrationState.stage = 'immutable-chunk'
  expect(await writeImmutableLedgerChunk({ redis, key: chunkKey, value: chunkPayload })).toEqual({
    status: 'written'
  })
  expect(await writeImmutableLedgerChunk({ redis, key: chunkKey, value: chunkPayload })).toEqual({ status: 'exists' })
  expect(await writeImmutableLedgerChunk({ redis, key: chunkKey, value: 'different' })).toEqual({ status: 'conflict' })
  expect(await readLedgerValue({ redis, key: chunkKey })).toEqual({ status: 'ok', value: chunkPayload })

  await redis.set(corruptKey, 'not-an-opaque-ledger-value')
  expect(await readLedgerValue({ redis, key: corruptKey })).toEqual({ status: 'corrupt', reason: 'encoding' })

  integrationState.stage = 'lock-race'
  const acquisitions = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      acquireLedgerLock({
        redis,
        lockKey,
        fenceKey,
        owner: `integration-race-${index}-${randomUUID()}`,
        ttlMs: 15_000
      })
    )
  )
  const acquired = acquisitions.filter((result) => result.status === 'acquired')
  expect(acquired).toHaveLength(1)
  expect(acquisitions.filter((result) => result.status === 'busy')).toHaveLength(3)
  const firstAcquire = acquired[0]
  if (firstAcquire?.status !== 'acquired') {
    throw new Error('Development Redis lock race did not produce one winner')
  }

  const headOne = firstRevision.verified.headValue
  const headTwo = secondRevision.verified.headValue
  integrationState.stage = 'initial-head-commit'
  expect(
    await commitVerifiedLedgerRevision({
      redis,
      lock: firstAcquire.lock,
      expectedHead: null,
      revision: firstRevision.verified
    })
  ).toEqual({ status: 'committed', head: headOne, previousHead: null })

  integrationState.stage = 'snapshot-pin'
  const snapshot = await createVerifiedLedgerSnapshot({
    redis,
    walletHash,
    expectedCalculationVersion: 'integration-v1',
    expectedChainIds: [1],
    latestSettledDayTimestamp: 1_699_920_000,
    eventUpperTimestamp: 1_700_000_100
  })
  expect(snapshot.status).toBe('ready')
  if (snapshot.status !== 'ready') {
    throw new Error('Development Redis snapshot pin did not resolve the active revision')
  }
  integrationState.keys.push(getLedgerSnapshotKey(walletHash, snapshot.pin.snapshotId))

  integrationState.stage = 'lock-expiry'
  expect(await redis.pexpire(lockKey, 1_000)).toBe(1)
  await new Promise((resolve) => setTimeout(resolve, 1_250))
  integrationState.stage = 'lock-reacquire'
  const secondAcquire = await acquireLedgerLock({
    redis,
    lockKey,
    fenceKey,
    owner: `integration-b-${randomUUID()}`,
    ttlMs: 15_000
  })
  expect(secondAcquire.status).toBe('acquired')
  if (secondAcquire.status !== 'acquired') {
    throw new Error('Development Redis lock reacquire failed')
  }
  expect(secondAcquire.lock.fence).toBeGreaterThan(firstAcquire.lock.fence)

  integrationState.stage = 'stale-writer-rejection'
  expect(
    await commitVerifiedLedgerRevision({
      redis,
      lock: firstAcquire.lock,
      expectedHead: firstRevision.verified.head,
      revision: secondRevision.verified
    })
  ).toEqual({ status: 'lock_lost' })
  expect(await readLedgerValue({ redis, key: manifestTwoKey })).toEqual({ status: 'missing' })
  expect(await readLedgerValue({ redis, key: headKey })).toEqual({ status: 'ok', value: headOne })

  integrationState.stage = 'head-conflict-rejection'
  expect(
    await commitVerifiedLedgerRevision({
      redis,
      lock: secondAcquire.lock,
      expectedHead: secondRevision.verified.head,
      revision: secondRevision.verified
    })
  ).toEqual({ status: 'head_conflict' })
  expect(await readLedgerValue({ redis, key: manifestTwoKey })).toEqual({ status: 'missing' })
  expect(await readLedgerValue({ redis, key: headKey })).toEqual({ status: 'ok', value: headOne })

  integrationState.stage = 'head-commit-race'
  const raceResults = await Promise.all([
    commitVerifiedLedgerRevision({
      redis,
      lock: secondAcquire.lock,
      expectedHead: firstRevision.verified.head,
      revision: secondRevision.verified
    }),
    commitVerifiedLedgerRevision({
      redis,
      lock: secondAcquire.lock,
      expectedHead: firstRevision.verified.head,
      revision: thirdRevision.verified
    })
  ])
  expect(raceResults.filter((result) => result.status === 'committed')).toHaveLength(1)

  integrationState.stage = 'snapshot-exact-head-read'
  const loadedSnapshot = await loadVerifiedLedgerSnapshot({
    redis,
    walletHash,
    snapshotId: snapshot.pin.snapshotId,
    expectedCalculationVersion: 'integration-v1',
    expectedChainIds: [1]
  })
  expect(loadedSnapshot.status).toBe('ready')
  if (loadedSnapshot.status !== 'ready') {
    throw new Error('Development Redis snapshot failed after the active head advanced')
  }
  expect(loadedSnapshot.head.revision).toBe(revisionOne)
  expect(raceResults.filter((result) => result.status === 'head_conflict')).toHaveLength(1)
  const committed = raceResults.find((result) => result.status === 'committed')
  if (committed?.status !== 'committed') {
    throw new Error('Development Redis head race did not produce one winner')
  }
  const winningHead = committed.head
  const losingManifestKey = winningHead === headTwo ? manifestThreeKey : manifestTwoKey

  expect(await readLedgerValue({ redis, key: headKey })).toEqual({ status: 'ok', value: winningHead })
  expect(await readLedgerValue({ redis, key: previousHeadKey })).toEqual({ status: 'ok', value: headOne })
  expect(await readLedgerValue({ redis, key: losingManifestKey })).toEqual({ status: 'missing' })

  integrationState.stage = 'head-recovery'
  await redis.set(headKey, 'corrupt-active-head')
  const recoveryStatus = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    state: 'syncing' as const,
    sourceGeneration: 1,
    revision: revisionOne,
    reasonCode: null,
    updatedAtMs: Date.now()
  }
  expect(
    await recoverCorruptLedgerHeadFromPrevious({
      redis,
      lock: secondAcquire.lock,
      previousRevision: firstRevision.verified,
      syncStatus: recoveryStatus
    })
  ).toEqual({ status: 'recovered' })
  expect(await readLedgerValue({ redis, key: headKey })).toEqual({ status: 'ok', value: headOne })
  expect(await readLedgerValue({ redis, key: previousHeadKey })).toEqual({ status: 'missing' })
  expect(await readLedgerValue({ redis, key: syncStatusKey, parse: parseLedgerSyncStatus })).toEqual({
    status: 'ok',
    value: recoveryStatus
  })
  integrationState.stage = 'lock-release'
  expect(await releaseLedgerLock({ redis, lockKey, lock: secondAcquire.lock })).toEqual({ status: 'released' })
  integrationState.stage = 'complete'
}

describe.runIf(integrationEnabled)('development Redis ledger integration', () => {
  afterAll(async () => {
    if (!integrationState.redis || integrationState.keys.length === 0) {
      return
    }

    try {
      const cleanupKeys = Array.from(new Set(integrationState.keys))
      await integrationState.redis.del(...cleanupKeys)
      expect(await integrationState.redis.exists(...cleanupKeys)).toBe(0)
    } catch (error) {
      handleHoldingsLedgerRedisError('cleanup', error)
      throw new Error('Development Redis ledger cleanup failed')
    }
  })

  it('enforces batched immutability, concurrent fencing/CAS, and atomic previous-head recovery', async () => {
    const redis = getHoldingsLedgerRedisClient()
    expect(redis).not.toBeNull()
    if (!redis) {
      throw new Error('Development Redis is not configured')
    }
    integrationState.redis = redis

    try {
      await runRedisScenario(redis)
    } catch (error) {
      handleHoldingsLedgerRedisError('initialization', error)
      throw new Error(`Development Redis ledger integration failed at ${integrationState.stage}`)
    }
  }, 30_000)
})
