import { describe, expect, it } from 'vitest'
import {
  clampSlippage,
  getRemainingEnsoSlippageBps,
  getSlippageSaveState,
  SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT
} from './settings'

describe('transaction settings', () => {
  it('clamps slippage to the legacy zero-to-five-percent range', () => {
    expect(clampSlippage(-1)).toBe(0)
    expect(clampSlippage(0.5)).toBe(0.5)
    expect(clampSlippage(10)).toBe(5)
  })

  it('allows presets through one percent without acknowledgement', () => {
    expect(getSlippageSaveState({ currentSlippage: 0.5, localSlippage: 1 })).toEqual({
      sanitizedSlippage: 1,
      isSlippageDirty: true,
      needsRiskAcknowledgement: false,
      hasValidRiskAcknowledgement: true
    })
  })

  it('requires the exact legacy acknowledgement above one percent', () => {
    expect(
      getSlippageSaveState({
        currentSlippage: 0.5,
        localSlippage: 2,
        riskAcknowledgement: SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT
      }).hasValidRiskAcknowledgement
    ).toBe(true)
    expect(
      getSlippageSaveState({
        currentSlippage: 0.5,
        localSlippage: 2,
        riskAcknowledgement: 'I understand'
      }).hasValidRiskAcknowledgement
    ).toBe(false)
  })

  it('reserves only the tolerance remaining after Enso route impact', () => {
    expect(getRemainingEnsoSlippageBps({ quoteImpactPercent: 0.5, userToleranceBps: 100 })).toBe(50)
    expect(getRemainingEnsoSlippageBps({ quoteImpactPercent: 1.2, userToleranceBps: 100 })).toBe(0)
  })
})
