import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsRedisClientMock = vi.fn()
const isHoldingsStorageEnabledMock = vi.fn()
const handleHoldingsRedisErrorMock = vi.fn()

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
})
