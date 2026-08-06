import { describe, expect, it } from 'vitest'
import { resolveSwapTokenPrice } from './swapTokenPrice'

describe('resolveSwapTokenPrice', () => {
  it('prefers a valid context price', () => {
    expect(
      resolveSwapTokenPrice({
        contextPrice: 2,
        walletValue: 30,
        walletBalance: 10,
        vaultUnderlyingPrice: 4,
        vaultPricePerShare: 1.2
      })
    ).toBe(2)
  })

  it('derives a price from wallet value when the context price is unavailable', () => {
    expect(resolveSwapTokenPrice({ contextPrice: 0, walletValue: 9_513.34, walletBalance: 4.99 })).toBeCloseTo(
      1_906.48,
      2
    )
  })

  it('derives a vault-share price from underlying price and PPS', () => {
    expect(
      resolveSwapTokenPrice({
        contextPrice: 0,
        walletValue: 0,
        walletBalance: 0,
        vaultUnderlyingPrice: 1,
        vaultPricePerShare: 1.08
      })
    ).toBe(1.08)
  })

  it('returns zero rather than inventing a price', () => {
    expect(resolveSwapTokenPrice({ contextPrice: 0, walletValue: 0, walletBalance: 0 })).toBe(0)
  })
})
