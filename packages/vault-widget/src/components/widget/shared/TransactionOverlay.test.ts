import { describe, expect, it } from 'vitest'
import {
  getBridgeTrackerLink,
  getSubmittedTransactionCopy,
  resolveCompletionDeferral,
  resolveCrossChainSourceCompletion,
  shouldAutoContinuePermitSuccess,
  shouldRunDeferredCompletion
} from './transactionOverlay.helpers'

describe('getBridgeTrackerLink', () => {
  it('links Relay routes by their persisted request ID', () => {
    expect(
      getBridgeTrackerLink({
        bridgeProtocol: 'relay',
        bridgeRequestId: '0xrequest',
        sourceTxHash: '0xsource'
      })
    ).toEqual({
      label: 'Track bridge on Relay',
      url: 'https://relay.link/transaction/0xrequest'
    })
  })

  it('links Stargate routes by source transaction hash', () => {
    expect(getBridgeTrackerLink({ bridgeProtocol: 'stargate', sourceTxHash: '0xsource' })).toEqual({
      label: 'Track bridge on LayerZero',
      url: 'https://layerzeroscan.com/tx/0xsource'
    })
  })

  it('does not invent a transaction-specific CCIP link without a message ID', () => {
    expect(getBridgeTrackerLink({ bridgeProtocol: 'ccip', sourceTxHash: '0xsource' })).toBeUndefined()
  })
})

describe('getSubmittedTransactionCopy', () => {
  const bridge = {
    isCrossChain: true,
    isBridgeTrackingActive: false,
    isBridgeTrackingUnavailable: false,
    sourceChainName: 'Katana',
    destinationChainName: 'Base',
    bridgeAction: 'deposit'
  }

  it('does not claim bridging started before source confirmation is persisted', () => {
    expect(getSubmittedTransactionCopy(bridge)).toEqual({
      title: 'Transaction submitted',
      detail: 'Waiting for the source transaction to be confirmed.'
    })
  })

  it('shows actionable fallback copy without bridge progress when persistence fails', () => {
    expect(
      getSubmittedTransactionCopy({
        ...bridge,
        isBridgeTrackingUnavailable: true,
        bridgeTrackingError: 'Check the source transaction.'
      })
    ).toEqual({ title: 'Tracking unavailable', detail: 'Check the source transaction.' })
  })

  it('shows bridge progress only after durable tracking becomes active', () => {
    expect(getSubmittedTransactionCopy({ ...bridge, isBridgeTrackingActive: true })).toEqual({
      title: 'Transaction complete on Katana',
      detail: 'Bridging to Base…'
    })
  })
})

describe('shouldAutoContinuePermitSuccess', () => {
  it('continues permit steps once the next step is ready', () => {
    expect(
      shouldAutoContinuePermitSuccess({
        overlayState: 'success',
        executedStepIsPermit: true,
        executedStepAutoContinues: true,
        executedStepCompletesFlow: false,
        currentStepId: 'deposit',
        executedStepId: 'permit',
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
        currentStepId: 'permit',
        executedStepId: 'permit',
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
        currentStepId: 'done',
        executedStepId: 'permit',
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

describe('resolveCrossChainSourceCompletion', () => {
  it('defers completion until close while bridge tracking continues', () => {
    expect(
      resolveCrossChainSourceCompletion({
        completedAllSteps: true,
        isBridgeTrackingAvailable: true,
        isOpen: true,
        hasBridgeFailed: false
      })
    ).toBe('after-close')
  })

  it('completes immediately when bridge tracking is unavailable', () => {
    expect(
      resolveCrossChainSourceCompletion({
        completedAllSteps: true,
        isBridgeTrackingAvailable: false,
        isOpen: true,
        hasBridgeFailed: false
      })
    ).toBe('immediate')
  })

  it('completes immediately when the overlay closed during source confirmation', () => {
    expect(
      resolveCrossChainSourceCompletion({
        completedAllSteps: true,
        isBridgeTrackingAvailable: true,
        isOpen: false,
        hasBridgeFailed: false
      })
    ).toBe('immediate')
  })

  it('does not complete a non-terminal transaction step', () => {
    expect(
      resolveCrossChainSourceCompletion({
        completedAllSteps: false,
        isBridgeTrackingAvailable: false,
        isOpen: false,
        hasBridgeFailed: false
      })
    ).toBe('none')
  })

  it('does not re-arm completion when bridge failure wins the source-refresh race', () => {
    expect(
      resolveCrossChainSourceCompletion({
        completedAllSteps: true,
        isBridgeTrackingAvailable: true,
        isOpen: true,
        hasBridgeFailed: true
      })
    ).toBe('none')
  })
})

describe('shouldRunDeferredCompletion', () => {
  it('does not run close-deferred completion on confetti end', () => {
    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-close',
        trigger: 'confetti',
        hasBridgeFailed: false
      })
    ).toBe(false)
  })

  it('runs confetti-deferred completion when the animation finishes', () => {
    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-confetti',
        trigger: 'confetti',
        hasBridgeFailed: false
      })
    ).toBe(true)
  })

  it('flushes any deferred completion when the overlay closes', () => {
    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-confetti',
        trigger: 'close',
        hasBridgeFailed: false
      })
    ).toBe(true)
  })

  it('does not flush a deferred success callback after bridge failure', () => {
    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-close',
        trigger: 'close',
        hasBridgeFailed: true
      })
    ).toBe(false)
  })
})
