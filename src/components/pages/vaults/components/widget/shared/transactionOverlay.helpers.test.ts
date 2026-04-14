import { describe, expect, it } from 'vitest'
import { resolvePendingSafeOverlayState } from './transactionOverlay.helpers'

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
