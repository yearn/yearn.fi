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
  executeHoldingsLedgerRedisOperation,
  getHoldingsLedgerRedisClient
} from '@/server/lib/holdings/storage/ledgerRedis'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAILY_USD_CACHE_SCHEMA_VERSION = 1 as const
const DAILY_USD_CACHE_CALCULATION_VERSION = 'wallet-ledger-daily-usd-v2'
const DAILY_USD_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
const DAILY_USD_PROVISIONAL_MAX_AGE_MS = 60 * 60 * 1000
const DAILY_USD_CACHE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const DAILY_USD_CACHE_META_FIELD = '__meta'
const DAILY_USD_CACHE_VERSIONS: readonly VaultVersion[] = ['all', 'v2', 'v3']
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

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
  redis.call('HSET', KEYS[2], ARGV[index], ARGV[index + 1])
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
  const redis = getRedis()
  if (!redis) {
    debugLog('wallet-ledger-usd-cache', 'completed daily USD totals cache read', {
      durationMs: getDurationMs(),
      version: identity.version,
      startDate,
      endDate,
      rows: 0,
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
      status: 'error'
    })
    return { totals: [], oldestUpdatedAt: null }
  }
}

async function writeTotals(
  identity: TWalletLedgerDailyUsdCacheIdentity,
  totals: readonly THoldingsCachedTotal[]
): Promise<boolean> {
  totals.forEach(assertTotal)
  if (totals.length === 0) {
    return true
  }
  const getDurationMs = startHoldingsDebugTimer()
  const redis = getRedis()
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
  const redis = getRedis()
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
