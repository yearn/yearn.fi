import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHistoricalHoldingsChartMock = vi.fn()
const getHoldingsProtocolReturnPortfolioMock = vi.fn()
const getSettledAddressScopedContextMock = vi.fn()

vi.mock('./aggregator', () => ({
  getHistoricalHoldingsChart: getHistoricalHoldingsChartMock
}))

vi.mock('./pnlSimple', () => ({
  getHoldingsProtocolReturnPortfolio: getHoldingsProtocolReturnPortfolioMock
}))

vi.mock('./settledHoldingsContext', () => ({
  getSettledAddressScopedContext: getSettledAddressScopedContextMock
}))

const USER = '0x1111111111111111111111111111111111111111'
const VAULT = '0x2222222222222222222222222222222222222222'

describe('getHoldingsPortfolio', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('preserves the public balance and protocol-return responses while sharing settled context', async () => {
    const settledContext = Promise.resolve({ address: USER })
    const protocolReturn = {
      address: USER,
      version: 'v3' as const,
      timeframe: 'all' as const,
      generatedAt: '2026-08-14T00:00:00.000Z',
      summary: {
        totalVaults: 1,
        completeVaults: 1,
        partialVaults: 0,
        recommendedGrowthDisplay: 'usd' as const,
        recommendedGrowthDisplayReason: 'stable_dominant' as const,
        openBaselineCompositionUsd: { stable: 100, ethFamily: 0, other: 0 },
        isComplete: true
      },
      dataPoints: [
        {
          date: '2026-08-13',
          timestamp: 1_755_043_199,
          growthWeightUsd: 5,
          growthWeightEth: 0.001,
          protocolReturnPct: 5,
          annualizedProtocolReturnPct: 10,
          growthIndex: 105
        }
      ],
      familySeries: []
    }
    const growth = {
      generatedAt: protocolReturn.generatedAt,
      summary: { totalVaults: 1, completeVaults: 1, partialVaults: 0, isComplete: true },
      vaults: [
        {
          chainId: 1,
          vaultAddress: VAULT,
          status: 'ok' as const,
          issues: [],
          baselineUsd: 100,
          baselineExposureUsdYears: 0.5,
          growthUsd: 5,
          growthPct: 5,
          annualizedProtocolReturnPct: 10,
          metadata: {
            symbol: 'yvUSDC',
            decimals: 18,
            assetDecimals: 6,
            tokenAddress: '0x3333333333333333333333333333333333333333'
          }
        }
      ]
    }
    getSettledAddressScopedContextMock.mockReturnValue(settledContext)
    getHistoricalHoldingsChartMock.mockResolvedValue({
      address: USER,
      periodDays: 2,
      timeframe: 'all',
      denomination: 'eth',
      hasActivity: true,
      dataPoints: [
        { date: '2026-08-12', timestamp: 1_754_956_799, value: 1 },
        { date: '2026-08-13', timestamp: 1_755_043_199, value: 1.1 }
      ]
    })
    getHoldingsProtocolReturnPortfolioMock.mockResolvedValue({ protocolReturn, growth })

    const { getHoldingsPortfolio } = await import('./portfolio')
    const response = await getHoldingsPortfolio(USER, 'v3', 'parallel', 'paged', 'eth', 'all')

    expect(response).toEqual({
      address: USER,
      version: 'v3',
      denomination: 'eth',
      timeframe: 'all',
      balance: {
        address: USER,
        denomination: 'eth',
        timeframe: 'all',
        dataPoints: [
          { date: '2026-08-12', value: 1 },
          { date: '2026-08-13', value: 1.1 }
        ]
      },
      protocolReturn,
      growth
    })
    expect(getHistoricalHoldingsChartMock).toHaveBeenCalledWith(
      USER,
      'v3',
      'parallel',
      'paged',
      'eth',
      'all',
      undefined,
      settledContext
    )
    expect(getHoldingsProtocolReturnPortfolioMock).toHaveBeenCalledWith(
      USER,
      'v3',
      'parallel',
      'paged',
      'all',
      undefined,
      undefined,
      settledContext
    )
  })
})
