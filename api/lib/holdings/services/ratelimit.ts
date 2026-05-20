import { createHash } from 'node:crypto'
import { getHoldingsRedisClient, handleHoldingsRedisError, isHoldingsStorageEnabled } from '../storage/redis'

const WINDOW_SECONDS = 60
const MAX_REQUESTS = 10
const RATE_LIMIT_KEY_PREFIX = 'holdings:rate-limit'

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

function getRateLimitKey(clientIdentifier: string): string {
  const identifierHash = createHash('sha256').update(clientIdentifier).digest('hex')
  return `${RATE_LIMIT_KEY_PREFIX}:${identifierHash}`
}

export async function checkRateLimit(clientIdentifier: string): Promise<RateLimitResult> {
  if (!isHoldingsStorageEnabled()) {
    return { allowed: true }
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    return { allowed: true }
  }

  try {
    const key = getRateLimitKey(clientIdentifier)
    const requestCount = await redis.incr(key)

    if (requestCount === 1) {
      await redis.expire(key, WINDOW_SECONDS)
    }

    if (requestCount > MAX_REQUESTS) {
      const ttl = await redis.ttl(key)
      const retryAfter = ttl > 0 ? ttl : WINDOW_SECONDS
      return { allowed: false, retryAfter }
    }

    return { allowed: true }
  } catch (error) {
    handleHoldingsRedisError('rate limit check failed', error)
    return { allowed: true }
  }
}
