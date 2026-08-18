import type { SetCommandOptions } from '@upstash/redis'
import {
  getVerifiedLedgerRevisionValues,
  isLedgerSnapshotId,
  parseLedgerSnapshotPin,
  stringifyCanonicalLedgerValue,
  type TLedgerVerifiedRevisionV1,
  validateLedgerHead,
  validateLedgerSnapshotPin,
  validateLedgerSyncStatus
} from '@/server/lib/holdings/services/ledger/codec'
import { assertLedgerKeysShareWalletScope } from '@/server/lib/holdings/services/ledger/keyScope'
import {
  getLedgerChunkKey,
  getLedgerHeadKey,
  getLedgerIndexShardKey,
  getLedgerLockKey,
  getLedgerPreviousHeadKey,
  getLedgerRevisionManifestKey,
  getLedgerSnapshotKey,
  getLedgerSyncStatusKey
} from '@/server/lib/holdings/services/ledger/keys'
import {
  getLedgerLockToken,
  type TLedgerLock,
  type TLedgerScriptRedis
} from '@/server/lib/holdings/services/ledger/lock'
import {
  LEDGER_MAX_ACTIVE_REVISION_BYTES,
  LEDGER_MAX_ENCODED_CHUNK_BYTES,
  LEDGER_MAX_ENCODED_INDEX_SHARD_BYTES,
  LEDGER_MAX_HEAD_BYTES,
  LEDGER_MAX_MANIFEST_BYTES,
  LEDGER_MAX_SNAPSHOT_PIN_BYTES,
  LEDGER_SNAPSHOT_TTL_SECONDS,
  type TLedgerHeadV1,
  type TLedgerSnapshotPinV1,
  type TLedgerSyncStatusV1
} from '@/server/lib/holdings/services/ledger/types'
import { executeHoldingsLedgerRedisOperation } from '@/server/lib/holdings/storage/ledgerRedis'

export interface TLedgerRedis extends TLedgerScriptRedis {
  get<TData>(key: string): Promise<TData | null>
  set<TData>(key: string, value: TData, options?: SetCommandOptions): Promise<'OK' | TData | null>
}

export interface TLedgerRedisPipeline {
  get<_TData>(key: string): TLedgerRedisPipeline
  set<TData>(key: string, value: TData, options?: SetCommandOptions): TLedgerRedisPipeline
  exec<TResults extends unknown[] = unknown[]>(): Promise<TResults>
}

export interface TLedgerPipelineRedis extends TLedgerRedis {
  pipeline(): TLedgerRedisPipeline
}

export type TImmutableLedgerWriteResult =
  | { status: 'written' }
  | { status: 'exists' }
  | { status: 'conflict' }
  | { status: 'corrupt' }

export type TImmutableLedgerBlobWriteItem =
  | Readonly<{ kind: 'chunk'; key: string; checksum: string; value: string }>
  | Readonly<{ kind: 'index'; key: string; checksum: string; shard: number; value: string }>

export type TImmutableLedgerBlobWriteResult = Readonly<{
  kind: TImmutableLedgerBlobWriteItem['kind']
  key: string
  checksum: string
  status: TImmutableLedgerWriteResult['status']
}>

export type TLedgerCorruptionReason = 'encoding' | 'checksum' | 'parse'

export interface TLedgerCorruption {
  key: string
  reason: TLedgerCorruptionReason
}

export type TLedgerReadResult<TValue> =
  | { status: 'ok'; value: TValue }
  | { status: 'missing' }
  | { status: 'corrupt'; reason: TLedgerCorruptionReason }

export type TCommitLedgerHeadResult =
  | { status: 'committed'; head: string; previousHead: string | null }
  | { status: 'already_committed'; head: string }
  | { status: 'lock_lost' }
  | { status: 'head_conflict' }
  | { status: 'manifest_exists' }

export type TWriteLedgerSyncStatusResult = { status: 'written' } | { status: 'lock_lost' }

export type TWriteLedgerSnapshotPinResult = { status: 'written' } | { status: 'exists' } | { status: 'corrupt' }

export type TLedgerSnapshotPinReadResult =
  | { status: 'ok'; pin: TLedgerSnapshotPinV1 }
  | { status: 'missing' }
  | { status: 'corrupt' }

export type TRecoverCorruptLedgerHeadResult =
  | { status: 'recovered' }
  | { status: 'lock_lost' }
  | { status: 'active_missing' }
  | { status: 'previous_changed' }

// Upstash automatically JSON-decodes GET/EVAL results. Prefixing keeps JSON-looking
// application payloads opaque and lets reads reject values written outside this store.
const LEDGER_VALUE_PREFIX = 'holdings-ledger:opaque:v1:'

const COMMIT_LEDGER_HEAD_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-ledger-head-commit-v1
local currentHead = redis.call('GET', KEYS[2])
local currentManifest = redis.call('GET', KEYS[4])
local writesSyncStatus = ARGV[6] == '1'

if currentHead == ARGV[4] and currentManifest == ARGV[5] then
  if writesSyncStatus then
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then
      return 1
    end
    redis.call('SET', KEYS[5], ARGV[7])
  end
  return 4
end

if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 1
end

local expectsHead = ARGV[2] == '1'

if expectsHead then
  if not currentHead or currentHead ~= ARGV[3] then
    return 2
  end
elseif currentHead then
  return 2
end

local manifestStored = redis.call('SET', KEYS[4], ARGV[5], 'NX')
if not manifestStored then
  return 3
end

if currentHead then
  redis.call('SET', KEYS[3], currentHead)
else
  redis.call('DEL', KEYS[3])
end

redis.call('SET', KEYS[2], ARGV[4])
if writesSyncStatus then
  redis.call('SET', KEYS[5], ARGV[7])
end
return 0
`

const WRITE_LEDGER_SYNC_STATUS_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-ledger-sync-status-write-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end

redis.call('SET', KEYS[2], ARGV[2])
return 1
`

const RECOVER_CORRUPT_LEDGER_HEAD_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-ledger-head-recovery-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 1
end

if not redis.call('GET', KEYS[2]) then
  return 2
end

local previousHead = redis.call('GET', KEYS[3])
if not previousHead or previousHead ~= ARGV[2] then
  return 3
end

redis.call('SET', KEYS[2], previousHead)
redis.call('DEL', KEYS[3])
redis.call('SET', KEYS[4], ARGV[3])
return 0
`

type TDecodedLedgerValue = { status: 'ok'; value: string } | { status: 'corrupt' }

type TPreparedImmutableLedgerBlob = Readonly<{
  item: TImmutableLedgerBlobWriteItem
  encodedValue: string
  encodedBytes: number
}>

function assertNonEmpty(value: string, label: string): void {
  if (value.length === 0) {
    throw new Error(`${label} must not be empty`)
  }
}

function encodeLedgerValue(value: string): string {
  return `${LEDGER_VALUE_PREFIX}${value}`
}

function decodeLedgerValue(value: unknown): TDecodedLedgerValue {
  return typeof value === 'string' && value.startsWith(LEDGER_VALUE_PREFIX)
    ? { status: 'ok', value: value.slice(LEDGER_VALUE_PREFIX.length) }
    : { status: 'corrupt' }
}

function assertEncodedSize(value: string, maximumBytes: number, label: string): void {
  assertNonEmpty(value, label)
  if (Buffer.byteLength(value, 'utf8') > maximumBytes) {
    throw new Error(`${label} exceeds its encoded byte limit`)
  }
}

function classifyExistingImmutableLedgerValue(existing: unknown, expectedValue: string): TImmutableLedgerWriteResult {
  if (existing === null) {
    return { status: 'conflict' }
  }

  const decoded = decodeLedgerValue(existing)
  if (decoded.status === 'corrupt') {
    return { status: 'corrupt' }
  }

  return decoded.value === expectedValue ? { status: 'exists' } : { status: 'conflict' }
}

function getImmutableLedgerBlobMaximumBytes(item: TImmutableLedgerBlobWriteItem): number {
  return item.kind === 'chunk' ? LEDGER_MAX_ENCODED_CHUNK_BYTES : LEDGER_MAX_ENCODED_INDEX_SHARD_BYTES
}

function getExpectedImmutableLedgerBlobKey(walletHash: string, item: TImmutableLedgerBlobWriteItem): string {
  return item.kind === 'chunk'
    ? getLedgerChunkKey(walletHash, item.checksum)
    : getLedgerIndexShardKey(walletHash, item.shard, item.checksum)
}

function prepareImmutableLedgerBlobs(items: readonly TImmutableLedgerBlobWriteItem[]): TPreparedImmutableLedgerBlob[] {
  if (items.length === 0) {
    return []
  }

  const keys = items.map((item) => item.key)
  const walletHash = assertLedgerKeysShareWalletScope(keys)
  if (new Set(keys).size !== keys.length) {
    throw new Error('Immutable ledger blob keys must be unique')
  }

  const prepared = items.map((item) => {
    const label = item.kind === 'chunk' ? 'Immutable ledger chunk' : 'Immutable ledger index shard'
    assertEncodedSize(item.value, getImmutableLedgerBlobMaximumBytes(item), label)
    if (item.key !== getExpectedImmutableLedgerBlobKey(walletHash, item)) {
      throw new Error(`Immutable ledger ${item.kind} key does not match its checksum`)
    }

    return {
      item,
      encodedValue: encodeLedgerValue(item.value),
      encodedBytes: Buffer.byteLength(item.value, 'utf8')
    }
  })
  const batchEncodedBytes = prepared.reduce((total, blob) => total + blob.encodedBytes, 0)
  if (batchEncodedBytes > LEDGER_MAX_ACTIVE_REVISION_BYTES) {
    throw new Error('Immutable ledger blob batch exceeds the active revision byte limit')
  }

  return prepared
}

function assertPipelineResultCount(results: readonly unknown[], expectedCount: number, label: string): void {
  if (results.length !== expectedCount) {
    throw new Error(`${label} returned an unexpected result count`)
  }
}

async function notifyLedgerCorruption(
  onCorrupt: ((corruption: TLedgerCorruption) => void | Promise<void>) | undefined,
  corruption: TLedgerCorruption
): Promise<void> {
  if (!onCorrupt) {
    return
  }

  try {
    await onCorrupt(corruption)
  } catch {
    // Observability/fallback hooks must not turn a safe corrupt read into a thrown request.
  }
}

async function createCorruptReadResult<TValue>(args: {
  key: string
  reason: TLedgerCorruptionReason
  onCorrupt?: (corruption: TLedgerCorruption) => void | Promise<void>
}): Promise<TLedgerReadResult<TValue>> {
  const corruption: TLedgerCorruption = {
    key: args.key,
    reason: args.reason
  }
  await notifyLedgerCorruption(args.onCorrupt, corruption)
  return { status: 'corrupt', reason: args.reason }
}

function parseCommitStatus(value: unknown): 0 | 1 | 2 | 3 | 4 {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' && /^[0-4]$/.test(value) ? Number(value) : Number.NaN

  if (parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) {
    return parsed
  }

  throw new Error('Ledger head commit script returned an invalid status')
}

function parseSyncStatusWriteStatus(value: unknown): 0 | 1 {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' && /^[01]$/.test(value) ? Number(value) : Number.NaN

  if (parsed === 0 || parsed === 1) {
    return parsed
  }

  throw new Error('Ledger sync status write script returned an invalid status')
}

function parseHeadRecoveryStatus(value: unknown): 0 | 1 | 2 | 3 {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' && /^[0-3]$/.test(value) ? Number(value) : Number.NaN

  if (parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3) {
    return parsed
  }

  throw new Error('Ledger head recovery script returned an invalid status')
}

function assertDistinctCommitKeys(keys: string[]): void {
  keys.forEach((key) => {
    assertNonEmpty(key, 'Ledger commit key')
  })

  if (new Set(keys).size !== keys.length) {
    throw new Error('Ledger commit keys must be distinct')
  }
}

function assertCanonicalCommitKeys(args: {
  lockKey: string
  headKey: string
  previousHeadKey: string
  nextManifestKey: string
  syncStatusKey: string
}): void {
  const walletHash = assertLedgerKeysShareWalletScope([
    args.lockKey,
    args.headKey,
    args.previousHeadKey,
    args.nextManifestKey,
    args.syncStatusKey
  ])
  if (
    args.lockKey !== getLedgerLockKey(walletHash) ||
    args.headKey !== getLedgerHeadKey(walletHash) ||
    args.previousHeadKey !== getLedgerPreviousHeadKey(walletHash) ||
    args.syncStatusKey !== getLedgerSyncStatusKey(walletHash)
  ) {
    throw new Error('Ledger commit requires canonical wallet lock and head keys')
  }
  const manifestIdentity = /:manifest:(\d+):([A-Za-z0-9_-]{1,96})$/.exec(args.nextManifestKey)
  const sourceGeneration = manifestIdentity ? Number(manifestIdentity[1]) : Number.NaN
  const revision = manifestIdentity?.[2] ?? ''
  if (
    !Number.isSafeInteger(sourceGeneration) ||
    args.nextManifestKey !== getLedgerRevisionManifestKey(walletHash, sourceGeneration, revision)
  ) {
    throw new Error('Ledger commit requires a canonical revision manifest key')
  }
}

async function writeImmutableLedgerValue(args: {
  redis: TLedgerRedis
  key: string
  value: string
  maximumBytes: number
  label: string
}): Promise<TImmutableLedgerWriteResult> {
  assertNonEmpty(args.key, 'Immutable ledger value key')
  assertLedgerKeysShareWalletScope([args.key])
  assertEncodedSize(args.value, args.maximumBytes, args.label)
  const options: SetCommandOptions = { nx: true }
  const result = await executeHoldingsLedgerRedisOperation('write', () =>
    args.redis.set(args.key, encodeLedgerValue(args.value), options)
  )

  if (result === 'OK') {
    return { status: 'written' }
  }

  if (result === null) {
    const existing = await executeHoldingsLedgerRedisOperation('read', () => args.redis.get<unknown>(args.key))
    return classifyExistingImmutableLedgerValue(existing, args.value)
  }

  throw new Error('Immutable ledger value write returned an unexpected result')
}

export function writeImmutableLedgerChunk(args: {
  redis: TLedgerRedis
  key: string
  value: string
}): Promise<TImmutableLedgerWriteResult> {
  return writeImmutableLedgerValue({
    ...args,
    maximumBytes: LEDGER_MAX_ENCODED_CHUNK_BYTES,
    label: 'Immutable ledger chunk'
  })
}

export function writeImmutableLedgerIndexShard(args: {
  redis: TLedgerRedis
  key: string
  value: string
}): Promise<TImmutableLedgerWriteResult> {
  return writeImmutableLedgerValue({
    ...args,
    maximumBytes: LEDGER_MAX_ENCODED_INDEX_SHARD_BYTES,
    label: 'Immutable ledger index shard'
  })
}

export async function writeImmutableLedgerBlobs(args: {
  redis: TLedgerPipelineRedis
  items: readonly TImmutableLedgerBlobWriteItem[]
}): Promise<TImmutableLedgerBlobWriteResult[]> {
  const prepared = prepareImmutableLedgerBlobs(args.items)
  if (prepared.length === 0) {
    return []
  }

  const writePipeline = args.redis.pipeline()
  prepared.forEach((blob) => {
    writePipeline.set(blob.item.key, blob.encodedValue, { nx: true })
  })
  const writeResults = await executeHoldingsLedgerRedisOperation('write', () => writePipeline.exec<unknown[]>())
  assertPipelineResultCount(writeResults, prepared.length, 'Immutable ledger blob write pipeline')
  if (writeResults.some((result) => result !== 'OK' && result !== null)) {
    throw new Error('Immutable ledger blob write pipeline returned an unexpected result')
  }

  const existingItemIndexes = writeResults.flatMap((result, index) => (result === null ? [index] : []))
  const existingValues = await (async () => {
    if (existingItemIndexes.length === 0) {
      return [] as unknown[]
    }

    const verificationPipeline = args.redis.pipeline()
    existingItemIndexes.forEach((index) => {
      verificationPipeline.get<unknown>((prepared[index] as TPreparedImmutableLedgerBlob).item.key)
    })
    const results = await executeHoldingsLedgerRedisOperation('read', () => verificationPipeline.exec<unknown[]>())
    assertPipelineResultCount(results, existingItemIndexes.length, 'Immutable ledger blob verification pipeline')
    return results
  })()
  const verificationIndexByItemIndex = new Map(existingItemIndexes.map((itemIndex, index) => [itemIndex, index]))

  return prepared.map((blob, index) => {
    const status = (() => {
      if (writeResults[index] === 'OK') {
        return 'written' as const
      }

      const verificationIndex = verificationIndexByItemIndex.get(index)
      if (verificationIndex === undefined) {
        throw new Error('Immutable ledger blob verification result is missing')
      }
      return classifyExistingImmutableLedgerValue(existingValues[verificationIndex], blob.item.value).status
    })()

    return {
      kind: blob.item.kind,
      key: blob.item.key,
      checksum: blob.item.checksum,
      status
    }
  })
}

export async function readLedgerValue<TValue = string>(args: {
  redis: Pick<TLedgerRedis, 'get'>
  key: string
  parse?: (value: string) => TValue
  validateChecksum?: (value: string) => boolean | Promise<boolean>
  onCorrupt?: (corruption: TLedgerCorruption) => void | Promise<void>
}): Promise<TLedgerReadResult<TValue>> {
  assertNonEmpty(args.key, 'Ledger value key')
  assertLedgerKeysShareWalletScope([args.key])
  const storedValue = await executeHoldingsLedgerRedisOperation('read', () => args.redis.get<unknown>(args.key))

  if (storedValue === null) {
    return { status: 'missing' }
  }

  const decoded = decodeLedgerValue(storedValue)
  if (decoded.status === 'corrupt') {
    return createCorruptReadResult({ key: args.key, reason: 'encoding', onCorrupt: args.onCorrupt })
  }

  if (args.validateChecksum) {
    try {
      const checksumIsValid = await args.validateChecksum(decoded.value)
      if (!checksumIsValid) {
        return createCorruptReadResult({ key: args.key, reason: 'checksum', onCorrupt: args.onCorrupt })
      }
    } catch {
      return createCorruptReadResult({ key: args.key, reason: 'checksum', onCorrupt: args.onCorrupt })
    }
  }

  try {
    return {
      status: 'ok',
      value: args.parse ? args.parse(decoded.value) : (decoded.value as TValue)
    }
  } catch {
    return createCorruptReadResult({ key: args.key, reason: 'parse', onCorrupt: args.onCorrupt })
  }
}

export async function readLedgerValues(args: {
  redis: Pick<TLedgerPipelineRedis, 'pipeline'>
  keys: readonly string[]
  onCorrupt?: (corruption: TLedgerCorruption) => void | Promise<void>
}): Promise<TLedgerReadResult<string>[]> {
  const keys = [...args.keys]
  if (keys.length === 0) {
    return []
  }
  keys.forEach((key) => {
    assertNonEmpty(key, 'Ledger value key')
  })
  assertLedgerKeysShareWalletScope(keys)

  const pipeline = args.redis.pipeline()
  keys.forEach((key) => {
    pipeline.get<unknown>(key)
  })
  const storedValues = await executeHoldingsLedgerRedisOperation('read', () => pipeline.exec<unknown[]>())
  assertPipelineResultCount(storedValues, keys.length, 'Ledger value read pipeline')

  return Promise.all(
    storedValues.map(async (storedValue, index): Promise<TLedgerReadResult<string>> => {
      if (storedValue === null) {
        return { status: 'missing' }
      }
      const decoded = decodeLedgerValue(storedValue)
      if (decoded.status === 'corrupt') {
        return createCorruptReadResult({
          key: keys[index] as string,
          reason: 'encoding',
          onCorrupt: args.onCorrupt
        })
      }
      return { status: 'ok', value: decoded.value }
    })
  )
}

export async function readLedgerSnapshotPin(args: {
  redis: Pick<TLedgerRedis, 'get'>
  walletHash: string
  snapshotId: string
}): Promise<TLedgerSnapshotPinReadResult> {
  if (!isLedgerSnapshotId(args.snapshotId)) {
    return { status: 'corrupt' }
  }
  const result = await readLedgerValue({
    redis: args.redis,
    key: getLedgerSnapshotKey(args.walletHash, args.snapshotId),
    parse: (value) => {
      const pin = parseLedgerSnapshotPin(value)
      if (pin.snapshotId !== args.snapshotId || pin.head.walletHash !== args.walletHash) {
        throw new Error('Ledger snapshot pin does not match its wallet-scoped key')
      }
      return pin
    }
  })
  return result.status === 'ok'
    ? { status: 'ok', pin: result.value }
    : result.status === 'missing'
      ? { status: 'missing' }
      : { status: 'corrupt' }
}

export async function writeLedgerSnapshotPin(args: {
  redis: TLedgerRedis
  walletHash: string
  pin: TLedgerSnapshotPinV1
}): Promise<TWriteLedgerSnapshotPinResult> {
  validateLedgerSnapshotPin(args.pin)
  if (args.pin.head.walletHash !== args.walletHash) {
    throw new Error('Ledger snapshot pin wallet does not match its wallet-scoped key')
  }
  const key = getLedgerSnapshotKey(args.walletHash, args.pin.snapshotId)
  const value = stringifyCanonicalLedgerValue(args.pin)
  assertEncodedSize(value, LEDGER_MAX_SNAPSHOT_PIN_BYTES, 'Ledger snapshot pin')
  const options: SetCommandOptions = { nx: true, ex: LEDGER_SNAPSHOT_TTL_SECONDS }
  const result = await executeHoldingsLedgerRedisOperation('write', () =>
    args.redis.set(key, encodeLedgerValue(value), options)
  )
  if (result === 'OK') {
    return { status: 'written' }
  }
  if (result === null) {
    const existing = await readLedgerSnapshotPin({
      redis: args.redis,
      walletHash: args.walletHash,
      snapshotId: args.pin.snapshotId
    })
    return existing.status === 'ok' ? { status: 'exists' } : { status: 'corrupt' }
  }
  throw new Error('Ledger snapshot pin write returned an unexpected result')
}

export async function writeLedgerSyncStatus(args: {
  redis: TLedgerScriptRedis
  walletHash: string
  lock: TLedgerLock
  status: TLedgerSyncStatusV1
}): Promise<TWriteLedgerSyncStatusResult> {
  validateLedgerSyncStatus(args.status)
  const lockKey = getLedgerLockKey(args.walletHash)
  const syncStatusKey = getLedgerSyncStatusKey(args.walletHash)
  assertLedgerKeysShareWalletScope([lockKey, syncStatusKey])
  const statusValue = stringifyCanonicalLedgerValue(args.status)
  assertEncodedSize(statusValue, LEDGER_MAX_HEAD_BYTES, 'Ledger sync status')
  const writeStatus = parseSyncStatusWriteStatus(
    await executeHoldingsLedgerRedisOperation('write', () =>
      args.redis.eval<string[], unknown>(
        WRITE_LEDGER_SYNC_STATUS_SCRIPT,
        [lockKey, syncStatusKey],
        [getLedgerLockToken(args.lock), encodeLedgerValue(statusValue)]
      )
    )
  )

  return writeStatus === 1 ? { status: 'written' } : { status: 'lock_lost' }
}

export async function recoverCorruptLedgerHeadFromPrevious(args: {
  redis: TLedgerScriptRedis
  lock: TLedgerLock
  previousRevision: TLedgerVerifiedRevisionV1
  syncStatus: TLedgerSyncStatusV1
}): Promise<TRecoverCorruptLedgerHeadResult> {
  const verified = getVerifiedLedgerRevisionValues(args.previousRevision)
  validateLedgerSyncStatus(args.syncStatus)
  if (
    args.syncStatus.state !== 'syncing' ||
    args.syncStatus.sourceGeneration !== verified.head.sourceGeneration ||
    args.syncStatus.revision !== verified.head.revision
  ) {
    throw new Error('Ledger head recovery sync status must track the verified previous revision')
  }
  const syncStatusValue = stringifyCanonicalLedgerValue(args.syncStatus)
  assertEncodedSize(syncStatusValue, LEDGER_MAX_HEAD_BYTES, 'Ledger sync status')
  const lockKey = getLedgerLockKey(verified.head.walletHash)
  const headKey = getLedgerHeadKey(verified.head.walletHash)
  const previousHeadKey = getLedgerPreviousHeadKey(verified.head.walletHash)
  const syncStatusKey = getLedgerSyncStatusKey(verified.head.walletHash)
  const keys = [lockKey, headKey, previousHeadKey, syncStatusKey]
  assertLedgerKeysShareWalletScope(keys)
  if (new Set(keys).size !== keys.length) {
    throw new Error('Ledger head recovery keys must be distinct')
  }

  const status = parseHeadRecoveryStatus(
    await executeHoldingsLedgerRedisOperation('commit', () =>
      args.redis.eval<string[], unknown>(RECOVER_CORRUPT_LEDGER_HEAD_SCRIPT, keys, [
        getLedgerLockToken(args.lock),
        encodeLedgerValue(verified.headValue),
        encodeLedgerValue(syncStatusValue)
      ])
    )
  )

  if (status === 0) {
    return { status: 'recovered' }
  }
  if (status === 1) {
    return { status: 'lock_lost' }
  }
  if (status === 2) {
    return { status: 'active_missing' }
  }
  return { status: 'previous_changed' }
}

async function commitLedgerHeadValues(args: {
  redis: TLedgerScriptRedis
  lockKey: string
  headKey: string
  previousHeadKey: string
  nextManifestKey: string
  syncStatusKey: string
  lock: TLedgerLock
  expectedHead: string | null
  nextHead: string
  nextManifestValue: string
  syncStatusValue: string | null
}): Promise<TCommitLedgerHeadResult> {
  assertDistinctCommitKeys([args.lockKey, args.headKey, args.previousHeadKey, args.nextManifestKey, args.syncStatusKey])
  assertCanonicalCommitKeys(args)
  assertEncodedSize(args.nextHead, LEDGER_MAX_HEAD_BYTES, 'Ledger head')
  assertEncodedSize(args.nextManifestValue, LEDGER_MAX_MANIFEST_BYTES, 'Ledger manifest')
  if (args.syncStatusValue !== null) {
    assertEncodedSize(args.syncStatusValue, LEDGER_MAX_HEAD_BYTES, 'Ledger sync status')
  }
  if (args.expectedHead !== null) {
    assertEncodedSize(args.expectedHead, LEDGER_MAX_HEAD_BYTES, 'Expected ledger head')
  }
  const encodedExpectedHead = args.expectedHead === null ? '' : encodeLedgerValue(args.expectedHead)
  const status = parseCommitStatus(
    await executeHoldingsLedgerRedisOperation('commit', () =>
      args.redis.eval<string[], unknown>(
        COMMIT_LEDGER_HEAD_SCRIPT,
        [args.lockKey, args.headKey, args.previousHeadKey, args.nextManifestKey, args.syncStatusKey],
        [
          getLedgerLockToken(args.lock),
          args.expectedHead === null ? '0' : '1',
          encodedExpectedHead,
          encodeLedgerValue(args.nextHead),
          encodeLedgerValue(args.nextManifestValue),
          args.syncStatusValue === null ? '0' : '1',
          args.syncStatusValue === null ? '' : encodeLedgerValue(args.syncStatusValue)
        ]
      )
    )
  )

  if (status === 0) {
    return { status: 'committed', head: args.nextHead, previousHead: args.expectedHead }
  }

  if (status === 1) {
    return { status: 'lock_lost' }
  }

  if (status === 2) {
    return { status: 'head_conflict' }
  }

  if (status === 4) {
    return { status: 'already_committed', head: args.nextHead }
  }

  return { status: 'manifest_exists' }
}

export async function commitVerifiedLedgerRevision(args: {
  redis: TLedgerScriptRedis
  lock: TLedgerLock
  expectedHead: TLedgerHeadV1 | null
  revision: TLedgerVerifiedRevisionV1
  syncStatus?: TLedgerSyncStatusV1
}): Promise<TCommitLedgerHeadResult> {
  const verified = getVerifiedLedgerRevisionValues(args.revision)
  if (args.expectedHead !== null) {
    validateLedgerHead(args.expectedHead)
    if (args.expectedHead.walletHash !== verified.head.walletHash) {
      throw new Error('Expected ledger head and next revision must belong to the same wallet')
    }
  }
  const syncStatusValue = (() => {
    if (args.syncStatus === undefined) {
      return null
    }
    validateLedgerSyncStatus(args.syncStatus)
    if (
      args.syncStatus.state !== 'complete' ||
      args.syncStatus.sourceGeneration !== verified.head.sourceGeneration ||
      args.syncStatus.revision !== verified.head.revision
    ) {
      throw new Error('Atomic ledger commit sync status must complete the verified revision')
    }
    return stringifyCanonicalLedgerValue(args.syncStatus)
  })()
  return commitLedgerHeadValues({
    redis: args.redis,
    lockKey: getLedgerLockKey(verified.head.walletHash),
    headKey: getLedgerHeadKey(verified.head.walletHash),
    previousHeadKey: getLedgerPreviousHeadKey(verified.head.walletHash),
    nextManifestKey: verified.head.manifestKey,
    syncStatusKey: getLedgerSyncStatusKey(verified.head.walletHash),
    lock: args.lock,
    expectedHead: args.expectedHead === null ? null : stringifyCanonicalLedgerValue(args.expectedHead),
    nextHead: verified.headValue,
    nextManifestValue: verified.manifestValue,
    syncStatusValue
  })
}
