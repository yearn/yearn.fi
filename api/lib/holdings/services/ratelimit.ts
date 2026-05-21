import { createHash } from 'node:crypto'
import { getHoldingsRedisClient, handleHoldingsRedisError, isHoldingsStorageEnabled } from '../storage/redis'

const WINDOW_SECONDS = 60
const MAX_REQUESTS = 10
const WINDOW_MS = WINDOW_SECONDS * 1000
const MAX_FALLBACK_KEYS = 1000
const RATE_LIMIT_KEY_PREFIX = 'holdings:rate-limit'

interface FallbackRateLimitEntry {
  count: number
  resetAt: number
}

const fallbackRateLimitEntries = new Map<string, FallbackRateLimitEntry>()

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

function getRateLimitKey(clientIdentifier: string): string {
  const identifierHash = createHash('sha256').update(clientIdentifier).digest('hex')
  return `${RATE_LIMIT_KEY_PREFIX}:${identifierHash}`
}

function logFallbackRateLimit(reason: string): void {
  console.warn(`[Holdings Redis] Using fallback rate limiter: ${reason}`)
}

function logRateLimitFailClosed(reason: string): void {
  console.warn(`[Holdings Redis] Rate limiter failed closed: ${reason}`)
}

function cleanupFallbackEntries(now: number, protectedKey?: string): void {
  Array.from(fallbackRateLimitEntries.entries())
    .filter(([, entry]) => entry.resetAt <= now)
    .forEach(([key]) => {
      fallbackRateLimitEntries.delete(key)
    })

  const excessEntryCount = Math.max(0, fallbackRateLimitEntries.size - MAX_FALLBACK_KEYS)
  Array.from(fallbackRateLimitEntries.keys())
    .filter((key) => key !== protectedKey)
    .slice(0, excessEntryCount)
    .forEach((key) => {
      fallbackRateLimitEntries.delete(key)
    })
}

function checkFallbackRateLimit(clientIdentifier: string): RateLimitResult {
  const now = Date.now()
  cleanupFallbackEntries(now)

  const key = getRateLimitKey(clientIdentifier)
  const existingEntry = fallbackRateLimitEntries.get(key)
  const entry = existingEntry && existingEntry.resetAt > now ? existingEntry : { count: 0, resetAt: now + WINDOW_MS }

  entry.count += 1
  fallbackRateLimitEntries.set(key, entry)
  cleanupFallbackEntries(now, key)

  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
  }

  return { allowed: true }
}

export async function checkRateLimit(clientIdentifier: string): Promise<RateLimitResult> {
  if (!isHoldingsStorageEnabled()) {
    logFallbackRateLimit('database_disabled')
    return checkFallbackRateLimit(clientIdentifier)
  }

  const redis = getHoldingsRedisClient()
  if (!redis) {
    logFallbackRateLimit('pool_unavailable')
    return checkFallbackRateLimit(clientIdentifier)
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
    logFallbackRateLimit('query_failed')
    return checkFallbackRateLimit(clientIdentifier)
  }
}
