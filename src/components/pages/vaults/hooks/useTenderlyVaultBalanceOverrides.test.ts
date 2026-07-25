// @vitest-environment jsdom

import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useWalletActions } from '@shared/contexts/useWallet'
import { fetchTokenBalances } from '@shared/hooks/useBalancesQueries'
import type { TAddress } from '@shared/types'
import { toAddress } from '@shared/utils'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchTenderlyVaultBalanceOverrides,
  getTenderlyVaultBalanceOverrideScopeId,
  getTenderlyVaultOverrideRefreshKey,
  getVaultTenderlyOverrideTokens,
  useTenderlyVaultBalanceOverrides
} from './useTenderlyVaultBalanceOverrides'

vi.mock('@shared/contexts/useWallet', () => ({
  useWalletActions: vi.fn()
}))

vi.mock('@shared/hooks/useBalancesQueries', () => ({
  fetchTokenBalances: vi.fn()
}))

vi.mock('@/config/tenderly', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/tenderly')>()),
  isTenderlyModeEnabled: () => true
}))

const ACCOUNT = toAddress('0x9999999999999999999999999999999999999999')
const ASSET_ADDRESS = toAddress('0x1111111111111111111111111111111111111111')
const STAKING_ADDRESS = toAddress('0x2222222222222222222222222222222222222222')
const CURRENT_VAULT = {
  address: YVUSD_UNLOCKED_ADDRESS,
  chainID: YVUSD_CHAIN_ID,
  decimals: 6,
  name: 'yvUSD',
  symbol: 'yvUSD',
  token: {
    address: ASSET_ADDRESS,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC'
  }
}

const useWalletActionsMock = vi.mocked(useWalletActions)
const fetchTokenBalancesMock = vi.mocked(fetchTokenBalances)

function tokenKeys(tokens: ReturnType<typeof getVaultTenderlyOverrideTokens>): string[] {
  return tokens.map((token) => `${token.chainID}:${token.address}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getVaultTenderlyOverrideTokens', () => {
  it('includes only the current vault, underlying asset, and staking token for a regular vault', () => {
    const tokens = getVaultTenderlyOverrideTokens({
      currentVault: {
        address: toAddress('0x3333333333333333333333333333333333333333'),
        chainID: 1,
        decimals: 18,
        name: 'Example Vault',
        symbol: 'yvEX',
        token: {
          address: ASSET_ADDRESS,
          decimals: 6,
          name: 'Example Asset',
          symbol: 'EX'
        }
      },
      stakingAddress: STAKING_ADDRESS
    })

    expect(tokenKeys(tokens)).toEqual([
      `1:${toAddress('0x3333333333333333333333333333333333333333')}`,
      `1:${ASSET_ADDRESS}`,
      `1:${STAKING_ADDRESS}`
    ])
  })

  it('adds both yvUSD variants without duplicating the current variant', () => {
    const tokens = getVaultTenderlyOverrideTokens({
      currentVault: {
        address: YVUSD_UNLOCKED_ADDRESS,
        chainID: YVUSD_CHAIN_ID,
        decimals: 6,
        name: 'yvUSD',
        symbol: 'yvUSD',
        token: {
          address: ASSET_ADDRESS,
          decimals: 6,
          name: 'USDC',
          symbol: 'USDC'
        }
      }
    })

    expect(tokenKeys(tokens)).toEqual([
      `${YVUSD_CHAIN_ID}:${YVUSD_UNLOCKED_ADDRESS}`,
      `${YVUSD_CHAIN_ID}:${ASSET_ADDRESS}`,
      `${YVUSD_CHAIN_ID}:${YVUSD_LOCKED_ADDRESS}`
    ])
  })

  it('does not add the zero-address yvBTC locked placeholder', () => {
    const tokens = getVaultTenderlyOverrideTokens({
      currentVault: {
        address: YVBTC_UNLOCKED_ADDRESS,
        chainID: 1,
        decimals: 8,
        name: 'yvBTC',
        symbol: 'yvBTC',
        token: {
          address: ASSET_ADDRESS,
          decimals: 8,
          name: 'Bitcoin',
          symbol: 'BTC'
        }
      }
    })

    expect(tokenKeys(tokens)).toEqual([`1:${YVBTC_UNLOCKED_ADDRESS}`, `1:${ASSET_ADDRESS}`])
  })

  it('changes the refresh key when Tenderly state mutates', () => {
    const currentVault = {
      address: YVUSD_UNLOCKED_ADDRESS,
      chainID: YVUSD_CHAIN_ID,
      decimals: 6,
      name: 'yvUSD',
      symbol: 'yvUSD',
      token: {
        address: ASSET_ADDRESS,
        decimals: 6,
        name: 'USDC',
        symbol: 'USDC'
      }
    }
    const firstKey = getTenderlyVaultOverrideRefreshKey({
      account: ACCOUNT,
      currentVault,
      refreshRevision: 1
    })
    const nextKey = getTenderlyVaultOverrideRefreshKey({
      account: ACCOUNT,
      currentVault,
      refreshRevision: 2
    })

    expect(nextKey).not.toBe(firstKey)
  })

  it('uses a stable route scope that does not include the refresh revision', () => {
    const currentVault = {
      address: YVUSD_UNLOCKED_ADDRESS,
      chainID: YVUSD_CHAIN_ID,
      decimals: 6,
      name: 'yvUSD',
      symbol: 'yvUSD',
      token: {
        address: ASSET_ADDRESS,
        decimals: 6,
        name: 'USDC',
        symbol: 'USDC'
      }
    }

    expect(
      getTenderlyVaultBalanceOverrideScopeId({
        account: ACCOUNT,
        currentVault
      })
    ).toBe(`tenderly-vault:${ACCOUNT}:${YVUSD_CHAIN_ID}:${YVUSD_UNLOCKED_ADDRESS}:`)
  })

  it('fetches only the explicitly selected override tokens', async () => {
    const selectedTokens = getVaultTenderlyOverrideTokens({
      currentVault: {
        address: YVUSD_UNLOCKED_ADDRESS,
        chainID: YVUSD_CHAIN_ID,
        decimals: 6,
        name: 'yvUSD',
        symbol: 'yvUSD',
        token: {
          address: ASSET_ADDRESS,
          decimals: 6,
          name: 'USDC',
          symbol: 'USDC'
        }
      }
    })
    const fetchBalances = vi.fn<typeof fetchTokenBalances>(async (chainId, _account, tokens) =>
      Object.fromEntries(
        tokens.map((token) => [
          token.address,
          {
            address: token.address,
            balance: {
              raw: 1n,
              normalized: 1,
              display: '1',
              decimals: token.decimals ?? 18
            },
            chainID: chainId,
            decimals: token.decimals ?? 18,
            name: token.name ?? '',
            symbol: token.symbol ?? '',
            value: 0
          }
        ])
      )
    )

    const balances = await fetchTenderlyVaultBalanceOverrides({
      account: ACCOUNT,
      fetchBalances,
      tokens: selectedTokens
    })

    expect(fetchBalances).toHaveBeenCalledOnce()
    expect(fetchBalances).toHaveBeenCalledWith(YVUSD_CHAIN_ID, ACCOUNT, selectedTokens, true)
    expect(Object.keys(balances[YVUSD_CHAIN_ID])).toEqual(selectedTokens.map((token) => token.address))
  })
})

describe('useTenderlyVaultBalanceOverrides', () => {
  it('refreshes again after reconnecting the same account to the same vault', async () => {
    const clearBalanceOverride = vi.fn()
    const registerBalanceOverrideRefresher = vi.fn()
    const setBalanceOverride = vi.fn()
    useWalletActionsMock.mockReturnValue({
      clearBalanceOverride,
      onRefresh: vi.fn(),
      registerBalanceOverrideRefresher,
      setBalanceOverride
    })
    fetchTokenBalancesMock.mockResolvedValue({})

    const { rerender } = renderHook(
      ({ account }: { account?: TAddress }) =>
        useTenderlyVaultBalanceOverrides({
          account,
          currentVault: CURRENT_VAULT
        }),
      {
        initialProps: { account: ACCOUNT as TAddress | undefined }
      }
    )

    await waitFor(() => expect(fetchTokenBalancesMock).toHaveBeenCalledTimes(1))

    rerender({ account: undefined })
    await waitFor(() => expect(clearBalanceOverride).toHaveBeenCalledOnce())

    rerender({ account: ACCOUNT })
    await waitFor(() => expect(fetchTokenBalancesMock).toHaveBeenCalledTimes(2))
  })
})
