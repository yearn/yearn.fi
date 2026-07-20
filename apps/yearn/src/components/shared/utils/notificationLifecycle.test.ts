import type { TNotification } from '@shared/types/notifications'
import { getNotificationLifecyclePresentation } from '@shared/utils/notificationLifecycle'
import { describe, expect, it } from 'vitest'

const notification: TNotification = {
  type: 'crosschain zap',
  address: '0x0000000000000000000000000000000000000001',
  chainId: 1,
  toChainId: 8453,
  amount: '1',
  status: 'submitted',
  txHash: `0x${'a'.repeat(64)}`,
  bridgeProtocol: 'relay',
  bridgeStatus: 'pending'
}

describe('notification lifecycle presentation', () => {
  it('shows source confirmation without claiming delivery', () => {
    expect(getNotificationLifecyclePresentation(notification)).toMatchObject({
      label: 'Source transaction complete',
      styleStatus: 'submitted',
      transactionChainId: 1
    })
  })

  it('links delivered bridges to the destination transaction', () => {
    const destinationTxHash = `0x${'b'.repeat(64)}` as const
    expect(
      getNotificationLifecyclePresentation({
        ...notification,
        status: 'success',
        bridgeStatus: 'delivered',
        destinationTxHash
      })
    ).toMatchObject({
      label: 'Bridge complete',
      transactionHash: destinationTxHash,
      transactionChainId: 8453
    })
  })

  it('makes unavailable tracking explicit', () => {
    expect(
      getNotificationLifecyclePresentation({
        ...notification,
        bridgeTrackingState: 'unavailable',
        bridgeError: 'Check the source transaction.'
      })
    ).toMatchObject({ label: 'Tracking unavailable', detail: 'Check the source transaction.' })
  })

  it('makes recoverable manual bridge execution explicit', () => {
    expect(
      getNotificationLifecyclePresentation({
        ...notification,
        bridgeStatus: 'ready_for_manual_execution'
      })
    ).toMatchObject({
      label: 'Manual action required',
      detail: 'The destination action needs manual completion. Check the bridge tracker or source transaction.',
      styleStatus: 'submitted'
    })
  })
})
