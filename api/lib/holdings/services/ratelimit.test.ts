import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsRedisClientMock = vi.fn()
const isHoldingsStorageEnabledMock = vi.fn()
const handleHoldingsRedisErrorMock = vi.fn()
const warnMock = vi.spyOn(console, 'warn').mockImplementation(() => {})

vi.mock('../storage/redis', () => ({
  getHoldingsRedisClient: getHoldingsRedisClientMock,
  isHoldingsStorageEnabled: isHoldingsStorageEnabledMock,
  handleHoldingsRedisError: handleHoldingsRedisErrorMock
}))

describe('Redis rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isHoldingsStorageEnabledMock.mockReturnValue(true)
  })

  it('sets a one-minute ttl on the first request in a window', async () => {
    const incrMock = vi.fn().mockResolvedValue(1)
    const expireMock = vi.fn().mockResolvedValue(1)
    getHoldingsRedisClientMock.mockReturnValue({
      incr: incrMock,
      expire: expireMock,
      ttl: vi.fn()
    })

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1')

    expect(result).toEqual({ allowed: true })
    expect(expireMock).toHaveBeenCalledWith(expect.stringMatching(/^holdings:rate-limit:[a-f0-9]{64}$/), 60)
  })

  it('returns retry-after from Redis ttl after the request limit is exceeded', async () => {
    getHoldingsRedisClientMock.mockReturnValue({
      incr: vi.fn().mockResolvedValue(11),
      expire: vi.fn(),
      ttl: vi.fn().mockResolvedValue(42)
    })

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1')

    expect(result).toEqual({ allowed: false, retryAfter: 42 })
  })

  it('rate limits with the fallback when holdings storage is disabled', async () => {
    isHoldingsStorageEnabledMock.mockReturnValue(false)

    const { checkRateLimit } = await import('./ratelimit')
    let result = { allowed: true }
    for (let i = 0; i < 11; i += 1) {
      result = await checkRateLimit('127.0.0.1')
    }

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
    expect(warnMock).toHaveBeenCalledWith('[Holdings Redis] Using fallback rate limiter: database_disabled')
  })

  it('rate limits with the fallback when Redis is unavailable', async () => {
    getHoldingsRedisClientMock.mockReturnValue(null)

    const { checkRateLimit } = await import('./ratelimit')
    let result = { allowed: true }
    for (let i = 0; i < 11; i += 1) {
      result = await checkRateLimit('127.0.0.1')
    }

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
    expect(warnMock).toHaveBeenCalledWith('[Holdings Redis] Using fallback rate limiter: pool_unavailable')
  })

  it('rate limits with the fallback when the Redis query fails', async () => {
    getHoldingsRedisClientMock.mockReturnValue({
      incr: vi.fn().mockRejectedValue(new Error('network error')),
      expire: vi.fn(),
      ttl: vi.fn()
    })

    const { checkRateLimit } = await import('./ratelimit')
    let result = { allowed: true }
    for (let i = 0; i < 11; i += 1) {
      result = await checkRateLimit('127.0.0.1')
    }

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
    expect(handleHoldingsRedisErrorMock).toHaveBeenCalledWith('rate limit check failed', expect.any(Error))
    expect(warnMock).toHaveBeenCalledWith('[Holdings Redis] Using fallback rate limiter: query_failed')
  })

  it('uses Redis when the database-backed limiter succeeds', async () => {
    const incrMock = vi.fn().mockResolvedValue(1)
    const expireMock = vi.fn().mockResolvedValue(1)
    getHoldingsRedisClientMock.mockReturnValue({
      incr: incrMock,
      expire: expireMock,
      ttl: vi.fn()
    })

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1')

    expect(result).toEqual({ allowed: true })
    expect(incrMock).toHaveBeenCalledTimes(1)
    expect(warnMock).not.toHaveBeenCalled()
  })
})
