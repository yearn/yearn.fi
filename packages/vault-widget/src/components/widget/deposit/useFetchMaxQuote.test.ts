import { describe, expect, it } from 'vitest'
import { resolveMaxQuoteSlippage } from './useFetchMaxQuote'

describe('resolveMaxQuoteSlippage', () => {
  it('falls back to the user tolerance when the bootstrap quote is unavailable', () => {
    expect(
      resolveMaxQuoteSlippage({
        hasBootstrapQuote: false,
        userTolerancePercentage: 3,
        quoteImpactPercentage: 0
      })
    ).toBe(3)
  })

  it('reuses the remaining slippage once the bootstrap quote exposes price impact', () => {
    expect(
      resolveMaxQuoteSlippage({
        hasBootstrapQuote: true,
        userTolerancePercentage: 3,
        quoteImpactPercentage: 1
      })
    ).toBe(2.02)
  })
})
