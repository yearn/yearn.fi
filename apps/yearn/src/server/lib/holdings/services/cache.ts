import { createHash } from 'node:crypto'
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib'
import { getHoldingsRedisClient, handleHoldingsRedisError, isHoldingsStorageEnabled } from '../storage/redis'
import { debugError, debugLog } from './debug'

export interface CachedTotal {
  date: string
  usdValue: number
}

interface CachedTotalPayload {
  usdValue: number
  updatedAt: number
}

interface ParsedCachedTotal {
  date: string
  usdValue: number
  updatedAt: Date
}

export interface CachedTotalsResult {
  totals: CachedTotal[]
  oldestUpdatedAt: Date | null
}

export interface VaultIdentifier {
  address: string
  chainId: number
}

const HOLDINGS_TOTALS_TTL_SECONDS = 30 * 24 * 60 * 60
// v3 starts fresh after preventing incomplete PPS responses from persisting zero-valued history.
// Old hashes expire naturally and cannot reintroduce previously cached incomplete days.
const HOLDINGS_TOTALS_KEY_PREFIX = 'holdings:totals:v3'
const PROTOCOL_RETURN_HISTORY_TTL_SECONDS = 30 * 24 * 60 * 60
// v15 stores nested-vault returns consistently in terminal-asset units.
const PROTOCOL_RETURN_HISTORY_KEY_PREFIX = 'holdings:protocol-return-history:v15'
const PROTOCOL_RETURN_HISTORY_VALUE_PREFIX = 'br1:'
const PROTOCOL_RETURN_HISTORY_MAX_ENCODED_BYTES = 4 * 1024 * 1024
const PROTOCOL_RETURN_HISTORY_MAX_DECODED_BYTES = 64 * 1024 * 1024
const VAULT_INVALIDATION_KEY_PREFIX = 'holdings:vault-invalidated'
export interface ProtocolReturnHistoryCacheIdentity {
  userAddress: string
  timeframe: string
  vaultScope?: VaultIdentifier[]
}

export interface CachedProtocolReturnHistory<TResponse> {
  settledDate: string
  response: TResponse
}

interface CachedProtocolReturnHistoryPayload<TResponse> {
  settledDate: string
  updatedAt: number
  vaults: VaultIdentifier[]
  response: TResponse
}

function normalizeUserAddress(userAddress: string): string {
  return userAddress.toLowerCase()
}

function getUserAddressCacheKey(userAddress: string): string {
  return createHash('sha256').update(normalizeUserAddress(userAddress)).digest('hex')
}

function getTotalsKey(userAddressHash: string): string {
  return `${HOLDINGS_TOTALS_KEY_PREFIX}:${userAddressHash}`
}

function getVaultScopeCacheKey(vaultScope?: VaultIdentifier[]): string {
  if (!vaultScope?.length) {
    return 'all'
  }

  const normalizedScope = Array.from(
    new Set(vaultScope.map((vault) => `${vault.chainId}:${vault.address.toLowerCase()}`))
  )
    .sort()
    .join(',')
  return createHash('sha256').update(normalizedScope).digest('hex')
}

export function getProtocolReturnHistoryCacheKey(identity: ProtocolReturnHistoryCacheIdentity): string {
  const userAddressHash = getUserAddressCacheKey(identity.userAddress)
  const vaultScopeKey = getVaultScopeCacheKey(identity.vaultScope)
  return `${PROTOCOL_RETURN_HISTORY_KEY_PREFIX}:${userAddressHash}:${identity.timeframe}:${vaultScopeKey}`
}

function getVaultInvalidationKey(vault: VaultIdentifier): string {
  return `${VAULT_INVALIDATION_KEY_PREFIX}:${vault.chainId}:${vault.address.toLowerCase()}`
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function encodeProtocolReturnHistoryPayload<TResponse>(payload: CachedProtocolReturnHistoryPayload<TResponse>): {
  value: string
  decodedBytes: number
  encodedBytes: number
} {
  const json = JSON.stringify(payload)
  const compressed = brotliCompressSync(Buffer.from(json), {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 4
    }
  })
  const value = `${PROTOCOL_RETURN_HISTORY_VALUE_PREFIX}${compressed.toString('base64')}`

  return {
    value,
    decodedBytes: Buffer.byteLength(json),
    encodedBytes: Buffer.byteLength(value)
  }
}

function decodeProtocolReturnHistoryPayload(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith(PROTOCOL_RETURN_HISTORY_VALUE_PREFIX)) {
    return null
  }

  if (Buffer.byteLength(value) > PROTOCOL_RETURN_HISTORY_MAX_ENCODED_BYTES) {
    return null
  }

  try {
    const encoded = value.slice(PROTOCOL_RETURN_HISTORY_VALUE_PREFIX.length)
    const compressed = Buffer.from(encoded, 'base64')
    if (compressed.length === 0 || compressed.toString('base64') !== encoded) {
      return null
    }

    return JSON.parse(
      brotliDecompressSync(compressed, {
        maxOutputLength: PROTOCOL_RETURN_HISTORY_MAX_DECODED_BYTES
      }).toString()
    )
  } catch {
    return null
  }
}

function parseCachedTotalPayload(value: unknown): CachedTotalPayload | null {
  const parsed = parseJsonValue(value)
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const payload = parsed as Partial<CachedTotalPayload>
  const usdValue = Number(payload.usdValue)
  const updatedAt = Number(payload.updatedAt)

  if (!Number.isFinite(usdValue) || !Number.isFinite(updatedAt)) {
    return null
  }

  return { usdValue, updatedAt }
}

function parseVaultIdentifier(value: unknown): VaultIdentifier | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<VaultIdentifier>
  return typeof candidate.address === 'string' && Number.isInteger(candidate.chainId)
    ? { address: candidate.address, chainId: Number(candidate.chainId) }
    : null
}

function parseCachedProtocolReturnHistoryPayload<TResponse>(
  value: unknown
): CachedProtocolReturnHistoryPayload<TResponse> | null {
  const parsed = decodeProtocolReturnHistoryPayload(value)
  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const payload = parsed as Partial<CachedProtocolReturnHistoryPayload<TResponse>>
  const updatedAt = Number(payload.updatedAt)
  const vaults = Array.isArray(payload.vaults) ? payload.vaults.map(parseVaultIdentifier) : []

  if (
    typeof payload.settledDate !== 'string' ||
    !Number.isFinite(updatedAt) ||
    !Array.isArray(payload.vaults) ||
    vaults.some((vault) => vault === null) ||
    !('response' in payload)
  ) {
    return null
  }

  return {
    settledDate: payload.settledDate,
    updatedAt,
    vaults: vaults.filter((vault): vault is VaultIdentifier => vault !== null),
    response: payload.response as TResponse
  }
}

function isDateInRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate
}

function parseCachedTotalsByDate(
  valuesByDate: Record<string, unknown> | null,
  startDate: string,
  endDate: string
): ParsedCachedTotal[] {
  return Object.entries(valuesByDate ?? {})
    .filter(([date]) => isDateInRange(date, startDate, endDate))
    .map(([date, value]) => {
      const payload = parseCachedTotalPayload(value)
      return payload
        ? {
            date,
            usdValue: payload.usdValue,
            updatedAt: new Date(payload.updatedAt)
          }
        : null
    })
    .filter((total): total is ParsedCachedTotal => total !== null && Number.isFinite(total.updatedAt.getTime()))
    .sort((left, right) => left.date.localeCompare(right.date))
}

export async function saveCachedTotals(userAddress: string, totals: CachedTotal[]): Promise<boolean> {
  const userAddressHash = getUserAddressCacheKey(userAddress)

  if (!isHoldingsStorageEnabled() || totals.length === 0) {
    if (totals.length > 0) {
      debugLog('cache', 'skipping cached totals save because Redis storage is disabled', { rows: totals.length })
    }
    return false
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    debugLog('cache', 'skipping cached totals save because Redis client is unavailable', { rows: totals.length })
    return false
  }

  try {
    const updatedAt = Date.now()
    const key = getTotalsKey(userAddressHash)
    const valuesByDate = Object.fromEntries(
      totals.map((total) => [
        total.date,
        JSON.stringify({
          usdValue: total.usdValue,
          updatedAt
        } satisfies CachedTotalPayload)
      ])
    )

    debugLog('cache', 'saving cached totals to Redis', {
      userAddressHash,
      rows: totals.length
    })

    await redis.hset(key, valuesByDate)
    await redis.expire(key, HOLDINGS_TOTALS_TTL_SECONDS)
    debugLog('cache', 'saved cached totals to Redis', { rows: totals.length })
    return true
  } catch (error) {
    handleHoldingsRedisError('cached totals save failed', error)
    debugError('cache', 'cached totals save failed', error, { rows: totals.length })
    return false
  }
}

export async function getCachedProtocolReturnHistorySnapshot<TResponse>(
  identity: ProtocolReturnHistoryCacheIdentity,
  maximumSettledDate: string
): Promise<CachedProtocolReturnHistory<TResponse> | null> {
  if (!isHoldingsStorageEnabled()) {
    debugLog('cache', 'skipping protocol return history cache lookup because Redis storage is disabled')
    return null
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    debugLog('cache', 'skipping protocol return history cache lookup because Redis client is unavailable')
    return null
  }

  const key = getProtocolReturnHistoryCacheKey(identity)

  try {
    const payload = parseCachedProtocolReturnHistoryPayload<TResponse>(await redis.get(key))
    if (!payload) {
      debugLog('cache', 'protocol return history cache miss', { key })
      return null
    }

    if (payload.settledDate > maximumSettledDate) {
      debugLog('cache', 'protocol return history cache is from a future settled date', {
        key,
        cachedSettledDate: payload.settledDate,
        requestedSettledDate: maximumSettledDate
      })
      return null
    }

    const isStale = await checkCacheStaleness(payload.vaults, new Date(payload.updatedAt))
    if (isStale) {
      debugLog('cache', 'protocol return history cache is stale', { key, vaults: payload.vaults.length })
      return null
    }

    debugLog('cache', 'protocol return history cache hit', {
      key,
      vaults: payload.vaults.length,
      cachedSettledDate: payload.settledDate,
      requestedSettledDate: maximumSettledDate
    })
    return {
      settledDate: payload.settledDate,
      response: payload.response
    }
  } catch (error) {
    handleHoldingsRedisError('protocol return history cache lookup failed', error)
    debugError('cache', 'protocol return history cache lookup failed', error, { key })
    return null
  }
}

export async function saveCachedProtocolReturnHistory<TResponse>(
  identity: ProtocolReturnHistoryCacheIdentity,
  settledDate: string,
  vaults: VaultIdentifier[],
  response: TResponse,
  updatedAt = Date.now()
): Promise<boolean> {
  if (!isHoldingsStorageEnabled()) {
    debugLog('cache', 'skipping protocol return history cache save because Redis storage is disabled')
    return false
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    debugLog('cache', 'skipping protocol return history cache save because Redis client is unavailable')
    return false
  }

  const key = getProtocolReturnHistoryCacheKey(identity)

  try {
    const payload: CachedProtocolReturnHistoryPayload<TResponse> = {
      settledDate,
      updatedAt,
      vaults: vaults.map((vault) => ({
        address: vault.address.toLowerCase(),
        chainId: vault.chainId
      })),
      response
    }
    const encoded = encodeProtocolReturnHistoryPayload(payload)
    if (encoded.encodedBytes > PROTOCOL_RETURN_HISTORY_MAX_ENCODED_BYTES) {
      debugLog('cache', 'skipping oversized compressed protocol return history cache save', {
        key,
        vaults: vaults.length,
        decodedBytes: encoded.decodedBytes,
        encodedBytes: encoded.encodedBytes,
        maximumEncodedBytes: PROTOCOL_RETURN_HISTORY_MAX_ENCODED_BYTES
      })
      return false
    }

    debugLog('cache', 'saving compressed protocol return history snapshot to Redis', {
      key,
      vaults: vaults.length,
      decodedBytes: encoded.decodedBytes,
      encodedBytes: encoded.encodedBytes
    })
    await redis.set(key, encoded.value, { ex: PROTOCOL_RETURN_HISTORY_TTL_SECONDS })
    debugLog('cache', 'saved protocol return history snapshot to Redis', {
      key,
      vaults: vaults.length,
      decodedBytes: encoded.decodedBytes,
      encodedBytes: encoded.encodedBytes
    })
    return true
  } catch (error) {
    handleHoldingsRedisError('protocol return history cache save failed', error)
    debugError('cache', 'protocol return history cache save failed', error, { key, vaults: vaults.length })
    return false
  }
}

export async function clearUserCache(userAddress: string): Promise<number> {
  const userAddressHash = getUserAddressCacheKey(userAddress)

  if (!isHoldingsStorageEnabled()) {
    debugLog('cache', 'skipping user cache clear because Redis storage is disabled', { userAddressHash })
    return 0
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    debugLog('cache', 'skipping user cache clear because Redis client is unavailable', { userAddressHash })
    return 0
  }

  try {
    const deletedCount = await redis.del(getTotalsKey(userAddressHash))
    console.log(`[Cache] Cleared ${deletedCount} Redis cached entries for user ${userAddress}`)
    return deletedCount
  } catch (error) {
    handleHoldingsRedisError('user cache clear failed', error)
    debugError('cache', 'user cache clear failed', error, { userAddressHash })
    return 0
  }
}

export async function invalidateVaults(vaults: VaultIdentifier[]): Promise<number> {
  if (!isHoldingsStorageEnabled() || vaults.length === 0) {
    if (vaults.length > 0) {
      debugLog('cache', 'skipping vault invalidation because Redis storage is disabled', { vaults: vaults.length })
    }
    return 0
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    debugLog('cache', 'skipping vault invalidation because Redis client is unavailable', { vaults: vaults.length })
    return 0
  }

  try {
    const invalidatedAt = Date.now()
    const results = await Promise.all(vaults.map((vault) => redis.set(getVaultInvalidationKey(vault), invalidatedAt)))
    const invalidatedCount = results.filter(Boolean).length
    debugLog('cache', 'invalidated vault cache timestamps in Redis', {
      vaults: vaults.length,
      invalidatedCount
    })
    return invalidatedCount
  } catch (error) {
    handleHoldingsRedisError('vault cache invalidation failed', error)
    debugError('cache', 'vault cache invalidation failed', error, { vaults: vaults.length })
    return 0
  }
}

export async function checkCacheStaleness(
  vaults: VaultIdentifier[],
  cacheOldestTimestamp: Date | null
): Promise<boolean> {
  if (!isHoldingsStorageEnabled() || vaults.length === 0 || !cacheOldestTimestamp) {
    if (vaults.length > 0 && cacheOldestTimestamp !== null) {
      debugLog('cache', 'skipping cache staleness check because Redis storage is disabled', { vaults: vaults.length })
    }
    return false
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    debugLog('cache', 'skipping cache staleness check because Redis client is unavailable', { vaults: vaults.length })
    return false
  }

  try {
    debugLog('cache', 'checking Redis cache staleness', {
      vaults: vaults.length,
      cacheOldestTimestamp: cacheOldestTimestamp.toISOString()
    })
    const keys = vaults.map(getVaultInvalidationKey)
    const invalidationValues = await redis.mget<Array<string | number | null>>(keys)
    const latestInvalidationMs = invalidationValues
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .reduce<number | null>((latest, value) => (latest === null || value > latest ? value : latest), null)

    if (latestInvalidationMs === null) {
      return false
    }

    const latestInvalidation = new Date(latestInvalidationMs)
    const isStale = latestInvalidation > cacheOldestTimestamp
    debugLog('cache', 'checked Redis cache staleness', {
      vaults: vaults.length,
      latestInvalidation: latestInvalidation.toISOString(),
      cacheOldestTimestamp: cacheOldestTimestamp.toISOString(),
      isStale
    })

    if (isStale) {
      console.log(
        `[Cache] Cache is stale: invalidation at ${latestInvalidation.toISOString()} > cache at ${cacheOldestTimestamp.toISOString()}`
      )
    }

    return isStale
  } catch (error) {
    handleHoldingsRedisError('cache staleness check failed', error)
    debugError('cache', 'cache staleness check failed', error, { vaults: vaults.length })
    return false
  }
}

export async function getCachedTotalsWithTimestamp(
  userAddress: string,
  startDate: string,
  endDate: string
): Promise<CachedTotalsResult> {
  const userAddressHash = getUserAddressCacheKey(userAddress)

  if (!isHoldingsStorageEnabled()) {
    debugLog('cache', 'skipping cached totals with timestamp lookup because Redis storage is disabled')
    return { totals: [], oldestUpdatedAt: null }
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    debugLog('cache', 'skipping cached totals with timestamp lookup because Redis client is unavailable')
    return { totals: [], oldestUpdatedAt: null }
  }

  try {
    debugLog('cache', 'loading cached totals with timestamps from Redis', {
      userAddressHash,
      startDate,
      endDate
    })
    const valuesByDate = await redis.hgetall<Record<string, unknown>>(getTotalsKey(userAddressHash))
    const parsedTotals = parseCachedTotalsByDate(valuesByDate, startDate, endDate)
    const totals = parsedTotals.map((total) => ({
      date: total.date,
      usdValue: total.usdValue
    }))
    const oldestUpdatedAt =
      parsedTotals.length > 0
        ? parsedTotals.reduce(
            (oldest, total) => (total.updatedAt < oldest ? total.updatedAt : oldest),
            parsedTotals[0].updatedAt
          )
        : null

    debugLog('cache', 'loaded cached totals with timestamps from Redis', {
      rows: totals.length,
      oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
    })
    return { totals, oldestUpdatedAt }
  } catch (error) {
    handleHoldingsRedisError('cached totals with timestamp lookup failed', error)
    debugError('cache', 'cached totals with timestamp lookup failed', error, {
      userAddressHash,
      startDate,
      endDate
    })
    return { totals: [], oldestUpdatedAt: null }
  }
}
