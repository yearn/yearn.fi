import { describe, expect, it } from 'vitest'
import type { TChainTokens } from '../types'
import { zeroNormalizedBN } from '../utils'
import {
  hasWalletBalanceSnapshot,
  shouldExposeWalletLoading,
  shouldUpdateVisibleBalanceSnapshot
} from './useWallet.helpers'

const TOKEN_BALANCE_SNAPSHOT = {
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
} satisfies TChainTokens

describe('useWallet.helpers', () => {
  it('detects when the wallet has a settled balance snapshot', () => {
    expect(hasWalletBalanceSnapshot({})).toBe(false)
    expect(hasWalletBalanceSnapshot({ 1: {} })).toBe(false)
    expect(hasWalletBalanceSnapshot(TOKEN_BALANCE_SNAPSHOT)).toBe(true)
  })

  it('adopts the first visible balance snapshot while a cold load is still running', () => {
    expect(
      shouldUpdateVisibleBalanceSnapshot({
        currentBalances: {},
        nextBalances: TOKEN_BALANCE_SNAPSHOT,
        isLoading: true
      })
    ).toBe(true)
  })

  it('keeps later loading snapshots quiet once something is visible', () => {
    expect(
      shouldUpdateVisibleBalanceSnapshot({
        currentBalances: TOKEN_BALANCE_SNAPSHOT,
        nextBalances: {
          ...TOKEN_BALANCE_SNAPSHOT,
          10: {}
        },
        isLoading: true
      })
    ).toBe(false)
  })

  it('always accepts the final non-loading snapshot', () => {
    expect(
      shouldUpdateVisibleBalanceSnapshot({
        currentBalances: TOKEN_BALANCE_SNAPSHOT,
        nextBalances: {},
        isLoading: false
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
