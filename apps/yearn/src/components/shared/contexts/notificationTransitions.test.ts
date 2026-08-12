import { applyNotificationUpdate } from '@shared/contexts/notificationTransitions'
import type { TNotification } from '@shared/types/notifications'
import { describe, expect, it } from 'vitest'

const HASH = `0x${'a'.repeat(64)}` as const

function notification(overrides: Partial<TNotification> = {}): TNotification {
  return {
    id: 1,
    type: 'crosschain zap',
    address: '0x0000000000000000000000000000000000000001',
    chainId: 1,
    toChainId: 8453,
    amount: '1',
    status: 'submitted',
    txHash: HASH,
    bridgeProtocol: 'relay',
    bridgeStatus: 'pending',
    bridgeTrackingState: 'active',
    ...overrides
  }
}

describe('applyNotificationUpdate', () => {
  it('advances a confirmed source transaction to delivered', () => {
    expect(
      applyNotificationUpdate(notification(), {
        status: 'success',
        bridgeStatus: 'delivered',
        destinationTxHash: `0x${'b'.repeat(64)}`
      })
    ).toMatchObject({ status: 'success', bridgeStatus: 'delivered' })
  })

  it('does not let a late source confirmation regress a delivered bridge', () => {
    const delivered = notification({ status: 'success', bridgeStatus: 'delivered' })

    expect(applyNotificationUpdate(delivered, { status: 'submitted', bridgeStatus: 'pending' })).toBe(delivered)
    expect(applyNotificationUpdate(delivered, { status: 'success', bridgeStatus: 'pending' })).toBe(delivered)
  })

  it('allows terminal metadata to be completed idempotently', () => {
    const delivered = notification({ status: 'success', bridgeStatus: 'delivered' })
    const destinationTxHash = `0x${'c'.repeat(64)}` as const

    expect(applyNotificationUpdate(delivered, { destinationTxHash })).toEqual({ ...delivered, destinationTxHash })
  })
})
