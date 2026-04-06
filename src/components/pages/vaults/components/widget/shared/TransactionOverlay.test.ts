import { describe, expect, it } from 'vitest'
import {
  resolveCompletionDeferral,
  shouldAutoContinuePermitSuccess,
  shouldRunDeferredCompletion
} from './transactionOverlay.helpers'

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

describe('resolveCompletionDeferral', () => {
  it('does not run completion callbacks for non-terminal success states', () => {
    expect(
      resolveCompletionDeferral({
        completedAllSteps: false,
        deferOnAllCompleteUntilClose: false,
        deferOnAllCompleteUntilConfettiEnd: true,
        stepShowsConfetti: true
      })
    ).toBe('none')
  })

  it('prefers close deferral when explicitly requested', () => {
    expect(
      resolveCompletionDeferral({
        completedAllSteps: true,
        deferOnAllCompleteUntilClose: true,
        deferOnAllCompleteUntilConfettiEnd: true,
        stepShowsConfetti: true
      })
    ).toBe('after-close')
  })

  it('defers terminal completion until confetti ends when configured', () => {
    expect(
      resolveCompletionDeferral({
        completedAllSteps: true,
        deferOnAllCompleteUntilClose: false,
        deferOnAllCompleteUntilConfettiEnd: true,
        stepShowsConfetti: true
      })
    ).toBe('after-confetti')
  })

  it('falls back to immediate completion when no confetti is shown', () => {
    expect(
      resolveCompletionDeferral({
        completedAllSteps: true,
        deferOnAllCompleteUntilClose: false,
        deferOnAllCompleteUntilConfettiEnd: true,
        stepShowsConfetti: false
      })
    ).toBe('immediate')
  })
})

describe('shouldRunDeferredCompletion', () => {
  it('does not run close-deferred completion on confetti end', () => {
    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-close',
        trigger: 'confetti'
      })
    ).toBe(false)
  })

  it('runs confetti-deferred completion when the animation finishes', () => {
    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-confetti',
        trigger: 'confetti'
      })
    ).toBe(true)
  })

  it('flushes any deferred completion when the overlay closes', () => {
    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-confetti',
        trigger: 'close'
      })
    ).toBe(true)
  })
})
