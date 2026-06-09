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

  it('marks vaults as invalidated in Redis', async () => {
    const msetMock = vi.fn().mockResolvedValue('OK')
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_779_564_000_000)
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    getHoldingsRedisClientMock.mockReturnValue({
      mset: msetMock
    })

    const { invalidateVaults } = await import('./cache')
    const invalidated = await invalidateVaults([
      {
        address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
        chainId: 1
      }
    ])

    expect(invalidated).toBe(1)
    expect(msetMock).toHaveBeenCalledWith({
      'holdings:vault-invalidated:1:0xbe53a109b494e5c9f97b9cd39fe969be68bf6204': 1_779_564_000_000
    })
    nowSpy.mockRestore()
  })
})
