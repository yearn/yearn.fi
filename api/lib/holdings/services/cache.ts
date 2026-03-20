import { getPool, isDatabaseEnabled } from '../db/connection'
import { debugError, debugLog } from './debug'

export interface CachedTotal {
  date: string
  usdValue: number
}

export interface CachedPrice {
  tokenKey: string
  timestamp: number
  price: number
}

export async function getCachedTotals(userAddress: string, startDate: string, endDate: string): Promise<CachedTotal[]> {
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
    debugLog('cache', 'loading cached totals', { userAddress: userAddress.toLowerCase(), startDate, endDate })
    const result = await pool.query<{ date: Date; usd_value: string }>(
      `SELECT date, usd_value FROM holdings_totals
       WHERE user_address = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC`,
      [userAddress.toLowerCase(), startDate, endDate]
    )

    const totals = result.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
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

export async function saveCachedTotals(userAddress: string, totals: CachedTotal[]): Promise<void> {
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
    debugLog('cache', 'saving cached totals', { userAddress: userAddress.toLowerCase(), rows: totals.length })
    const values: unknown[] = []
    const placeholders: string[] = []
    let paramIndex = 1

    for (const total of totals) {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`)
      values.push(userAddress.toLowerCase(), total.date, total.usdValue)
      paramIndex += 3
    }

    const query = `
      INSERT INTO holdings_totals (user_address, date, usd_value)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (user_address, date)
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
  const result = new Map<string, Map<number, number>>()

  if (!isDatabaseEnabled() || tokenKeys.length === 0 || timestamps.length === 0) {
    if (tokenKeys.length > 0 && timestamps.length > 0) {
      debugLog('cache', 'skipping cached prices lookup because database is disabled', {
        tokenKeys: tokenKeys.length,
        timestamps: timestamps.length
      })
    }
    return result
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping cached prices lookup because database pool is unavailable', {
      tokenKeys: tokenKeys.length,
      timestamps: timestamps.length
    })
    return result
  }

  try {
    debugLog('cache', 'loading cached prices', { tokenKeys: tokenKeys.length, timestamps: timestamps.length })
    const tokenPlaceholders = tokenKeys.map((_, i) => `$${i + 1}`).join(', ')
    const timestampPlaceholders = timestamps.map((_, i) => `$${tokenKeys.length + i + 1}`).join(', ')

    const query = `
      SELECT token_key, timestamp, price
      FROM token_prices
      WHERE token_key IN (${tokenPlaceholders})
        AND timestamp IN (${timestampPlaceholders})
    `

    const queryResult = await pool.query<{ token_key: string; timestamp: number; price: string }>(query, [
      ...tokenKeys,
      ...timestamps
    ])

    for (const row of queryResult.rows) {
      if (!result.has(row.token_key)) {
        result.set(row.token_key, new Map())
      }
      result.get(row.token_key)!.set(row.timestamp, parseFloat(row.price))
    }

    const cachedPoints = Array.from(result.values()).reduce((total, priceMap) => total + priceMap.size, 0)
    debugLog('cache', 'loaded cached prices', {
      tokenKeys: result.size,
      pricePoints: cachedPoints
    })
  } catch (error) {
    console.error('[Cache] Failed to get cached prices:', error)
    debugError('cache', 'cached prices lookup failed', error, {
      tokenKeys: tokenKeys.length,
      timestamps: timestamps.length
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
    const result = await pool.query(`DELETE FROM holdings_totals WHERE date < NOW() - INTERVAL '366 days'`)
    const deletedCount = result.rowCount ?? 0
    console.log(`[Cache] Deleted ${deletedCount} stale cache rows`)
    return deletedCount
  } catch (error) {
    console.error('[Cache] Failed to delete stale cache:', error)
    debugError('cache', 'stale cache deletion failed', error)
    return 0
  }
}

export async function clearUserCache(userAddress: string): Promise<number> {
  if (!isDatabaseEnabled()) {
    debugLog('cache', 'skipping user cache clear because database is disabled', {
      userAddress: userAddress.toLowerCase()
    })
    return 0
  }

  const pool = await getPool()
  if (!pool) {
    debugLog('cache', 'skipping user cache clear because database pool is unavailable', {
      userAddress: userAddress.toLowerCase()
    })
    return 0
  }

  try {
    const result = await pool.query('DELETE FROM holdings_totals WHERE user_address = $1', [userAddress.toLowerCase()])
    const deletedCount = result.rowCount ?? 0
    console.log(`[Cache] Cleared ${deletedCount} cached rows for user ${userAddress}`)
    return deletedCount
  } catch (error) {
    console.error('[Cache] Failed to clear user cache:', error)
    debugError('cache', 'user cache clear failed', error, { userAddress: userAddress.toLowerCase() })
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
    debugLog('cache', 'loading cached totals with timestamps', {
      userAddress: userAddress.toLowerCase(),
      startDate,
      endDate
    })
    const result = await pool.query<{ date: Date; usd_value: string; updated_at: Date }>(
      `SELECT date, usd_value, updated_at FROM holdings_totals
       WHERE user_address = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC`,
      [userAddress.toLowerCase(), startDate, endDate]
    )

    const totals = result.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
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
      userAddress: userAddress.toLowerCase(),
      startDate,
      endDate
    })
    return { totals: [], oldestUpdatedAt: null }
  }
}
