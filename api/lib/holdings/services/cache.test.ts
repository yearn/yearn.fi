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
    const queryMock = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValueOnce({ rowCount: 4 })

    isDatabaseEnabledMock.mockReturnValue(true)
    getPoolMock.mockResolvedValue({
      query: queryMock,
      end: vi.fn()
    })

    const { deleteStaleCache } = await import('./cache')
    const deletedCount = await deleteStaleCache()

    expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining('DELETE FROM holdings_totals'))
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM token_price_misses'))
    expect(queryMock).toHaveBeenNthCalledWith(3, expect.stringContaining('DELETE FROM rate_limits'))
    expect(deletedCount).toBe(9)
  })
})
