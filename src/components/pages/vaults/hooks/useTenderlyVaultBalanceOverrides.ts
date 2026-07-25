import { isYvBtcAddress, YVBTC_LOCKED_ADDRESS, YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import {
  isYvUsdAddress,
  YVUSD_CHAIN_ID,
  YVUSD_DECIMALS,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import { useWalletActions } from '@shared/contexts/useWallet'
import type { TUseBalancesTokens } from '@shared/hooks/useBalances.multichains'
import { fetchTokenBalances } from '@shared/hooks/useBalancesQueries'
import type { TAddress, TChainTokens } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { isTenderlyModeEnabled } from '@/config/tenderly'
import type { TKongVaultView } from '../domain/kongVaultSelectors'

type TTenderlyVaultBalanceOverrideVault = Pick<
  TKongVaultView,
  'address' | 'chainID' | 'decimals' | 'name' | 'symbol'
> & {
  token: Pick<TKongVaultView['token'], 'address' | 'decimals' | 'name' | 'symbol'>
}

type TUseTenderlyVaultBalanceOverridesProps = {
  account?: TAddress
  currentVault?: TTenderlyVaultBalanceOverrideVault
  refreshRevision?: number
  stakingAddress?: TAddress
}

type TUseTenderlyVaultBalanceOverridesResult = {
  refresh: () => Promise<TChainTokens>
}

type TFetchTokenBalances = typeof fetchTokenBalances

function addTenderlyOverrideToken(
  tokens: Map<string, TUseBalancesTokens>,
  address: string | undefined,
  chainID: number | undefined,
  metadata?: Partial<TUseBalancesTokens>
): void {
  if (!address || !Number.isInteger(chainID) || isZeroAddress(toAddress(address))) {
    return
  }

  const token = {
    address: toAddress(address),
    chainID: chainID as number,
    ...metadata
  }
  tokens.set(`${token.chainID}:${token.address}`, token)
}

export function getVaultTenderlyOverrideTokens({
  currentVault,
  stakingAddress
}: {
  currentVault: TTenderlyVaultBalanceOverrideVault
  stakingAddress?: TAddress
}): TUseBalancesTokens[] {
  const tokens = new Map<string, TUseBalancesTokens>()

  addTenderlyOverrideToken(tokens, currentVault.address, currentVault.chainID, {
    decimals: currentVault.decimals,
    name: currentVault.name,
    symbol: currentVault.symbol,
    isVaultToken: true
  })
  addTenderlyOverrideToken(tokens, currentVault.token.address, currentVault.chainID, {
    decimals: currentVault.token.decimals,
    name: currentVault.token.name,
    symbol: currentVault.token.symbol
  })
  addTenderlyOverrideToken(tokens, stakingAddress, currentVault.chainID, {
    decimals: currentVault.decimals,
    name: currentVault.name,
    symbol: currentVault.symbol,
    isStakingToken: true
  })

  if (isYvUsdAddress(currentVault.address)) {
    addTenderlyOverrideToken(tokens, YVUSD_UNLOCKED_ADDRESS, YVUSD_CHAIN_ID, {
      decimals: YVUSD_DECIMALS,
      name: 'yvUSD',
      symbol: 'yvUSD',
      isVaultToken: true
    })
    addTenderlyOverrideToken(tokens, YVUSD_LOCKED_ADDRESS, YVUSD_CHAIN_ID, {
      decimals: YVUSD_DECIMALS,
      name: 'yvUSD (Locked)',
      symbol: 'yvUSD',
      isVaultToken: true
    })
  }

  if (isYvBtcAddress(currentVault.address)) {
    addTenderlyOverrideToken(tokens, YVBTC_UNLOCKED_ADDRESS, currentVault.chainID, {
      decimals: currentVault.decimals,
      name: currentVault.name,
      symbol: currentVault.symbol,
      isVaultToken: true
    })
    addTenderlyOverrideToken(tokens, YVBTC_LOCKED_ADDRESS, currentVault.chainID, {
      decimals: currentVault.decimals,
      name: currentVault.name,
      symbol: currentVault.symbol,
      isVaultToken: true
    })
  }

  return [...tokens.values()]
}

export function getTenderlyVaultOverrideRefreshKey({
  account,
  currentVault,
  refreshRevision = 0,
  stakingAddress
}: {
  account: TAddress
  currentVault: TTenderlyVaultBalanceOverrideVault
  refreshRevision?: number
  stakingAddress?: TAddress
}): string {
  return [
    account,
    currentVault.chainID,
    currentVault.address,
    currentVault.token.address,
    stakingAddress ?? '',
    refreshRevision
  ].join(':')
}

export function getTenderlyVaultBalanceOverrideScopeId({
  account,
  currentVault,
  stakingAddress
}: {
  account: TAddress
  currentVault: TTenderlyVaultBalanceOverrideVault
  stakingAddress?: TAddress
}): string {
  return ['tenderly-vault', account, currentVault.chainID, currentVault.address, stakingAddress ?? ''].join(':')
}

export async function fetchTenderlyVaultBalanceOverrides({
  account,
  fetchBalances = fetchTokenBalances,
  tokens
}: {
  account: TAddress
  fetchBalances?: TFetchTokenBalances
  tokens: TUseBalancesTokens[]
}): Promise<TChainTokens> {
  const chainIds = [...new Set(tokens.map((token) => token.chainID))]
  const tokensByChain = Object.fromEntries(
    chainIds.map((chainId) => [chainId, tokens.filter((token) => token.chainID === chainId)])
  )
  const balancesByChain = await Promise.all(
    Object.entries(tokensByChain).map(
      async ([chainId, chainTokens]) =>
        [Number(chainId), await fetchBalances(Number(chainId), account, chainTokens, true)] as const
    )
  )

  return Object.fromEntries(balancesByChain)
}

export function useTenderlyVaultBalanceOverrides({
  account,
  currentVault,
  refreshRevision = 0,
  stakingAddress
}: TUseTenderlyVaultBalanceOverridesProps): TUseTenderlyVaultBalanceOverridesResult {
  const { clearBalanceOverride, registerBalanceOverrideRefresher, setBalanceOverride } = useWalletActions()
  const activeScopeIdRef = useRef<string | null>(null)
  const refreshKeyRef = useRef<string | null>(null)
  const registeredRefreshRef = useRef<() => Promise<TChainTokens>>(async () => ({}))
  const isTenderlyMode = isTenderlyModeEnabled()
  const tokensToRefresh = useMemo(
    () =>
      currentVault
        ? getVaultTenderlyOverrideTokens({
            currentVault,
            stakingAddress
          })
        : [],
    [currentVault, stakingAddress]
  )
  const scopeId = useMemo(
    () =>
      isTenderlyMode && account && currentVault
        ? getTenderlyVaultBalanceOverrideScopeId({
            account,
            currentVault,
            stakingAddress
          })
        : undefined,
    [account, currentVault, isTenderlyMode, stakingAddress]
  )
  const refresh = useCallback(async (): Promise<TChainTokens> => {
    if (!account || !scopeId || tokensToRefresh.length === 0) {
      return {}
    }

    const nextBalances = await fetchTenderlyVaultBalanceOverrides({
      account,
      tokens: tokensToRefresh
    })
    if (activeScopeIdRef.current === scopeId) {
      setBalanceOverride(scopeId, nextBalances)
    }
    return nextBalances
  }, [account, scopeId, setBalanceOverride, tokensToRefresh])
  registeredRefreshRef.current = refresh
  const registeredRefresh = useCallback(async (): Promise<TChainTokens> => await registeredRefreshRef.current(), [])

  // The wallet override registry is imperative external state, so it must follow this route scope's lifecycle.
  useEffect(() => {
    if (!scopeId) {
      return
    }

    activeScopeIdRef.current = scopeId
    registerBalanceOverrideRefresher(scopeId, registeredRefresh)

    return () => {
      if (activeScopeIdRef.current === scopeId) {
        activeScopeIdRef.current = null
      }
      refreshKeyRef.current = null
      clearBalanceOverride(scopeId)
    }
  }, [clearBalanceOverride, registerBalanceOverrideRefresher, registeredRefresh, scopeId])

  useEffect(() => {
    if (!scopeId || !account || !currentVault) {
      return
    }

    const refreshKey = getTenderlyVaultOverrideRefreshKey({
      account,
      currentVault,
      refreshRevision,
      stakingAddress
    })
    if (refreshKeyRef.current === refreshKey) {
      return
    }
    refreshKeyRef.current = refreshKey

    // Tenderly mutations are external to TanStack Query, so the active workflow needs an imperative VNet refresh.
    void refresh().catch((error) => {
      console.error('Failed to refresh Tenderly vault override balances:', error)
      refreshKeyRef.current = null
    })
  }, [account, currentVault, refresh, refreshRevision, scopeId, stakingAddress])

  return { refresh }
}
