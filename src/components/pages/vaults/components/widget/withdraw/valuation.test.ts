import { describe, expect, it } from 'vitest'
import { calculateWithdrawValueInfo } from './valuation'

const ONE_ETHER = 10n ** 18n

describe('calculateWithdrawValueInfo', () => {
  it('does not invent slippage when a route cannot be built', () => {
    const valueInfo = calculateWithdrawValueInfo({
      withdrawAmountBn: 100n * ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1,
      expectedOut: 0n,
      outputDecimals: 18,
      outputUsdPrice: 1
    })

    expect(valueInfo.priceImpactPercentage).toBe(0)
    expect(valueInfo.worstCasePriceImpactPercentage).toBe(0)
  })

  it('does not infer price impact when the output price is unavailable for a nonzero quote', () => {
    const valueInfo = calculateWithdrawValueInfo({
      withdrawAmountBn: 100n * ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1,
      expectedOut: 100n * ONE_ETHER,
      outputDecimals: 18,
      outputUsdPrice: 0
    })

    expect(valueInfo.priceImpactPercentage).toBe(0)
    expect(valueInfo.worstCasePriceImpactPercentage).toBe(0)
    expect(valueInfo.hasIncompleteUsdValuation).toBe(true)
  })

  it('tracks the worst-case execution floor separately from the quoted output', () => {
    const valueInfo = calculateWithdrawValueInfo({
      withdrawAmountBn: 100n * ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1,
      expectedOut: 100n * ONE_ETHER,
      minExpectedOut: 99n * ONE_ETHER,
      outputDecimals: 18,
      outputUsdPrice: 1
    })

    expect(valueInfo.priceImpactPercentage).toBe(0)
    expect(valueInfo.worstCasePriceImpactPercentage).toBe(1)
  })
})
