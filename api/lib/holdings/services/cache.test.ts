import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPoolMock = vi.fn()
const isDatabaseEnabledMock = vi.fn()

vi.mock('../db/connection', () => ({
  getPool: getPoolMock,
  isDatabaseEnabled: isDatabaseEnabledMock
}))

describe('cache writes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('saves historical totals in smaller batches', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rowCount: 250 })
    isDatabaseEnabledMock.mockReturnValue(true)
    getPoolMock.mockResolvedValue({
      query: queryMock,
      end: vi.fn()
    })

    const { saveCachedTotals } = await import('./cache')
    const totals = Array.from({ length: 497 }, (_value, index) => ({
      date: `2025-01-${String((index % 28) + 1).padStart(2, '0')}`,
      usdValue: index
    }))

    const saved = await saveCachedTotals('0x0000000000000000000000000000000000000001', 'all', totals)

    expect(saved).toBe(true)
    expect(queryMock).toHaveBeenCalledTimes(2)
    expect(queryMock.mock.calls[0]?.[1]).toHaveLength(1_000)
    expect(queryMock.mock.calls[1]?.[1]).toHaveLength(988)
  })
})

describe('price cache lookups', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('loads cached prices with compact array parameters', async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ token_key: 'ethereum:0xabc', timestamp: 1700000000, price: '1.23' }]
    })

    isDatabaseEnabledMock.mockReturnValue(true)
    getPoolMock.mockResolvedValue({
      query: queryMock,
      end: vi.fn()
    })

    const { getCachedPricesForTokenTimestamps } = await import('./cache')
    const result = await getCachedPricesForTokenTimestamps([
      { tokenKey: 'ethereum:0xabc', timestamps: [1700000000, 1700003600] }
    ])

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('unnest($1::text[], $2::integer[])'), [
      ['ethereum:0xabc', 'ethereum:0xabc'],
      [1700000000, 1700003600]
    ])
    expect(result.get('ethereum:0xabc')?.get(1700000000)).toBe(1.23)
  })

  it('loads cached price misses with compact array parameters', async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [{ token_key: 'ethereum:0xabc', timestamp: 1700000000 }]
    })

    isDatabaseEnabledMock.mockReturnValue(true)
    getPoolMock.mockResolvedValue({
      query: queryMock,
      end: vi.fn()
    })

    const { getCachedPriceMissesForTokenTimestamps } = await import('./cache')
    const result = await getCachedPriceMissesForTokenTimestamps([
      { tokenKey: 'ethereum:0xabc', timestamps: [1700000000, 1700003600] }
    ])

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('unnest($1::text[], $2::integer[])'), [
      ['ethereum:0xabc', 'ethereum:0xabc'],
      [1700000000, 1700003600]
    ])
    expect(result.get('ethereum:0xabc')?.has(1700000000)).toBe(true)
  })
})

describe('protocol return history cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('loads cached protocol return history by wallet, timeframe, vault filter, and settled timestamp', async () => {
    const queryMock = vi.fn().mockResolvedValue({
      rows: [
        { response_json: { dataPoints: [{ timestamp: 1700000000 }] }, updated_at: new Date('2026-05-11T00:00:00Z') }
      ]
    })

    isDatabaseEnabledMock.mockReturnValue(true)
    getPoolMock.mockResolvedValue({
      query: queryMock,
      end: vi.fn()
    })

    const { getCachedProtocolReturnHistory } = await import('./cache')
    const result = await getCachedProtocolReturnHistory<{ dataPoints: Array<{ timestamp: number }> }>({
      userAddress: '0x1111111111111111111111111111111111111111',
      version: 'all',
      timeframe: '1y',
      vaultFilterKey: 'all',
      latestSettledTimestamp: 1778457599,
      maxAgeSeconds: 3600
    })

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('FROM protocol_return_history'), [
      expect.any(String),
      'all',
      '1y',
      expect.any(String),
      1778457599,
      3600
    ])
    expect(result?.response.dataPoints[0]?.timestamp).toBe(1700000000)
  })

  it('saves cached protocol return history without disabling the database on write failure', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] })

    isDatabaseEnabledMock.mockReturnValue(true)
    getPoolMock.mockResolvedValue({
      query: queryMock,
      end: vi.fn()
    })

    const { saveCachedProtocolReturnHistory } = await import('./cache')
    await saveCachedProtocolReturnHistory({
      userAddress: '0x1111111111111111111111111111111111111111',
      version: 'all',
      timeframe: '1y',
      vaultFilterKey: 'all',
      latestSettledTimestamp: 1778457599,
      response: { dataPoints: [] }
    })

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO protocol_return_history'),
      [expect.any(String), 'all', '1y', expect.any(String), 1778457599, JSON.stringify({ dataPoints: [] })],
      { disableOnFailure: false }
    )
  })

  it('serves protocol return history from memory when the database is disabled', async () => {
    isDatabaseEnabledMock.mockReturnValue(false)
    getPoolMock.mockResolvedValue(null)

    const { getCachedProtocolReturnHistory, saveCachedProtocolReturnHistory } = await import('./cache')
    await saveCachedProtocolReturnHistory({
      userAddress: '0x2222222222222222222222222222222222222222',
      version: 'all',
      timeframe: '1y',
      vaultFilterKey: 'all',
      latestSettledTimestamp: 1778457599,
      response: { dataPoints: [{ timestamp: 1778457599 }] }
    })

    const result = await getCachedProtocolReturnHistory<{ dataPoints: Array<{ timestamp: number }> }>({
      userAddress: '0x2222222222222222222222222222222222222222',
      version: 'all',
      timeframe: '1y',
      vaultFilterKey: 'all',
      latestSettledTimestamp: 1778457599,
      maxAgeSeconds: 3600
    })

    expect(getPoolMock).not.toHaveBeenCalled()
    expect(result?.response.dataPoints[0]?.timestamp).toBe(1778457599)
  })
})
