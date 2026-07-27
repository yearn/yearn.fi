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
})

describe('protocol return history snapshot cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('stores a versioned wallet snapshot without exposing the wallet address in the key', async () => {
    const setMock = vi.fn().mockResolvedValue('OK')
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    getHoldingsRedisClientMock.mockReturnValue({ set: setMock })

    const { getProtocolReturnHistoryCacheKey, saveCachedProtocolReturnHistory } = await import('./cache')
    const identity = {
      userAddress: '0x0000000000000000000000000000000000000001',
      version: 'all',
      timeframe: '1y'
    }
    const response = { summary: { isComplete: true }, dataPoints: [{ date: '2026-07-15' }] }
    const saved = await saveCachedProtocolReturnHistory(
      identity,
      '2026-07-15',
      [{ address: '0x00000000000000000000000000000000000000A1', chainId: 1 }],
      response,
      1234
    )
    const key = getProtocolReturnHistoryCacheKey(identity)

    expect(saved).toBe(true)
    expect(key).toMatch(/^holdings:protocol-return-history:v3:[a-f0-9]{64}:all:1y:all$/)
    expect(key).not.toContain(identity.userAddress)
    expect(setMock).toHaveBeenCalledWith(
      key,
      JSON.stringify({
        settledDate: '2026-07-15',
        updatedAt: 1234,
        vaults: [{ address: '0x00000000000000000000000000000000000000a1', chainId: 1 }],
        response
      }),
      { ex: 24 * 60 * 60 }
    )
  })

  it('builds a stable hashed key for filtered vault scopes', async () => {
    const { getProtocolReturnHistoryCacheKey } = await import('./cache')
    const identity = {
      userAddress: '0x0000000000000000000000000000000000000001',
      version: 'all',
      timeframe: '1y',
      vaultScope: [
        { address: '0x00000000000000000000000000000000000000b2', chainId: 10 },
        { address: '0x00000000000000000000000000000000000000A1', chainId: 1 }
      ]
    }
    const reversedIdentity = { ...identity, vaultScope: [...identity.vaultScope].reverse() }
    const key = getProtocolReturnHistoryCacheKey(identity)

    expect(key).toBe(getProtocolReturnHistoryCacheKey(reversedIdentity))
    expect(key).toMatch(/^holdings:protocol-return-history:v3:[a-f0-9]{64}:all:1y:[a-f0-9]{64}$/)
    expect(key).not.toContain(identity.vaultScope[0].address)
  })

  it('returns a current snapshot after checking vault invalidation markers with the supported array signature', async () => {
    const getMock = vi.fn().mockResolvedValue({
      settledDate: '2026-07-15',
      updatedAt: 2000,
      vaults: [{ address: '0x00000000000000000000000000000000000000a1', chainId: 1 }],
      response: { dataPoints: [{ date: '2026-07-15' }] }
    })
    const mgetMock = vi.fn().mockResolvedValue([null])
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    getHoldingsRedisClientMock.mockReturnValue({ get: getMock, mget: mgetMock })

    const { getCachedProtocolReturnHistory } = await import('./cache')
    const response = await getCachedProtocolReturnHistory<{ dataPoints: Array<{ date: string }> }>(
      {
        userAddress: '0x0000000000000000000000000000000000000001',
        version: 'all',
        timeframe: '1y'
      },
      '2026-07-15'
    )

    expect(response).toEqual({ dataPoints: [{ date: '2026-07-15' }] })
    expect(mgetMock).toHaveBeenCalledWith(['holdings:vault-invalidated:1:0x00000000000000000000000000000000000000a1'])
  })

  it('misses snapshots from a different settled day before checking invalidations', async () => {
    const getMock = vi.fn().mockResolvedValue({
      settledDate: '2026-07-14',
      updatedAt: 2000,
      vaults: [{ address: '0x00000000000000000000000000000000000000a1', chainId: 1 }],
      response: { dataPoints: [] }
    })
    const mgetMock = vi.fn()
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    getHoldingsRedisClientMock.mockReturnValue({ get: getMock, mget: mgetMock })

    const { getCachedProtocolReturnHistory } = await import('./cache')
    const response = await getCachedProtocolReturnHistory(
      {
        userAddress: '0x0000000000000000000000000000000000000001',
        version: 'all',
        timeframe: '1y'
      },
      '2026-07-15'
    )

    expect(response).toBeNull()
    expect(mgetMock).not.toHaveBeenCalled()
  })

  it('misses snapshots invalidated after their calculation started', async () => {
    const getMock = vi.fn().mockResolvedValue({
      settledDate: '2026-07-15',
      updatedAt: 2000,
      vaults: [{ address: '0x00000000000000000000000000000000000000a1', chainId: 1 }],
      response: { dataPoints: [] }
    })
    const mgetMock = vi.fn().mockResolvedValue([3000])
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    getHoldingsRedisClientMock.mockReturnValue({ get: getMock, mget: mgetMock })

    const { getCachedProtocolReturnHistory } = await import('./cache')
    const response = await getCachedProtocolReturnHistory(
      {
        userAddress: '0x0000000000000000000000000000000000000001',
        version: 'all',
        timeframe: '1y'
      },
      '2026-07-15'
    )

    expect(response).toBeNull()
  })
})
