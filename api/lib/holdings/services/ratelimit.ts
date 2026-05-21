import { createHash } from 'node:crypto'
import { getHoldingsRedisClient, handleHoldingsRedisError, isHoldingsStorageConfigured } from '../storage/redis'

const WINDOW_SECONDS = 60
const MAX_REQUESTS = 10
const RATE_LIMIT_KEY_PREFIX = 'holdings:rate-limit'

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
  degraded?: boolean
  reason?: 'storage_unavailable'
}

function getRateLimitKey(clientIdentifier: string): string {
  const identifierHash = createHash('sha256').update(clientIdentifier).digest('hex')
  return `${RATE_LIMIT_KEY_PREFIX}:${identifierHash}`
}

function logRateLimitFailClosed(reason: string): void {
  console.warn(`[Holdings Redis] Rate limiter failed closed: ${reason}`)
}

export async function checkRateLimit(clientIdentifier: string): Promise<RateLimitResult> {
  if (!isHoldingsStorageConfigured()) {
    return { allowed: true }
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    console.error('[Holdings Redis] rate limit storage unavailable')
    return { allowed: false, retryAfter: WINDOW_SECONDS, degraded: true, reason: 'storage_unavailable' }
  }

  try {
    const key = getRateLimitKey(clientIdentifier)
    const requestCount = await redis.incr(key)

    if (requestCount === 1) {
      await redis.expire(key, WINDOW_SECONDS)
    }

    if (requestCount > MAX_REQUESTS) {
      try {
        const ttl = await redis.ttl(key)
        const retryAfter = ttl > 0 ? ttl : WINDOW_SECONDS
        return { allowed: false, retryAfter }
      } catch (error) {
        handleHoldingsRedisError('rate limit ttl lookup failed', error)
        logRateLimitFailClosed('query_failed')
        return { allowed: false, retryAfter: WINDOW_SECONDS }
      }
    }

    return { allowed: true }
  } catch (error) {
    handleHoldingsRedisError('rate limit check failed', error)
    return { allowed: false, retryAfter: WINDOW_SECONDS, degraded: true, reason: 'storage_unavailable' }
  }
}
