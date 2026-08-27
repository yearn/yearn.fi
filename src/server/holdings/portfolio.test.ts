import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureHoldingsStorageInitializedMock = vi.fn()
const getHoldingsPortfolioMock = vi.fn()
const USER = '0x1111111111111111111111111111111111111111'

vi.mock('../lib/holdings', () => ({
  ensureHoldingsStorageInitialized: ensureHoldingsStorageInitializedMock,
  getHoldingsPortfolio: getHoldingsPortfolioMock
}))

describe('holdings portfolio route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureHoldingsStorageInitializedMock.mockResolvedValue(undefined)
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('returns the combined portfolio response without changing either nested response', async () => {
    const portfolio = {
      address: USER,
      version: 'v3',
      denomination: 'eth',
      timeframe: 'all',
      balance: {
        address: USER,
        denomination: 'eth',
        timeframe: 'all',
        dataPoints: [{ date: '2026-08-13', value: 1.1 }]
      },
      protocolReturn: {
        address: USER,
        version: 'v3',
        timeframe: 'all',
        generatedAt: '2026-08-14T00:00:00.000Z',
        summary: {
          totalVaults: 1,
          completeVaults: 1,
          partialVaults: 0,
          recommendedGrowthDisplay: 'usd',
          recommendedGrowthDisplayReason: 'stable_dominant',
          openBaselineCompositionUsd: { stable: 100, ethFamily: 0, other: 0 },
          isComplete: true
        },
        dataPoints: [],
        familySeries: []
      },
      growth: {
        generatedAt: '2026-08-14T00:00:00.000Z',
        summary: { totalVaults: 1, completeVaults: 1, partialVaults: 0, isComplete: true },
        vaults: []
      }
    }
    getHoldingsPortfolioMock.mockResolvedValue(portfolio)

    const { default: handler } = await import('./portfolio')
    const response = await handler(
      new Request(
        `https://yearn.fi/api/holdings/portfolio?${new URLSearchParams({
          address: USER,
          version: 'v3',
          fetchType: 'parallel',
          denomination: 'eth',
          timeframe: 'all'
        })}`
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
    await expect(response.json()).resolves.toEqual(portfolio)
    expect(getHoldingsPortfolioMock).toHaveBeenCalledWith(USER, 'v3', 'parallel', 'paged', 'eth', 'all')
  })

  it('uses bounded parallel event pagination by default', async () => {
    getHoldingsPortfolioMock.mockResolvedValue({
      address: USER,
      version: 'all',
      denomination: 'usd',
      timeframe: '1y',
      balance: { address: USER, denomination: 'usd', timeframe: '1y', dataPoints: [] },
      protocolReturn: { dataPoints: [] },
      growth: { vaults: [] }
    })

    const { default: handler } = await import('./portfolio')
    const response = await handler(new Request(`https://yearn.fi/api/holdings/portfolio?address=${USER}`))

    expect(response.status).toBe(200)
    expect(getHoldingsPortfolioMock).toHaveBeenCalledWith(USER, 'all', 'parallel', 'paged', 'usd', '1y')
  })
})
