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
