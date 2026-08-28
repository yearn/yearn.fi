import type { TNotification } from '@shared/types/notifications'
import { describe, expect, it } from 'vitest'
import {
  getLocalActivityTransactionKey,
  getReceiptValidatedLocalActivityNotifications
} from './useLocalActivityReceiptStatuses'

const FAILED_HASH = '0xca2ea76c57d927d9d3637b8132031291d67f3977eba90d936a0647eb4487b651'

function createNotification(overrides: Partial<TNotification> = {}): TNotification {
  return {
    address: '0xdf0259238271427c469abc18a2cb3047d5c12466',
    type: 'deposit',
    amount: '1',
    chainId: 1,
    status: 'success',
    txHash: FAILED_HASH,
    timeFinished: 1,
    ...overrides
  }
}

describe('local activity receipt validation', () => {
  it('converts a cached success into a failed notification when its receipt reverted', () => {
    const notification = createNotification()
    const transactionKey = getLocalActivityTransactionKey(notification)
    const statuses = new Map([[transactionKey!, 'reverted' as const]])

    expect(getReceiptValidatedLocalActivityNotifications([notification], statuses)[0]?.status).toBe('error')
  })

  it('does not present an unverified cached success as completed', () => {
    expect(getReceiptValidatedLocalActivityNotifications([createNotification()], new Map())).toEqual([])
  })

  it('keeps receipt-confirmed successes and existing errors', () => {
    const success = createNotification()
    const error = createNotification({ txHash: `0x${'f'.repeat(64)}`, status: 'error' })
    const transactionKey = getLocalActivityTransactionKey(success)
    const statuses = new Map([[transactionKey!, 'success' as const]])

    expect(getReceiptValidatedLocalActivityNotifications([success, error], statuses)).toEqual([success, error])
  })
})
