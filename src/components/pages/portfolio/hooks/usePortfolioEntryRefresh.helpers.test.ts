import { describe, expect, it } from 'vitest'
import { shouldRequestPortfolioEntryRefresh } from './usePortfolioEntryRefresh.helpers'

describe('shouldRequestPortfolioEntryRefresh', () => {
  it('refreshes once when the portfolio page is active and has not refreshed yet', () => {
    expect(shouldRequestPortfolioEntryRefresh({ hasRequestedRefresh: false, isActive: true })).toBe(true)
  })

  it('does not refresh when the portfolio page is not active', () => {
    expect(shouldRequestPortfolioEntryRefresh({ hasRequestedRefresh: false, isActive: false })).toBe(false)
  })

  it('does not refresh again after the page-entry refresh already ran', () => {
    expect(shouldRequestPortfolioEntryRefresh({ hasRequestedRefresh: true, isActive: true })).toBe(false)
  })
})
