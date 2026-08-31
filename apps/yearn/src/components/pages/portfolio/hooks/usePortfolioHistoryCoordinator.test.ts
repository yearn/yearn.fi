import { buildPortfolioHistoryBundleEndpoint } from '@pages/portfolio/hooks/usePortfolioHistoryBundle'
import {
  resolvePortfolioHistorySource,
  shouldLoadPortfolioHistory
} from '@pages/portfolio/hooks/usePortfolioHistoryCoordinator'
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

  it('waits for the combined endpoint before considering legacy fallback', () => {
    expect(
      resolvePortfolioHistorySource({
        canLoad: true,
        hasCombinedResponse: false,
        combinedError: null
      })
    ).toEqual({ shouldUseLegacy: false, isCombinedPending: true })
  })

  it('falls back only after the combined endpoint fails without data', () => {
    expect(
      resolvePortfolioHistorySource({
        canLoad: true,
        hasCombinedResponse: false,
        combinedError: new Error('not available')
      })
    ).toEqual({ shouldUseLegacy: true, isCombinedPending: false })
  })

  it('keeps a combined response during a later background error', () => {
    expect(
      resolvePortfolioHistorySource({
        canLoad: true,
        hasCombinedResponse: true,
        combinedError: new Error('refresh failed')
      })
    ).toEqual({ shouldUseLegacy: false, isCombinedPending: false })
  })

  it('starts history while wallet balance discovery is still loading', () => {
    expect(shouldLoadPortfolioHistory({ isActive: true, isHoldingsLoading: true, isPositionsTab: true })).toBe(true)
    expect(shouldLoadPortfolioHistory({ isActive: true, isHoldingsLoading: false, isPositionsTab: true })).toBe(true)
    expect(shouldLoadPortfolioHistory({ isActive: false, isHoldingsLoading: true, isPositionsTab: true })).toBe(false)
    expect(shouldLoadPortfolioHistory({ isActive: true, isHoldingsLoading: true, isPositionsTab: false })).toBe(false)
  })
})
