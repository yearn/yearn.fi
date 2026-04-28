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
  it('turns a Safe approval overlay into a dismissible submitted state when the Safe tx is queued', () => {
    expect(
      resolveApprovalOverlayPendingSafeState({
        txState: 'pending',
        isWalletSafe: true,
        hasReceiptTransactionHash: false,
        callsStatus: 'pending'
      })
    ).toBe('submitted')
  })

  it('keeps normal wallet approval overlays pending until a receipt arrives', () => {
    expect(
      resolveApprovalOverlayPendingSafeState({
        txState: 'pending',
        isWalletSafe: false,
        hasReceiptTransactionHash: false,
        callsStatus: 'pending'
      })
    ).toBe('pending')
  })
})
