import { parseUnits } from 'viem'
import { describe, expect, it } from 'vitest'
import { getSwapVaultEstimate } from './swapVaultEstimate'

describe('getSwapVaultEstimate', () => {
  it('converts quoted vault shares into underlying value and annual return', () => {
    expect(
      getSwapVaultEstimate({
        expectedShares: parseUnits('10', 18),
        minimumShares: parseUnits('9.9', 18),
        shareDecimals: 18,
        pricePerShare: 1.25,
        underlyingPrice: 2,
        annualRate: 0.1
      })
    ).toEqual({
      expectedUnderlying: 12.5,
      minimumUnderlying: 12.375,
      expectedUnderlyingUsd: 25,
      minimumUnderlyingUsd: 24.75,
      estimatedAnnualReturn: 1.2375,
      estimatedAnnualReturnUsd: 2.475
    })
  })

  it('keeps unavailable price and APR data distinct from zero', () => {
    expect(
      getSwapVaultEstimate({
        expectedShares: parseUnits('10', 18),
        minimumShares: parseUnits('9.9', 18),
        shareDecimals: 18,
        pricePerShare: 1.25
      })
    ).toEqual({
      expectedUnderlying: 12.5,
      minimumUnderlying: 12.375,
      expectedUnderlyingUsd: null,
      minimumUnderlyingUsd: null,
      estimatedAnnualReturn: null,
      estimatedAnnualReturnUsd: null
    })
  })

  it('does not synthesize underlying values without a price per share', () => {
    expect(
      getSwapVaultEstimate({
        expectedShares: parseUnits('10', 18),
        minimumShares: parseUnits('9.9', 18),
        shareDecimals: 18,
        pricePerShare: 0,
        underlyingPrice: 2,
        annualRate: 0.1
      }).minimumUnderlying
    ).toBeNull()
  })
})
