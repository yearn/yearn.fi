import { describe, expect, it } from 'vitest'
import { getPortfolioHistoryDisplayState } from './portfolioDisplayState'

describe('getPortfolioHistoryDisplayState', () => {
  it('keeps the history chart deferred while holdings are still loading', () => {
    expect(
      getPortfolioHistoryDisplayState({
        isActive: true,
        isHoldingsLoading: true,
        hasHoldings: false,
        balanceHistoryIsLoading: false,
        balanceHistoryIsEmpty: true,
        protocolReturnHistoryIsLoading: false,
        protocolReturnHistoryIsEmpty: true
      })
    ).toEqual({
      hasResolvedNoYearnPositions: false,
      shouldDeferHistoryChart: true
    })
  })

  it('requires both history sources to resolve before showing the no-positions state', () => {
    expect(
      getPortfolioHistoryDisplayState({
        isActive: true,
        isHoldingsLoading: false,
        hasHoldings: false,
        balanceHistoryIsLoading: false,
        balanceHistoryIsEmpty: true,
        protocolReturnHistoryIsLoading: false,
        protocolReturnHistoryIsEmpty: true
      })
    ).toEqual({
      hasResolvedNoYearnPositions: true,
      shouldDeferHistoryChart: false
    })
  })

  it('waits for protocol-return history when holdings exist', () => {
    expect(
      getPortfolioHistoryDisplayState({
        isActive: true,
        isHoldingsLoading: false,
        hasHoldings: true,
        balanceHistoryIsLoading: false,
        balanceHistoryIsEmpty: false,
        protocolReturnHistoryIsLoading: true,
        protocolReturnHistoryIsEmpty: true
      }).shouldDeferHistoryChart
    ).toBe(true)
  })
})
