import {
  buildNotificationEntry,
  buildNotificationUpdate,
  isCrossChainNotificationType,
  shouldSetNotificationFinishedAt
} from '@shared/contexts/notificationActions.helpers'
import { describe, expect, it } from 'vitest'

describe('notification action helpers', () => {
  it('builds a submitted bridge notification with its source hash atomically', () => {
    const txHash = `0x${'a'.repeat(64)}` as const
    expect(
      buildNotificationEntry(
        {
          type: 'crosschain zap',
          amount: '1',
          fromAddress: '0x0000000000000000000000000000000000000001',
          fromSymbol: 'USDC',
          fromChainId: 747474,
          executionChainId: 747474,
          ownerAddress: '0x0000000000000000000000000000000000000003',
          toAddress: '0x0000000000000000000000000000000000000002',
          toSymbol: 'yvUSDC',
          toChainId: 8453,
          bridgeProtocol: 'relay',
          status: 'pending',
          txHash
        },
        '0x0000000000000000000000000000000000000004',
        10
      )
    ).toMatchObject({
      status: 'pending',
      address: '0x0000000000000000000000000000000000000003',
      txHash,
      chainId: 747474,
      executionChainId: 747474,
      toChainId: 8453,
      bridgeProtocol: 'relay',
      bridgeTrackingState: 'active',
      createdAt: 10
    })
  })

  it('marks cross-chain tracking unavailable when route metadata has no supported bridge', () => {
    expect(
      buildNotificationEntry(
        {
          type: 'crosschain withdraw zap',
          amount: '1',
          fromAddress: '0x0000000000000000000000000000000000000001',
          fromSymbol: 'yvUSDC',
          fromChainId: 8453,
          ownerAddress: '0x0000000000000000000000000000000000000003',
          toChainId: 747474,
          status: 'pending',
          txHash: `0x${'b'.repeat(64)}`
        },
        '0x0000000000000000000000000000000000000003',
        10
      )
    ).toMatchObject({
      bridgeTrackingState: 'unavailable',
      bridgeError: 'Automatic bridge tracking is unavailable for this route. Check the source transaction for progress.'
    })
  })

  it('recognizes both cross-chain transaction directions', () => {
    expect(isCrossChainNotificationType('crosschain zap')).toBe(true)
    expect(isCrossChainNotificationType('crosschain withdraw zap')).toBe(true)
    expect(isCrossChainNotificationType('zap')).toBe(false)
  })

  it('does not finish a notification while its bridge is pending', () => {
    expect(shouldSetNotificationFinishedAt({ id: 1, status: 'submitted', bridgeStatus: 'pending' })).toBe(false)
  })

  it('finishes failed source transactions', () => {
    expect(shouldSetNotificationFinishedAt({ id: 1, status: 'error' })).toBe(true)
  })

  it('does not erase persisted metadata during a partial status update', () => {
    expect(buildNotificationUpdate({ id: 1, status: 'submitted', awaitingExecution: true }, 10)).toEqual({
      status: 'submitted',
      awaitingExecution: true
    })
    expect(buildNotificationUpdate({ id: 1, status: 'submitted', bridgeStatus: 'pending' }, 10)).toEqual({
      status: 'submitted',
      bridgeStatus: 'pending'
    })
  })
})
