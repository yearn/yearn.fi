import { describe, expect, it } from 'vitest'
import { calculateWithdrawValueInfo } from './valuation'

const ONE_ETHER = 10n ** 18n

describe('calculateWithdrawValueInfo', () => {
  it('treats zero-output zaps as 100% price impact', () => {
    const valueInfo = calculateWithdrawValueInfo({
      withdrawAmountBn: 100n * ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1,
      expectedOut: 0n,
      outputDecimals: 18,
      outputUsdPrice: 1
    })

    expect(valueInfo.priceImpactPercentage).toBe(100)
    expect(valueInfo.isHighPriceImpact).toBe(true)
    expect(valueInfo.isBlockingPriceImpact).toBe(true)
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
    expect(valueInfo.isHighPriceImpact).toBe(false)
    expect(valueInfo.isBlockingPriceImpact).toBe(false)
  })
})
