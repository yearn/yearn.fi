import { getPool, isDatabaseEnabled } from '../db/connection'

const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS = 10

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!isDatabaseEnabled()) {
    // No database - allow all requests
    return { allowed: true, remaining: MAX_REQUESTS }
  }

  const pool = await getPool()
  if (!pool) {
    return { allowed: true, remaining: MAX_REQUESTS }
  }

  try {
    // Atomic upsert and check in a single query
    const result = await pool.query<{
      request_count: number
      window_start: Date
    }>(
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
    const windowEnd = new Date(window_start).getTime() + WINDOW_MS
    const now = Date.now()

    if (request_count > MAX_REQUESTS) {
      const retryAfter = Math.ceil((windowEnd - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, retryAfter)
      }
    }

    return {
      allowed: true,
      remaining: MAX_REQUESTS - request_count
    }
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error)
    // On error, allow the request
    return { allowed: true, remaining: MAX_REQUESTS }
  }
}

export async function cleanupExpiredRateLimits(): Promise<number> {
  if (!isDatabaseEnabled()) {
    return 0
  }

  const pool = await getPool()
  if (!pool) {
    return 0
  }

  try {
    const result = await pool.query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '5 minutes'`)
    return result.rowCount
  } catch (error) {
    console.error('[RateLimit] Error cleaning up:', error)
    return 0
  }
}
