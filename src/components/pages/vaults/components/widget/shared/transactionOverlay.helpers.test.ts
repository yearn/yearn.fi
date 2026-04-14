import { describe, expect, it } from 'vitest'
import {
  resolveExecutionTrackingHash,
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

describe('resolvePendingSafeOverlayState', () => {
  it('moves a Safe transaction overlay into a submitted state when the Safe tx is awaiting confirmations', () => {
    expect(
      resolvePendingSafeOverlayState({
        overlayState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: 'AWAITING_CONFIRMATIONS',
        callsStatus: undefined
      })
    ).toBe('submitted')
  })

  it('moves a Safe transaction overlay into a submitted state when the Safe tx is queued but not executed', () => {
    expect(
      resolvePendingSafeOverlayState({
        overlayState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: 'AWAITING_EXECUTION',
        callsStatus: undefined
      })
    ).toBe('submitted')
  })

  it('falls back to wallet_getCallsStatus when Safe tx details are not available yet', () => {
    expect(
      resolvePendingSafeOverlayState({
        overlayState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: undefined,
        callsStatus: 'pending'
      })
    ).toBe('submitted')
  })

  it('keeps non-Safe pending overlays waiting for a normal receipt', () => {
    expect(
      resolvePendingSafeOverlayState({
        overlayState: 'pending',
        isWalletSafe: false,
        hasExecutionReceipt: false,
        safeTxStatus: 'AWAITING_EXECUTION',
        callsStatus: 'pending'
      })
    ).toBe('pending')
  })

  it('surfaces Safe detail failures as overlay errors', () => {
    expect(
      resolvePendingSafeOverlayState({
        overlayState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: 'FAILED',
        callsStatus: undefined
      })
    ).toBe('error')
  })

  it('surfaces cancelled Safe transactions as overlay errors', () => {
    expect(
      resolvePendingSafeOverlayState({
        overlayState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: 'CANCELLED',
        callsStatus: undefined
      })
    ).toBe('error')
  })

  it('keeps polling submitted Safe overlays so failures can still surface', () => {
    expect(
      resolvePendingSafeOverlayState({
        overlayState: 'submitted',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: undefined,
        callsStatus: 'failure'
      })
    ).toBe('error')
  })
})

describe('resolveExecutionTrackingHash', () => {
  it('prefers the actual executed tx hash for Safe sessions', () => {
    expect(
      resolveExecutionTrackingHash({
        isWalletSafe: true,
        submittedTxHash: '0xsafe',
        safeExecutionTxHash: '0xexecuted',
        callsReceiptTxHash: '0xfallback'
      })
    ).toBe('0xexecuted')
  })

  it('falls back to calls-status receipt hash for Safe sessions when details have not resolved yet', () => {
    expect(
      resolveExecutionTrackingHash({
        isWalletSafe: true,
        submittedTxHash: '0xsafe',
        safeExecutionTxHash: undefined,
        callsReceiptTxHash: '0xfallback'
      })
    ).toBe('0xfallback')
  })

  it('uses the submitted tx hash directly for non-Safe sessions', () => {
    expect(
      resolveExecutionTrackingHash({
        isWalletSafe: false,
        submittedTxHash: '0xnormal',
        safeExecutionTxHash: '0xexecuted',
        callsReceiptTxHash: '0xfallback'
      })
    ).toBe('0xnormal')
  })
})
