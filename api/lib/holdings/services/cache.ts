import { createHash } from 'node:crypto'
import { getPool, isDatabaseEnabled } from '../db/connection'
import { debugError, debugLog } from './debug'
import type { VaultVersion } from './graphql'

export interface CachedTotal {
  date: string
  usdValue: number
}

export interface CachedPrice {
  tokenKey: string
  timestamp: number
  price: number
}

export interface CachedPriceMiss {
  tokenKey: string
  timestamp: number
}

export interface CachedPriceLookup {
  tokenKey: string
  timestamps: number[]
}

const PRICE_MISS_TTL_MS = 7 * 24 * 60 * 60 * 1_000

function normalizeUserAddress(userAddress: string): string {
  return userAddress.toLowerCase()
}

function getUserAddressCacheKey(userAddress: string): string {
  return createHash('sha256').update(normalizeUserAddress(userAddress)).digest('hex')
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_value, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize)
  )
}

function normalizeCachedPriceLookups(lookups: CachedPriceLookup[]): CachedPriceLookup[] {
  const timestampsByToken = lookups.reduce<Map<string, Set<number>>>((result, lookup) => {
    if (lookup.timestamps.length === 0) {
      return result
    }

    const tokenKey = lookup.tokenKey.toLowerCase()
    const timestampSet = result.get(tokenKey) ?? new Set<number>()
    lookup.timestamps.forEach((timestamp) => {
      timestampSet.add(timestamp)
    })
    result.set(tokenKey, timestampSet)
    return result
  }, new Map())

  return Array.from(timestampsByToken.entries()).map(([tokenKey, timestampSet]) => ({
    tokenKey,
    timestamps: Array.from(timestampSet).sort((a, b) => a - b)
  }))
}

function countCachedPriceLookupPoints(lookups: CachedPriceLookup[]): number {
  return lookups.reduce((total, lookup) => total + lookup.timestamps.length, 0)
}

export async function getCachedTotals(
  userAddress: string,
  version: VaultVersion,
  startDate: string,
  endDate: string
): Promise<CachedTotal[]> {
  if (!isDatabaseEnabled()) {
    debugLog('cache', 'skipping cached totals lookup because database is disabled')
    return []
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached totals lookup because database pool is unavailable')
    return []
  }

  try {
    const userAddressHash = getUserAddressCacheKey(userAddress)
    debugLog('cache', 'loading cached totals', { userAddressHash, version, startDate, endDate })
    const result = await pool.query<{ date: string; usd_value: string }>(
      `SELECT date::text AS date, usd_value FROM holdings_totals
       WHERE user_address_hash = $1 AND version = $2 AND date >= $3 AND date <= $4
       ORDER BY date ASC`,
      [userAddressHash, version, startDate, endDate]
    )

    const totals = result.rows.map((row) => ({
      date: row.date,
      usdValue: parseFloat(row.usd_value)
    }))

    debugLog('cache', 'loaded cached totals', { rows: totals.length })
    return totals
  } catch (error) {
    console.error('[Cache] Failed to get cached totals:', error)
    debugError('cache', 'cached totals lookup failed', error)
    return []
  }
}

export async function saveCachedTotals(
  userAddress: string,
  version: VaultVersion,
  totals: CachedTotal[]
): Promise<void> {
  if (!isDatabaseEnabled() || totals.length === 0) {
    if (totals.length > 0) {
      debugLog('cache', 'skipping cached totals save because database is disabled', { rows: totals.length })
    }
    return
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached totals save because database pool is unavailable', { rows: totals.length })
    return
  }

  try {
    const userAddressHash = getUserAddressCacheKey(userAddress)
    debugLog('cache', 'saving cached totals', {
      userAddressHash,
      version,
      rows: totals.length
    })
    const values: unknown[] = []
    const placeholders: string[] = []
    let paramIndex = 1

    for (const total of totals) {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`)
      values.push(userAddressHash, version, total.date, total.usdValue)
      paramIndex += 4
    }

    const query = `
      INSERT INTO holdings_totals (user_address_hash, version, date, usd_value)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (user_address_hash, version, date)
      DO UPDATE SET usd_value = EXCLUDED.usd_value, updated_at = NOW()
    `

    await pool.query(query, values)
    debugLog('cache', 'saved cached totals', { rows: totals.length })
  } catch (error) {
    console.error('[Cache] Failed to save totals:', error)
    debugError('cache', 'cached totals save failed', error, { rows: totals.length })
  }
}

export async function getCachedPrices(
  tokenKeys: string[],
  timestamps: number[]
): Promise<Map<string, Map<number, number>>> {
  return getCachedPricesForTokenTimestamps(tokenKeys.map((tokenKey) => ({ tokenKey, timestamps })))
}

export async function getCachedPricesForTokenTimestamps(
  lookups: CachedPriceLookup[]
): Promise<Map<string, Map<number, number>>> {
  const result = new Map<string, Map<number, number>>()
  const normalizedLookups = normalizeCachedPriceLookups(lookups)
  const pricePoints = countCachedPriceLookupPoints(normalizedLookups)

  if (!isDatabaseEnabled() || normalizedLookups.length === 0 || pricePoints === 0) {
    if (normalizedLookups.length > 0 && pricePoints > 0) {
      debugLog('cache', 'skipping cached prices lookup because database is disabled', {
        tokenKeys: normalizedLookups.length,
        pricePoints
      })
    }
    return result
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached prices lookup because database pool is unavailable', {
      tokenKeys: normalizedLookups.length,
      pricePoints
    })
    return result
  }

  try {
    debugLog('cache', 'loading cached prices', { tokenKeys: normalizedLookups.length, pricePoints })
    const lookupPairs = normalizedLookups.flatMap((lookup) =>
      lookup.timestamps.map((timestamp) => ({ tokenKey: lookup.tokenKey, timestamp }))
    )

    await chunkItems(lookupPairs, 5_000).reduce<Promise<void>>(async (previousPromise, batch) => {
      await previousPromise

      const values = batch.flatMap((pair) => [pair.tokenKey, pair.timestamp])
      const placeholders = batch.map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::integer)`).join(', ')

      const query = `
        WITH requested(token_key, price_timestamp) AS (
          VALUES ${placeholders}
        )
        SELECT token_prices.token_key, token_prices.timestamp, token_prices.price
        FROM token_prices
        INNER JOIN requested
          ON requested.token_key = token_prices.token_key
          AND requested.price_timestamp = token_prices.timestamp
      `

      const queryResult = await pool.query<{ token_key: string; timestamp: number; price: string }>(query, values)

      queryResult.rows.forEach((row) => {
        const tokenPrices = result.get(row.token_key) ?? new Map<number, number>()
        tokenPrices.set(row.timestamp, parseFloat(row.price))
        result.set(row.token_key, tokenPrices)
      })
    }, Promise.resolve())

    const cachedPoints = Array.from(result.values()).reduce((total, priceMap) => total + priceMap.size, 0)
    debugLog('cache', 'loaded cached prices', {
      tokenKeys: result.size,
      pricePoints: cachedPoints
    })
  } catch (error) {
    console.error('[Cache] Failed to get cached prices:', error)
    debugError('cache', 'cached prices lookup failed', error, {
      tokenKeys: normalizedLookups.length,
      pricePoints
    })
  }

  return result
}

export async function getCachedPriceMisses(
  tokenKeys: string[],
  timestamps: number[]
): Promise<Map<string, Set<number>>> {
  return getCachedPriceMissesForTokenTimestamps(tokenKeys.map((tokenKey) => ({ tokenKey, timestamps })))
}

export async function getCachedPriceMissesForTokenTimestamps(
  lookups: CachedPriceLookup[]
): Promise<Map<string, Set<number>>> {
  const result = new Map<string, Set<number>>()
  const normalizedLookups = normalizeCachedPriceLookups(lookups)
  const pricePoints = countCachedPriceLookupPoints(normalizedLookups)

  if (!isDatabaseEnabled() || normalizedLookups.length === 0 || pricePoints === 0) {
    if (normalizedLookups.length > 0 && pricePoints > 0) {
      debugLog('cache', 'skipping cached price misses lookup because database is disabled', {
        tokenKeys: normalizedLookups.length,
        pricePoints
      })
    }
    return result
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached price misses lookup because database pool is unavailable', {
      tokenKeys: normalizedLookups.length,
      pricePoints
    })
    return result
  }

  try {
    debugLog('cache', 'loading cached price misses', { tokenKeys: normalizedLookups.length, pricePoints })
    const lookupPairs = normalizedLookups.flatMap((lookup) =>
      lookup.timestamps.map((timestamp) => ({ tokenKey: lookup.tokenKey, timestamp }))
    )

    await chunkItems(lookupPairs, 5_000).reduce<Promise<void>>(async (previousPromise, batch) => {
      await previousPromise

      const values = batch.flatMap((pair) => [pair.tokenKey, pair.timestamp])
      const placeholders = batch.map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::integer)`).join(', ')

      const query = `
        WITH requested(token_key, price_timestamp) AS (
          VALUES ${placeholders}
        )
        SELECT token_price_misses.token_key, token_price_misses.timestamp
        FROM token_price_misses
        INNER JOIN requested
          ON requested.token_key = token_price_misses.token_key
          AND requested.price_timestamp = token_price_misses.timestamp
        WHERE token_price_misses.expires_at > NOW()
      `

      const queryResult = await pool.query<{ token_key: string; timestamp: number }>(query, values)

      queryResult.rows.forEach((row) => {
        const tokenMisses = result.get(row.token_key) ?? new Set<number>()
        tokenMisses.add(row.timestamp)
        result.set(row.token_key, tokenMisses)
      })
    }, Promise.resolve())

    const cachedMissPoints = Array.from(result.values()).reduce((total, timestampSet) => total + timestampSet.size, 0)
    debugLog('cache', 'loaded cached price misses', {
      tokenKeys: result.size,
      missPoints: cachedMissPoints
    })
  } catch (error) {
    console.error('[Cache] Failed to get cached price misses:', error)
    debugError('cache', 'cached price misses lookup failed', error, {
      tokenKeys: normalizedLookups.length,
      pricePoints
    })
  }

  return result
}

export async function saveCachedPrices(prices: CachedPrice[]): Promise<void> {
  if (!isDatabaseEnabled() || prices.length === 0) {
    if (prices.length > 0) {
      debugLog('cache', 'skipping cached prices save because database is disabled', { rows: prices.length })
    }
    return
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached prices save because database pool is unavailable', { rows: prices.length })
    return
  }

  try {
    debugLog('cache', 'saving cached prices', { rows: prices.length })
    // Batch insert in chunks of 1000
    const BATCH_SIZE = 1000
    for (let i = 0; i < prices.length; i += BATCH_SIZE) {
      const batch = prices.slice(i, i + BATCH_SIZE)
      const values: unknown[] = []
      const placeholders: string[] = []
      let paramIndex = 1

      for (const price of batch) {
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`)
        values.push(price.tokenKey, price.timestamp, price.price)
        paramIndex += 3
      }

      const query = `
        INSERT INTO token_prices (token_key, timestamp, price)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (token_key, timestamp) DO NOTHING
      `

      await pool.query(query, values)
    }
    debugLog('cache', 'saved cached prices', { rows: prices.length })
  } catch (error) {
    console.error('[Cache] Failed to save prices:', error)
    debugError('cache', 'cached prices save failed', error, { rows: prices.length })
  }
}

export async function saveCachedPriceMisses(priceMisses: CachedPriceMiss[]): Promise<void> {
  if (!isDatabaseEnabled() || priceMisses.length === 0) {
    if (priceMisses.length > 0) {
      debugLog('cache', 'skipping cached price misses save because database is disabled', { rows: priceMisses.length })
    }
    return
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached price misses save because database pool is unavailable', {
      rows: priceMisses.length
    })
    return
  }

  try {
    debugLog('cache', 'saving cached price misses', { rows: priceMisses.length })
    const expiresAt = new Date(Date.now() + PRICE_MISS_TTL_MS)
    const BATCH_SIZE = 1_000

    for (let i = 0; i < priceMisses.length; i += BATCH_SIZE) {
      const batch = priceMisses.slice(i, i + BATCH_SIZE)
      const values: unknown[] = []
      const placeholders: string[] = []
      let paramIndex = 1

      for (const priceMiss of batch) {
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`)
        values.push(priceMiss.tokenKey, priceMiss.timestamp, expiresAt)
        paramIndex += 3
      }

      const query = `
        INSERT INTO token_price_misses (token_key, timestamp, expires_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (token_key, timestamp)
        DO UPDATE SET expires_at = GREATEST(token_price_misses.expires_at, EXCLUDED.expires_at)
      `

      await pool.query(query, values)
    }

    debugLog('cache', 'saved cached price misses', { rows: priceMisses.length })
  } catch (error) {
    console.error('[Cache] Failed to save price misses:', error)
    debugError('cache', 'cached price misses save failed', error, { rows: priceMisses.length })
  }
}

export async function deleteStaleCache(): Promise<number> {
  if (!isDatabaseEnabled()) {
    debugLog('cache', 'skipping stale cache deletion because database is disabled')
    return 0
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping stale cache deletion because database pool is unavailable')
    return 0
  }

  try {
    const [staleTotalsResult, expiredMissesResult, staleRateLimitsResult] = await Promise.all([
      pool.query(`DELETE FROM holdings_totals WHERE date < NOW() - INTERVAL '366 days'`),
      pool.query(`DELETE FROM token_price_misses WHERE expires_at <= NOW()`),
      pool.query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day'`)
    ])
    const deletedCount =
      (staleTotalsResult.rowCount ?? 0) + (expiredMissesResult.rowCount ?? 0) + (staleRateLimitsResult.rowCount ?? 0)
    console.log(`[Cache] Deleted ${deletedCount} stale cache rows`)
    return deletedCount
  } catch (error) {
    console.error('[Cache] Failed to delete stale cache:', error)
    debugError('cache', 'stale cache deletion failed', error)
    return 0
  }
}

export async function clearUserCache(userAddress: string, version?: VaultVersion): Promise<number> {
  if (!isDatabaseEnabled()) {
    debugLog('cache', 'skipping user cache clear because database is disabled', {
      userAddressHash: getUserAddressCacheKey(userAddress),
      version: version ?? null
    })
    return 0
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping user cache clear because database pool is unavailable', {
      userAddressHash: getUserAddressCacheKey(userAddress),
      version: version ?? null
    })
    return 0
  }

  try {
    const userAddressHash = getUserAddressCacheKey(userAddress)
    const result = version
      ? await pool.query('DELETE FROM holdings_totals WHERE user_address_hash = $1 AND version = $2', [
          userAddressHash,
          version
        ])
      : await pool.query('DELETE FROM holdings_totals WHERE user_address_hash = $1', [userAddressHash])
    const deletedCount = result.rowCount ?? 0
    console.log(`[Cache] Cleared ${deletedCount} cached rows for user ${userAddress}${version ? ` (${version})` : ''}`)
    return deletedCount
  } catch (error) {
    console.error('[Cache] Failed to clear user cache:', error)
    debugError('cache', 'user cache clear failed', error, {
      userAddressHash: getUserAddressCacheKey(userAddress),
      version: version ?? null
    })
    return 0
  }
}

export interface VaultIdentifier {
  address: string
  chainId: number
}

export async function invalidateVaults(vaults: VaultIdentifier[]): Promise<number> {
  if (!isDatabaseEnabled() || vaults.length === 0) {
    if (vaults.length > 0) {
      debugLog('cache', 'skipping vault invalidation because database is disabled', { vaults: vaults.length })
    }
    return 0
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping vault invalidation because database pool is unavailable', { vaults: vaults.length })
    return 0
  }

  try {
    const values: unknown[] = []
    const placeholders: string[] = []
    let paramIndex = 1

    for (const vault of vaults) {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, NOW())`)
      values.push(vault.address.toLowerCase(), vault.chainId)
      paramIndex += 2
    }

    const query = `
      INSERT INTO vault_invalidations (vault_address, chain_id, invalidated_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (vault_address, chain_id)
      DO UPDATE SET invalidated_at = NOW()
    `

    await pool.query(query, values)
    console.log(`[Cache] Invalidated ${vaults.length} vaults`)
    return vaults.length
  } catch (error) {
    console.error('[Cache] Failed to invalidate vaults:', error)
    debugError('cache', 'vault invalidation failed', error, { vaults: vaults.length })
    return 0
  }
}

export async function checkCacheStaleness(
  vaults: VaultIdentifier[],
  cacheOldestTimestamp: Date | null
): Promise<boolean> {
  if (!isDatabaseEnabled() || vaults.length === 0 || !cacheOldestTimestamp) {
    if (vaults.length > 0 && cacheOldestTimestamp !== null) {
      debugLog('cache', 'skipping cache staleness check because database is disabled', { vaults: vaults.length })
    }
    return false
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cache staleness check because database pool is unavailable', { vaults: vaults.length })
    return false
  }

  try {
    debugLog('cache', 'checking cache staleness', {
      vaults: vaults.length,
      cacheOldestTimestamp: cacheOldestTimestamp.toISOString()
    })
    // Build WHERE clause for vault pairs
    const conditions: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    for (const vault of vaults) {
      conditions.push(`(vault_address = $${paramIndex} AND chain_id = $${paramIndex + 1})`)
      values.push(vault.address.toLowerCase(), vault.chainId)
      paramIndex += 2
    }

    const query = `
      SELECT MAX(invalidated_at) as latest_invalidation
      FROM vault_invalidations
      WHERE ${conditions.join(' OR ')}
    `

    const result = await pool.query<{ latest_invalidation: Date | null }>(query, values)
    const latestInvalidation = result.rows[0]?.latest_invalidation

    if (!latestInvalidation) {
      return false // No invalidations recorded for these vaults
    }

    const isStale = latestInvalidation > cacheOldestTimestamp
    debugLog('cache', 'checked cache staleness', {
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
    console.error('[Cache] Failed to check cache staleness:', error)
    debugError('cache', 'cache staleness check failed', error, { vaults: vaults.length })
    return false // Fail-open: proceed with cached data
  }
}

export interface CachedTotalsResult {
  totals: CachedTotal[]
  oldestUpdatedAt: Date | null
}

export async function getCachedTotalsWithTimestamp(
  userAddress: string,
  version: VaultVersion,
  startDate: string,
  endDate: string
): Promise<CachedTotalsResult> {
  if (!isDatabaseEnabled()) {
    debugLog('cache', 'skipping cached totals with timestamp lookup because database is disabled')
    return { totals: [], oldestUpdatedAt: null }
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached totals with timestamp lookup because database pool is unavailable')
    return { totals: [], oldestUpdatedAt: null }
  }

  try {
    const userAddressHash = getUserAddressCacheKey(userAddress)
    debugLog('cache', 'loading cached totals with timestamps', {
      userAddressHash,
      version,
      startDate,
      endDate
    })
    const result = await pool.query<{ date: string; usd_value: string; updated_at: Date }>(
      `SELECT date::text AS date, usd_value, updated_at FROM holdings_totals
       WHERE user_address_hash = $1 AND version = $2 AND date >= $3 AND date <= $4
       ORDER BY date ASC`,
      [userAddressHash, version, startDate, endDate]
    )

    const totals = result.rows.map((row) => ({
      date: row.date,
      usdValue: parseFloat(row.usd_value)
    }))

    const oldestUpdatedAt =
      result.rows.length > 0
        ? result.rows.reduce((min, row) => (row.updated_at < min ? row.updated_at : min), result.rows[0].updated_at)
        : null

    debugLog('cache', 'loaded cached totals with timestamps', {
      rows: totals.length,
      oldestUpdatedAt: oldestUpdatedAt?.toISOString() ?? null
    })
    return { totals, oldestUpdatedAt }
  } catch (error) {
    console.error('[Cache] Failed to get cached totals with timestamp:', error)
    debugError('cache', 'cached totals with timestamp lookup failed', error, {
      userAddressHash: getUserAddressCacheKey(userAddress),
      version,
      startDate,
      endDate
    })
    return { totals: [], oldestUpdatedAt: null }
  }
}
