import { holdingsConfig } from '@/server/lib/holdings/config'
import { debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import type {
  THoldingsCachedTotal,
  THoldingsCachedTotalsResult,
  THoldingsTotalsCache
} from '@/server/lib/holdings/services/eventSource'
import type { VaultVersion } from '@/server/lib/holdings/services/graphql'
import {
  getWalletLedgerKey,
  type TWalletLedgerCacheCommitTransition
} from '@/server/lib/holdings/services/ledger/walletStore'
import {
  type TWalletLedgerState,
  WALLET_LEDGER_CODEC,
  WALLET_LEDGER_SCHEMA_VERSION
} from '@/server/lib/holdings/services/ledger/walletTypes'
import {
  adoptHoldingsLedgerRedisReadYourWritesSyncToken,
  executeHoldingsLedgerRedisOperation,
  getHoldingsLedgerRedisClient,
  getHoldingsLedgerRedisClientWithTimeout
} from '@/server/lib/holdings/storage/ledgerRedis'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAILY_USD_CACHE_SCHEMA_VERSION = 1 as const
const DAILY_USD_CACHE_CALCULATION_VERSION = 'wallet-ledger-daily-usd-v4'
const DAILY_USD_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
const DAILY_USD_PROVISIONAL_MAX_AGE_MS = 60 * 60 * 1000
const DAILY_USD_CACHE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const DAILY_USD_CACHE_META_FIELD = '__meta'
const DAILY_USD_CACHE_VERSIONS: readonly VaultVersion[] = ['all', 'v2', 'v3']
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const DAILY_USD_CACHE_WRITE_TIMEOUT_MS = 3_000
const DAILY_USD_PENDING_READ_WAIT_MS = 1_000
const DAILY_USD_PENDING_MAX_IDENTITIES = 16
const DAILY_USD_PENDING_MAX_DATES_PER_IDENTITY = 4_096

interface TDeferred<TValue> {
  readonly promise: Promise<TValue>
  readonly resolve: (value: TValue) => void
}

interface TPendingDailyUsdBatch {
  readonly totalsByDate: Map<string, THoldingsCachedTotal>
  readonly deferred: TDeferred<boolean>
}

interface TPendingDailyUsdWrite {
  readonly identity: TWalletLedgerDailyUsdCacheIdentity
  inFlight: Promise<boolean> | null
  queued: TPendingDailyUsdBatch | null
  cancelled: boolean
}

const pendingDailyUsdCacheWrites = new Map<string, TPendingDailyUsdWrite>()

const WRITE_DAILY_USD_TOTALS_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-daily-usd-write-v2
local walletValue = redis.call('GET', KEYS[1])
if walletValue == false or string.sub(walletValue, 1, string.len(ARGV[1])) ~= ARGV[1] then
  return 0
end
local keyTypeReply = redis.call('TYPE', KEYS[2])
local keyType = keyTypeReply
if type(keyTypeReply) == 'table' then
  keyType = keyTypeReply['ok']
end
if keyType ~= 'none' and keyType ~= 'hash' then
  redis.call('DEL', KEYS[2])
end
local expectedMeta = ARGV[2]
if redis.call('HGET', KEYS[2], '${DAILY_USD_CACHE_META_FIELD}') ~= expectedMeta then
  redis.call('DEL', KEYS[2])
  redis.call('HSET', KEYS[2], '${DAILY_USD_CACHE_META_FIELD}', expectedMeta)
end
for index = 4, #ARGV, 2 do
  local date = ARGV[index]
  local incomingValue = ARGV[index + 1]
  local existingValue = redis.call('HGET', KEYS[2], date)
  local existingComplete = existingValue ~= false and string.find(existingValue, '"isComplete":true', 1, true) ~= nil
  local incomingComplete = string.find(incomingValue, '"isComplete":true', 1, true) ~= nil
  if existingComplete == false or incomingComplete then
    redis.call('HSET', KEYS[2], date, incomingValue)
  end
end
redis.call('EXPIRE', KEYS[2], ARGV[3])
return 1
`

const TRANSITION_DAILY_USD_TOTALS_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-daily-usd-transition-v2
local walletValue = redis.call('GET', KEYS[1])
if walletValue == false or string.sub(walletValue, 1, string.len(ARGV[1])) ~= ARGV[1] then
  return 0
end
local keyTypeReply = redis.call('TYPE', KEYS[2])
local keyType = keyTypeReply
if type(keyTypeReply) == 'table' then
  keyType = keyTypeReply['ok']
end
if keyType ~= 'none' and keyType ~= 'hash' then
  redis.call('DEL', KEYS[2])
end
local previousMeta = ARGV[2]
local currentMeta = ARGV[3]
local dirtyFromDate = ARGV[4]
local reset = ARGV[5]
local existingMeta = redis.call('HGET', KEYS[2], '${DAILY_USD_CACHE_META_FIELD}')
if existingMeta == false then
  return 1
end
if reset == '1' then
  redis.call('DEL', KEYS[2])
  redis.call('HSET', KEYS[2], '${DAILY_USD_CACHE_META_FIELD}', currentMeta)
  redis.call('EXPIRE', KEYS[2], ARGV[6])
  return 1
end
if existingMeta == currentMeta then
  redis.call('EXPIRE', KEYS[2], ARGV[6])
  return 1
end
if previousMeta == '' or existingMeta ~= previousMeta then
  redis.call('DEL', KEYS[2])
elseif dirtyFromDate ~= '' then
  local fields = redis.call('HKEYS', KEYS[2])
  for _, field in ipairs(fields) do
    if string.match(field, '^%d%d%d%d%-%d%d%-%d%d$') and field >= dirtyFromDate then
      redis.call('HDEL', KEYS[2], field)
    end
  end
end
redis.call('HSET', KEYS[2], '${DAILY_USD_CACHE_META_FIELD}', currentMeta)
redis.call('EXPIRE', KEYS[2], ARGV[6])
return 1
`

interface TWalletLedgerDailyUsdRedis {
  readonly readYourWritesSyncToken: string | undefined
  hmget(key: string, ...fields: string[]): Promise<unknown>
  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData>
}

interface TDailyUsdCacheMeta {
  readonly schemaVersion: typeof DAILY_USD_CACHE_SCHEMA_VERSION
  readonly calculationVersion: typeof DAILY_USD_CACHE_CALCULATION_VERSION
  readonly valuationRevision: string
  readonly ledgerCalculationVersion: string
  readonly sourceGeneration: number
  readonly eventRevision: string
  readonly appliedInvalidationSequence: number
}

interface TDailyUsdCacheValue {
  readonly usdValue: number
  readonly updatedAtMs: number
  readonly isComplete: boolean
}

export interface TWalletLedgerDailyUsdCacheMetaIdentity {
  readonly walletHash: string
  readonly version: VaultVersion
  readonly ledgerCalculationVersion: string
  readonly sourceGeneration: number
  readonly eventRevision: string
  readonly appliedInvalidationSequence: number
}

export interface TWalletLedgerDailyUsdCacheIdentity extends TWalletLedgerDailyUsdCacheMetaIdentity {
  readonly ledgerRevision: string
}

export interface TWalletLedgerDailyUsdCacheTransition {
  readonly previous: TWalletLedgerDailyUsdCacheMetaIdentity | null
  readonly current: TWalletLedgerDailyUsdCacheIdentity
  readonly dirtyFromDate: string | null
  readonly reset: boolean
}

export interface TWalletLedgerDailyUsdCacheCommitArguments {
  readonly previous: TWalletLedgerState | null
  readonly current: TWalletLedgerState
  readonly dirtyFromDate: string | null
  readonly reset: boolean
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`)
  }
}

function assertVaultVersion(value: VaultVersion): void {
  if (value !== 'all' && value !== 'v2' && value !== 'v3') {
    throw new Error('Wallet ledger daily USD cache vault version is invalid')
  }
}

function assertDate(value: string, label: string): void {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!UTC_DATE_PATTERN.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be an ISO UTC date`)
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
}

function assertMetaIdentity(identity: TWalletLedgerDailyUsdCacheMetaIdentity): void {
  assertSha256(identity.walletHash, 'Wallet ledger daily USD cache wallet hash')
  assertSha256(identity.eventRevision, 'Wallet ledger daily USD cache event revision')
  assertVaultVersion(identity.version)
  if (
    typeof identity.ledgerCalculationVersion !== 'string' ||
    identity.ledgerCalculationVersion.length === 0 ||
    identity.ledgerCalculationVersion.trim() !== identity.ledgerCalculationVersion
  ) {
    throw new Error('Wallet ledger daily USD cache ledger calculation version is invalid')
  }
  if (!Number.isSafeInteger(identity.sourceGeneration) || identity.sourceGeneration < 1) {
    throw new Error('Wallet ledger daily USD cache source generation is invalid')
  }
  if (!Number.isSafeInteger(identity.appliedInvalidationSequence) || identity.appliedInvalidationSequence < 0) {
    throw new Error('Wallet ledger daily USD cache invalidation sequence is invalid')
  }
}

function assertIdentity(identity: TWalletLedgerDailyUsdCacheIdentity): void {
  assertMetaIdentity(identity)
  assertSha256(identity.ledgerRevision, 'Wallet ledger daily USD cache ledger revision')
}

function assertTotal(total: THoldingsCachedTotal): void {
  assertDate(total.date, 'Wallet ledger daily USD cache total date')
  if (!Number.isFinite(total.usdValue) || total.usdValue < 0) {
    throw new Error('Wallet ledger daily USD cache total must be a non-negative finite number')
  }
  if (total.isComplete !== undefined && typeof total.isComplete !== 'boolean') {
    throw new Error('Wallet ledger daily USD cache completeness must be a boolean')
  }
}

function getMeta(identity: TWalletLedgerDailyUsdCacheMetaIdentity): TDailyUsdCacheMeta {
  return {
    schemaVersion: DAILY_USD_CACHE_SCHEMA_VERSION,
    calculationVersion: DAILY_USD_CACHE_CALCULATION_VERSION,
    valuationRevision: holdingsConfig.ledgerValuationRevision,
    ledgerCalculationVersion: identity.ledgerCalculationVersion,
    sourceGeneration: identity.sourceGeneration,
    eventRevision: identity.eventRevision,
    appliedInvalidationSequence: identity.appliedInvalidationSequence
  }
}

function encodeMeta(identity: TWalletLedgerDailyUsdCacheMetaIdentity): string {
  return JSON.stringify(getMeta(identity))
}

function getPendingWriteIdentity(identity: TWalletLedgerDailyUsdCacheIdentity): string {
  return JSON.stringify([
    getWalletLedgerDailyUsdTotalsKey(identity.walletHash, identity.version),
    identity.ledgerRevision,
    encodeMeta(identity)
  ])
}

function createDeferred<TValue>(): TDeferred<TValue> {
  const controls: { resolve: (value: TValue) => void } = { resolve: () => undefined }
  const promise = new Promise<TValue>((resolve) => {
    controls.resolve = resolve
  })

  return { promise, resolve: (value) => controls.resolve(value) }
}

function getPendingWritePromises(pending: TPendingDailyUsdWrite): readonly Promise<boolean>[] {
  return [...(pending.inFlight ? [pending.inFlight] : []), ...(pending.queued ? [pending.queued.deferred.promise] : [])]
}

function waitForPendingWrites(promises: readonly Promise<boolean>[]): Promise<boolean> {
  if (promises.length === 0) {
    return Promise.resolve(false)
  }
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), DAILY_USD_PENDING_READ_WAIT_MS)
    void Promise.all(promises).then(
      () => {
        clearTimeout(timeout)
        resolve(true)
      },
      () => {
        clearTimeout(timeout)
        resolve(false)
      }
    )
  })
}
async function awaitPendingWrites(identity: TWalletLedgerDailyUsdCacheIdentity): Promise<boolean> {
  const pending = pendingDailyUsdCacheWrites.get(getPendingWriteIdentity(identity))
  return pending ? waitForPendingWrites(getPendingWritePromises(pending)) : false
}

export function resetWalletLedgerDailyUsdTotalsCacheForTests(): void {
  pendingDailyUsdCacheWrites.forEach((pending) => {
    pending.cancelled = true
    pending.queued?.deferred.resolve(false)
    pending.queued = null
  })
  pendingDailyUsdCacheWrites.clear()
}

export function getWalletLedgerDailyUsdCacheIdentity(
  ledger: TWalletLedgerState,
  version: VaultVersion
): TWalletLedgerDailyUsdCacheIdentity {
  return {
    walletHash: ledger.walletHash,
    version,
    ledgerRevision: ledger.revision,
    ledgerCalculationVersion: ledger.calculationVersion,
    sourceGeneration: ledger.sourceGeneration,
    eventRevision: ledger.eventRevision,
    appliedInvalidationSequence: ledger.appliedInvalidationSequence
  }
}

export function createWalletLedgerDailyUsdCacheCommitTransitions(
  args: TWalletLedgerDailyUsdCacheCommitArguments
): readonly TWalletLedgerCacheCommitTransition[] {
  if (args.dirtyFromDate !== null) {
    assertDate(args.dirtyFromDate, 'Wallet ledger daily USD cache dirty date')
  }
  return DAILY_USD_CACHE_VERSIONS.map((version) => {
    const current = getWalletLedgerDailyUsdCacheIdentity(args.current, version)
    const previous = args.previous ? getWalletLedgerDailyUsdCacheIdentity(args.previous, version) : null
    assertIdentity(current)
    if (previous) {
      assertIdentity(previous)
    }
    return {
      key: getWalletLedgerDailyUsdTotalsKey(current.walletHash, version),
      previousMeta: previous ? encodeMeta(previous) : null,
      currentMeta: encodeMeta(current),
      dirtyFromDate: args.dirtyFromDate,
      reset: args.reset,
      ttlSeconds: DAILY_USD_CACHE_TTL_SECONDS
    }
  })
}

function getLedgerRevisionValuePrefix(ledgerRevision: string): string {
  return `holdings-wallet-ledger:opaque:v${WALLET_LEDGER_SCHEMA_VERSION}:${WALLET_LEDGER_CODEC}:${ledgerRevision}:`
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseCacheValue(value: unknown, nowMs: number): TDailyUsdCacheValue | null {
  const parsed = parseJson(value)
  if (!parsed || typeof parsed !== 'object') {
    return null
  }
  const { usdValue, updatedAtMs, isComplete } = parsed as Record<string, unknown>
  if (
    typeof usdValue !== 'number' ||
    !Number.isFinite(usdValue) ||
    usdValue < 0 ||
    typeof updatedAtMs !== 'number' ||
    !Number.isSafeInteger(updatedAtMs) ||
    updatedAtMs < 0 ||
    updatedAtMs > nowMs + DAILY_USD_CACHE_MAX_FUTURE_SKEW_MS ||
    typeof isComplete !== 'boolean'
  ) {
    return null
  }
  return { usdValue, updatedAtMs, isComplete }
}

function parseRequestedHashValues(fields: readonly string[], value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    if (value.length !== fields.length || value.every((entry) => entry === null)) {
      return null
    }
    return Object.fromEntries(fields.map((field, index) => [field, value[index]]))
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getUtcDates(startDate: string, endDate: string): readonly string[] {
  const startTimestamp = Date.parse(`${startDate}T00:00:00.000Z`)
  const endTimestamp = Date.parse(`${endDate}T00:00:00.000Z`)
  const dateCount = Math.floor((endTimestamp - startTimestamp) / MILLISECONDS_PER_DAY) + 1
  return Array.from({ length: dateCount }, (_, index) =>
    new Date(startTimestamp + index * MILLISECONDS_PER_DAY).toISOString().slice(0, 10)
  )
}

export function getWalletLedgerDailyUsdDateRange(args: {
  readonly latestSettledDayTimestamp: number
  readonly timeframe: '1y' | 'all'
}): { readonly startDate: string; readonly endDate: string; readonly dates: readonly string[] } {
  assertNonNegativeSafeInteger(args.latestSettledDayTimestamp, 'Wallet ledger latest settled day timestamp')
  const firstTimestamp =
    args.timeframe === 'all'
      ? holdingsConfig.historyStartTimestamp
      : args.latestSettledDayTimestamp - Math.max(holdingsConfig.historyDays - 1, 0) * (MILLISECONDS_PER_DAY / 1000)
  const startDate = new Date(firstTimestamp * 1000).toISOString().slice(0, 10)
  const endDate = new Date(args.latestSettledDayTimestamp * 1000).toISOString().slice(0, 10)
  return { startDate, endDate, dates: getUtcDates(startDate, endDate) }
}

function parseScriptBoolean(value: unknown): boolean {
  if (value === 1 || value === '1') {
    return true
  }
  if (value === 0 || value === '0') {
    return false
  }
  throw new Error('Wallet ledger daily USD cache script returned an invalid status')
}

function getRedis(): TWalletLedgerDailyUsdRedis | null {
  return getHoldingsLedgerRedisClient() as TWalletLedgerDailyUsdRedis | null
}

function getWriteRedis(): TWalletLedgerDailyUsdRedis | null {
  return getHoldingsLedgerRedisClientWithTimeout(DAILY_USD_CACHE_WRITE_TIMEOUT_MS) as TWalletLedgerDailyUsdRedis | null
}

export function getWalletLedgerDailyUsdTotalsKey(walletHash: string, version: VaultVersion): string {
  assertSha256(walletHash, 'Wallet ledger daily USD cache wallet hash')
  assertVaultVersion(version)
  return `${getWalletLedgerKey(walletHash)}:daily-usd:v${DAILY_USD_CACHE_SCHEMA_VERSION}:${version}`
}

async function readTotals(
  identity: TWalletLedgerDailyUsdCacheIdentity,
  startDate: string,
  endDate: string
): Promise<THoldingsCachedTotalsResult> {
  assertDate(startDate, 'Wallet ledger daily USD cache start date')
  assertDate(endDate, 'Wallet ledger daily USD cache end date')
  if (startDate > endDate) {
    throw new Error('Wallet ledger daily USD cache date range is invalid')
  }
  const getDurationMs = startHoldingsDebugTimer()
  const awaitedPendingWrite = await awaitPendingWrites(identity)
  const redis = getRedis()
  if (!redis) {
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache read', {
      durationMs: getDurationMs(),
      version: identity.version,
      startDate,
      endDate,
      rows: 0,
      awaitedPendingWrite,
      status: 'disabled'
    })
    return { totals: [], oldestUpdatedAt: null }
  }

  try {
    const dates = getUtcDates(startDate, endDate)
    const fields = [DAILY_USD_CACHE_META_FIELD, ...dates]
    const values = parseRequestedHashValues(
      fields,
      await executeHoldingsLedgerRedisOperation('read', () =>
        redis.hmget(getWalletLedgerDailyUsdTotalsKey(identity.walletHash, identity.version), ...fields)
      )
    )
    if (!values || values[DAILY_USD_CACHE_META_FIELD] !== encodeMeta(identity)) {
      debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache read', {
        durationMs: getDurationMs(),
        version: identity.version,
        startDate,
        endDate,
        rows: 0,
        awaitedPendingWrite,
        status: 'miss'
      })
      return { totals: [], oldestUpdatedAt: null }
    }
    const nowMs = Date.now()
    const parsedRows = dates
      .map((date) => {
        const value = values[date]
        const payload = parseCacheValue(value, nowMs)
        return payload ? { date, ...payload } : null
      })
      .filter(
        (total): total is TDailyUsdCacheValue & { readonly date: string } =>
          total !== null && UTC_DATE_PATTERN.test(total.date)
      )
    const freshRows = parsedRows.filter(
      (total) => total.isComplete || nowMs - total.updatedAtMs < DAILY_USD_PROVISIONAL_MAX_AGE_MS
    )
    const provisionalRows = freshRows.filter((total) => !total.isComplete).length
    const expiredProvisionalRows = parsedRows.filter(
      (total) => !total.isComplete && nowMs - total.updatedAtMs >= DAILY_USD_PROVISIONAL_MAX_AGE_MS
    ).length
    const oldestUpdatedAtMs = freshRows.reduce<number | null>(
      (oldest, total) => (oldest === null || total.updatedAtMs < oldest ? total.updatedAtMs : oldest),
      null
    )
    const result = {
      totals: freshRows.map(({ date, usdValue, isComplete }) =>
        isComplete ? { date, usdValue } : { date, usdValue, isComplete: false }
      ),
      oldestUpdatedAt: oldestUpdatedAtMs === null ? null : new Date(oldestUpdatedAtMs)
    }
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache read', {
      durationMs: getDurationMs(),
      version: identity.version,
      startDate,
      endDate,
      rows: result.totals.length,
      provisionalRows,
      expiredProvisionalRows,
      awaitedPendingWrite,
      status: result.totals.length > 0 ? 'hit' : 'miss'
    })
    return result
  } catch {
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache read', {
      durationMs: getDurationMs(),
      version: identity.version,
      startDate,
      endDate,
      rows: 0,
      awaitedPendingWrite,
      status: 'error'
    })
    return { totals: [], oldestUpdatedAt: null }
  }
}

async function persistTotals(
  identity: TWalletLedgerDailyUsdCacheIdentity,
  totals: readonly THoldingsCachedTotal[]
): Promise<boolean> {
  totals.forEach(assertTotal)
  if (totals.length === 0) {
    return true
  }
  const getDurationMs = startHoldingsDebugTimer()
  const redis = getWriteRedis()
  if (!redis) {
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache write', {
      durationMs: getDurationMs(),
      version: identity.version,
      rows: totals.length,
      status: 'disabled'
    })
    return false
  }
  const updatedAtMs = Date.now()
  const values = Array.from(new Map(totals.map((total) => [total.date, total])).values()).toSorted((left, right) =>
    left.date.localeCompare(right.date)
  )
  const args = [
    getLedgerRevisionValuePrefix(identity.ledgerRevision),
    encodeMeta(identity),
    String(DAILY_USD_CACHE_TTL_SECONDS),
    ...values.flatMap((total) => [
      total.date,
      JSON.stringify({ usdValue: total.usdValue, updatedAtMs, isComplete: total.isComplete !== false })
    ])
  ]

  try {
    const written = parseScriptBoolean(
      await executeHoldingsLedgerRedisOperation('write', () =>
        redis.eval<string[], unknown>(
          WRITE_DAILY_USD_TOTALS_SCRIPT,
          [
            getWalletLedgerKey(identity.walletHash),
            getWalletLedgerDailyUsdTotalsKey(identity.walletHash, identity.version)
          ],
          args
        )
      )
    )
    adoptHoldingsLedgerRedisReadYourWritesSyncToken(redis)
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache write', {
      durationMs: getDurationMs(),
      version: identity.version,
      rows: values.length,
      provisionalRows: values.filter((total) => total.isComplete === false).length,
      status: written ? 'saved' : 'fenced'
    })
    return written
  } catch {
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache write', {
      durationMs: getDurationMs(),
      version: identity.version,
      rows: values.length,
      status: 'error'
    })
    return false
  }
}

function getPreferredTotal(
  current: THoldingsCachedTotal | undefined,
  candidate: THoldingsCachedTotal
): THoldingsCachedTotal {
  if (!current) {
    return candidate
  }
  const currentComplete = current.isComplete !== false
  const candidateComplete = candidate.isComplete !== false
  return currentComplete && !candidateComplete ? current : candidate
}

function normalizePendingTotals(totals: readonly THoldingsCachedTotal[]): Map<string, THoldingsCachedTotal> {
  totals.forEach(assertTotal)
  return totals.reduce((byDate, total) => {
    byDate.set(total.date, getPreferredTotal(byDate.get(total.date), total))
    return byDate
  }, new Map<string, THoldingsCachedTotal>())
}

function mergePendingTotals(
  destination: Map<string, THoldingsCachedTotal>,
  incoming: ReadonlyMap<string, THoldingsCachedTotal>
): boolean {
  const addedDates = Array.from(incoming.keys()).filter((date) => !destination.has(date)).length
  if (destination.size + addedDates > DAILY_USD_PENDING_MAX_DATES_PER_IDENTITY) {
    return false
  }
  incoming.forEach((total, date) => {
    destination.set(date, getPreferredTotal(destination.get(date), total))
  })
  return true
}

function completePendingBatch(
  pendingWriteIdentity: string,
  pending: TPendingDailyUsdWrite,
  batch: TPendingDailyUsdBatch,
  saved: boolean
): void {
  batch.deferred.resolve(saved)
  pending.inFlight = null
  if (pending.cancelled) {
    return
  }
  if (pending.queued) {
    drainPendingWrite(pendingWriteIdentity, pending)
    return
  }
  if (pendingDailyUsdCacheWrites.get(pendingWriteIdentity) === pending) {
    pendingDailyUsdCacheWrites.delete(pendingWriteIdentity)
  }
}

function drainPendingWrite(pendingWriteIdentity: string, pending: TPendingDailyUsdWrite): void {
  const batch = pending.queued
  if (pending.cancelled || pending.inFlight || !batch) {
    return
  }
  pending.queued = null
  const persistence = persistTotals(pending.identity, Array.from(batch.totalsByDate.values())).catch(() => false)
  pending.inFlight = persistence
  void persistence.then((saved) => {
    completePendingBatch(pendingWriteIdentity, pending, batch, saved)
  })
}

function enqueueTotalsWrite(
  identity: TWalletLedgerDailyUsdCacheIdentity,
  totalsByDate: Map<string, THoldingsCachedTotal>
): Promise<boolean> {
  if (totalsByDate.size === 0) {
    return Promise.resolve(true)
  }
  if (totalsByDate.size > DAILY_USD_PENDING_MAX_DATES_PER_IDENTITY) {
    return Promise.resolve(false)
  }
  const pendingWriteIdentity = getPendingWriteIdentity(identity)
  const existing = pendingDailyUsdCacheWrites.get(pendingWriteIdentity)
  if (existing?.queued) {
    if (!mergePendingTotals(existing.queued.totalsByDate, totalsByDate)) {
      return Promise.resolve(false)
    }
    return existing.queued.deferred.promise
  }
  if (existing) {
    const deferred = createDeferred<boolean>()
    existing.queued = { totalsByDate, deferred }
    drainPendingWrite(pendingWriteIdentity, existing)
    return deferred.promise
  }
  if (pendingDailyUsdCacheWrites.size >= DAILY_USD_PENDING_MAX_IDENTITIES) {
    return Promise.resolve(false)
  }
  const deferred = createDeferred<boolean>()
  const pending: TPendingDailyUsdWrite = {
    identity,
    inFlight: null,
    queued: { totalsByDate, deferred },
    cancelled: false
  }
  pendingDailyUsdCacheWrites.set(pendingWriteIdentity, pending)
  drainPendingWrite(pendingWriteIdentity, pending)
  return deferred.promise
}

function writeTotals(
  identity: TWalletLedgerDailyUsdCacheIdentity,
  totals: readonly THoldingsCachedTotal[]
): Promise<boolean> {
  try {
    const totalsByDate = normalizePendingTotals(totals)
    const queuedBehindPendingWrite = pendingDailyUsdCacheWrites.has(getPendingWriteIdentity(identity))
    const persistence = enqueueTotalsWrite(identity, totalsByDate)
    debugLog('wallet-ledger-usd-cache', 'queued daily USD totals cache write', {
      version: identity.version,
      rows: totalsByDate.size,
      queuedBehindPendingWrite
    })
    return persistence
  } catch (error) {
    return Promise.reject(error)
  }
}

export function createWalletLedgerDailyUsdTotalsCache(
  identity: TWalletLedgerDailyUsdCacheIdentity
): THoldingsTotalsCache {
  assertIdentity(identity)
  return Object.freeze({
    read: (startDate: string, endDate: string) => readTotals(identity, startDate, endDate),
    write: (totals: readonly THoldingsCachedTotal[]) => writeTotals(identity, totals)
  })
}

export async function transitionWalletLedgerDailyUsdTotalsCache(
  transition: TWalletLedgerDailyUsdCacheTransition
): Promise<boolean> {
  assertIdentity(transition.current)
  if (transition.previous) {
    assertMetaIdentity(transition.previous)
    if (
      transition.previous.walletHash !== transition.current.walletHash ||
      transition.previous.version !== transition.current.version
    ) {
      throw new Error('Wallet ledger daily USD cache transition identity changed scope')
    }
  }
  if (transition.dirtyFromDate !== null) {
    assertDate(transition.dirtyFromDate, 'Wallet ledger daily USD cache dirty date')
  }
  const getDurationMs = startHoldingsDebugTimer()
  const redis = getWriteRedis()
  if (!redis) {
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache transition', {
      durationMs: getDurationMs(),
      version: transition.current.version,
      dirtyFromDate: transition.dirtyFromDate,
      reset: transition.reset,
      status: 'disabled'
    })
    return false
  }

  try {
    const transitioned = parseScriptBoolean(
      await executeHoldingsLedgerRedisOperation('write', () =>
        redis.eval<string[], unknown>(
          TRANSITION_DAILY_USD_TOTALS_SCRIPT,
          [
            getWalletLedgerKey(transition.current.walletHash),
            getWalletLedgerDailyUsdTotalsKey(transition.current.walletHash, transition.current.version)
          ],
          [
            getLedgerRevisionValuePrefix(transition.current.ledgerRevision),
            transition.previous ? encodeMeta(transition.previous) : '',
            encodeMeta(transition.current),
            transition.dirtyFromDate ?? '',
            transition.reset ? '1' : '0',
            String(DAILY_USD_CACHE_TTL_SECONDS)
          ]
        )
      )
    )
    adoptHoldingsLedgerRedisReadYourWritesSyncToken(redis)
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache transition', {
      durationMs: getDurationMs(),
      version: transition.current.version,
      dirtyFromDate: transition.dirtyFromDate,
      reset: transition.reset,
      status: transitioned ? 'applied' : 'fenced'
    })
    return transitioned
  } catch {
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache transition', {
      durationMs: getDurationMs(),
      version: transition.current.version,
      dirtyFromDate: transition.dirtyFromDate,
      reset: transition.reset,
      status: 'error'
    })
    return false
  }
}
