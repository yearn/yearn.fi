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

  it('preserves cached responses without constructing the deferred settled context', async () => {
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
    getSettledAddressScopedContextMock.mockResolvedValue({ address: USER })
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
      expect.any(Function),
      expect.any(Function)
    )
    expect(getHoldingsProtocolReturnPortfolioMock).toHaveBeenCalledWith(
      USER,
      'v3',
      'parallel',
      'paged',
      'all',
      undefined,
      undefined,
      expect.any(Function)
    )
    expect(getSettledAddressScopedContextMock).not.toHaveBeenCalled()
    expect(getHistoricalHoldingsChartMock.mock.calls[0]?.[7]).toBe(
      getHoldingsProtocolReturnPortfolioMock.mock.calls[0]?.[7]
    )
    const loadCacheValidationVaults = getHistoricalHoldingsChartMock.mock.calls[0]?.[8] as () => Promise<unknown>
    await expect(loadCacheValidationVaults()).resolves.toEqual([{ chainId: 1, vaultAddress: VAULT }])
  })

  it('constructs the shared settled context once when both cold paths request it', async () => {
    const generatedAt = '2026-08-14T00:00:00.000Z'
    const loadContextArgument = async (...args: unknown[]): Promise<void> => {
      const loadContext = args[7] as () => Promise<unknown>
      await loadContext()
    }
    getSettledAddressScopedContextMock.mockResolvedValue({ address: USER })
    getHistoricalHoldingsChartMock.mockImplementation(async (...args: unknown[]) => {
      await loadContextArgument(...args)
      return {
        address: USER,
        periodDays: 1,
        timeframe: '1y',
        denomination: 'usd',
        hasActivity: true,
        dataPoints: [{ date: '2026-08-13', timestamp: 1_755_043_199, value: 100 }]
      }
    })
    getHoldingsProtocolReturnPortfolioMock.mockImplementation(async (...args: unknown[]) => {
      await loadContextArgument(...args)
      return {
        protocolReturn: {
          address: USER,
          version: 'all',
          timeframe: '1y',
          generatedAt,
          summary: {
            totalVaults: 0,
            completeVaults: 0,
            partialVaults: 0,
            recommendedGrowthDisplay: 'index',
            recommendedGrowthDisplayReason: 'mixed',
            openBaselineCompositionUsd: { stable: 0, ethFamily: 0, other: 0 },
            isComplete: true
          },
          dataPoints: [],
          familySeries: []
        },
        growth: {
          generatedAt,
          summary: { totalVaults: 0, completeVaults: 0, partialVaults: 0, isComplete: true },
          vaults: []
        }
      }
    })

    const { getHoldingsPortfolio } = await import('./portfolio')
    await getHoldingsPortfolio(USER)

    expect(getSettledAddressScopedContextMock).toHaveBeenCalledTimes(1)
    expect(getSettledAddressScopedContextMock).toHaveBeenCalledWith({
      userAddress: USER,
      fetchType: 'seq',
      paginationMode: 'paged'
    })
  })
})
