import { describe, expect, it } from 'vitest'
import {
  appendCachedNotification,
  filterNotificationsForAddress,
  isNotificationForAddress,
  mergeCachedNotificationEntry
} from './useNotifications.helpers'

describe('useNotifications.helpers', () => {
  it('appends new notifications without reloading the existing list', () => {
    const first = {
      id: 1,
      type: 'deposit' as const,
      address: '0x111' as const,
      chainId: 1,
      amount: '1',
      status: 'pending' as const
    }
    const second = {
      id: 2,
      type: 'withdraw' as const,
      address: '0x222' as const,
      chainId: 1,
      amount: '2',
      status: 'pending' as const
    }

    expect(appendCachedNotification([first], second)).toEqual([first, second])
  })

  it('merges notification updates in place', () => {
    const original = {
      id: 7,
      type: 'deposit' as const,
      address: '0x111' as const,
      chainId: 1,
      amount: '1',
      status: 'pending' as const
    }

    expect(mergeCachedNotificationEntry([original], 7, { status: 'success', txHash: '0xabc' })).toEqual([
      {
        ...original,
        status: 'success',
        txHash: '0xabc'
      }
    ])
  })

  it('adds the updated notification if the cache does not contain it yet', () => {
    expect(
      mergeCachedNotificationEntry([], 3, {
        type: 'deposit',
        address: '0x333',
        chainId: 1,
        amount: '3',
        status: 'success'
      })
    ).toEqual([
      {
        id: 3,
        type: 'deposit',
        address: '0x333',
        chainId: 1,
        amount: '3',
        status: 'success'
      }
    ])
  })

  it('matches notifications by wallet address case-insensitively', () => {
    const notification = {
      id: 1,
      type: 'deposit' as const,
      address: '0xAbC' as const,
      chainId: 1,
      amount: '1',
      status: 'pending' as const
    }

    expect(isNotificationForAddress(notification, '0xabc')).toBe(true)
    expect(isNotificationForAddress(notification, '0xdef')).toBe(false)
    expect(isNotificationForAddress(notification)).toBe(false)
  })

  it('filters cached notifications to the active wallet only', () => {
    const first = {
      id: 1,
      type: 'deposit' as const,
      address: '0x111' as const,
      chainId: 1,
      amount: '1',
      status: 'pending' as const
    }
    const second = {
      id: 2,
      type: 'withdraw' as const,
      address: '0x222' as const,
      chainId: 1,
      amount: '2',
      status: 'pending' as const
    }

    expect(filterNotificationsForAddress([first, second], '0x111')).toEqual([first])
    expect(filterNotificationsForAddress([first, second], undefined)).toEqual([])
  })
})
