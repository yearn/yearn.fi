// @vitest-environment jsdom

import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { YVUSD_CHAIN_ID, YVUSD_DECIMALS, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useWalletActions } from '@shared/contexts/useWallet'
import { fetchTokenBalances } from '@shared/hooks/useBalancesQueries'
import type { TAddress } from '@shared/types'
import { toAddress } from '@shared/utils'
import { act, renderHook, waitFor } from '@testing-library/react'
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
type TFetchTokenBalancesResult = Awaited<ReturnType<typeof fetchTokenBalances>>

function tokenKeys(tokens: ReturnType<typeof getVaultTenderlyOverrideTokens>): string[] {
  return tokens.map((token) => `${token.chainID}:${token.address}`)
}

function createTokenBalances(raw: bigint): TFetchTokenBalancesResult {
  return {
    [YVUSD_UNLOCKED_ADDRESS]: {
      address: YVUSD_UNLOCKED_ADDRESS,
      balance: {
        raw,
        normalized: Number(raw),
        display: raw.toString(),
        decimals: YVUSD_DECIMALS
      },
      chainID: YVUSD_CHAIN_ID,
      decimals: YVUSD_DECIMALS,
      name: 'yvUSD',
      symbol: 'yvUSD',
      value: 0
    }
  }
}

function setupWalletActionsMocks(): {
  clearBalanceOverride: ReturnType<typeof vi.fn>
  registerBalanceOverrideRefresher: ReturnType<typeof vi.fn>
  setBalanceOverride: ReturnType<typeof vi.fn>
} {
  const clearBalanceOverride = vi.fn()
  const registerBalanceOverrideRefresher = vi.fn()
  const setBalanceOverride = vi.fn()
  useWalletActionsMock.mockReturnValue({
    clearBalanceOverride,
    onRefresh: vi.fn(),
    registerBalanceOverrideRefresher,
    setBalanceOverride
  })
  return {
    clearBalanceOverride,
    registerBalanceOverrideRefresher,
    setBalanceOverride
  }
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
    const { clearBalanceOverride } = setupWalletActionsMocks()
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

  it('ignores an older refresh that resolves after a newer state revision', async () => {
    const { setBalanceOverride } = setupWalletActionsMocks()
    const firstRefresh = Promise.withResolvers<TFetchTokenBalancesResult>()
    const secondRefresh = Promise.withResolvers<TFetchTokenBalancesResult>()
    const firstBalances = createTokenBalances(1n)
    const secondBalances = createTokenBalances(2n)
    const scopeId = getTenderlyVaultBalanceOverrideScopeId({
      account: ACCOUNT,
      currentVault: CURRENT_VAULT
    })
    fetchTokenBalancesMock
      .mockImplementationOnce(async () => await firstRefresh.promise)
      .mockImplementationOnce(async () => await secondRefresh.promise)

    const { rerender } = renderHook(
      ({ refreshRevision }: { refreshRevision: number }) =>
        useTenderlyVaultBalanceOverrides({
          account: ACCOUNT,
          currentVault: CURRENT_VAULT,
          refreshRevision
        }),
      {
        initialProps: { refreshRevision: 0 }
      }
    )

    await waitFor(() => expect(fetchTokenBalancesMock).toHaveBeenCalledTimes(1))
    rerender({ refreshRevision: 1 })
    await waitFor(() => expect(fetchTokenBalancesMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      secondRefresh.resolve(secondBalances)
      await secondRefresh.promise
    })
    await waitFor(() =>
      expect(setBalanceOverride).toHaveBeenCalledWith(scopeId, {
        [YVUSD_CHAIN_ID]: secondBalances
      })
    )

    await act(async () => {
      firstRefresh.resolve(firstBalances)
      await firstRefresh.promise
    })
    expect(setBalanceOverride).toHaveBeenCalledTimes(1)
  })

  it('ignores an older refresh after remounting the same account and vault scope', async () => {
    const { clearBalanceOverride, setBalanceOverride } = setupWalletActionsMocks()
    const firstMountRefresh = Promise.withResolvers<TFetchTokenBalancesResult>()
    const secondMountRefresh = Promise.withResolvers<TFetchTokenBalancesResult>()
    const firstBalances = createTokenBalances(1n)
    const secondBalances = createTokenBalances(2n)
    const scopeId = getTenderlyVaultBalanceOverrideScopeId({
      account: ACCOUNT,
      currentVault: CURRENT_VAULT
    })
    fetchTokenBalancesMock
      .mockImplementationOnce(async () => await firstMountRefresh.promise)
      .mockImplementationOnce(async () => await secondMountRefresh.promise)

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

    await act(async () => {
      secondMountRefresh.resolve(secondBalances)
      await secondMountRefresh.promise
    })
    await waitFor(() =>
      expect(setBalanceOverride).toHaveBeenCalledWith(scopeId, {
        [YVUSD_CHAIN_ID]: secondBalances
      })
    )

    await act(async () => {
      firstMountRefresh.resolve(firstBalances)
      await firstMountRefresh.promise
    })
    expect(setBalanceOverride).toHaveBeenCalledTimes(1)
  })

  it('does not clear the active refresh key when an older lifecycle request rejects', async () => {
    setupWalletActionsMocks()
    const firstMountRefresh = Promise.withResolvers<TFetchTokenBalancesResult>()
    const secondMountRefresh = Promise.withResolvers<TFetchTokenBalancesResult>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fetchTokenBalancesMock
      .mockImplementationOnce(async () => await firstMountRefresh.promise)
      .mockImplementationOnce(async () => await secondMountRefresh.promise)

    const { rerender } = renderHook(
      ({ account, currentVault }: { account?: TAddress; currentVault: typeof CURRENT_VAULT }) =>
        useTenderlyVaultBalanceOverrides({
          account,
          currentVault
        }),
      {
        initialProps: {
          account: ACCOUNT as TAddress | undefined,
          currentVault: CURRENT_VAULT
        }
      }
    )

    await waitFor(() => expect(fetchTokenBalancesMock).toHaveBeenCalledTimes(1))
    rerender({ account: undefined, currentVault: CURRENT_VAULT })
    rerender({ account: ACCOUNT, currentVault: CURRENT_VAULT })
    await waitFor(() => expect(fetchTokenBalancesMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      secondMountRefresh.resolve(createTokenBalances(2n))
      await secondMountRefresh.promise
    })
    await act(async () => {
      firstMountRefresh.reject(new Error('stale refresh failed'))
      await firstMountRefresh.promise.catch(() => undefined)
    })

    rerender({
      account: ACCOUNT,
      currentVault: {
        ...CURRENT_VAULT,
        token: { ...CURRENT_VAULT.token }
      }
    })
    await act(async () => await Promise.resolve())

    expect(fetchTokenBalancesMock).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })
})
