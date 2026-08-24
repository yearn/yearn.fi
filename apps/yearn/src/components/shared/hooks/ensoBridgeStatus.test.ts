import {
  buildEnsoBridgeNotificationUpdate,
  ENSO_BRIDGE_TRACKING_TIMEOUT_MESSAGE,
  normalizeEnsoBridgeStatusResponse,
  selectNextEnsoBridgeNotification
} from '@shared/hooks/ensoBridgeStatus'
import type { TNotification } from '@shared/types/notifications'
import { describe, expect, it } from 'vitest'

const HASH = `0x${'a'.repeat(64)}` as const

function bridgeNotification(overrides: Partial<TNotification> = {}): TNotification {
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

describe('Enso bridge status tracking', () => {
  it('normalizes delivered destination transaction metadata', () => {
    const destinationTxHash = `0x${'b'.repeat(64)}` as const
    expect(
      normalizeEnsoBridgeStatusResponse({
        status: 'DELIVERED',
        destinationChainId: 8453,
        destinationTxHash
      })
    ).toEqual({ status: 'delivered', destinationChainId: 8453, destinationTxHash })
  })

  it('polls the least recently checked active bridge first', () => {
    expect(
      selectNextEnsoBridgeNotification([
        bridgeNotification({ id: 1, lastBridgeCheckAt: 20 }),
        bridgeNotification({ id: 2, lastBridgeCheckAt: 10 })
      ])?.id
    ).toBe(2)
  })

  it('settles delivered and failed bridges explicitly', () => {
    expect(buildEnsoBridgeNotificationUpdate({ status: 'delivered' }, 50, { sourceConfirmedAt: 10 })).toMatchObject({
      status: 'success',
      bridgeStatus: 'delivered',
      timeFinished: 50
    })
    expect(buildEnsoBridgeNotificationUpdate({ status: 'failed' }, 50, { sourceConfirmedAt: 10 })).toMatchObject({
      status: 'error',
      bridgeStatus: 'failed',
      timeFinished: 50
    })
  })

  it('stops indefinite unknown polling with actionable fallback copy', () => {
    expect(buildEnsoBridgeNotificationUpdate({ status: 'unknown' }, 700, { sourceConfirmedAt: 10 })).toMatchObject({
      status: 'submitted',
      bridgeStatus: 'unknown',
      bridgeTrackingState: 'unavailable',
      bridgeError: ENSO_BRIDGE_TRACKING_TIMEOUT_MESSAGE,
      timeFinished: 700
    })
  })
})
