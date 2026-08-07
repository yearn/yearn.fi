import { describe, expect, it } from 'vitest'
import { getProtectedEnsoQuoteError } from './protectedEnsoQuoteError'

describe('getProtectedEnsoQuoteError', () => {
  it('shows the cross-chain minimum for both transaction flows', () => {
    const params = {
      blockedReason: 'cross-chain-minimum-slippage' as const,
      hasUnpricedQuoteError: false,
      isDebouncing: false
    }

    expect(getProtectedEnsoQuoteError({ ...params, flow: 'deposit' })).toBe(
      'Cross-chain routes require at least 0.01% slippage.'
    )
    expect(getProtectedEnsoQuoteError({ ...params, flow: 'withdraw' })).toBe(
      'Cross-chain routes require at least 0.01% slippage.'
    )
  })

  it('uses actionable flow-specific copy when positive tolerance is exhausted', () => {
    const params = {
      blockedReason: 'no-protected-tolerance' as const,
      hasUnpricedQuoteError: false,
      isDebouncing: false
    }

    expect(getProtectedEnsoQuoteError({ ...params, flow: 'deposit' })).toContain('use the base asset flow')
    expect(getProtectedEnsoQuoteError({ ...params, flow: 'withdraw' })).toContain('withdraw the base asset')
  })

  it('does not show a stale quote error while the amount is debouncing', () => {
    expect(
      getProtectedEnsoQuoteError({
        blockedReason: 'cross-chain-minimum-slippage',
        hasUnpricedQuoteError: true,
        isDebouncing: true,
        flow: 'deposit'
      })
    ).toBeNull()
  })
})
