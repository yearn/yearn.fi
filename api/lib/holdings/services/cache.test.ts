import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPoolMock = vi.fn()
const isDatabaseEnabledMock = vi.fn()

vi.mock('../db/connection', () => ({
  getPool: getPoolMock,
  isDatabaseEnabled: isDatabaseEnabledMock
}))

describe('cache writes', () => {
  beforeEach(() => {
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
    expect(queryMock.mock.calls[0]?.[2]).toEqual({ disableOnFailure: false })
    expect(queryMock.mock.calls[1]?.[2]).toEqual({ disableOnFailure: false })
  })
})
