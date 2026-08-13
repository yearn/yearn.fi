import type { SetCommandOptions } from '@upstash/redis'
import { LEDGER_STREAMS } from '@/server/lib/holdings/services/ledger/types'
import { decodeWalletLedgerValue, parseWalletLedgerCoverage } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  type TWalletLedgerCheckedMarkerReadResult,
  type TWalletLedgerCheckedMarkerV2,
  type TWalletLedgerCoverageV1,
  type TWalletLedgerReadResult,
  type TWalletLedgerState,
  type TWalletLedgerVerifiedHeaderReadResult,
  WALLET_LEDGER_CHECKED_MARKER_SCHEMA_VERSION,
  WALLET_LEDGER_CODEC,
  WALLET_LEDGER_SCHEMA_VERSION
} from '@/server/lib/holdings/services/ledger/walletTypes'
import { executeHoldingsLedgerRedisOperation } from '@/server/lib/holdings/storage/ledgerRedis'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const KEY_NAMESPACE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const LOCK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,192}$/
const WALLET_LEDGER_KEY_PREFIX = 'holdings:wallet-ledger:v3'
const WALLET_LEDGER_CHECKED_MARKER_FIELDS = [
  'schemaVersion',
  'revision',
  'eventRevision',
  'calculationVersion',
  'sourceGeneration',
  'appliedInvalidationSequence',
  'updatedAtMs',
  'coveredAtMs',
  'eventCount',
  'hasActivity',
  'encodedBytes',
  'decodedBytes',
  'checkedAtMs',
  'reconciledAtMs',
  'coverage'
] as const
const WALLET_LEDGER_VALUE_PREFIX = `holdings-wallet-ledger:opaque:v${WALLET_LEDGER_SCHEMA_VERSION}:${WALLET_LEDGER_CODEC}:`

const RENEW_WALLET_LEDGER_LOCK_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-lock-renew-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
return redis.call('PEXPIRE', KEYS[1], ARGV[2])
`

const RELEASE_WALLET_LEDGER_LOCK_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-lock-release-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
return redis.call('DEL', KEYS[1])
`

const COMMIT_WALLET_LEDGER_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-commit-v5
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
local markerKeyIndex = #KEYS
for keyIndex = 3, markerKeyIndex - 1 do
  local keyTypeReply = redis.call('TYPE', KEYS[keyIndex])
  local keyType = keyTypeReply
  if type(keyTypeReply) == 'table' then
    keyType = keyTypeReply['ok']
  end
  if keyType ~= 'none' and keyType ~= 'hash' then
    redis.call('DEL', KEYS[keyIndex])
  end
end
local ttl = tonumber(ARGV[3])
if ttl ~= nil and ttl > 0 then
  redis.call('SET', KEYS[2], ARGV[2], 'PX', ttl)
else
  redis.call('SET', KEYS[2], ARGV[2])
end
for keyIndex = 3, markerKeyIndex - 1 do
  local argumentIndex = 4 + ((keyIndex - 3) * 5)
  local previousMeta = ARGV[argumentIndex]
  local currentMeta = ARGV[argumentIndex + 1]
  local dirtyFromDate = ARGV[argumentIndex + 2]
  local reset = ARGV[argumentIndex + 3]
  local cacheTtl = ARGV[argumentIndex + 4]
  local existingMeta = redis.call('HGET', KEYS[keyIndex], '__meta')
  if existingMeta ~= false then
    if existingMeta == currentMeta then
      redis.call('EXPIRE', KEYS[keyIndex], cacheTtl)
    elseif reset == '1' then
      redis.call('DEL', KEYS[keyIndex])
      redis.call('HSET', KEYS[keyIndex], '__meta', currentMeta)
      redis.call('EXPIRE', KEYS[keyIndex], cacheTtl)
    else
      if previousMeta == '' or existingMeta ~= previousMeta then
        redis.call('DEL', KEYS[keyIndex])
      elseif dirtyFromDate ~= '' then
        local fields = redis.call('HKEYS', KEYS[keyIndex])
        for _, field in ipairs(fields) do
          if string.match(field, '^%d%d%d%d%-%d%d%-%d%d$') and field >= dirtyFromDate then
            redis.call('HDEL', KEYS[keyIndex], field)
          end
        end
      end
      redis.call('HSET', KEYS[keyIndex], '__meta', currentMeta)
      redis.call('EXPIRE', KEYS[keyIndex], cacheTtl)
    end
  end
end
if ttl ~= nil and ttl > 0 then
  redis.call('SET', KEYS[markerKeyIndex], ARGV[#ARGV], 'PX', ttl)
else
  redis.call('SET', KEYS[markerKeyIndex], ARGV[#ARGV])
end
if ARGV[#ARGV - 1] == '1' then
  redis.call('DEL', KEYS[1])
end
return 1
`

const COMMIT_WALLET_LEDGER_CHECKED_MARKER_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-checked-marker-commit-v3
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
local value = redis.call('GET', KEYS[2])
if value == false or string.sub(value, 1, string.len(ARGV[2])) ~= ARGV[2] or string.len(value) ~= tonumber(ARGV[3]) then
  return 2
end
local ttl = redis.call('PTTL', KEYS[2])
if ttl >= 0 then
  redis.call('SET', KEYS[3], ARGV[4], 'PX', math.max(ttl, 1))
else
  redis.call('SET', KEYS[3], ARGV[4])
end
if ARGV[5] == '1' then
  redis.call('DEL', KEYS[1])
end
return 1
`

const READ_VERIFIED_WALLET_LEDGER_HEADER_SCRIPT = `#!lua flags=no-writes
-- holdings-wallet-ledger-header-read-v2
local ledgerValue = redis.call('GET', KEYS[1])
local markerValue = redis.call('GET', KEYS[2])
if ledgerValue == false or markerValue == false then
  return {0}
end
return {1, string.sub(ledgerValue, 1, ${WALLET_LEDGER_VALUE_PREFIX.length + 65}), markerValue, string.len(ledgerValue)}
`

const VERIFY_WALLET_LEDGER_SNAPSHOT_UNDER_LOCK_SCRIPT = `#!lua flags=no-writes
-- holdings-wallet-ledger-snapshot-verify-v2
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return {0}
end
if ARGV[2] == '' then
  if redis.call('EXISTS', KEYS[2]) ~= 0 then
    return {2}
  end
else
  if redis.call('GETRANGE', KEYS[2], 0, string.len(ARGV[2]) - 1) ~= ARGV[2] then
    return {2}
  end
  if redis.call('STRLEN', KEYS[2]) ~= tonumber(ARGV[3]) then
    return {2}
  end
end
local markerValue = redis.call('GET', KEYS[3])
if markerValue == false then
  return {1, 0}
end
return {1, 1, markerValue}
`

export interface TWalletLedgerRedis {
  get<TData>(key: string): Promise<TData | null>
  llen(key: string): Promise<number>
  lrange<TData>(key: string, start: number, end: number): Promise<TData[]>
  rpush<TData>(key: string, ...elements: TData[]): Promise<number>
  set<TData>(key: string, value: TData, options?: SetCommandOptions): Promise<'OK' | TData | null>
  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData>
}

export interface TWalletLedgerLock {
  readonly token: string
}

export interface TWalletLedgerCacheCommitTransition {
  readonly key: string
  readonly previousMeta: string | null
  readonly currentMeta: string
  readonly dirtyFromDate: string | null
  readonly reset: boolean
  readonly ttlSeconds: number
}

export type TAcquireWalletLedgerLockResult =
  | { readonly status: 'acquired'; readonly lock: TWalletLedgerLock }
  | { readonly status: 'busy' }

export type TWalletLedgerLockOperationResult = { readonly status: 'ok' } | { readonly status: 'lock_lost' }

export type TWalletLedgerCheckedMarkerCommitResult =
  | TWalletLedgerLockOperationResult
  | { readonly status: 'ledger_changed' }

export type TWalletLedgerSnapshotVerificationResult =
  | { readonly status: 'unchanged'; readonly marker: TWalletLedgerCheckedMarkerReadResult }
  | { readonly status: 'changed' }
  | { readonly status: 'lock_lost' }

function assertWalletHash(walletHash: string): void {
  if (!SHA256_PATTERN.test(walletHash)) {
    throw new Error('Wallet ledger wallet hash must be a lowercase SHA-256 digest')
  }
}

function assertLockToken(token: string): void {
  if (!LOCK_TOKEN_PATTERN.test(token)) {
    throw new Error('Wallet ledger lock token must be a bounded opaque identifier')
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`)
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function parseWalletLedgerCheckedMarker(value: unknown): TWalletLedgerCheckedMarkerV2 {
  const parsed = (() => {
    if (typeof value !== 'string') {
      return value
    }
    try {
      return JSON.parse(value) as unknown
    } catch {
      throw new Error('Wallet ledger checked marker must contain valid JSON')
    }
  })()
  if (!isPlainObject(parsed)) {
    throw new Error('Wallet ledger checked marker must be a plain object')
  }
  const actualFields = Object.keys(parsed).toSorted()
  const expectedFields = [...WALLET_LEDGER_CHECKED_MARKER_FIELDS].toSorted()
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    throw new Error('Wallet ledger checked marker contains unsupported or missing fields')
  }
  if (parsed.schemaVersion !== WALLET_LEDGER_CHECKED_MARKER_SCHEMA_VERSION) {
    throw new Error('Wallet ledger checked marker schema version is unsupported')
  }
  if (typeof parsed.revision !== 'string' || !SHA256_PATTERN.test(parsed.revision)) {
    throw new Error('Wallet ledger checked marker revision is invalid')
  }
  if (typeof parsed.eventRevision !== 'string' || !SHA256_PATTERN.test(parsed.eventRevision)) {
    throw new Error('Wallet ledger checked marker event revision is invalid')
  }
  if (
    typeof parsed.calculationVersion !== 'string' ||
    parsed.calculationVersion.length === 0 ||
    parsed.calculationVersion.trim() !== parsed.calculationVersion
  ) {
    throw new Error('Wallet ledger checked marker calculation version is invalid')
  }
  if (typeof parsed.sourceGeneration !== 'number') {
    throw new Error('Wallet ledger checked marker source generation is invalid')
  }
  if (typeof parsed.appliedInvalidationSequence !== 'number') {
    throw new Error('Wallet ledger checked marker invalidation sequence is invalid')
  }
  if (typeof parsed.updatedAtMs !== 'number') {
    throw new Error('Wallet ledger checked marker update timestamp is invalid')
  }
  if (typeof parsed.coveredAtMs !== 'number') {
    throw new Error('Wallet ledger checked marker coverage timestamp is invalid')
  }
  if (typeof parsed.eventCount !== 'number') {
    throw new Error('Wallet ledger checked marker event count is invalid')
  }
  if (typeof parsed.hasActivity !== 'boolean') {
    throw new Error('Wallet ledger checked marker activity flag is invalid')
  }
  if (typeof parsed.encodedBytes !== 'number' || typeof parsed.decodedBytes !== 'number') {
    throw new Error('Wallet ledger checked marker byte counts are invalid')
  }
  if (typeof parsed.checkedAtMs !== 'number') {
    throw new Error('Wallet ledger checked marker timestamp is invalid')
  }
  if (typeof parsed.reconciledAtMs !== 'number') {
    throw new Error('Wallet ledger checked marker reconciliation timestamp is invalid')
  }
  assertNonNegativeSafeInteger(parsed.checkedAtMs, 'Wallet ledger checked marker timestamp')
  assertNonNegativeSafeInteger(parsed.reconciledAtMs, 'Wallet ledger checked marker reconciliation timestamp')
  assertPositiveSafeInteger(parsed.sourceGeneration, 'Wallet ledger checked marker source generation')
  assertNonNegativeSafeInteger(parsed.appliedInvalidationSequence, 'Wallet ledger checked marker invalidation sequence')
  assertNonNegativeSafeInteger(parsed.updatedAtMs, 'Wallet ledger checked marker update timestamp')
  assertNonNegativeSafeInteger(parsed.coveredAtMs, 'Wallet ledger checked marker coverage timestamp')
  assertNonNegativeSafeInteger(parsed.eventCount, 'Wallet ledger checked marker event count')
  assertPositiveSafeInteger(parsed.encodedBytes, 'Wallet ledger checked marker encoded byte count')
  assertPositiveSafeInteger(parsed.decodedBytes, 'Wallet ledger checked marker decoded byte count')
  if (parsed.reconciledAtMs > parsed.checkedAtMs) {
    throw new Error('Wallet ledger checked marker timestamps are inconsistent')
  }
  if (parsed.updatedAtMs > parsed.checkedAtMs) {
    throw new Error('Wallet ledger checked marker update timestamp is inconsistent')
  }
  if (parsed.coveredAtMs < parsed.updatedAtMs || parsed.coveredAtMs > parsed.checkedAtMs) {
    throw new Error('Wallet ledger checked marker coverage timestamp is inconsistent')
  }
  if (parsed.hasActivity !== parsed.eventCount > 0) {
    throw new Error('Wallet ledger checked marker activity fields are inconsistent')
  }
  const coverage = parseWalletLedgerCoverage(parsed.coverage)
  return {
    schemaVersion: WALLET_LEDGER_CHECKED_MARKER_SCHEMA_VERSION,
    revision: parsed.revision,
    eventRevision: parsed.eventRevision,
    calculationVersion: parsed.calculationVersion,
    sourceGeneration: parsed.sourceGeneration,
    appliedInvalidationSequence: parsed.appliedInvalidationSequence,
    updatedAtMs: parsed.updatedAtMs,
    coveredAtMs: parsed.coveredAtMs,
    eventCount: parsed.eventCount,
    hasActivity: parsed.hasActivity,
    encodedBytes: parsed.encodedBytes,
    decodedBytes: parsed.decodedBytes,
    checkedAtMs: parsed.checkedAtMs,
    reconciledAtMs: parsed.reconciledAtMs,
    coverage
  }
}

function getLedgerEventCount(ledger: TWalletLedgerState): number {
  return LEDGER_STREAMS.reduce((total, stream) => total + ledger.streams[stream].length, 0)
}

function createWalletLedgerCheckedMarker(args: {
  readonly ledger: TWalletLedgerState
  readonly checkedAtMs: number
  readonly reconciledAtMs: number
  readonly coveredAtMs: number
  readonly coverage: readonly TWalletLedgerCoverageV1[]
}): TWalletLedgerCheckedMarkerV2 {
  const eventCount = getLedgerEventCount(args.ledger)
  return {
    schemaVersion: WALLET_LEDGER_CHECKED_MARKER_SCHEMA_VERSION,
    revision: args.ledger.revision,
    eventRevision: args.ledger.eventRevision,
    calculationVersion: args.ledger.calculationVersion,
    sourceGeneration: args.ledger.sourceGeneration,
    appliedInvalidationSequence: args.ledger.appliedInvalidationSequence,
    updatedAtMs: args.ledger.updatedAtMs,
    coveredAtMs: args.coveredAtMs,
    eventCount,
    hasActivity: eventCount > 0,
    encodedBytes: args.ledger.encodedBytes,
    decodedBytes: args.ledger.decodedBytes,
    checkedAtMs: args.checkedAtMs,
    reconciledAtMs: args.reconciledAtMs,
    coverage: args.coverage
  }
}

function stringifyWalletLedgerCheckedMarker(marker: TWalletLedgerCheckedMarkerV2): string {
  return JSON.stringify(parseWalletLedgerCheckedMarker(marker))
}

function getNamespaceSegment(): string {
  const namespace = process.env.HOLDINGS_LEDGER_KEY_NAMESPACE
  if (namespace === undefined || namespace === '') {
    return ''
  }
  if (!KEY_NAMESPACE_PATTERN.test(namespace)) {
    throw new Error('Wallet ledger key namespace contains unsupported characters')
  }
  return `:namespace:${namespace}`
}

function getWalletKeyPrefix(walletHash: string): string {
  assertWalletHash(walletHash)
  return `${WALLET_LEDGER_KEY_PREFIX}:{${walletHash}}${getNamespaceSegment()}`
}

function parseScriptBoolean(value: unknown, label: string): boolean {
  if (value === 1 || value === '1') {
    return true
  }
  if (value === 0 || value === '0') {
    return false
  }
  throw new Error(`${label} returned an invalid status`)
}

export function getWalletLedgerKey(walletHash: string): string {
  return getWalletKeyPrefix(walletHash)
}

export function getWalletLedgerLockKey(walletHash: string): string {
  return `${getWalletKeyPrefix(walletHash)}:lock`
}

export function getWalletLedgerCheckedMarkerKey(walletHash: string): string {
  return `${getWalletKeyPrefix(walletHash)}:checked`
}

export async function readStoredWalletLedger(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'get'>
  readonly walletHash: string
}): Promise<TWalletLedgerReadResult> {
  const value = await executeHoldingsLedgerRedisOperation('read', () =>
    args.redis.get<unknown>(getWalletLedgerKey(args.walletHash))
  )
  if (value === null) {
    return { status: 'missing' }
  }
  try {
    return {
      status: 'ready',
      ledger: decodeWalletLedgerValue(value, args.walletHash)
    }
  } catch {
    return { status: 'corrupt' }
  }
}

export async function readWalletLedgerCheckedMarker(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'get'>
  readonly walletHash: string
}): Promise<TWalletLedgerCheckedMarkerReadResult> {
  const value = await executeHoldingsLedgerRedisOperation('read', () =>
    args.redis.get<unknown>(getWalletLedgerCheckedMarkerKey(args.walletHash))
  )
  if (value === null) {
    return { status: 'missing' }
  }
  try {
    return { status: 'ready', marker: parseWalletLedgerCheckedMarker(value) }
  } catch {
    return { status: 'corrupt' }
  }
}

export async function readVerifiedWalletLedgerHeader(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
}): Promise<TWalletLedgerVerifiedHeaderReadResult> {
  const result = await executeHoldingsLedgerRedisOperation('read', () =>
    args.redis.eval<[], unknown>(
      READ_VERIFIED_WALLET_LEDGER_HEADER_SCRIPT,
      [getWalletLedgerKey(args.walletHash), getWalletLedgerCheckedMarkerKey(args.walletHash)],
      []
    )
  )
  if (!Array.isArray(result) || (result[0] !== 0 && result[0] !== '0' && result[0] !== 1 && result[0] !== '1')) {
    return { status: 'corrupt' }
  }
  if (result[0] === 0 || result[0] === '0') {
    return { status: 'missing' }
  }
  const ledgerValue = result[1]
  const markerValue = result[2]
  const encodedBytes = Number(result[3])
  if (typeof ledgerValue !== 'string' || !Number.isSafeInteger(encodedBytes) || encodedBytes <= 0) {
    return { status: 'corrupt' }
  }
  const marker = (() => {
    try {
      return parseWalletLedgerCheckedMarker(markerValue)
    } catch {
      return null
    }
  })()
  if (!marker) {
    return { status: 'corrupt' }
  }
  if (encodedBytes !== marker.encodedBytes) {
    return { status: 'ledger_changed' }
  }
  return ledgerValue.startsWith(`${WALLET_LEDGER_VALUE_PREFIX}${marker.revision}:`)
    ? { status: 'ready', header: marker }
    : { status: 'ledger_changed' }
}

export async function verifyWalletLedgerSnapshotUnderLock(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly expectedRevision: string | null
  readonly expectedEncodedBytes: number | null
}): Promise<TWalletLedgerSnapshotVerificationResult> {
  assertLockToken(args.lock.token)
  if (args.expectedRevision !== null && !SHA256_PATTERN.test(args.expectedRevision)) {
    throw new Error('Wallet ledger expected revision must be a lowercase SHA-256 digest')
  }
  if (args.expectedRevision === null && args.expectedEncodedBytes !== null) {
    throw new Error('Wallet ledger expected byte count requires a revision')
  }
  if (args.expectedEncodedBytes !== null) {
    assertPositiveSafeInteger(args.expectedEncodedBytes, 'Wallet ledger expected encoded byte count')
  }
  const expectedPrefix = args.expectedRevision === null ? '' : `${WALLET_LEDGER_VALUE_PREFIX}${args.expectedRevision}:`
  const result = await executeHoldingsLedgerRedisOperation('read', () =>
    args.redis.eval<string[], unknown>(
      VERIFY_WALLET_LEDGER_SNAPSHOT_UNDER_LOCK_SCRIPT,
      [
        getWalletLedgerLockKey(args.walletHash),
        getWalletLedgerKey(args.walletHash),
        getWalletLedgerCheckedMarkerKey(args.walletHash)
      ],
      [args.lock.token, expectedPrefix, args.expectedEncodedBytes === null ? '' : String(args.expectedEncodedBytes)]
    )
  )
  if (
    !Array.isArray(result) ||
    (result[0] !== 0 &&
      result[0] !== '0' &&
      result[0] !== 1 &&
      result[0] !== '1' &&
      result[0] !== 2 &&
      result[0] !== '2')
  ) {
    throw new Error('Wallet ledger snapshot verification returned an invalid status')
  }
  if (result[0] === 0 || result[0] === '0') {
    return { status: 'lock_lost' }
  }
  if (result[0] === 2 || result[0] === '2') {
    return { status: 'changed' }
  }
  if (result[1] === 0 || result[1] === '0') {
    return { status: 'unchanged', marker: { status: 'missing' } }
  }
  if (result[1] !== 1 && result[1] !== '1') {
    throw new Error('Wallet ledger snapshot verification returned an invalid marker status')
  }
  try {
    return { status: 'unchanged', marker: { status: 'ready', marker: parseWalletLedgerCheckedMarker(result[2]) } }
  } catch {
    return { status: 'unchanged', marker: { status: 'corrupt' } }
  }
}

export async function acquireWalletLedgerLock(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'set'>
  readonly walletHash: string
  readonly token: string
  readonly ttlMs: number
}): Promise<TAcquireWalletLedgerLockResult> {
  assertLockToken(args.token)
  assertPositiveSafeInteger(args.ttlMs, 'Wallet ledger lock TTL')
  const options: SetCommandOptions = { nx: true, px: args.ttlMs }
  const result = await executeHoldingsLedgerRedisOperation('lock', () =>
    args.redis.set(getWalletLedgerLockKey(args.walletHash), args.token, options)
  )
  if (result === 'OK') {
    return { status: 'acquired', lock: { token: args.token } }
  }
  if (result === null) {
    return { status: 'busy' }
  }
  throw new Error('Wallet ledger lock acquisition returned an unexpected result')
}

export async function renewWalletLedgerLock(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly ttlMs: number
}): Promise<TWalletLedgerLockOperationResult> {
  assertLockToken(args.lock.token)
  assertPositiveSafeInteger(args.ttlMs, 'Wallet ledger lock TTL')
  const renewed = parseScriptBoolean(
    await executeHoldingsLedgerRedisOperation('lock', () =>
      args.redis.eval<string[], unknown>(
        RENEW_WALLET_LEDGER_LOCK_SCRIPT,
        [getWalletLedgerLockKey(args.walletHash)],
        [args.lock.token, String(args.ttlMs)]
      )
    ),
    'Wallet ledger lock renewal'
  )
  return renewed ? { status: 'ok' } : { status: 'lock_lost' }
}

export async function releaseWalletLedgerLock(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
}): Promise<TWalletLedgerLockOperationResult> {
  assertLockToken(args.lock.token)
  const released = parseScriptBoolean(
    await executeHoldingsLedgerRedisOperation('lock', () =>
      args.redis.eval<string[], unknown>(
        RELEASE_WALLET_LEDGER_LOCK_SCRIPT,
        [getWalletLedgerLockKey(args.walletHash)],
        [args.lock.token]
      )
    ),
    'Wallet ledger lock release'
  )
  return released ? { status: 'ok' } : { status: 'lock_lost' }
}

export async function commitStoredWalletLedger(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly value: string
  readonly ttlMs?: number
  readonly cacheTransitions?: readonly TWalletLedgerCacheCommitTransition[]
  readonly checkedAtMs?: number
  readonly effectiveReconciledAtMs?: number
  readonly releaseLockOnSuccess?: boolean
}): Promise<TWalletLedgerLockOperationResult> {
  assertLockToken(args.lock.token)
  if (args.ttlMs !== undefined) {
    assertPositiveSafeInteger(args.ttlMs, 'Wallet ledger value TTL')
  }
  const ledger = decodeWalletLedgerValue(args.value, args.walletHash)
  const checkedAtMs = args.checkedAtMs ?? Date.now()
  const effectiveReconciledAtMs = args.effectiveReconciledAtMs ?? ledger.reconciledAtMs
  assertNonNegativeSafeInteger(checkedAtMs, 'Wallet ledger checked marker timestamp')
  assertNonNegativeSafeInteger(effectiveReconciledAtMs, 'Wallet ledger checked marker reconciliation timestamp')
  const markerValue = stringifyWalletLedgerCheckedMarker(
    createWalletLedgerCheckedMarker({
      ledger,
      checkedAtMs,
      reconciledAtMs: effectiveReconciledAtMs,
      coveredAtMs: ledger.updatedAtMs,
      coverage: ledger.coverage
    })
  )
  const cacheTransitions = args.cacheTransitions ?? []
  cacheTransitions.forEach((transition) => {
    if (!transition.key.startsWith(`${getWalletLedgerKey(args.walletHash)}:`)) {
      throw new Error('Wallet ledger cache transition key is outside the wallet hash slot')
    }
    if (transition.currentMeta.length === 0) {
      throw new Error('Wallet ledger cache transition metadata must not be empty')
    }
    if (transition.dirtyFromDate !== null && !UTC_DATE_PATTERN.test(transition.dirtyFromDate)) {
      throw new Error('Wallet ledger cache transition dirty date is invalid')
    }
    assertPositiveSafeInteger(transition.ttlSeconds, 'Wallet ledger cache transition TTL')
  })
  const committed = parseScriptBoolean(
    await executeHoldingsLedgerRedisOperation('commit', () =>
      args.redis.eval<string[], unknown>(
        COMMIT_WALLET_LEDGER_SCRIPT,
        [
          getWalletLedgerLockKey(args.walletHash),
          getWalletLedgerKey(args.walletHash),
          ...cacheTransitions.map(({ key }) => key),
          getWalletLedgerCheckedMarkerKey(args.walletHash)
        ],
        [
          args.lock.token,
          args.value,
          String(args.ttlMs ?? 0),
          ...cacheTransitions.flatMap((transition) => [
            transition.previousMeta ?? '',
            transition.currentMeta,
            transition.dirtyFromDate ?? '',
            transition.reset ? '1' : '0',
            String(transition.ttlSeconds)
          ]),
          args.releaseLockOnSuccess ? '1' : '0',
          markerValue
        ]
      )
    ),
    'Wallet ledger commit'
  )
  return committed ? { status: 'ok' } : { status: 'lock_lost' }
}

export async function commitWalletLedgerCheckedMarker(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly ledger: TWalletLedgerState
  readonly checkedAtMs: number
  readonly effectiveReconciledAtMs: number
  readonly coveredAtMs: number
  readonly coverage: readonly TWalletLedgerCoverageV1[]
  readonly releaseLockOnSuccess?: boolean
}): Promise<TWalletLedgerCheckedMarkerCommitResult> {
  assertLockToken(args.lock.token)
  assertNonNegativeSafeInteger(args.checkedAtMs, 'Wallet ledger checked marker timestamp')
  assertNonNegativeSafeInteger(args.effectiveReconciledAtMs, 'Wallet ledger checked marker reconciliation timestamp')
  const markerValue = stringifyWalletLedgerCheckedMarker(
    createWalletLedgerCheckedMarker({
      ledger: args.ledger,
      checkedAtMs: args.checkedAtMs,
      reconciledAtMs: args.effectiveReconciledAtMs,
      coveredAtMs: args.coveredAtMs,
      coverage: args.coverage
    })
  )
  const committed = await executeHoldingsLedgerRedisOperation('commit', () =>
    args.redis.eval<string[], unknown>(
      COMMIT_WALLET_LEDGER_CHECKED_MARKER_SCRIPT,
      [
        getWalletLedgerLockKey(args.walletHash),
        getWalletLedgerKey(args.walletHash),
        getWalletLedgerCheckedMarkerKey(args.walletHash)
      ],
      [
        args.lock.token,
        `${WALLET_LEDGER_VALUE_PREFIX}${args.ledger.revision}:`,
        String(args.ledger.encodedBytes),
        markerValue,
        args.releaseLockOnSuccess ? '1' : '0'
      ]
    )
  )
  if (committed === 1 || committed === '1') {
    return { status: 'ok' }
  }
  if (committed === 0 || committed === '0') {
    return { status: 'lock_lost' }
  }
  if (committed === 2 || committed === '2') {
    return { status: 'ledger_changed' }
  }
  throw new Error('Wallet ledger checked marker commit returned an invalid status')
}
