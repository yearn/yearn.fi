import { getPool, isDatabaseEnabled } from '../db/connection'

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
    return []
  }

  const pool = await getPool()
  if (!pool) {
    return []
  }

  try {
    const result = await pool.query<{ date: Date; usd_value: string }>(
      `SELECT date, usd_value FROM holdings_totals
       WHERE user_address = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC`,
      [userAddress.toLowerCase(), startDate, endDate]
    )

    return result.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      usdValue: parseFloat(row.usd_value)
    }))
  } catch (error) {
    console.error('[Cache] Failed to get cached totals:', error)
    return []
  }
}

export async function saveCachedTotals(userAddress: string, totals: CachedTotal[]): Promise<void> {
  if (!isDatabaseEnabled() || totals.length === 0) {
    return
  }

  const pool = await getPool()
  if (!pool) {
    return
  }

  try {
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
  } catch (error) {
    console.error('[Cache] Failed to save totals:', error)
  }
}

export async function getCachedPrices(
  tokenKeys: string[],
  timestamps: number[]
): Promise<Map<string, Map<number, number>>> {
  const result = new Map<string, Map<number, number>>()

  if (!isDatabaseEnabled() || tokenKeys.length === 0 || timestamps.length === 0) {
    return result
  }

  const pool = await getPool()
  if (!pool) {
    return result
  }

  try {
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
  } catch (error) {
    console.error('[Cache] Failed to get cached prices:', error)
  }

  return result
}

export async function saveCachedPrices(prices: CachedPrice[]): Promise<void> {
  if (!isDatabaseEnabled() || prices.length === 0) {
    return
  }

  const pool = await getPool()
  if (!pool) {
    return
  }

  try {
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
  } catch (error) {
    console.error('[Cache] Failed to save prices:', error)
  }
}

export async function deleteStaleCache(): Promise<number> {
  if (!isDatabaseEnabled()) {
    return 0
  }

  const pool = await getPool()
  if (!pool) {
    return 0
  }

  try {
    const result = await pool.query(`DELETE FROM holdings_totals WHERE date < NOW() - INTERVAL '366 days'`)
    const deletedCount = result.rowCount ?? 0
    console.log(`[Cache] Deleted ${deletedCount} stale cache rows`)
    return deletedCount
  } catch (error) {
    console.error('[Cache] Failed to delete stale cache:', error)
    return 0
  }
}

export async function clearUserCache(userAddress: string): Promise<number> {
  if (!isDatabaseEnabled()) {
    return 0
  }

  const pool = await getPool()
  if (!pool) {
    return 0
  }

  try {
    const result = await pool.query('DELETE FROM holdings_totals WHERE user_address = $1', [userAddress.toLowerCase()])
    const deletedCount = result.rowCount ?? 0
    console.log(`[Cache] Cleared ${deletedCount} cached rows for user ${userAddress}`)
    return deletedCount
  } catch (error) {
    console.error('[Cache] Failed to clear user cache:', error)
    return 0
  }
}

export interface VaultIdentifier {
  address: string
  chainId: number
}

export async function invalidateVaults(vaults: VaultIdentifier[]): Promise<number> {
  if (!isDatabaseEnabled() || vaults.length === 0) {
    return 0
  }

  const pool = await getPool()
  if (!pool) {
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
    return 0
  }
}

export async function checkCacheStaleness(
  vaults: VaultIdentifier[],
  cacheOldestTimestamp: Date | null
): Promise<boolean> {
  if (!isDatabaseEnabled() || vaults.length === 0 || !cacheOldestTimestamp) {
    return false
  }

  const pool = await getPool()
  if (!pool) {
    return false
  }

  try {
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
    if (isStale) {
      console.log(
        `[Cache] Cache is stale: invalidation at ${latestInvalidation.toISOString()} > cache at ${cacheOldestTimestamp.toISOString()}`
      )
    }
    return isStale
  } catch (error) {
    console.error('[Cache] Failed to check cache staleness:', error)
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
    return { totals: [], oldestUpdatedAt: null }
  }

  const pool = await getPool()
  if (!pool) {
    return { totals: [], oldestUpdatedAt: null }
  }

  try {
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

    return { totals, oldestUpdatedAt }
  } catch (error) {
    console.error('[Cache] Failed to get cached totals with timestamp:', error)
    return { totals: [], oldestUpdatedAt: null }
  }
}
