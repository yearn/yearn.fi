import type { TNotification } from '@shared/types/notifications'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  doesActivityEntryMatchSearch,
  doesLocalActivityMatchFilters,
  isRecentLocalActivityEntry,
  toLocalActivityEntry
} from './activity.helpers'

const USER_ADDRESS = '0x1111111111111111111111111111111111111111'
const ASSET_ADDRESS = '0x2222222222222222222222222222222222222222'
const VAULT_ADDRESS = '0x3333333333333333333333333333333333333333'
const TX_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const FINISHED_AT = 1776902400

function createNotification(overrides: Partial<TNotification> = {}): TNotification {
  return {
    type: 'deposit',
    address: USER_ADDRESS,
    chainId: 8453,
    amount: '10',
    fromAddress: ASSET_ADDRESS,
    fromTokenName: 'USDC',
    fromAmount: '10',
    toAddress: VAULT_ADDRESS,
    toTokenName: 'yvUSDC',
    toAmount: '9.5',
    txHash: TX_HASH,
    timeFinished: FINISHED_AT,
    status: 'success',
    ...overrides
  }
}

describe('portfolio activity helpers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the expected vault share amount for local deposit rows', () => {
    const entry = toLocalActivityEntry(createNotification())

    expect(entry?.assetSymbol).toBe('USDC')
    expect(entry?.assetAmount).toBe('10')
    expect(entry?.shareAmount).toBe('9.5')
    expect(entry?.shareAmountFormatted).toBe(9.5)
  })

  it('does not reuse the underlying amount as local deposit shares when shares are unknown', () => {
    const entry = toLocalActivityEntry(createNotification({ toAmount: undefined }))

    expect(entry?.assetAmount).toBe('10')
    expect(entry?.shareAmount).toBe('')
    expect(entry?.shareAmountFormatted).toBeNull()
  })

  it('uses the burned vault share amount and received underlying amount for local withdrawals', () => {
    const entry = toLocalActivityEntry(
      createNotification({
        type: 'withdraw',
        amount: '13.04',
        fromAddress: VAULT_ADDRESS,
        fromTokenName: 'yvUSDC-H',
        toAddress: ASSET_ADDRESS,
        toTokenName: 'USDC',
        toAmount: '12.22'
      })
    )

    expect(entry?.action).toBe('withdraw')
    expect(entry?.displayType).toBeNull()
    expect(entry?.assetSymbol).toBe('USDC')
    expect(entry?.assetAmount).toBe('12.22')
    expect(entry?.shareAmount).toBe('13.04')
  })

  it('matches local activity entries with the same search path as indexed rows', () => {
    const entry = toLocalActivityEntry(createNotification())

    expect(entry).not.toBeNull()
    expect(doesActivityEntryMatchSearch(entry!, 'deposit', {})).toBe(true)
    expect(doesActivityEntryMatchSearch(entry!, 'USDC', {})).toBe(true)
    expect(doesActivityEntryMatchSearch(entry!, TX_HASH.slice(0, 12), {})).toBe(true)
    expect(doesActivityEntryMatchSearch(entry!, 'not-present', {})).toBe(false)
  })

  it('applies type, chain, and date filters to local notifications before mapping rows', () => {
    const notification = createNotification()
    const filters = {
      types: ['deposit' as const],
      startDate: '',
      endDate: ''
    }

    expect(
      doesLocalActivityMatchFilters({
        chainId: 8453,
        endTimestamp: FINISHED_AT + 1,
        filters,
        notification,
        startTimestamp: FINISHED_AT - 1
      })
    ).toBe(true)
    expect(
      doesLocalActivityMatchFilters({
        chainId: 1,
        endTimestamp: FINISHED_AT + 1,
        filters,
        notification,
        startTimestamp: FINISHED_AT - 1
      })
    ).toBe(false)
  })

  it('keeps only recent successful local transactions that are not indexed yet', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date((FINISHED_AT + 60) * 1000))

    const notification = createNotification()

    expect(isRecentLocalActivityEntry(notification, new Set())).toBe(true)
    expect(isRecentLocalActivityEntry(notification, new Set([TX_HASH.toLowerCase()]))).toBe(false)
    expect(isRecentLocalActivityEntry({ ...notification, status: 'pending' }, new Set())).toBe(false)
  })
})
