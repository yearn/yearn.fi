import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPoolMock = vi.fn()
const isDatabaseEnabledMock = vi.fn()

vi.mock('../db/connection', () => ({
  getPool: getPoolMock,
  isDatabaseEnabled: isDatabaseEnabledMock
}))

describe('deleteStaleCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prunes stale rate limit rows during cache cleanup', async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({ rowCount: 2 }).mockResolvedValueOnce({ rowCount: 4 })

    isDatabaseEnabledMock.mockReturnValue(true)
    getPoolMock.mockResolvedValue({
      query: queryMock,
      end: vi.fn()
    })

    const { deleteStaleCache } = await import('./cache')
    const deletedCount = await deleteStaleCache()

    expect(queryMock).toHaveBeenNthCalledWith(1, 'DELETE FROM holdings_totals WHERE date < $1::date', ['2024-01-01'])
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM rate_limits'))
    expect(deletedCount).toBe(6)
  })
})

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
  })
})
