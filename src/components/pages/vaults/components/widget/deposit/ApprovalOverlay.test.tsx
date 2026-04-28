import { describe, expect, it } from 'vitest'
import { resolveApprovalOverlayConnectedChainId } from './ApprovalOverlay.helpers'

describe('resolveApprovalOverlayConnectedChainId', () => {
  it('falls back to the live wagmi chain id when useAccount().chain is missing for Safe/custom-chain sessions', () => {
    expect(
      resolveApprovalOverlayConnectedChainId({
        accountChainId: undefined,
        currentChainId: 747474
      })
    ).toBe(747474)
  })

  it('prefers the account chain id when it is available', () => {
    expect(
      resolveApprovalOverlayConnectedChainId({
        accountChainId: 1,
        currentChainId: 747474
      })
    ).toBe(1)
  })
})
