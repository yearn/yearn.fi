import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsRedisClientMock = vi.fn()
const isHoldingsStorageEnabledMock = vi.fn()
const handleHoldingsRedisErrorMock = vi.fn()

vi.mock('../storage/redis', () => ({
  getHoldingsRedisClient: getHoldingsRedisClientMock,
  isHoldingsStorageEnabled: isHoldingsStorageEnabledMock,
  handleHoldingsRedisError: handleHoldingsRedisErrorMock
}))

describe('Redis cache writes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('saves historical totals as Redis hash fields with a cache ttl', async () => {
    const hsetMock = vi.fn().mockResolvedValue(2)
    const expireMock = vi.fn().mockResolvedValue(1)
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    getHoldingsRedisClientMock.mockReturnValue({
      hset: hsetMock,
      expire: expireMock
    })

    const { saveCachedTotals } = await import('./cache')
    const saved = await saveCachedTotals('0x0000000000000000000000000000000000000001', 'all', [
      { date: '2025-01-01', usdValue: 1 },
      { date: '2025-01-02', usdValue: 2 }
    ])

    expect(saved).toBe(true)
    expect(hsetMock).toHaveBeenCalledTimes(1)
    expect(hsetMock.mock.calls[0]?.[0]).toMatch(/^holdings:totals:[a-f0-9]{64}:all$/)
    expect(Object.keys(hsetMock.mock.calls[0]?.[1] ?? {})).toEqual(['2025-01-01', '2025-01-02'])
    expect(expireMock).toHaveBeenCalledWith(hsetMock.mock.calls[0]?.[0], 30 * 24 * 60 * 60)
  })

  it('loads cached totals by requested date range', async () => {
    const hgetallMock = vi.fn().mockResolvedValue({
      '2025-01-01': JSON.stringify({ usdValue: 1, updatedAt: 1000 }),
      '2025-01-02': JSON.stringify({ usdValue: 2, updatedAt: 2000 }),
      '2025-01-03': JSON.stringify({ usdValue: 3, updatedAt: 3000 })
    })
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    getHoldingsRedisClientMock.mockReturnValue({
      hgetall: hgetallMock
    })

    const { getCachedTotalsWithTimestamp } = await import('./cache')
    const result = await getCachedTotalsWithTimestamp(
      '0x0000000000000000000000000000000000000001',
      'all',
      '2025-01-02',
      '2025-01-03'
    )

    expect(result.totals).toEqual([
      { date: '2025-01-02', usdValue: 2 },
      { date: '2025-01-03', usdValue: 3 }
    ])
    expect(result.oldestUpdatedAt?.getTime()).toBe(2000)
  })

  it('treats failed staleness checks as stale cache', async () => {
    const mgetMock = vi.fn().mockRejectedValue(new Error('redis unavailable'))
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    getHoldingsRedisClientMock.mockReturnValue({
      mget: mgetMock
    })

    const { checkCacheStaleness } = await import('./cache')
    const isStale = await checkCacheStaleness(
      [{ address: '0x0000000000000000000000000000000000000001', chainId: 1 }],
      new Date('2026-03-31T00:00:00Z')
    )

    expect(isStale).toBe(true)
    expect(handleHoldingsRedisErrorMock).toHaveBeenCalledWith('cache staleness check failed', expect.any(Error))
  })
})
