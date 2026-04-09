import { describe, expect, it } from 'vitest'
import {
  calculateRemainingEnsoSlippagePercentage,
  clampZapSlippage,
  requiresZapSlippageRiskAcknowledgement,
  toBasisPoints,
  ZAP_SLIPPAGE_HARD_CAP
} from './slippage'

describe('slippage utils', () => {
  it('clamps user slippage to the supported range', () => {
    expect(clampZapSlippage(-1)).toBe(0)
    expect(clampZapSlippage(0.5)).toBe(0.5)
    expect(clampZapSlippage(9)).toBe(ZAP_SLIPPAGE_HARD_CAP)
  })

  it('requires typed acknowledgement above 1%', () => {
    expect(requiresZapSlippageRiskAcknowledgement(1)).toBe(false)
    expect(requiresZapSlippageRiskAcknowledgement(1.01)).toBe(true)
  })

  it('converts percentages to basis points without rounding up', () => {
    expect(toBasisPoints(0.5)).toBe(50)
    expect(toBasisPoints(1.239)).toBe(123)
  })

  it('allocates only the remaining tolerance to Enso execution slippage', () => {
    expect(
      calculateRemainingEnsoSlippagePercentage({
        userTolerancePercentage: 1,
        quoteImpactPercentage: 0.5
      })
    ).toBe(0.5)
  })

  it('returns zero remaining Enso slippage when the quote already exceeds tolerance', () => {
    expect(
      calculateRemainingEnsoSlippagePercentage({
        userTolerancePercentage: 1,
        quoteImpactPercentage: 1.2
      })
    ).toBe(0)
  })
})
