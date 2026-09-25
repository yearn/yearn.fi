import type { TNotification } from '@shared/types/notifications'
import { getNotificationLifecyclePresentation, selectNotificationStatus } from '@shared/utils/notificationLifecycle'
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

describe('transaction references and aggregate status', () => {
  it.each([
    { destinationTxHash: undefined, toChainId: 8453 },
    { destinationTxHash: `0x${'b'.repeat(64)}` as const, toChainId: undefined },
    { destinationTxHash: `0x${'b'.repeat(64)}` as const, toChainId: 0 }
  ])('keeps the source hash on its execution chain if destination evidence is incomplete', (destination) => {
    expect(
      getNotificationLifecyclePresentation({
        ...notification,
        status: 'success',
        bridgeStatus: 'delivered',
        executionChainId: 10001,
        ...destination
      })
    ).toMatchObject({ transactionHash: notification.txHash, transactionChainId: 10001 })
  })

  it('keeps active work visible when another transaction completes or changes metadata', () => {
    const pending = { ...notification, status: 'pending' as const }
    const done = { ...notification, status: 'success' as const, timeFinished: 100 }
    expect(selectNotificationStatus([pending, done], 101)).toBe('pending')
    expect(selectNotificationStatus([done, { ...pending, blockNumber: 123n }], 101)).toBe('pending')
    expect(selectNotificationStatus([done, notification], 101)).toBe('submitted')
  })

  it('shows unresolved tracking, recent failures, and recent success in priority order', () => {
    const failed = { ...notification, status: 'error' as const, timeFinished: 100 }
    const done = { ...notification, status: 'success' as const, timeFinished: 110 }
    expect(selectNotificationStatus([done, failed, { ...notification, bridgeTrackingState: 'unavailable' }], 111)).toBe(
      'submitted'
    )
    expect(selectNotificationStatus([done, failed], 111)).toBe('error')
    expect(selectNotificationStatus([done], 111)).toBe('success')
    expect(selectNotificationStatus([done, failed], 410)).toBeNull()
    expect(selectNotificationStatus([], 111)).toBeNull()
  })
})
