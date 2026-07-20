import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { BOLD_ADDRESS } from '@pages/vaults/utils/yBold'
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
    vi.restoreAllMocks()
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

  it('uses the input amount for legacy local BOLD to ysyBOLD zap rows without a share amount', () => {
    const entry = toLocalActivityEntry(
      createNotification({
        fromAddress: BOLD_ADDRESS,
        fromTokenName: 'BOLD',
        fromAmount: '1.886214',
        toAddress: YBOLD_STAKING_ADDRESS,
        toTokenName: 'ysyBOLD',
        toAmount: undefined
      })
    )

    expect(entry?.assetSymbol).toBe('BOLD')
    expect(entry?.shareAmount).toBe('1.886214')
    expect(entry?.shareAmountFormatted).toBe(1.886214)
  })

  it('uses the input amount for legacy local BOLD to yBOLD deposit rows without a share amount', () => {
    const entry = toLocalActivityEntry(
      createNotification({
        fromAddress: BOLD_ADDRESS,
        fromTokenName: 'BOLD',
        fromAmount: '1.257',
        toAddress: YBOLD_VAULT_ADDRESS,
        toTokenName: 'yBOLD',
        toAmount: undefined
      })
    )

    expect(entry?.assetSymbol).toBe('BOLD')
    expect(entry?.shareAmount).toBe('1.257')
    expect(entry?.shareAmountFormatted).toBe(1.257)
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

  it('can map an unresolved local notification with a fallback timestamp', () => {
    const fallbackTimestamp = FINISHED_AT + 30
    const entry = toLocalActivityEntry(
      createNotification({
        status: 'submitted',
        timeFinished: undefined
      }),
      { fallbackTimestamp }
    )

    expect(entry?.timestamp).toBe(fallbackTimestamp)
    expect(entry?.action).toBe('deposit')
  })

  it('marks failed local notifications as failed activity', () => {
    const entry = toLocalActivityEntry(createNotification({ status: 'error' }))

    expect(entry?.transactionStatus).toBe('failed')
  })

  it('does not map local notifications without any timestamp', () => {
    const entry = toLocalActivityEntry(
      createNotification({
        status: 'pending',
        timeFinished: undefined
      })
    )

    expect(entry).toBeNull()
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
    vi.spyOn(Date, 'now').mockReturnValue((FINISHED_AT + 60) * 1000)

    const notification = createNotification()

    expect(isRecentLocalActivityEntry(notification, new Set())).toBe(true)
    expect(isRecentLocalActivityEntry(notification, new Set([TX_HASH.toLowerCase()]))).toBe(false)
    expect(isRecentLocalActivityEntry({ ...notification, status: 'pending' }, new Set())).toBe(false)
  })
})
