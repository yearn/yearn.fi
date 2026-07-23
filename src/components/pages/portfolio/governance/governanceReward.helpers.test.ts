import { describe, expect, it } from 'vitest'
import { resolveYvUsdcRewardPriceUsd } from './governanceReward.helpers'

describe('resolveYvUsdcRewardPriceUsd', () => {
  it('prefers a direct yvUSDC share price', () => {
    expect(resolveYvUsdcRewardPriceUsd({ directSharePrice: 1.12, underlyingPrice: 0.99, pricePerShare: 1.11 })).toBe(
      1.12
    )
  })

  it('uses the USDC price and vault price-per-share when the direct price is unavailable', () => {
    expect(
      resolveYvUsdcRewardPriceUsd({ directSharePrice: 0, underlyingPrice: 0.999, pricePerShare: 1.11 })
    ).toBeCloseTo(1.10889)
  })

  it('falls back to one dollar for USDC when spot pricing is unavailable', () => {
    expect(resolveYvUsdcRewardPriceUsd({ directSharePrice: 0, underlyingPrice: 0, pricePerShare: 1.111761 })).toBe(
      1.111761
    )
  })
})
