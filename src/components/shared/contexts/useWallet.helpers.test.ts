import { describe, expect, it } from 'vitest'
import type { TChainTokens } from '../types'
import { zeroNormalizedBN } from '../utils'
import {
  applyTokenListMetadataToBalances,
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
const TOKEN_LIST_METADATA_ADDRESS = '0x0000000000000000000000000000000000000123'

describe('useWallet.helpers', () => {
  it('overlays token-list metadata without changing wallet balance data', () => {
    const balances = {
      1: {
        [TOKEN_LIST_METADATA_ADDRESS.toLowerCase()]: {
          address: TOKEN_LIST_METADATA_ADDRESS,
          name: 'Kong Vault Token',
          symbol: 'yvBASE-1',
          decimals: 18,
          chainID: 1,
          logoURI: 'https://example.com/kong.png',
          value: 123,
          balance: {
            raw: 42n,
            normalized: 42,
            display: '42',
            decimals: 18
          }
        }
      }
    } satisfies TChainTokens

    const result = applyTokenListMetadataToBalances({
      balances,
      tokenLists: {
        1: {
          [TOKEN_LIST_METADATA_ADDRESS]: {
            address: TOKEN_LIST_METADATA_ADDRESS,
            name: 'yGauge Base Vault',
            symbol: 'yG-yvBASE-1',
            decimals: 18,
            chainID: 1,
            logoURI: 'https://example.com/tokenlist.png',
            value: 0,
            balance: zeroNormalizedBN
          }
        }
      }
    })

    expect(result[1][TOKEN_LIST_METADATA_ADDRESS.toLowerCase()]).toMatchObject({
      name: 'yGauge Base Vault',
      symbol: 'yG-yvBASE-1',
      logoURI: 'https://example.com/tokenlist.png',
      value: 123,
      balance: {
        raw: 42n,
        normalized: 42,
        display: '42'
      }
    })
  })

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
