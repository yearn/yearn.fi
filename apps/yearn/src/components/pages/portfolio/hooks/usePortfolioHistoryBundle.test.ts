import {
  resolvePortfolioHistoryBundleData,
  resolvePortfolioHistoryBundleLoading
} from '@pages/portfolio/hooks/usePortfolioHistoryBundle'
import type { TPortfolioResponse } from '@pages/portfolio/types/api'
import { keepPreviousData, QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

const USER_ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  const state: { resolve?: (value: T) => void } = {}
  const promise = new Promise<T>((resolve) => {
    state.resolve = resolve
  })

  return { promise, resolve: (value) => state.resolve?.(value) }
}

function createPortfolioResponse(
  address = USER_ADDRESS,
  timeframe: TPortfolioResponse['timeframe'] = '1y',
  growthUsd = 1
): TPortfolioResponse {
  return {
    address,
    version: 'all',
    denomination: 'usd',
    timeframe,
    balance: {
      address,
      denomination: 'usd',
      timeframe,
      dataPoints: [{ date: '2026-09-01', value: 100 }]
    },
    protocolReturn: {
      address,
      timeframe,
      summary: {
        totalVaults: 1,
        completeVaults: 1,
        partialVaults: 0,
        recommendedGrowthDisplay: 'index',
        recommendedGrowthDisplayReason: 'mixed',
        openBaselineCompositionUsd: {
          stable: 0,
          ethFamily: 0,
          other: 0
        },
        isComplete: true
      },
      dataPoints: [
        {
          date: '2026-09-01',
          growthWeightUsd: growthUsd,
          growthUsd,
          growthUsdEstimated: false,
          growthWeightEth: 0.001,
          protocolReturnPct: 1,
          annualizedProtocolReturnPct: 2,
          growthIndex: 101
        }
      ],
      familySeries: []
    },
    growth: {
      generatedAt: '2026-09-02T00:00:00.000Z',
      summary: {
        totalVaults: 1,
        completeVaults: 1,
        partialVaults: 0,
        isComplete: true
      },
      vaults: [
        {
          chainId: 1,
          vaultAddress: VAULT_ADDRESS,
          status: 'ok',
          issues: [],
          baselineUsd: 100,
          baselineExposureUsdYears: 0.5,
          growthUnderlying: growthUsd,
          growthUsd,
          growthPct: 1,
          annualizedProtocolReturnPct: 2,
          metadata: {
            symbol: 'yvUSDC',
            decimals: 18,
            assetDecimals: 6,
            tokenAddress: '0x3333333333333333333333333333333333333333'
          }
        }
      ]
    }
  }
}

describe('resolvePortfolioHistoryBundleData', () => {
  it('retains the same-wallet response while treating placeholder history as pending', () => {
    const response = createPortfolioResponse()

    expect(
      resolvePortfolioHistoryBundleData({
        address: USER_ADDRESS.toUpperCase(),
        data: response,
        isPlaceholderData: true
      })
    ).toEqual({ currentData: null, retainedData: response })
  })

  it('uses a resolved same-wallet response as current data', () => {
    const response = createPortfolioResponse()

    expect(
      resolvePortfolioHistoryBundleData({
        address: USER_ADDRESS,
        data: response,
        isPlaceholderData: false
      })
    ).toEqual({ currentData: response, retainedData: response })
  })

  it('does not retain data from another wallet', () => {
    expect(
      resolvePortfolioHistoryBundleData({
        address: '0x2222222222222222222222222222222222222222',
        data: createPortfolioResponse(),
        isPlaceholderData: true
      })
    ).toEqual({ currentData: null, retainedData: null })
  })
})

describe('resolvePortfolioHistoryBundleLoading', () => {
  it('keeps history loading while retained Growth remains available', () => {
    expect(
      resolvePortfolioHistoryBundleLoading({
        hasCurrentData: false,
        hasRetainedGrowth: true,
        isFetching: true,
        isLoading: false,
        isPlaceholderData: true
      })
    ).toEqual({ historyIsLoading: true, growthIsLoading: false })
  })

  it('loads both history and Growth before the first response', () => {
    expect(
      resolvePortfolioHistoryBundleLoading({
        hasCurrentData: false,
        hasRetainedGrowth: false,
        isFetching: true,
        isLoading: true,
        isPlaceholderData: false
      })
    ).toEqual({ historyIsLoading: true, growthIsLoading: true })
  })
})

describe('portfolio history query transition', () => {
  it('keeps same-wallet Growth while ALL history loads', async () => {
    const queryClient = new QueryClient()
    const allRequest = createDeferred<TPortfolioResponse>()
    const oneYearResponse = createPortfolioResponse()
    const allResponse = createPortfolioResponse(USER_ADDRESS, 'all', 2)
    const observer = new QueryObserver<TPortfolioResponse>(queryClient, {
      queryKey: ['portfolio', '1y'],
      queryFn: () => Promise.resolve(oneYearResponse),
      placeholderData: keepPreviousData,
      staleTime: Number.POSITIVE_INFINITY
    })
    const unsubscribe = observer.subscribe(() => undefined)

    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(oneYearResponse))

    observer.setOptions({
      queryKey: ['portfolio', 'all'],
      queryFn: () => allRequest.promise,
      placeholderData: keepPreviousData,
      staleTime: Number.POSITIVE_INFINITY
    })

    const pendingResult = observer.getCurrentResult()
    const pendingData = resolvePortfolioHistoryBundleData({
      address: USER_ADDRESS,
      data: pendingResult.data,
      isPlaceholderData: pendingResult.isPlaceholderData
    })
    const pendingLoading = resolvePortfolioHistoryBundleLoading({
      hasCurrentData: Boolean(pendingData.currentData),
      hasRetainedGrowth: Boolean(pendingData.retainedData?.growth),
      isFetching: pendingResult.isFetching,
      isLoading: pendingResult.isLoading,
      isPlaceholderData: pendingResult.isPlaceholderData
    })

    expect(pendingResult.isPlaceholderData).toBe(true)
    expect(pendingData.currentData).toBeNull()
    expect(pendingData.retainedData?.growth.vaults[0]?.growthUsd).toBe(1)
    expect(pendingLoading).toEqual({ historyIsLoading: true, growthIsLoading: false })

    allRequest.resolve(allResponse)

    await vi.waitFor(() => expect(observer.getCurrentResult().isPlaceholderData).toBe(false))
    expect(observer.getCurrentResult().data?.growth.vaults[0]?.growthUsd).toBe(2)

    unsubscribe()
  })
})
