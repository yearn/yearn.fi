// @vitest-environment jsdom

import {
  buildPortfolioHistoryBundleCacheKey,
  getIncompletePortfolioHistoryDiagnostics,
  resolvePortfolioHistoryBundleData,
  resolvePortfolioHistoryBundleLoading,
  usePortfolioHistoryBundle
} from '@pages/portfolio/hooks/usePortfolioHistoryBundle'
import type { TPortfolioResponse } from '@pages/portfolio/types/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({ address: '0x1111111111111111111111111111111111111111' })
}))
vi.mock('@hooks/usePlausible', () => ({ usePlausible: () => vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
})

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

describe('getIncompletePortfolioHistoryDiagnostics', () => {
  it('returns the vaults and issue codes responsible for incomplete history', () => {
    const response = createPortfolioResponse()
    response.protocolReturn.summary = {
      ...response.protocolReturn.summary,
      completeVaults: 0,
      partialVaults: 1,
      incompleteVaults: [
        {
          chainId: 1,
          vaultAddress: VAULT_ADDRESS,
          symbol: 'yvUSDC',
          tokenAddress: '0x3333333333333333333333333333333333333333',
          status: 'missing_pps',
          issues: ['missing_pps', 'missing_exit_price']
        }
      ],
      isComplete: false
    }

    expect(getIncompletePortfolioHistoryDiagnostics(response)).toEqual({
      address: USER_ADDRESS,
      timeframe: '1y',
      generatedAt: '2026-09-02T00:00:00.000Z',
      summary: {
        totalVaults: 1,
        completeVaults: 0,
        partialVaults: 1
      },
      missingVaults: [
        {
          chainId: 1,
          vaultAddress: VAULT_ADDRESS,
          symbol: 'yvUSDC',
          tokenAddress: '0x3333333333333333333333333333333333333333',
          status: 'missing_pps',
          issues: ['missing_pps', 'missing_exit_price']
        }
      ]
    })
  })

  it('returns no diagnostics for complete history', () => {
    expect(getIncompletePortfolioHistoryDiagnostics(createPortfolioResponse())).toBeNull()
  })
})

describe('portfolio balance empty state', () => {
  it.each([false, true])('uses indexed history even with a zero live balance; has history: %s', (hasHistory) => {
    const response = createPortfolioResponse()
    response.balance.dataPoints = hasHistory ? [{ date: '2026-09-01', value: 0 }] : []
    const queryClient = new QueryClient()
    queryClient.setQueryData(
      buildPortfolioHistoryBundleCacheKey({ address: USER_ADDRESS, denomination: 'usd', timeframe: '1y' }),
      response
    )
    const { result, rerender, unmount } = renderHook(
      ({ liveValue }) =>
        usePortfolioHistoryBundle('usd', '1y', true, {
          date: '2026-09-02',
          totalUsd: liveValue,
          totalEth: 0,
          vaults: []
        }),
      {
        initialProps: { liveValue: 0 },
        wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
      }
    )

    expect(result.current.balance.isLoading).toBe(false)
    expect(result.current.balance.isEmpty).toBe(!hasHistory)
    expect(result.current.balance.data?.at(-1)).toEqual({ date: '2026-09-02', value: 0, isLive: true })

    rerender({ liveValue: 100 })
    expect(result.current.balance.isEmpty).toBe(false)
    expect(result.current.balance.data?.at(-1)).toEqual({ date: '2026-09-02', value: 100, isLive: true })

    unmount()
    queryClient.clear()
  })
})

describe('portfolio history query transition', () => {
  it('keeps same-wallet Growth while ALL history loads', async () => {
    const queryClient = new QueryClient()
    const allRequest = createDeferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        const url = new URL(input, 'https://yearn.fi')
        if (url.pathname === '/api/holdings/progress') {
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        return url.searchParams.get('timeframe') === 'all'
          ? allRequest.promise
          : Promise.resolve(Response.json(createPortfolioResponse()))
      })
    )
    const { result, rerender, unmount } = renderHook(
      ({ timeframe }: { timeframe: TPortfolioResponse['timeframe'] }) => usePortfolioHistoryBundle('usd', timeframe),
      {
        initialProps: { timeframe: '1y' },
        wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
      }
    )

    try {
      await waitFor(() => expect(result.current.growth.vaults[0]?.growthUsd).toBe(1))
      expect(result.current.balance.isLoading).toBe(false)

      rerender({ timeframe: 'all' })

      expect(result.current.hasResponse).toBe(false)
      expect(result.current.balance.data).toBeNull()
      expect(result.current.balance.isLoading).toBe(true)
      expect(result.current.protocolReturn.isLoading).toBe(true)
      expect(result.current.protocolReturn.data?.[0]?.growthWeightUsd).toBe(1)
      expect(result.current.growth.vaults[0]?.growthUsd).toBe(1)
      expect(result.current.growth.isLoading).toBe(false)

      await act(async () => allRequest.resolve(Response.json(createPortfolioResponse(USER_ADDRESS, 'all', 2))))

      await waitFor(() => expect(result.current.growth.vaults[0]?.growthUsd).toBe(2))
      expect(result.current.hasResponse).toBe(true)
      expect(result.current.balance.data).toEqual([{ date: '2026-09-01', value: 100 }])
      expect(result.current.balance.isLoading).toBe(false)
      expect(result.current.protocolReturn.isLoading).toBe(false)
      expect(result.current.protocolReturn.timeframe).toBe('all')
      expect(result.current.protocolReturn.data?.[0]?.growthWeightUsd).toBe(2)
    } finally {
      unmount()
      queryClient.clear()
    }
  })
})
