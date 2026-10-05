// @vitest-environment jsdom

import {
  buildPortfolioHistoryBundleCacheKey,
  buildPortfolioHistoryBundleEndpoint
} from '@pages/portfolio/hooks/usePortfolioHistoryBundle'
import {
  shouldLoadPortfolioHistory,
  usePortfolioHistoryCoordinator
} from '@pages/portfolio/hooks/usePortfolioHistoryCoordinator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({ address: '0x0000000000000000000000000000000000000001' })
}))

vi.mock('@hooks/usePlausible', () => ({ usePlausible: () => vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('portfolio history bundle helpers', () => {
  it('builds the combined request with the selected chart options', () => {
    expect(
      buildPortfolioHistoryBundleEndpoint({
        address: '0x0000000000000000000000000000000000000001',
        denomination: 'eth',
        timeframe: 'all'
      })
    ).toBe('/api/holdings/portfolio?address=0x0000000000000000000000000000000000000001&denomination=eth&timeframe=all')
  })

  it('enables server debug logs when requested', () => {
    expect(
      buildPortfolioHistoryBundleEndpoint({
        address: '0x0000000000000000000000000000000000000001',
        denomination: 'usd',
        timeframe: 'all',
        debug: true
      })
    ).toBe(
      '/api/holdings/portfolio?address=0x0000000000000000000000000000000000000001&denomination=usd&timeframe=all&debug=1'
    )
  })

  it('adds progress without changing the response cache identity', () => {
    expect(
      buildPortfolioHistoryBundleEndpoint({
        address: '0x0000000000000000000000000000000000000001',
        denomination: 'usd',
        timeframe: 'all',
        progressId: 'portfolio:test'
      })
    ).toBe(
      '/api/holdings/portfolio?address=0x0000000000000000000000000000000000000001&denomination=usd&timeframe=all&progressId=portfolio%3Atest'
    )
    expect(
      buildPortfolioHistoryBundleCacheKey({
        address: '0xABCDEF0000000000000000000000000000000001',
        denomination: 'usd',
        timeframe: 'all'
      })
    ).toEqual(['fetch', 'portfolio-history-bundle', '0xabcdef0000000000000000000000000000000001', 'usd', 'all'])
  })

  it('starts history while wallet balance discovery is still loading', () => {
    expect(shouldLoadPortfolioHistory({ isActive: true, isPositionsTab: true })).toBe(true)
    expect(shouldLoadPortfolioHistory({ isActive: false, isPositionsTab: true })).toBe(false)
    expect(shouldLoadPortfolioHistory({ isActive: true, isPositionsTab: false })).toBe(false)
  })
})

describe('usePortfolioHistoryCoordinator', () => {
  it.each([new Error('Network request failed'), new DOMException('The operation was aborted', 'AbortError')])(
    'stops loading and exposes the first request failure: %s',
    async (error) => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const queryClient = new QueryClient()
      const { result, unmount } = renderHook(() => usePortfolioHistoryCoordinator(), {
        wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
      })

      try {
        expect(result.current.balance.isLoading).toBe(true)
        expect(result.current.protocolReturn.isLoading).toBe(true)
        expect(result.current.growth.isLoading).toBe(true)

        await waitFor(() => expect(result.current.balance.isLoading).toBe(false))
        expect(result.current.balance.error).toBe(error)
        expect(result.current.protocolReturn.isLoading).toBe(false)
        expect(result.current.protocolReturn.error).toBe(error)
        expect(result.current.growth.isLoading).toBe(false)
        expect(result.current.growth.error).toBe(error)
      } finally {
        unmount()
        queryClient.clear()
      }
    }
  )
})
