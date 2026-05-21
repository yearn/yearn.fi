import type { VercelRequest } from '@vercel/node'

type TRateLimitBucket = {
  count: number
  resetAt: number
}

type TRateLimitResult = {
  allowed: boolean
  retryAfter: number
}

const WINDOW_MS = 60_000
const buckets = new Map<string, TRateLimitBucket>()

function getHeaderValue(req: VercelRequest, header: string): string | undefined {
  const value = req.headers[header]
  return Array.isArray(value) ? value[0] : value
}

export function getEnsoClientKey(req: VercelRequest): string {
  const forwardedFor = getHeaderValue(req, 'x-forwarded-for')
  const forwardedClient = forwardedFor?.split(',')[0]?.trim()
  const realIp = getHeaderValue(req, 'x-real-ip')?.trim()
  const vercelIp = getHeaderValue(req, 'x-vercel-forwarded-for')?.split(',')[0]?.trim()

  return forwardedClient || realIp || vercelIp || 'unknown'
}

export function checkEnsoRateLimit(req: VercelRequest, route: string, limit: number): TRateLimitResult {
  const now = Date.now()
  const clientKey = getEnsoClientKey(req)
  const bucketKey = `${route}:${clientKey}`
  const bucket = buckets.get(bucketKey)
  const activeBucket = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + WINDOW_MS }
  const nextCount = activeBucket.count + 1

  buckets.set(bucketKey, { count: nextCount, resetAt: activeBucket.resetAt })

  if (nextCount <= limit) {
    return { allowed: true, retryAfter: 0 }
  }

  return {
    allowed: false,
    retryAfter: Math.max(1, Math.ceil((activeBucket.resetAt - now) / 1000))
  }
}

export function resetEnsoRateLimitForTests() {
  buckets.clear()
}

export async function fetchWithEnsoTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}
