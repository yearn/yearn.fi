import { createHash } from 'node:crypto'
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
const HOLDINGS_TOTALS_KEY_PREFIX = 'holdings:totals'
const VAULT_INVALIDATION_KEY_PREFIX = 'holdings:vault-invalidated'
const REDIS_SCAN_COUNT = 500

function normalizeUserAddress(userAddress: string): string {
  return userAddress.toLowerCase()
}

function getUserAddressCacheKey(userAddress: string): string {
  return createHash('sha256').update(normalizeUserAddress(userAddress)).digest('hex')
}

function getTotalsKey(userAddressHash: string, version: string): string {
  return `${HOLDINGS_TOTALS_KEY_PREFIX}:${userAddressHash}:${version}`
}

function getTotalsKeyPattern(userAddressHash: string): string {
  return `${HOLDINGS_TOTALS_KEY_PREFIX}:${userAddressHash}:*`
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

async function scanRedisKeys(pattern: string, cursor = '0', collectedKeys: string[] = []): Promise<string[]> {
  const redis = getHoldingsRedisClient()
  if (!redis) {
    return collectedKeys
  }

  const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: REDIS_SCAN_COUNT })
  const nextKeys = [...collectedKeys, ...keys]
  return nextCursor === '0' ? nextKeys : scanRedisKeys(pattern, nextCursor, nextKeys)
}

export async function getCachedTotals(
  userAddress: string,
  version: string,
  startDate: string,
  endDate: string
): Promise<CachedTotal[]> {
  const result = await getCachedTotalsWithTimestamp(userAddress, version, startDate, endDate)
  return result.totals
}

export async function saveCachedTotals(userAddress: string, version: string, totals: CachedTotal[]): Promise<boolean> {
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
    const key = getTotalsKey(userAddressHash, version)
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
      version,
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

export async function clearUserCache(userAddress: string, version?: string): Promise<number> {
  const userAddressHash = getUserAddressCacheKey(userAddress)

  if (!isHoldingsStorageEnabled()) {
    debugLog('cache', 'skipping user cache clear because Redis storage is disabled', {
      userAddressHash,
      version: version ?? null
    })
    return 0
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    debugLog('cache', 'skipping user cache clear because Redis client is unavailable', {
      userAddressHash,
      version: version ?? null
    })
    return 0
  }

  try {
    const keys = version
      ? [getTotalsKey(userAddressHash, version)]
      : await scanRedisKeys(getTotalsKeyPattern(userAddressHash))
    const deletedCount = keys.length > 0 ? await redis.del(...keys) : 0
    console.log(
      `[Cache] Cleared ${deletedCount} Redis cached entries for user ${userAddress}${version ? ` (${version})` : ''}`
    )
    return deletedCount
  } catch (error) {
    handleHoldingsRedisError('user cache clear failed', error)
    debugError('cache', 'user cache clear failed', error, {
      userAddressHash,
      version: version ?? null
    })
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
  version: string,
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
      version,
      startDate,
      endDate
    })
    const valuesByDate = await redis.hgetall<Record<string, unknown>>(getTotalsKey(userAddressHash, version))
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
      version,
      startDate,
      endDate
    })
    return { totals: [], oldestUpdatedAt: null }
  }
}
