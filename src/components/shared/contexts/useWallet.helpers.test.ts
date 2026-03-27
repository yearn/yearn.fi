import { describe, expect, it } from 'vitest'
import { zeroNormalizedBN } from '../utils'
import { hasWalletBalanceSnapshot, shouldExposeWalletLoading } from './useWallet.helpers'

describe('useWallet.helpers', () => {
  it('detects when the wallet has a settled balance snapshot', () => {
    expect(hasWalletBalanceSnapshot({})).toBe(false)
    expect(hasWalletBalanceSnapshot({ 1: {} })).toBe(false)
    expect(
      hasWalletBalanceSnapshot({
        1: {
          '0x123': {
            address: '0x123',
            name: 'Token',
            symbol: 'TOK',
            decimals: 18,
            chainID: 1,
            value: 0,
            balance: zeroNormalizedBN
          }
        }
      })
    ).toBe(true)
  })

  it('exposes loading only for cold wallet loads', () => {
    expect(
      shouldExposeWalletLoading({
        userAddress: undefined,
        hasVisibleBalances: false,
        isLoading: true,
        isBalancesPending: true
      })
    ).toBe(false)

    expect(
      shouldExposeWalletLoading({
        userAddress: '0x123',
        hasVisibleBalances: false,
        isLoading: true,
        isBalancesPending: false
      })
    ).toBe(true)

    expect(
      shouldExposeWalletLoading({
        userAddress: '0x123',
        hasVisibleBalances: false,
        isLoading: false,
        isBalancesPending: true
      })
    ).toBe(true)
  })

  it('keeps background refreshes visually quiet once balances are visible', () => {
    expect(
      shouldExposeWalletLoading({
        userAddress: '0x123',
        hasVisibleBalances: true,
        isLoading: true,
        isBalancesPending: false
      })
    ).toBe(false)

    expect(
      shouldExposeWalletLoading({
        userAddress: '0x123',
        hasVisibleBalances: true,
        isLoading: false,
        isBalancesPending: true
      })
    ).toBe(false)
  })
})
