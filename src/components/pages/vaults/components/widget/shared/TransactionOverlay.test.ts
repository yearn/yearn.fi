import { describe, expect, it } from 'vitest'
import { shouldAutoContinuePermitSuccess } from './transactionOverlay.helpers'

describe('shouldAutoContinuePermitSuccess', () => {
  it('continues permit steps once the next step is ready', () => {
    expect(
      shouldAutoContinuePermitSuccess({
        overlayState: 'success',
        executedStepIsPermit: true,
        executedStepAutoContinues: true,
        executedStepCompletesFlow: false,
        currentStepLabel: 'Deposit',
        executedStepLabel: 'Sign Permit',
        isStepReady: true,
        hasAdvancedFromStep: null,
        hasAutoContinuedFromStep: null
      })
    ).toBe(true)
  })

  it('does not continue permit steps before the next step changes and becomes ready', () => {
    expect(
      shouldAutoContinuePermitSuccess({
        overlayState: 'success',
        executedStepIsPermit: true,
        executedStepAutoContinues: true,
        executedStepCompletesFlow: false,
        currentStepLabel: 'Sign Permit',
        executedStepLabel: 'Sign Permit',
        isStepReady: false,
        hasAdvancedFromStep: null,
        hasAutoContinuedFromStep: null
      })
    ).toBe(false)
  })

  it('does not continue terminal permit steps', () => {
    expect(
      shouldAutoContinuePermitSuccess({
        overlayState: 'success',
        executedStepIsPermit: true,
        executedStepAutoContinues: true,
        executedStepCompletesFlow: true,
        currentStepLabel: 'Done',
        executedStepLabel: 'Sign Permit',
        isStepReady: true,
        hasAdvancedFromStep: null,
        hasAutoContinuedFromStep: null
      })
    ).toBe(false)
  })
})
