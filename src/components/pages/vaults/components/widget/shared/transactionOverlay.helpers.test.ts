import { describe, expect, it } from 'vitest'
import {
  formatPendingTransactionFunctionName,
  getPendingTransactionTitle,
  resolveCompletionDeferral,
  shouldAutoContinuePermitSuccess,
  shouldRunDeferredCompletion,
  resolveOverlayConnectedChainId,
  resolvePendingSafeOverlayState
} from './transactionOverlay.helpers'

describe('resolveOverlayConnectedChainId', () => {
  it('prefers the target chain for Safe sessions when account.chain is missing', () => {
    expect(
      resolveOverlayConnectedChainId({
        accountChainId: undefined,
        currentChainId: 1,
        targetChainId: 747474,
        isWalletSafe: true
      })
    ).toBe(747474)
  })
})

describe('transactionOverlay.helpers', () => {
  it('formats pending transaction function names from onchain requests', () => {
    expect(formatPendingTransactionFunctionName({ functionName: 'approve' })).toBe('Approve()')
    expect(formatPendingTransactionFunctionName({ functionName: 'deposit' })).toBe('Deposit()')
  })

  it('falls back to the step label when the request function name is unavailable', () => {
    expect(formatPendingTransactionFunctionName({ fallbackLabel: 'Withdraw' })).toBe('Withdraw()')
  })

  it('builds pending titles with the active function name', () => {
    expect(
      getPendingTransactionTitle({
        isPreparingNextStep: false,
        functionName: 'approve',
        fallbackLabel: 'Approve'
      })
    ).toBe('Approve() transaction pending')

    expect(
      getPendingTransactionTitle({
        isPreparingNextStep: false,
        functionName: undefined,
        fallbackLabel: 'Withdraw'
      })
    ).toBe('Withdraw() transaction pending')
  })

  it('keeps the confirmed copy while preparing a follow-up step', () => {
    expect(
      getPendingTransactionTitle({
        isPreparingNextStep: true,
        functionName: 'approve',
        fallbackLabel: 'Approve'
      })
    ).toBe('Transaction confirmed')
  })

  it('determines whether permit success should auto-continue', () => {
    expect(
      shouldAutoContinuePermitSuccess({
        overlayState: 'success',
        executedStepIsPermit: true,
        executedStepAutoContinues: true,
        executedStepCompletesFlow: false,
        currentStepLabel: 'Deposit',
        executedStepLabel: 'Permit',
        isStepReady: true,
        hasAdvancedFromStep: null,
        hasAutoContinuedFromStep: null
      })
    ).toBe(true)

    expect(
      shouldAutoContinuePermitSuccess({
        overlayState: 'pending',
        executedStepIsPermit: true,
        executedStepAutoContinues: true,
        executedStepCompletesFlow: false,
        currentStepLabel: 'Deposit',
        executedStepLabel: 'Permit',
        isStepReady: true,
        hasAdvancedFromStep: null,
        hasAutoContinuedFromStep: null
      })
    ).toBe(false)
  })

  it('resolves completion deferrals and run conditions', () => {
    expect(
      resolveCompletionDeferral({
        completedAllSteps: true,
        deferOnAllCompleteUntilClose: false,
        deferOnAllCompleteUntilConfettiEnd: true,
        stepShowsConfetti: true
      })
    ).toBe('after-confetti')

    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-confetti',
        trigger: 'close'
      })
    ).toBe(true)

    expect(
      shouldRunDeferredCompletion({
        completionDeferral: 'after-close',
        trigger: 'confetti'
      })
    ).toBe(false)

    describe('resolvePendingSafeOverlayState', () => {
      it('moves a Safe transaction overlay into a submitted state when the Safe tx is queued but not executed', () => {
        expect(
          resolvePendingSafeOverlayState({
            overlayState: 'pending',
            isWalletSafe: true,
            hasReceiptTransactionHash: false,
            callsStatus: 'pending'
          })
        ).toBe('submitted')
      })

      it('keeps non-Safe pending overlays waiting for a normal receipt', () => {
        expect(
          resolvePendingSafeOverlayState({
            overlayState: 'pending',
            isWalletSafe: false,
            hasReceiptTransactionHash: false,
            callsStatus: 'pending'
          })
        ).toBe('pending')
      })

      it('surfaces Safe call-batch failures as overlay errors', () => {
        expect(
          resolvePendingSafeOverlayState({
            overlayState: 'pending',
            isWalletSafe: true,
            hasReceiptTransactionHash: false,
            callsStatus: 'failure'
          })
        ).toBe('error')
      })
    })
  })

  it('keeps polling submitted Safe overlays so failures can still surface', () => {
    expect(
      resolvePendingSafeOverlayState({
        overlayState: 'submitted',
        isWalletSafe: true,
        hasReceiptTransactionHash: false,
        callsStatus: 'failure'
      })
    ).toBe('error')
  })
})
