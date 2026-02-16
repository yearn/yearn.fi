import { getPool, isDatabaseEnabled } from '../db/connection'
import type { CachedHolding } from '../types'

export async function getCachedHoldings(
  userAddress: string,
  startDate: string,
  endDate: string
): Promise<CachedHolding[]> {
  if (!isDatabaseEnabled()) {
    return []
  }

  const pool = await getPool()
  if (!pool) {
    return []
  }

  try {
    const result = await pool.query<{
      user_address: string
      date: Date
      chain_id: number
      vault_address: string
      shares: string
      usd_value: string
      price_per_share: string
      underlying_price: string
    }>(
      `SELECT user_address, date, chain_id, vault_address, shares, usd_value, price_per_share, underlying_price
       FROM holdings_cache
       WHERE user_address = $1 AND date >= $2 AND date <= $3
       ORDER BY date ASC`,
      [userAddress.toLowerCase(), startDate, endDate]
    )

    return result.rows.map((row) => ({
      userAddress: row.user_address,
      date: row.date.toISOString().split('T')[0],
      chainId: row.chain_id,
      vaultAddress: row.vault_address,
      shares: row.shares,
      usdValue: parseFloat(row.usd_value),
      pricePerShare: parseFloat(row.price_per_share),
      underlyingPrice: parseFloat(row.underlying_price)
    }))
  } catch (error) {
    console.error('[Cache] Failed to get cached holdings:', error)
    return []
  }
}

export async function getLatestCachedDate(userAddress: string): Promise<string | null> {
  if (!isDatabaseEnabled()) {
    return null
  }

  const pool = await getPool()
  if (!pool) {
    return null
  }

  try {
    const result = await pool.query<{ max_date: Date | null }>(
      `SELECT MAX(date) as max_date FROM holdings_cache WHERE user_address = $1`,
      [userAddress.toLowerCase()]
    )

    const maxDate = result.rows[0]?.max_date
    return maxDate ? maxDate.toISOString().split('T')[0] : null
  } catch (error) {
    console.error('[Cache] Failed to get latest cached date:', error)
    return null
  }
}

export async function saveCachedHoldings(holdings: CachedHolding[]): Promise<void> {
  if (!isDatabaseEnabled() || holdings.length === 0) {
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

    for (const holding of holdings) {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
      )
      values.push(
        holding.userAddress.toLowerCase(),
        holding.date,
        holding.chainId,
        holding.vaultAddress.toLowerCase(),
        holding.shares,
        holding.usdValue,
        holding.pricePerShare,
        holding.underlyingPrice
      )
      paramIndex += 8
    }

    const query = `
      INSERT INTO holdings_cache (user_address, date, chain_id, vault_address, shares, usd_value, price_per_share, underlying_price)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (user_address, date, chain_id, vault_address)
      DO UPDATE SET
        shares = EXCLUDED.shares,
        usd_value = EXCLUDED.usd_value,
        price_per_share = EXCLUDED.price_per_share,
        underlying_price = EXCLUDED.underlying_price
    `

    await pool.query(query, values)
  } catch (error) {
    console.error('[Cache] Failed to save holdings:', error)
  }
}

export async function clearCache(userAddress?: string): Promise<void> {
  if (!isDatabaseEnabled()) {
    return
  }

  const pool = await getPool()
  if (!pool) {
    return
  }

  try {
    if (userAddress) {
      await pool.query('DELETE FROM holdings_cache WHERE user_address = $1', [userAddress.toLowerCase()])
    } else {
      await pool.query('TRUNCATE holdings_cache')
    }
  } catch (error) {
    console.error('[Cache] Failed to clear cache:', error)
  }
}
