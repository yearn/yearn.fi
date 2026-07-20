import {
  getNotificationRefreshTargets,
  shouldInvalidateNotificationTokenQuery
} from '@shared/hooks/notificationRefresh'
import type { TNotification } from '@shared/types/notifications'
import { describe, expect, it } from 'vitest'

const notification: TNotification = {
  type: 'crosschain zap',
  address: '0x0000000000000000000000000000000000000001',
  chainId: 1,
  toChainId: 8453,
  amount: '1',
  fromAddress: '0x0000000000000000000000000000000000000002',
  toAddress: '0x0000000000000000000000000000000000000003',
  status: 'submitted'
}

describe('notification asset refresh', () => {
  it('refreshes only the source and destination transaction assets', () => {
    expect(getNotificationRefreshTargets(notification)).toEqual([
      { address: notification.fromAddress, chainID: 1 },
      { address: notification.toAddress, chainID: 8453 }
    ])
  })

  it('invalidates matching local token queries for the transaction account', () => {
    expect(
      shouldInvalidateNotificationTokenQuery(
        ['tokens', notification.toAddress, 8453, 8453, notification.address],
        notification
      )
    ).toBe(true)
    expect(
      shouldInvalidateNotificationTokenQuery(
        ['tokens', notification.toAddress, 8453, 8453, '0x0000000000000000000000000000000000000004'],
        notification
      )
    ).toBe(false)
  })
})
