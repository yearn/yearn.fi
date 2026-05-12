import { createHash } from 'node:crypto'
import { getPool, isDatabaseEnabled } from '../db/connection'
import { debugError, debugLog } from './debug'

export interface CachedTotal {
  date: string
  usdValue: number
}

function normalizeUserAddress(userAddress: string): string {
  return userAddress.toLowerCase()
}

function getUserAddressCacheKey(userAddress: string): string {
  return createHash('sha256').update(normalizeUserAddress(userAddress)).digest('hex')
}

export async function getCachedTotals(
  userAddress: string,
  version: string,
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

export async function saveCachedTotals(userAddress: string, version: string, totals: CachedTotal[]): Promise<boolean> {
  if (!isDatabaseEnabled() || totals.length === 0) {
    if (totals.length > 0) {
      debugLog('cache', 'skipping cached totals save because database is disabled', { rows: totals.length })
    }
    return false
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached totals save because database pool is unavailable', { rows: totals.length })
    return false
  }

  try {
    const userAddressHash = getUserAddressCacheKey(userAddress)
    debugLog('cache', 'saving cached totals', {
      userAddressHash,
      version,
      rows: totals.length
    })
    const BATCH_SIZE = 250

    for (let i = 0; i < totals.length; i += BATCH_SIZE) {
      const batch = totals.slice(i, i + BATCH_SIZE)
      const values: unknown[] = []
      const placeholders: string[] = []
      let paramIndex = 1

      for (const total of batch) {
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
    }
    debugLog('cache', 'saved cached totals', { rows: totals.length })
    return true
  } catch (error) {
    console.error('[Cache] Failed to save totals:', error)
    debugError('cache', 'cached totals save failed', error, { rows: totals.length })
    return false
  }
}

export async function clearUserCache(userAddress: string, version?: string): Promise<number> {
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
  version: string,
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
