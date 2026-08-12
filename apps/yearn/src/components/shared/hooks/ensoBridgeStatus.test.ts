import {
  buildEnsoBridgeNotificationUpdate,
  ENSO_BRIDGE_TRACKING_TIMEOUT_MESSAGE,
  isTrackableEnsoBridgeNotification,
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
  it('starts bridge polling only after source confirmation is persisted', () => {
    expect(isTrackableEnsoBridgeNotification(bridgeNotification({ status: 'pending', bridgeStatus: undefined }))).toBe(
      false
    )
    expect(isTrackableEnsoBridgeNotification(bridgeNotification())).toBe(true)
  })

  it('does not poll a cross-chain record with unavailable tracking metadata', () => {
    expect(
      isTrackableEnsoBridgeNotification(
        bridgeNotification({ bridgeProtocol: undefined, bridgeTrackingState: 'unavailable' })
      )
    ).toBe(false)
  })

  it('recovers Relay polling from a persisted request ID when the source hash was lost', () => {
    expect(
      isTrackableEnsoBridgeNotification(
        bridgeNotification({ txHash: undefined, bridgeRequestId: `0x${'c'.repeat(64)}` })
      )
    ).toBe(true)
  })

  it('normalizes delivered destination transaction metadata', () => {
    const destinationTxHash = `0x${'b'.repeat(64)}` as const
    const bridgeRequestId = `0x${'c'.repeat(64)}` as const
    expect(
      normalizeEnsoBridgeStatusResponse({
        status: 'DELIVERED',
        bridgeRequestId,
        destinationChainId: 8453,
        destinationTxHash
      })
    ).toEqual({ status: 'delivered', bridgeRequestId, destinationChainId: 8453, destinationTxHash })
  })

  it('keeps the newest active bridge in front of historical unfinished entries', () => {
    expect(
      selectNextEnsoBridgeNotification([
        bridgeNotification({ id: 1, createdAt: 10, lastBridgeCheckAt: 0 }),
        bridgeNotification({ id: 2, createdAt: 20, lastBridgeCheckAt: 30 })
      ])?.id
    ).toBe(2)
  })

  it('resumes an older bridge after the newest bridge settles', () => {
    expect(
      selectNextEnsoBridgeNotification([
        bridgeNotification({ id: 1, createdAt: 10 }),
        bridgeNotification({ id: 2, createdAt: 20, status: 'success', bridgeStatus: 'delivered' })
      ])?.id
    ).toBe(1)
  })

  it('settles delivered and failed bridges explicitly', () => {
    expect(
      buildEnsoBridgeNotificationUpdate({ status: 'delivered', sourceTxHash: HASH }, 50, {
        sourceConfirmedAt: 10
      })
    ).toMatchObject({ status: 'success', bridgeStatus: 'delivered', txHash: HASH, timeFinished: 50 })
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
