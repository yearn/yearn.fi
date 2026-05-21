import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsRedisClientMock = vi.fn()
const isHoldingsStorageConfiguredMock = vi.fn()
const handleHoldingsRedisErrorMock = vi.fn()
const warnMock = vi.spyOn(console, 'warn').mockImplementation(() => {})

vi.mock('../storage/redis', () => ({
  getHoldingsRedisClient: getHoldingsRedisClientMock,
  isHoldingsStorageConfigured: isHoldingsStorageConfiguredMock,
  handleHoldingsRedisError: handleHoldingsRedisErrorMock
}))

describe('Redis rate limiting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    isHoldingsStorageConfiguredMock.mockReturnValue(true)
  })

  it('allows requests when Redis storage is not configured', async () => {
    isHoldingsStorageConfiguredMock.mockReturnValue(false)

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1')

    expect(result).toEqual({ allowed: true })
    expect(getHoldingsRedisClientMock).not.toHaveBeenCalled()
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

  it('fails closed when Redis reports over limit but the ttl lookup fails', async () => {
    getHoldingsRedisClientMock.mockReturnValue({
      incr: vi.fn().mockResolvedValue(11),
      expire: vi.fn(),
      ttl: vi.fn().mockRejectedValue(new Error('ttl lookup failed'))
    })

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1')

    expect(result).toEqual({ allowed: false, retryAfter: 60 })
    expect(handleHoldingsRedisErrorMock).toHaveBeenCalledWith('rate limit ttl lookup failed', expect.any(Error))
    expect(warnMock).toHaveBeenCalledWith('[Holdings Redis] Rate limiter failed closed: query_failed')
  })

  it('denies with degraded metadata when configured Redis storage is unavailable', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    getHoldingsRedisClientMock.mockReturnValue(null)

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1')

    expect(result).toEqual({ allowed: false, retryAfter: 60, degraded: true, reason: 'storage_unavailable' })
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Holdings Redis] rate limit storage unavailable')

    consoleErrorSpy.mockRestore()
  })

  it('denies with degraded metadata when Redis rate-limit operations fail', async () => {
    const error = new Error('network timeout')
    getHoldingsRedisClientMock.mockReturnValue({
      incr: vi.fn().mockRejectedValue(error),
      expire: vi.fn(),
      ttl: vi.fn()
    })

    const { checkRateLimit } = await import('./ratelimit')
    const result = await checkRateLimit('127.0.0.1')

    expect(result).toEqual({ allowed: false, retryAfter: 60, degraded: true, reason: 'storage_unavailable' })
    expect(handleHoldingsRedisErrorMock).toHaveBeenCalledWith('rate limit check failed', error)
  })
})
