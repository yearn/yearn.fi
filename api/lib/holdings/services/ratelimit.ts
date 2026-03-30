import { getPool, isDatabaseEnabled } from '../db/connection'

const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS = 10

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!isDatabaseEnabled()) {
    return { allowed: true }
  }

  const pool = await getPool()
  if (!pool) {
    return { allowed: true }
  }

  try {
    const result = await pool.query<{ request_count: number; window_start: Date }>(
      `INSERT INTO rate_limits (ip, request_count, window_start)
       VALUES ($1, 1, NOW())
       ON CONFLICT (ip) DO UPDATE SET
         request_count = CASE
           WHEN rate_limits.window_start < NOW() - INTERVAL '1 minute'
           THEN 1
           ELSE rate_limits.request_count + 1
         END,
         window_start = CASE
           WHEN rate_limits.window_start < NOW() - INTERVAL '1 minute'
           THEN NOW()
           ELSE rate_limits.window_start
         END
       RETURNING request_count, window_start`,
      [ip]
    )

    const { request_count, window_start } = result.rows[0]

    if (request_count > MAX_REQUESTS) {
      const windowEnd = new Date(window_start).getTime() + WINDOW_MS
      const retryAfter = Math.max(1, Math.ceil((windowEnd - Date.now()) / 1000))
      return { allowed: false, retryAfter }
    }

    return { allowed: true }
  } catch (error) {
    console.error('[RateLimit] Check failed:', error)
    return { allowed: true }
  }
}
