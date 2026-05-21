import { describe, expect, it } from 'vitest'
import {
  appendCachedNotification,
  filterNotificationsByAddress,
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

  it('filters notifications to the active wallet address case-insensitively', () => {
    const activeWalletNotification = {
      id: 1,
      type: 'deposit' as const,
      address: '0x00000000000000000000000000000000000000AA' as const,
      chainId: 1,
      amount: '1',
      status: 'success' as const
    }
    const inactiveWalletNotification = {
      id: 2,
      type: 'withdraw' as const,
      address: '0x00000000000000000000000000000000000000bb' as const,
      chainId: 1,
      amount: '2',
      status: 'success' as const
    }

    expect(
      filterNotificationsByAddress(
        [activeWalletNotification, inactiveWalletNotification],
        '0x00000000000000000000000000000000000000aa'
      )
    ).toEqual([activeWalletNotification])
  })

  it('returns no notifications when the active wallet is absent', () => {
    const notification = {
      id: 1,
      type: 'deposit' as const,
      address: '0x00000000000000000000000000000000000000AA' as const,
      chainId: 1,
      amount: '1',
      status: 'success' as const
    }

    expect(filterNotificationsByAddress([notification], undefined)).toEqual([])
  })

  it('excludes malformed notification records without an address', () => {
    const notification = {
      id: 1,
      type: 'deposit' as const,
      chainId: 1,
      amount: '1',
      status: 'success' as const
    }

    expect(
      isNotificationForAddress(
        notification as Parameters<typeof isNotificationForAddress>[0],
        '0x00000000000000000000000000000000000000aa'
      )
    ).toBe(false)
  })
})
