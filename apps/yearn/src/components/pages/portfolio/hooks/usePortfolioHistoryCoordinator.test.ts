import {
  buildPortfolioHistoryBundleCacheKey,
  buildPortfolioHistoryBundleEndpoint
} from '@pages/portfolio/hooks/usePortfolioHistoryBundle'
import { shouldLoadPortfolioHistory } from '@pages/portfolio/hooks/usePortfolioHistoryCoordinator'
import { describe, expect, it } from 'vitest'

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
