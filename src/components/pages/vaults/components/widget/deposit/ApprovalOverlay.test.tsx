import { describe, expect, it } from 'vitest'
import {
  resolveApprovalOverlayConnectedChainId,
  resolveApprovalOverlayPendingSafeState
} from './ApprovalOverlay.helpers'

describe('resolveApprovalOverlayConnectedChainId', () => {
  it('falls back to the live wagmi chain id when useAccount().chain is missing for normal wallets', () => {
    expect(
      resolveApprovalOverlayConnectedChainId({
        accountChainId: undefined,
        currentChainId: 747474,
        targetChainId: 1,
        isWalletSafe: false
      })
    ).toBe(747474)
  })

  it('prefers the target chain for Safe sessions when useAccount().chain is missing', () => {
    expect(
      resolveApprovalOverlayConnectedChainId({
        accountChainId: undefined,
        currentChainId: 1,
        targetChainId: 747474,
        isWalletSafe: true
      })
    ).toBe(747474)
  })

  it('prefers the account chain id when it is available', () => {
    expect(
      resolveApprovalOverlayConnectedChainId({
        accountChainId: 1,
        currentChainId: 747474,
        targetChainId: 747474,
        isWalletSafe: true
      })
    ).toBe(1)
  })
})

describe('resolveApprovalOverlayPendingSafeState', () => {
  it('turns a Safe approval overlay into a dismissible submitted state when the Safe tx is awaiting confirmations', () => {
    expect(
      resolveApprovalOverlayPendingSafeState({
        txState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: 'AWAITING_CONFIRMATIONS',
        callsStatus: undefined
      })
    ).toBe('submitted')
  })

  it('turns a Safe approval overlay into a dismissible submitted state when the Safe tx is queued', () => {
    expect(
      resolveApprovalOverlayPendingSafeState({
        txState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: 'AWAITING_EXECUTION',
        callsStatus: undefined
      })
    ).toBe('submitted')
  })

  it('falls back to wallet_getCallsStatus when Safe details are not available yet', () => {
    expect(
      resolveApprovalOverlayPendingSafeState({
        txState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: undefined,
        callsStatus: 'pending'
      })
    ).toBe('submitted')
  })

  it('keeps normal wallet approval overlays pending until a receipt arrives', () => {
    expect(
      resolveApprovalOverlayPendingSafeState({
        txState: 'pending',
        isWalletSafe: false,
        hasExecutionReceipt: false,
        safeTxStatus: 'AWAITING_EXECUTION',
        callsStatus: 'pending'
      })
    ).toBe('pending')
  })

  it('surfaces failed Safe approval transactions as errors', () => {
    expect(
      resolveApprovalOverlayPendingSafeState({
        txState: 'pending',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: 'FAILED',
        callsStatus: undefined
      })
    ).toBe('error')
  })

  it('lets submitted Safe approval overlays surface failures too', () => {
    expect(
      resolveApprovalOverlayPendingSafeState({
        txState: 'submitted',
        isWalletSafe: true,
        hasExecutionReceipt: false,
        safeTxStatus: undefined,
        callsStatus: 'failure'
      })
    ).toBe('error')
  })
})
