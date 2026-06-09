import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkVercelRateLimitMock = vi.fn()

vi.mock('@vercel/firewall', () => ({
  checkRateLimit: checkVercelRateLimitMock
}))

describe('Vercel Firewall rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('allows requests without checking Vercel Firewall outside Vercel', async () => {
    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1', { host: 'localhost:3001' })

    expect(result).toEqual({ allowed: true })
    expect(checkVercelRateLimitMock).not.toHaveBeenCalled()
  })

  it('checks Vercel Firewall with the client identifier as the rate limit key', async () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_HOLDINGS_RATE_LIMIT_ID', 'test-holdings-limit')
    checkVercelRateLimitMock.mockResolvedValue({ rateLimited: false })

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1', { host: 'example.vercel.app', 'x-test': undefined })

    expect(result).toEqual({ allowed: true })
    expect(checkVercelRateLimitMock).toHaveBeenCalledWith('test-holdings-limit', {
      headers: { host: 'example.vercel.app' },
      rateLimitKey: '127.0.0.1'
    })
  })

  it('returns a fixed retry-after when Vercel rate limits the request', async () => {
    vi.stubEnv('VERCEL', '1')
    checkVercelRateLimitMock.mockResolvedValue({ rateLimited: true })

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1', { host: 'example.vercel.app' })

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
  })
})
