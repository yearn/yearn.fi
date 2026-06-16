import { beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_ADDRESS = '0x2222222222222222222222222222222222222222'

const ensureHoldingsStorageInitializedMock = vi.fn()
const fetchRecentAddressScopedActivityEventsMock = vi.fn()

vi.mock('../lib/holdings', () => ({
  ensureHoldingsStorageInitialized: ensureHoldingsStorageInitializedMock,
  fetchRecentAddressScopedActivityEvents: fetchRecentAddressScopedActivityEventsMock
}))

function createRequest(query: Record<string, string>): Request {
  return new Request(`https://yearn.fi/api/holdings/activity-facets?${new URLSearchParams(query)}`)
}

describe('holdings activity facets route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureHoldingsStorageInitializedMock.mockResolvedValue(undefined)
    fetchRecentAddressScopedActivityEventsMock.mockResolvedValue({
      deposits: [{ chainId: 1 }],
      withdrawals: [{ chainId: 8453 }],
      transfersIn: [],
      transfersOut: [],
      hasMoreDeposits: false,
      hasMoreWithdrawals: false,
      hasMoreTransfersIn: false,
      hasMoreTransfersOut: false
    })
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('returns chain facets from cheap chain existence checks', async () => {
    const { default: handler } = await import('./activity-facets')
    const response = await handler(
      createRequest({
        address: TEST_ADDRESS,
        version: 'all'
      })
    )

    expect(fetchRecentAddressScopedActivityEventsMock).toHaveBeenCalledWith(TEST_ADDRESS, 'all', 250, undefined, 0)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      address: TEST_ADDRESS.toLowerCase(),
      version: 'all',
      facets: { chainIds: [1, 8453] },
      pageInfo: {
        hasMore: false,
        nextOffsetPerSource: null
      }
    })
  })
})
