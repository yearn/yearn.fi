import { Buffer } from 'node:buffer'
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib'
import { holdingsConfig } from '@/server/lib/holdings/config'
import { debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import type { VaultVersion } from '@/server/lib/holdings/services/graphql'
import { getLedgerSha256 } from '@/server/lib/holdings/services/ledger/codec'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import type { THoldingsLedgerGrowthResponse } from '@/server/lib/holdings/services/ledger/rows'
import { getWalletLedgerKey } from '@/server/lib/holdings/services/ledger/walletStore'
import { WALLET_LEDGER_CODEC, WALLET_LEDGER_SCHEMA_VERSION } from '@/server/lib/holdings/services/ledger/walletTypes'
import type { HoldingsPnLSimpleHistoryResponse } from '@/server/lib/holdings/services/pnlSimple'
import {
  adoptHoldingsLedgerRedisReadYourWritesSyncToken,
  executeHoldingsLedgerRedisOperation,
  getHoldingsLedgerRedisClient,
  getHoldingsLedgerRedisClientWithTimeout
} from '@/server/lib/holdings/storage/ledgerRedis'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const DERIVED_CACHE_SCHEMA_VERSION = 1 as const
const DERIVED_CACHE_CALCULATION_VERSION = 'wallet-ledger-derived-portfolio-v2'
const DERIVED_CACHE_CODEC = 'brotli-q4-base64-quality-v1' as const
const DERIVED_CACHE_VALUE_PREFIX = `holdings-wallet-ledger-derived-portfolio:opaque:v${DERIVED_CACHE_SCHEMA_VERSION}:${DERIVED_CACHE_CODEC}:`
const DERIVED_CACHE_COMPLETE_TTL_SECONDS = 30 * 60
// Missing historical valuations are normally upstream coverage gaps, not values that heal within
// a few minutes. Keep provisional results through the portfolio's 25-minute client freshness window;
// event, invalidation, valuation-revision, and settled-day identity changes still invalidate them.
const DERIVED_CACHE_PROVISIONAL_TTL_SECONDS = 30 * 60
const DERIVED_CACHE_MAX_ENCODED_BYTES = 8 * 1024 * 1024
const DERIVED_CACHE_MAX_DECODED_BYTES = 8 * 1024 * 1024
const DERIVED_CACHE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const DERIVED_CACHE_WRITE_ATTEMPTS = 2
const DERIVED_CACHE_WRITE_ATTEMPT_TIMEOUT_MS = 3_000
const DERIVED_CACHE_MEMORY_MAX_ENTRIES = 16
const DERIVED_CACHE_MEMORY_MAX_DECODED_BYTES = 16 * 1024 * 1024
const DERIVED_CACHE_PENDING_WRITE_MAX_ENTRIES = 8
const DERIVED_CACHE_PENDING_WRITE_MAX_ENCODED_BYTES = 16 * 1024 * 1024

const WRITE_DERIVED_PORTFOLIO_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-derived-portfolio-write-v2
local walletValue = redis.call('GET', KEYS[1])
if walletValue == false or string.sub(walletValue, 1, string.len(ARGV[1])) ~= ARGV[1] then
  return 0
end
local existingValue = redis.call('GET', KEYS[2])
if ARGV[4] == '0' and existingValue ~= false and string.sub(existingValue, 1, string.len(ARGV[5])) == ARGV[5] then
  return 2
end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`

interface TWalletLedgerDerivedCacheRedis {
  readonly readYourWritesSyncToken: string | undefined
  get<TData>(key: string): Promise<TData | null>
  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData>
}

export interface TWalletLedgerDerivedPortfolioCacheIdentity {
  readonly walletHash: string
  readonly ledgerRevision: string
  readonly eventRevision: string
  readonly sourceGeneration: number
  readonly appliedInvalidationSequence: number
  readonly ledgerCalculationVersion: string
  readonly latestSettledDayTimestamp: number
  readonly version: VaultVersion
  readonly timeframe: '1y' | 'all'
}

export interface TWalletLedgerDerivedPortfolioCacheValue {
  readonly protocolReturn: HoldingsPnLSimpleHistoryResponse
  readonly growth: THoldingsLedgerGrowthResponse
}

type TWalletLedgerDerivedPortfolioCachePayload = {
  readonly schemaVersion: typeof DERIVED_CACHE_SCHEMA_VERSION
  readonly calculationVersion: typeof DERIVED_CACHE_CALCULATION_VERSION
  readonly valuationRevision: string
  readonly identity: Omit<TWalletLedgerDerivedPortfolioCacheIdentity, 'ledgerRevision'>
  readonly updatedAtMs: number
  readonly expiresAtMs: number
  readonly value: TWalletLedgerDerivedPortfolioCacheValue
}

type TEncodedDerivedPortfolioPayload = {
  readonly value: string
  readonly encodedBytes: number
  readonly decodedBytes: number
  readonly cacheIdentityHash: string
}

type TPreparedDerivedPortfolioCacheWrite = {
  readonly identity: TWalletLedgerDerivedPortfolioCacheIdentity
  readonly value: TWalletLedgerDerivedPortfolioCacheValue
  readonly complete: boolean
  readonly ttlSeconds: number
  readonly expiresAtMs: number
  readonly cacheIdentity: string
  readonly persistenceIdentity: string
  readonly encoded: TEncodedDerivedPortfolioPayload
}

type TPreparedDerivedPortfolioCacheWriteResult =
  | { readonly status: 'ready'; readonly prepared: TPreparedDerivedPortfolioCacheWrite }
  | { readonly status: 'invalid' | 'empty' | 'oversized' | 'error' }

type TDerivedPortfolioMemoryCacheEntry = {
  readonly value: TWalletLedgerDerivedPortfolioCacheValue
  readonly expiresAtMs: number
  readonly decodedBytes: number
  readonly complete: boolean
}

type TPendingDerivedPortfolioCacheWrite = {
  readonly token: object
  readonly encodedBytes: number
  readonly persistence: Promise<TWalletLedgerDerivedPortfolioCacheWriteStatus>
}

const derivedPortfolioCacheRuntime = {
  memory: new Map<string, TDerivedPortfolioMemoryCacheEntry>(),
  memoryDecodedBytes: 0,
  pendingWrites: new Map<string, TPendingDerivedPortfolioCacheWrite>(),
  pendingEncodedBytes: 0
}

export function resetWalletLedgerDerivedPortfolioCacheForTests(): void {
  derivedPortfolioCacheRuntime.memory.clear()
  derivedPortfolioCacheRuntime.memoryDecodedBytes = 0
  derivedPortfolioCacheRuntime.pendingWrites.clear()
  derivedPortfolioCacheRuntime.pendingEncodedBytes = 0
}

export type TWalletLedgerDerivedPortfolioCacheReadResult =
  | { readonly status: 'hit'; readonly value: TWalletLedgerDerivedPortfolioCacheValue }
  | { readonly status: 'miss' | 'disabled' | 'error' }

export type TWalletLedgerDerivedPortfolioCacheWriteStatus =
  | 'saved'
  | 'fenced'
  | 'disabled'
  | 'error'
  | 'empty'
  | 'oversized'
  | 'saved-provisional'
  | 'preserved-complete'

export type TWalletLedgerDerivedPortfolioCacheEnqueueResult =
  | {
      readonly status: 'queued'
      readonly persistence: Promise<TWalletLedgerDerivedPortfolioCacheWriteStatus>
    }
  | {
      readonly status: 'memory-only' | 'error' | 'empty' | 'oversized'
      readonly persistence: null
    }

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`)
  }
}

function assertIdentity(identity: TWalletLedgerDerivedPortfolioCacheIdentity): void {
  assertSha256(identity.walletHash, 'Wallet ledger derived cache wallet hash')
  assertSha256(identity.ledgerRevision, 'Wallet ledger derived cache ledger revision')
  assertSha256(identity.eventRevision, 'Wallet ledger derived cache event revision')
  if (!Number.isSafeInteger(identity.sourceGeneration) || identity.sourceGeneration < 1) {
    throw new Error('Wallet ledger derived cache source generation is invalid')
  }
  if (!Number.isSafeInteger(identity.appliedInvalidationSequence) || identity.appliedInvalidationSequence < 0) {
    throw new Error('Wallet ledger derived cache invalidation sequence is invalid')
  }
  if (
    typeof identity.ledgerCalculationVersion !== 'string' ||
    identity.ledgerCalculationVersion.length === 0 ||
    identity.ledgerCalculationVersion.trim() !== identity.ledgerCalculationVersion
  ) {
    throw new Error('Wallet ledger derived cache calculation version is invalid')
  }
  if (!Number.isSafeInteger(identity.latestSettledDayTimestamp) || identity.latestSettledDayTimestamp < 0) {
    throw new Error('Wallet ledger derived cache settled day is invalid')
  }
  if (identity.version !== 'all' && identity.version !== 'v2' && identity.version !== 'v3') {
    throw new Error('Wallet ledger derived cache vault version is invalid')
  }
  if (identity.timeframe !== '1y' && identity.timeframe !== 'all') {
    throw new Error('Wallet ledger derived cache timeframe is invalid')
  }
}

function getPayloadIdentity(
  identity: TWalletLedgerDerivedPortfolioCacheIdentity
): Omit<TWalletLedgerDerivedPortfolioCacheIdentity, 'ledgerRevision'> {
  // Coverage-only synchronization changes the storage revision without changing the event-derived result.
  // The exact storage revision is still used as the atomic write fence below.
  return {
    walletHash: identity.walletHash,
    eventRevision: identity.eventRevision,
    sourceGeneration: identity.sourceGeneration,
    appliedInvalidationSequence: identity.appliedInvalidationSequence,
    ledgerCalculationVersion: identity.ledgerCalculationVersion,
    latestSettledDayTimestamp: identity.latestSettledDayTimestamp,
    version: identity.version,
    timeframe: identity.timeframe
  }
}

function getExpectedPayloadIdentity(identity: TWalletLedgerDerivedPortfolioCacheIdentity): string {
  return JSON.stringify(getPayloadIdentity(identity))
}

function getInProcessCacheIdentity(
  identity: TWalletLedgerDerivedPortfolioCacheIdentity,
  valuationRevision: string
): string {
  return JSON.stringify({
    schemaVersion: DERIVED_CACHE_SCHEMA_VERSION,
    calculationVersion: DERIVED_CACHE_CALCULATION_VERSION,
    valuationRevision,
    identity: getPayloadIdentity(identity)
  })
}

function removeMemoryCacheEntry(cacheIdentity: string): boolean {
  const existing = derivedPortfolioCacheRuntime.memory.get(cacheIdentity)
  if (!existing) {
    return false
  }
  derivedPortfolioCacheRuntime.memory.delete(cacheIdentity)
  derivedPortfolioCacheRuntime.memoryDecodedBytes -= existing.decodedBytes
  return true
}

function evictOldestMemoryCacheEntry(): boolean {
  const oldestCacheIdentity = derivedPortfolioCacheRuntime.memory.keys().next().value
  return typeof oldestCacheIdentity === 'string' ? removeMemoryCacheEntry(oldestCacheIdentity) : false
}

function makeMemoryCacheRoom(decodedBytes: number): void {
  if (
    derivedPortfolioCacheRuntime.memory.size < DERIVED_CACHE_MEMORY_MAX_ENTRIES &&
    derivedPortfolioCacheRuntime.memoryDecodedBytes + decodedBytes <= DERIVED_CACHE_MEMORY_MAX_DECODED_BYTES
  ) {
    return
  }
  if (evictOldestMemoryCacheEntry()) {
    makeMemoryCacheRoom(decodedBytes)
  }
}

function writeMemoryCache(prepared: TPreparedDerivedPortfolioCacheWrite): void {
  if (prepared.encoded.decodedBytes > DERIVED_CACHE_MEMORY_MAX_DECODED_BYTES) {
    return
  }
  const existing = derivedPortfolioCacheRuntime.memory.get(prepared.cacheIdentity)
  if (existing && Date.now() < existing.expiresAtMs && existing.complete && !prepared.complete) {
    derivedPortfolioCacheRuntime.memory.delete(prepared.cacheIdentity)
    derivedPortfolioCacheRuntime.memory.set(prepared.cacheIdentity, existing)
    return
  }
  removeMemoryCacheEntry(prepared.cacheIdentity)
  makeMemoryCacheRoom(prepared.encoded.decodedBytes)
  derivedPortfolioCacheRuntime.memory.set(prepared.cacheIdentity, {
    value: prepared.value,
    expiresAtMs: prepared.expiresAtMs,
    decodedBytes: prepared.encoded.decodedBytes,
    complete: prepared.complete
  })
  derivedPortfolioCacheRuntime.memoryDecodedBytes += prepared.encoded.decodedBytes
}

function readMemoryCache(
  identity: TWalletLedgerDerivedPortfolioCacheIdentity,
  nowMs: number
): TWalletLedgerDerivedPortfolioCacheValue | null {
  const cacheIdentity = getInProcessCacheIdentity(identity, holdingsConfig.ledgerValuationRevision)
  const entry = derivedPortfolioCacheRuntime.memory.get(cacheIdentity)
  if (!entry) {
    return null
  }
  if (nowMs >= entry.expiresAtMs) {
    removeMemoryCacheEntry(cacheIdentity)
    return null
  }
  derivedPortfolioCacheRuntime.memory.delete(cacheIdentity)
  derivedPortfolioCacheRuntime.memory.set(cacheIdentity, entry)
  return entry.value
}

function getLedgerRevisionValuePrefix(ledgerRevision: string): string {
  return `holdings-wallet-ledger:opaque:v${WALLET_LEDGER_SCHEMA_VERSION}:${WALLET_LEDGER_CODEC}:${ledgerRevision}:`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function encodePayload(
  payload: TWalletLedgerDerivedPortfolioCachePayload,
  complete: boolean,
  cacheIdentityHash: string
): TEncodedDerivedPortfolioPayload | null {
  const json = JSON.stringify(payload)
  const decoded = Buffer.from(json, 'utf8')
  if (decoded.length > DERIVED_CACHE_MAX_DECODED_BYTES) {
    return null
  }
  const checksum = getLedgerSha256(decoded)
  const data = brotliCompressSync(decoded, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 }
  }).toString('base64')
  const quality = complete ? 'c' : 'p'
  const value = `${DERIVED_CACHE_VALUE_PREFIX}${quality}:${cacheIdentityHash}:${checksum}:${data}`
  const encodedBytes = Buffer.byteLength(value, 'utf8')
  if (encodedBytes > DERIVED_CACHE_MAX_ENCODED_BYTES) {
    return null
  }
  return { value, encodedBytes, decodedBytes: decoded.length, cacheIdentityHash }
}

function decodePayload(value: unknown): {
  readonly payload: unknown
  readonly complete: boolean
  readonly cacheIdentityHash: string
} | null {
  if (typeof value !== 'string') {
    return null
  }
  if (
    Buffer.byteLength(value, 'utf8') > DERIVED_CACHE_MAX_ENCODED_BYTES ||
    !value.startsWith(DERIVED_CACHE_VALUE_PREFIX)
  ) {
    return null
  }
  const remainder = value.slice(DERIVED_CACHE_VALUE_PREFIX.length)
  const [quality, cacheIdentityHash, checksum, data, ...unexpected] = remainder.split(':')
  if (
    unexpected.length > 0 ||
    (quality !== 'c' && quality !== 'p') ||
    !SHA256_PATTERN.test(cacheIdentityHash ?? '') ||
    !SHA256_PATTERN.test(checksum ?? '') ||
    !data
  ) {
    return null
  }
  const compressed = Buffer.from(data, 'base64')
  if (compressed.length === 0 || compressed.toString('base64') !== data) {
    return null
  }
  const decoded = (() => {
    try {
      return brotliDecompressSync(compressed, { maxOutputLength: DERIVED_CACHE_MAX_DECODED_BYTES })
    } catch {
      return null
    }
  })()
  if (!decoded || getLedgerSha256(decoded) !== checksum) {
    return null
  }
  const json = decoded.toString('utf8')
  const parsed = (() => {
    try {
      return JSON.parse(json) as unknown
    } catch {
      return null
    }
  })()
  if (parsed === null || JSON.stringify(parsed) !== json) {
    return null
  }
  return { payload: parsed, complete: quality === 'c', cacheIdentityHash: cacheIdentityHash ?? '' }
}

function isPortfolioValue(
  value: unknown,
  identity: TWalletLedgerDerivedPortfolioCacheIdentity
): value is TWalletLedgerDerivedPortfolioCacheValue {
  if (!isRecord(value) || !isRecord(value.protocolReturn) || !isRecord(value.growth)) {
    return false
  }
  const protocolReturn = value.protocolReturn
  const growth = value.growth
  return (
    typeof protocolReturn.address === 'string' &&
    EVM_ADDRESS_PATTERN.test(protocolReturn.address) &&
    hashLedgerWalletAddress(protocolReturn.address) === identity.walletHash &&
    protocolReturn.version === identity.version &&
    protocolReturn.timeframe === identity.timeframe &&
    typeof protocolReturn.generatedAt === 'string' &&
    isRecord(protocolReturn.summary) &&
    Array.isArray(protocolReturn.dataPoints) &&
    Array.isArray(protocolReturn.familySeries) &&
    typeof growth.address === 'string' &&
    growth.address.toLowerCase() === protocolReturn.address.toLowerCase() &&
    growth.version === identity.version &&
    typeof growth.generatedAt === 'string' &&
    isRecord(growth.summary) &&
    Array.isArray(growth.vaults)
  )
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }
  try {
    const candidate = Reflect.get(error, 'status') ?? Reflect.get(error, 'statusCode')
    const status = typeof candidate === 'string' && /^\d{3}$/.test(candidate) ? Number(candidate) : candidate
    return Number.isInteger(status) ? Number(status) : null
  } catch {
    return null
  }
}

function isRetryableWriteError(error: unknown): boolean {
  const status = getErrorStatus(error)
  return status === null || status === 408 || status === 425 || status === 429 || status >= 500
}

function parsePayload(
  value: unknown,
  identity: TWalletLedgerDerivedPortfolioCacheIdentity,
  nowMs: number
): TWalletLedgerDerivedPortfolioCacheValue | null {
  const decoded = decodePayload(value)
  if (!decoded || !isRecord(decoded.payload)) {
    return null
  }
  const parsed = decoded.payload
  const updatedAtMs = parsed.updatedAtMs
  const expiresAtMs = parsed.expiresAtMs
  if (
    parsed.schemaVersion !== DERIVED_CACHE_SCHEMA_VERSION ||
    parsed.calculationVersion !== DERIVED_CACHE_CALCULATION_VERSION ||
    parsed.valuationRevision !== holdingsConfig.ledgerValuationRevision ||
    decoded.cacheIdentityHash !==
      getLedgerSha256(getInProcessCacheIdentity(identity, holdingsConfig.ledgerValuationRevision)) ||
    JSON.stringify(parsed.identity) !== getExpectedPayloadIdentity(identity) ||
    typeof updatedAtMs !== 'number' ||
    !Number.isSafeInteger(updatedAtMs) ||
    updatedAtMs < 0 ||
    updatedAtMs > nowMs + DERIVED_CACHE_MAX_FUTURE_SKEW_MS ||
    typeof expiresAtMs !== 'number' ||
    !Number.isSafeInteger(expiresAtMs) ||
    expiresAtMs <= updatedAtMs ||
    expiresAtMs > updatedAtMs + DERIVED_CACHE_COMPLETE_TTL_SECONDS * 1000 ||
    nowMs >= expiresAtMs ||
    !isPortfolioValue(parsed.value, identity) ||
    decoded.complete !== isComplete(parsed.value)
  ) {
    return null
  }
  return parsed.value
}

function getRedis(): TWalletLedgerDerivedCacheRedis | null {
  return getHoldingsLedgerRedisClient() as TWalletLedgerDerivedCacheRedis | null
}

function getWriteRedis(): TWalletLedgerDerivedCacheRedis | null {
  return getHoldingsLedgerRedisClientWithTimeout(
    DERIVED_CACHE_WRITE_ATTEMPT_TIMEOUT_MS
  ) as TWalletLedgerDerivedCacheRedis | null
}

function parseScriptWriteStatus(value: unknown): 0 | 1 | 2 {
  if (value === 1 || value === '1') {
    return 1
  }
  if (value === 0 || value === '0') {
    return 0
  }
  if (value === 2 || value === '2') {
    return 2
  }
  throw new Error('Wallet ledger derived cache script returned an invalid status')
}

async function writeEncodedPayload(args: {
  readonly redis: TWalletLedgerDerivedCacheRedis
  readonly identity: TWalletLedgerDerivedPortfolioCacheIdentity
  readonly encodedValue: string
  readonly ttlSeconds: number
  readonly complete: boolean
  readonly cacheIdentityHash: string
  readonly attempt?: number
}): Promise<unknown> {
  const attempt = args.attempt ?? 1
  try {
    const result = await args.redis.eval<string[], unknown>(
      WRITE_DERIVED_PORTFOLIO_SCRIPT,
      [getWalletLedgerKey(args.identity.walletHash), getWalletLedgerDerivedPortfolioCacheKey(args.identity)],
      [
        getLedgerRevisionValuePrefix(args.identity.ledgerRevision),
        args.encodedValue,
        String(args.ttlSeconds),
        args.complete ? '1' : '0',
        `${DERIVED_CACHE_VALUE_PREFIX}c:${args.cacheIdentityHash}:`
      ]
    )
    adoptHoldingsLedgerRedisReadYourWritesSyncToken(args.redis)
    return result
  } catch (error) {
    if (attempt >= DERIVED_CACHE_WRITE_ATTEMPTS || !isRetryableWriteError(error)) {
      throw error
    }
    debugLog('wallet-ledger-derived-cache', 'retrying transient derived portfolio cache write', {
      attempt: attempt + 1,
      maxAttempts: DERIVED_CACHE_WRITE_ATTEMPTS
    })
    return writeEncodedPayload({ ...args, attempt: attempt + 1 })
  }
}

function isComplete(value: TWalletLedgerDerivedPortfolioCacheValue): boolean {
  return value.protocolReturn.summary.isComplete === true && value.growth.summary.isComplete === true
}

function hasResults(value: TWalletLedgerDerivedPortfolioCacheValue): boolean {
  return value.protocolReturn.summary.totalVaults > 0 || value.growth.summary.totalVaults > 0
}

function prepareDerivedPortfolioCacheWrite(
  identity: TWalletLedgerDerivedPortfolioCacheIdentity,
  value: TWalletLedgerDerivedPortfolioCacheValue
): TPreparedDerivedPortfolioCacheWriteResult {
  if (!isPortfolioValue(value, identity)) {
    return { status: 'invalid' }
  }
  if (!hasResults(value)) {
    return { status: 'empty' }
  }
  const complete = isComplete(value)
  const ttlSeconds = complete ? DERIVED_CACHE_COMPLETE_TTL_SECONDS : DERIVED_CACHE_PROVISIONAL_TTL_SECONDS
  const updatedAtMs = Date.now()
  const valuationRevision = holdingsConfig.ledgerValuationRevision
  const cacheIdentity = getInProcessCacheIdentity(identity, valuationRevision)
  const cacheIdentityHash = getLedgerSha256(cacheIdentity)
  const payload: TWalletLedgerDerivedPortfolioCachePayload = {
    schemaVersion: DERIVED_CACHE_SCHEMA_VERSION,
    calculationVersion: DERIVED_CACHE_CALCULATION_VERSION,
    valuationRevision,
    identity: getPayloadIdentity(identity),
    updatedAtMs,
    expiresAtMs: updatedAtMs + ttlSeconds * 1000,
    value
  }
  const encoded = (() => {
    try {
      return encodePayload(payload, complete, cacheIdentityHash)
    } catch {
      return undefined
    }
  })()
  if (encoded === null) {
    return { status: 'oversized' }
  }
  if (encoded === undefined) {
    return { status: 'error' }
  }
  return {
    status: 'ready',
    prepared: {
      identity,
      value,
      complete,
      ttlSeconds,
      expiresAtMs: payload.expiresAtMs,
      cacheIdentity,
      persistenceIdentity: JSON.stringify([cacheIdentity, identity.ledgerRevision, complete]),
      encoded
    }
  }
}

function getPreparationWriteStatus(
  status: Exclude<TPreparedDerivedPortfolioCacheWriteResult['status'], 'ready'>
): TWalletLedgerDerivedPortfolioCacheWriteStatus {
  return status === 'invalid' ? 'error' : status
}

function getPreparationEnqueueStatus(
  status: Exclude<TPreparedDerivedPortfolioCacheWriteResult['status'], 'ready'>
): Exclude<TWalletLedgerDerivedPortfolioCacheEnqueueResult['status'], 'queued' | 'memory-only'> {
  return status === 'invalid' ? 'error' : status
}

function logPreparedWriteRejection(
  identity: TWalletLedgerDerivedPortfolioCacheIdentity,
  getDurationMs: () => number,
  status: Exclude<TPreparedDerivedPortfolioCacheWriteResult['status'], 'ready'>
): void {
  debugLog('wallet-ledger-derived-cache', 'completed derived portfolio cache write', {
    durationMs: getDurationMs(),
    version: identity.version,
    timeframe: identity.timeframe,
    status
  })
}

async function persistPreparedDerivedPortfolioCacheWrite(
  redis: TWalletLedgerDerivedCacheRedis,
  prepared: TPreparedDerivedPortfolioCacheWrite,
  getDurationMs: () => number
): Promise<TWalletLedgerDerivedPortfolioCacheWriteStatus> {
  try {
    const writeStatus = parseScriptWriteStatus(
      await executeHoldingsLedgerRedisOperation('write', () =>
        writeEncodedPayload({
          redis,
          identity: prepared.identity,
          encodedValue: prepared.encoded.value,
          ttlSeconds: prepared.ttlSeconds,
          complete: prepared.complete,
          cacheIdentityHash: prepared.encoded.cacheIdentityHash
        })
      )
    )
    const status =
      writeStatus === 0
        ? 'fenced'
        : writeStatus === 2
          ? 'preserved-complete'
          : prepared.complete
            ? 'saved'
            : 'saved-provisional'
    debugLog('wallet-ledger-derived-cache', 'completed derived portfolio cache write', {
      durationMs: getDurationMs(),
      version: prepared.identity.version,
      timeframe: prepared.identity.timeframe,
      encodedBytes: prepared.encoded.encodedBytes,
      decodedBytes: prepared.encoded.decodedBytes,
      status
    })
    return status
  } catch {
    debugLog('wallet-ledger-derived-cache', 'completed derived portfolio cache write', {
      durationMs: getDurationMs(),
      version: prepared.identity.version,
      timeframe: prepared.identity.timeframe,
      status: 'error'
    })
    return 'error'
  }
}

function removePendingWrite(persistenceIdentity: string, token: object): void {
  const pending = derivedPortfolioCacheRuntime.pendingWrites.get(persistenceIdentity)
  if (pending?.token !== token) {
    return
  }
  derivedPortfolioCacheRuntime.pendingWrites.delete(persistenceIdentity)
  derivedPortfolioCacheRuntime.pendingEncodedBytes -= pending.encodedBytes
}

function enqueuePreparedPersistence(
  redis: TWalletLedgerDerivedCacheRedis,
  prepared: TPreparedDerivedPortfolioCacheWrite,
  getDurationMs: () => number
): Promise<TWalletLedgerDerivedPortfolioCacheWriteStatus> | null {
  const existing = derivedPortfolioCacheRuntime.pendingWrites.get(prepared.persistenceIdentity)
  if (existing) {
    return existing.persistence
  }
  if (
    derivedPortfolioCacheRuntime.pendingWrites.size >= DERIVED_CACHE_PENDING_WRITE_MAX_ENTRIES ||
    derivedPortfolioCacheRuntime.pendingEncodedBytes + prepared.encoded.encodedBytes >
      DERIVED_CACHE_PENDING_WRITE_MAX_ENCODED_BYTES
  ) {
    return null
  }
  const token = {}
  const persistence = persistPreparedDerivedPortfolioCacheWrite(redis, prepared, getDurationMs).finally(() => {
    removePendingWrite(prepared.persistenceIdentity, token)
  })
  derivedPortfolioCacheRuntime.pendingWrites.set(prepared.persistenceIdentity, {
    token,
    encodedBytes: prepared.encoded.encodedBytes,
    persistence
  })
  derivedPortfolioCacheRuntime.pendingEncodedBytes += prepared.encoded.encodedBytes
  return persistence
}

export function getWalletLedgerDerivedPortfolioCacheKey(identity: TWalletLedgerDerivedPortfolioCacheIdentity): string {
  assertIdentity(identity)
  return `${getWalletLedgerKey(identity.walletHash)}:derived-portfolio:v${DERIVED_CACHE_SCHEMA_VERSION}:${identity.version}:${identity.timeframe}`
}

export async function readWalletLedgerDerivedPortfolioCache(
  identity: TWalletLedgerDerivedPortfolioCacheIdentity
): Promise<TWalletLedgerDerivedPortfolioCacheReadResult> {
  assertIdentity(identity)
  const getDurationMs = startHoldingsDebugTimer()
  const memoryValue = readMemoryCache(identity, Date.now())
  if (memoryValue) {
    debugLog('wallet-ledger-derived-cache', 'completed derived portfolio cache read', {
      durationMs: getDurationMs(),
      version: identity.version,
      timeframe: identity.timeframe,
      status: 'memory-hit'
    })
    return { status: 'hit', value: memoryValue }
  }
  const redis = getRedis()
  if (!redis) {
    debugLog('wallet-ledger-derived-cache', 'completed derived portfolio cache read', {
      durationMs: getDurationMs(),
      version: identity.version,
      timeframe: identity.timeframe,
      status: 'disabled'
    })
    return { status: 'disabled' }
  }

  try {
    const value = parsePayload(
      await executeHoldingsLedgerRedisOperation('read', () =>
        redis.get<unknown>(getWalletLedgerDerivedPortfolioCacheKey(identity))
      ),
      identity,
      Date.now()
    )
    const status = value ? 'hit' : 'miss'
    debugLog('wallet-ledger-derived-cache', 'completed derived portfolio cache read', {
      durationMs: getDurationMs(),
      version: identity.version,
      timeframe: identity.timeframe,
      status
    })
    return value ? { status: 'hit', value } : { status: 'miss' }
  } catch {
    debugLog('wallet-ledger-derived-cache', 'completed derived portfolio cache read', {
      durationMs: getDurationMs(),
      version: identity.version,
      timeframe: identity.timeframe,
      status: 'error'
    })
    return { status: 'error' }
  }
}

export async function writeWalletLedgerDerivedPortfolioCache(
  identity: TWalletLedgerDerivedPortfolioCacheIdentity,
  value: TWalletLedgerDerivedPortfolioCacheValue
): Promise<TWalletLedgerDerivedPortfolioCacheWriteStatus> {
  assertIdentity(identity)
  const getDurationMs = startHoldingsDebugTimer()
  const preparedResult = prepareDerivedPortfolioCacheWrite(identity, value)
  if (preparedResult.status !== 'ready') {
    logPreparedWriteRejection(identity, getDurationMs, preparedResult.status)
    return getPreparationWriteStatus(preparedResult.status)
  }
  const redis = getWriteRedis()
  if (!redis) {
    debugLog('wallet-ledger-derived-cache', 'completed derived portfolio cache write', {
      durationMs: getDurationMs(),
      version: identity.version,
      timeframe: identity.timeframe,
      status: 'disabled'
    })
    return 'disabled'
  }
  return persistPreparedDerivedPortfolioCacheWrite(redis, preparedResult.prepared, getDurationMs)
}

export function enqueueWalletLedgerDerivedPortfolioCacheWrite(
  identity: TWalletLedgerDerivedPortfolioCacheIdentity,
  value: TWalletLedgerDerivedPortfolioCacheValue
): TWalletLedgerDerivedPortfolioCacheEnqueueResult {
  assertIdentity(identity)
  const getDurationMs = startHoldingsDebugTimer()
  const preparedResult = prepareDerivedPortfolioCacheWrite(identity, value)
  if (preparedResult.status !== 'ready') {
    logPreparedWriteRejection(identity, getDurationMs, preparedResult.status)
    return {
      status: getPreparationEnqueueStatus(preparedResult.status),
      persistence: null
    }
  }

  writeMemoryCache(preparedResult.prepared)
  const redis = getWriteRedis()
  const persistence = redis ? enqueuePreparedPersistence(redis, preparedResult.prepared, getDurationMs) : null
  debugLog('wallet-ledger-derived-cache', 'queued derived portfolio cache write', {
    durationMs: getDurationMs(),
    version: identity.version,
    timeframe: identity.timeframe,
    status: persistence ? 'queued' : 'memory-only',
    reason: redis ? (persistence ? 'scheduled' : 'capacity') : 'disabled'
  })
  return persistence ? { status: 'queued', persistence } : { status: 'memory-only', persistence: null }
}
