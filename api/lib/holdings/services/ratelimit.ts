import { checkRateLimit as checkVercelRateLimit } from '@vercel/firewall'

const WINDOW_SECONDS = 60
const DEFAULT_RATE_LIMIT_ID = 'holdings-public-api'

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

type RateLimitHeaders = Headers | Record<string, string | string[] | undefined>

function getRateLimitId(): string {
  return process.env.VERCEL_HOLDINGS_RATE_LIMIT_ID?.trim() || DEFAULT_RATE_LIMIT_ID
}

function normalizeHeaders(headers?: RateLimitHeaders): Headers | Record<string, string | string[]> | undefined {
  if (!headers || headers instanceof Headers) {
    return headers
  }

  const normalizedHeaders: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== 'undefined') {
      normalizedHeaders[key] = value
    }
  }
  return normalizedHeaders
}

export async function checkRateLimit(clientIdentifier: string, headers?: RateLimitHeaders): Promise<RateLimitResult> {
  if (process.env.VERCEL !== '1') {
    return { allowed: true }
  }

  const rateLimitId = getRateLimitId()

  try {
    const result = await checkVercelRateLimit(rateLimitId, {
      headers: normalizeHeaders(headers),
      rateLimitKey: clientIdentifier
    })

    if (result.error) {
      console.warn(`[Holdings] Vercel rate limit check returned ${result.error} for ${rateLimitId}`)
    }

    return result.rateLimited ? { allowed: false, retryAfter: WINDOW_SECONDS } : { allowed: true }
  } catch (error) {
    console.warn('[Holdings] Vercel rate limit check failed', error)
    return { allowed: true }
  }
}
