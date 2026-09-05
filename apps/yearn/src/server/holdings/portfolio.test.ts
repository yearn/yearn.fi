import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsPortfolioMock = vi.fn()
const startHoldingsProgressMock = vi.fn()
const updateHoldingsProgressMock = vi.fn()
const USER = '0x1111111111111111111111111111111111111111'

vi.mock('../lib/holdings', () => ({
  getHoldingsPortfolio: getHoldingsPortfolioMock
}))

vi.mock('@/server/lib/holdings/services/progress', () => ({
  startHoldingsProgress: startHoldingsProgressMock,
  updateHoldingsProgress: updateHoldingsProgressMock
}))

describe('holdings portfolio route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    startHoldingsProgressMock.mockImplementation(async ({ id }: { id: string | null }) => id)
    updateHoldingsProgressMock.mockResolvedValue(undefined)
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('returns the combined portfolio response without changing either nested response', async () => {
    const portfolio = {
      address: USER,
      version: 'all',
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
        version: 'all',
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

    const { GET: handler } = await import('@/server/holdings/portfolio')
    const response = await handler(
      new Request(
        `https://yearn.fi/api/holdings/portfolio?${new URLSearchParams({
          address: USER,
          denomination: 'eth',
          timeframe: 'all'
        })}`
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
    await expect(response.json()).resolves.toEqual(portfolio)
    expect(getHoldingsPortfolioMock).toHaveBeenCalledWith(USER, 'eth', 'all', null)
  })

  it('uses the single portfolio event pipeline', async () => {
    getHoldingsPortfolioMock.mockResolvedValue({
      address: USER,
      version: 'all',
      denomination: 'usd',
      timeframe: '1y',
      balance: { address: USER, denomination: 'usd', timeframe: '1y', dataPoints: [] },
      protocolReturn: { dataPoints: [] },
      growth: { vaults: [] }
    })

    const { GET: handler } = await import('@/server/holdings/portfolio')
    const response = await handler(new Request(`https://yearn.fi/api/holdings/portfolio?address=${USER}`))

    expect(response.status).toBe(200)
    expect(getHoldingsPortfolioMock).toHaveBeenCalledWith(USER, 'usd', '1y', null)
  })

  it('starts and completes progress for the combined request', async () => {
    getHoldingsPortfolioMock.mockResolvedValue({
      address: USER,
      version: 'all',
      denomination: 'usd',
      timeframe: 'all',
      balance: {
        address: USER,
        denomination: 'usd',
        timeframe: 'all',
        dataPoints: [{ date: '2026-08-13', value: 100 }]
      },
      protocolReturn: { dataPoints: [{ date: '2026-08-13' }] },
      growth: { vaults: [] }
    })

    const { GET: handler } = await import('@/server/holdings/portfolio')
    const response = await handler(
      new Request(
        `https://yearn.fi/api/holdings/portfolio?${new URLSearchParams({
          address: USER,
          timeframe: 'all',
          progressId: 'portfolio:test'
        })}`
      )
    )

    expect(response.status).toBe(200)
    expect(startHoldingsProgressMock).toHaveBeenCalledWith({
      id: 'portfolio:test',
      route: 'portfolio',
      address: USER,
      message: 'Checking saved portfolio history'
    })
    expect(getHoldingsPortfolioMock).toHaveBeenCalledWith(USER, 'usd', 'all', 'portfolio:test')
    expect(updateHoldingsProgressMock).toHaveBeenLastCalledWith('portfolio:test', {
      status: 'complete',
      progress: 100,
      message: 'Portfolio history ready',
      detail: null
    })
  })

  it('marks combined progress as failed when the request errors', async () => {
    getHoldingsPortfolioMock.mockRejectedValue(new Error('price request failed'))

    const { GET: handler } = await import('@/server/holdings/portfolio')
    const response = await handler(
      new Request(
        `https://yearn.fi/api/holdings/portfolio?${new URLSearchParams({
          address: USER,
          progressId: 'portfolio:test'
        })}`
      )
    )

    expect(response.status).toBe(502)
    expect(updateHoldingsProgressMock).toHaveBeenLastCalledWith('portfolio:test', {
      status: 'error',
      message: 'Failed to build portfolio history',
      detail: 'price request failed'
    })
  })
})
