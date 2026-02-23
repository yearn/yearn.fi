import { getPool, isDatabaseEnabled } from '../db/connection'

export interface CachedTotal {
  date: string
  usdValue: number
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
