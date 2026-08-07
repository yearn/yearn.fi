import { Redis } from '@upstash/redis'
import {
  lifetimeEarningsHeadlineSchema,
  type TLifetimeEarningsHeadline
} from '@/components/shared/utils/schemas/lifetimeEarningsSchema'

export const LIFETIME_EARNINGS_REDIS_KEY = 'lifetime_yield:headline'

const rawHeadlineSchema = lifetimeEarningsHeadlineSchema.omit({ value: true, computed_at_ms: true })

const redisState: { client: Redis | null } = { client: null }

function getRedisClient(): Redis {
  if (!redisState.client) {
    const url = process.env.UPSTASH_REDIS_REST_URL_EARNINGS || process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN_EARNINGS || process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL_EARNINGS and UPSTASH_REDIS_REST_TOKEN_EARNINGS (or the unsuffixed fallbacks) must both be set'
      )
    }

    redisState.client = new Redis({ url, token })
  }

  return redisState.client
}

/**
 * Read the raw snapshot from Redis and extrapolate it to "now" on the server.
 * Runs at ISR revalidation time; the client keeps extrapolating from
 * `computed_at_ms` using `rate_usd_per_sec`. The 30d-averaged rate makes the
 * figure tolerant of long stale periods by design, so no live re-sync channel
 * is needed.
 */
export async function getLifetimeEarningsHeadline(): Promise<TLifetimeEarningsHeadline> {
  const blob = await getRedisClient().get<unknown>(LIFETIME_EARNINGS_REDIS_KEY)
  if (blob === null || blob === undefined) {
    throw new Error(`Redis key ${LIFETIME_EARNINGS_REDIS_KEY} is missing`)
  }

  const raw = rawHeadlineSchema.parse(typeof blob === 'string' ? JSON.parse(blob) : blob)
  const computedAtMs = Date.now()
  const value = raw.net_yield_usd + (raw.rate_usd_per_sec * (computedAtMs - raw.as_of_ms)) / 1000
  return { ...raw, value, computed_at_ms: computedAtMs }
}

/** Null on any failure — the badge simply does not render without data. */
export async function getLifetimeEarningsHeadlineOrNull(): Promise<TLifetimeEarningsHeadline | null> {
  try {
    return await getLifetimeEarningsHeadline()
  } catch (error) {
    console.warn('[SSR] Failed to read lifetime earnings headline', error)
    return null
  }
}
