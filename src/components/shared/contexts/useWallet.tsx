import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import type { QueryKey } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { createContext, memo, useCallback, useContext, useDeferredValue, useMemo, useRef, useState } from 'react'
import { isTenderlyModeEnabled } from '@/config/tenderly'
import { env } from '@/env'
import type { TUseBalancesTokens } from '../hooks/useBalances.multichains'
import { mergeBalanceSources, useBalancesCombined } from '../hooks/useBalancesCombined'
import { useBalancesWithQuery } from '../hooks/useBalancesWithQuery'
import type { TFetchQueryKey } from '../hooks/useFetch'
import { useStakingAssetConversions } from '../hooks/useStakingAssetConversions'
import { getVaultHoldingsUsdValue } from '../hooks/useVaultFilterUtils'
import type { TAddress, TChainTokens, TDict, TNDict, TNormalizedBN, TToken, TYChainTokens } from '../types'
import { DEFAULT_ERC20, zeroNormalizedBN } from '../utils'
import {
  applyTokenListMetadataToBalances,
  hasWalletBalanceSnapshot,
  shouldExposeWalletLoading,
  shouldUpdateVisibleBalanceSnapshot,
  shouldUseEnsoWalletBalances
} from './useWallet.helpers'
import { useWeb3 } from './useWeb3'
import { useYearn } from './useYearn'
import { useYearnTokens } from './useYearn.helper'
import { useTokenList } from './WithTokenList'

const USE_ENSO_BALANCES = env.NEXT_PUBLIC_BALANCE_SOURCE !== 'multicall'

type TTokenAndChain = { address: TAddress; chainID: number }
type TBalanceOverrideRefresher = () => Promise<TChainTokens>

type TWalletContext = {
  getToken: ({ address, chainID }: TTokenAndChain) => TToken
  getBalance: ({ address, chainID }: TTokenAndChain) => TNormalizedBN
  getVaultHoldingsUsd: (vault: TKongVaultInput) => number
  balances: TChainTokens
  isLoading: boolean
  hasCompletedBalanceLoad: boolean
  onRefresh: (
    tokenList?: TUseBalancesTokens[],
    shouldSaveInStorage?: boolean,
    shouldForceFetch?: boolean
  ) => Promise<TChainTokens>
  clearBalanceOverride: (scopeId: string) => void
  registerBalanceOverrideRefresher: (scopeId: string, refresher: TBalanceOverrideRefresher) => void
  setBalanceOverride: (scopeId: string, balances: TChainTokens) => void
}

type TWalletTokensContext = Pick<TWalletContext, 'getToken' | 'getBalance' | 'balances'>
type TWalletStatusContext = Pick<TWalletContext, 'isLoading' | 'hasCompletedBalanceLoad'>
type TWalletHoldingsContext = Pick<TWalletContext, 'getVaultHoldingsUsd'>
type TWalletActionsContext = Pick<
  TWalletContext,
  'clearBalanceOverride' | 'onRefresh' | 'registerBalanceOverrideRefresher' | 'setBalanceOverride'
>

const defaultProps = {
  getToken: (): TToken => DEFAULT_ERC20,
  getBalance: (): TNormalizedBN => zeroNormalizedBN,
  getVaultHoldingsUsd: (): number => 0,
  balances: {},
  isLoading: true,
  hasCompletedBalanceLoad: false,
  onRefresh: async (): Promise<TChainTokens> => ({}),
  clearBalanceOverride: (): void => undefined,
  registerBalanceOverrideRefresher: (): void => undefined,
  setBalanceOverride: (): void => undefined
}

/*******************************************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletTokensContext = createContext<TWalletTokensContext>(defaultProps)
const WalletStatusContext = createContext<TWalletStatusContext>(defaultProps)
const WalletHoldingsContext = createContext<TWalletHoldingsContext>(defaultProps)
const WalletActionsContext = createContext<TWalletActionsContext>(defaultProps)
export const WalletContextApp = memo(function WalletContextApp(props: {
  children: ReactElement
  shouldWorkOnTestnet?: boolean
}): ReactElement {
  const queryClient = useQueryClient()
  const { vaults, allVaults, isLoadingVaultList, getPrice } = useYearn()
  const { address: userAddress } = useWeb3()

  const allTokens = useYearnTokens({
    vaults: allVaults,
    catalogVaults: vaults,
    isLoadingVaultList,
    isEnabled: Boolean(userAddress)
  })
  const { getToken: getTokenListToken, tokenLists } = useTokenList()
  const [balanceOverrides, setBalanceOverrides] = useState<Record<string, TChainTokens>>({})
  const balanceOverrideRefreshersRef = useRef(new Map<string, TBalanceOverrideRefresher>())
  const useBalancesHook = shouldUseEnsoWalletBalances({
    isTenderlyMode: isTenderlyModeEnabled(),
    prefersEnso: USE_ENSO_BALANCES
  })
    ? useBalancesCombined
    : useBalancesWithQuery
  const {
    data: tokensRaw, // Expected to be TDict<TNormalizedBN | undefined>
    onUpdate,
    onUpdateSome,
    isLoading,
    isSuccess
  } = useBalancesHook({
    tokens: allTokens,
    priorityChainID: 1
  })
  const stableTokensRaw = useMemo((): TYChainTokens => (tokensRaw ? (tokensRaw as TYChainTokens) : {}), [tokensRaw])
  /**************************************************************************
   ** Balance queries stream updates across multiple chains. Hold the last
   ** deep-stable settled snapshot while the wallet is loading so list
   ** consumers do not rerender on every intermediate balance update during
   ** connect or get stuck on transient reference churn.
   **************************************************************************/
  const settledTokensRawRef = useRef<TYChainTokens>({})
  const settledOwnerRef = useRef(userAddress)
  const hasCompletedInitialBalanceLoadRef = useRef(false)
  if (settledOwnerRef.current !== userAddress) {
    settledOwnerRef.current = userAddress
    settledTokensRawRef.current = {}
    hasCompletedInitialBalanceLoadRef.current = false
  }
  if (
    shouldUpdateVisibleBalanceSnapshot({
      currentBalances: settledTokensRawRef.current,
      nextBalances: stableTokensRaw,
      isLoading
    })
  ) {
    settledTokensRawRef.current = stableTokensRaw
  }
  const visibleTokensRaw = settledTokensRawRef.current
  const deferredTokensRaw = useDeferredValue(visibleTokensRaw)
  const canonicalBalances = useMemo(
    (): TNDict<TDict<TToken>> =>
      applyTokenListMetadataToBalances({
        balances: deferredTokensRaw as TYChainTokens,
        tokenLists
      }),
    [deferredTokensRaw, tokenLists]
  )
  const balancesWithOverrides = useMemo(
    () => mergeBalanceSources(deferredTokensRaw as TChainTokens, ...Object.values(balanceOverrides)),
    [balanceOverrides, deferredTokensRaw]
  )
  const balances = useMemo(
    (): TNDict<TDict<TToken>> =>
      applyTokenListMetadataToBalances({
        balances: balancesWithOverrides as TYChainTokens,
        tokenLists
      }),
    [balancesWithOverrides, tokenLists]
  )
  const isBalancesPending = deferredTokensRaw !== visibleTokensRaw
  const hasVisibleBalances = hasWalletBalanceSnapshot(visibleTokensRaw)
  const isWalletLoading = shouldExposeWalletLoading({
    userAddress,
    hasVisibleBalances,
    isLoading,
    isBalancesPending
  })
  const hasCurrentBalanceLoadCompleted =
    !userAddress || (allTokens.length > 0 && isSuccess && !isLoading && !isBalancesPending)
  if (hasCurrentBalanceLoadCompleted) {
    hasCompletedInitialBalanceLoadRef.current = true
  }
  const hasCompletedBalanceLoad = !userAddress || hasCompletedInitialBalanceLoadRef.current
  const refreshSourcesRef = useRef({
    onUpdate,
    onUpdateSome,
    userAddress
  })
  refreshSourcesRef.current = {
    onUpdate,
    onUpdateSome,
    userAddress
  }

  const setBalanceOverride = useCallback((scopeId: string, nextBalances: TChainTokens): void => {
    setBalanceOverrides((currentOverrides) => ({
      ...currentOverrides,
      [scopeId]: nextBalances
    }))
  }, [])

  const registerBalanceOverrideRefresher = useCallback(
    (scopeId: string, refresher: TBalanceOverrideRefresher): void => {
      balanceOverrideRefreshersRef.current.set(scopeId, refresher)
    },
    []
  )

  const clearBalanceOverride = useCallback((scopeId: string): void => {
    balanceOverrideRefreshersRef.current.delete(scopeId)
    setBalanceOverrides((currentOverrides) => {
      if (!(scopeId in currentOverrides)) {
        return currentOverrides
      }
      return Object.fromEntries(Object.entries(currentOverrides).filter(([key]) => key !== scopeId))
    })
  }, [])

  const onRefresh = useCallback(
    async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TYChainTokens> => {
      const invalidateHoldingsQueries = async (): Promise<void> => {
        const { userAddress } = refreshSourcesRef.current
        if (!userAddress) {
          return
        }

        const normalizedUserAddress = userAddress.toLowerCase()
        await queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey as TFetchQueryKey | QueryKey
            if (!Array.isArray(queryKey) || queryKey[0] !== 'fetch' || typeof queryKey[1] !== 'string') {
              return false
            }

            const endpoint = queryKey[1]
            if (!endpoint.includes('/api/holdings/')) {
              return false
            }

            try {
              const url = new URL(endpoint, 'http://localhost')
              return url.searchParams.get('address')?.toLowerCase() === normalizedUserAddress
            } catch {
              return false
            }
          }
        })
      }

      if (isTenderlyModeEnabled()) {
        const { onUpdate } = refreshSourcesRef.current
        const overrideRefreshers = [...balanceOverrideRefreshersRef.current.values()]
        const [canonicalBalances, refreshedOverrides] = await Promise.all([
          onUpdate(tokenToUpdate === undefined),
          Promise.all(overrideRefreshers.map(async (refreshOverride) => await refreshOverride()))
        ])
        await invalidateHoldingsQueries()
        return mergeBalanceSources(canonicalBalances, ...refreshedOverrides) as TYChainTokens
      }

      if (tokenToUpdate) {
        const { onUpdateSome } = refreshSourcesRef.current
        const updatedBalances = await onUpdateSome(tokenToUpdate)
        await invalidateHoldingsQueries()
        return updatedBalances as TYChainTokens
      }
      const { onUpdate } = refreshSourcesRef.current
      const updatedBalances = await onUpdate(true)
      await invalidateHoldingsQueries()
      return updatedBalances as TYChainTokens
    },
    [queryClient]
  )

  /**************************************************************************
   ** Token cache persists during balance refetches (e.g., chain switches).
   ** This prevents the UI from flickering to DEFAULT_ERC20 temporarily.
   **************************************************************************/
  const tokenCache = useRef<TDict<TToken>>({})

  const getToken = useCallback(
    ({ address, chainID }: TTokenAndChain): TToken => {
      const cacheKey = `${userAddress || 'disconnected'}-${chainID || 1}-${address}`
      const token = balances?.[chainID || 1]?.[address]
      const canonicalToken = canonicalBalances?.[chainID || 1]?.[address]

      // Route-scoped overrides are returned to the active workflow but never persisted beyond its lifetime.
      if (token && token.address !== DEFAULT_ERC20.address) {
        if (canonicalToken && canonicalToken.address !== DEFAULT_ERC20.address) {
          tokenCache.current[cacheKey] = canonicalToken
        }
        return token
      }
      // If balances is empty (during refetch), return cached token if available
      return tokenCache.current[cacheKey] || getTokenListToken({ address, chainID })
    },
    [balances, canonicalBalances, userAddress, getTokenListToken]
  )

  /**************************************************************************
   ** getBalance is a safe retrieval of a balance from the balances state
   **************************************************************************/
  const getBalance = useCallback(
    ({ address, chainID }: TTokenAndChain): TNormalizedBN =>
      balances?.[chainID || 1]?.[address]?.balance || zeroNormalizedBN,
    [balances]
  )

  const shouldResolveStakingConversions = Boolean(userAddress && !isLoading && !isBalancesPending)

  const stakingConvertedAssets = useStakingAssetConversions({
    allVaults,
    getBalance,
    userAddress: shouldResolveStakingConversions ? userAddress : undefined
  })

  const getVaultHoldingsUsd = useCallback(
    (vault: TKongVaultInput): number =>
      getVaultHoldingsUsdValue(vault, getToken, getBalance, getPrice, {
        allVaults,
        stakingConvertedAssets
      }),
    [allVaults, getBalance, getPrice, getToken, stakingConvertedAssets]
  )

  /***************************************************************************
   **	Setup and render the Context provider to use in the app.
   ***************************************************************************/
  const tokensValue = useMemo(
    (): TWalletTokensContext => ({
      getToken,
      getBalance,
      balances
    }),
    [getBalance, getToken, balances]
  )
  const statusValue = useMemo(
    (): TWalletStatusContext => ({
      isLoading: isWalletLoading,
      hasCompletedBalanceLoad
    }),
    [hasCompletedBalanceLoad, isWalletLoading]
  )
  const holdingsValue = useMemo(
    (): TWalletHoldingsContext => ({
      getVaultHoldingsUsd
    }),
    [getVaultHoldingsUsd]
  )
  const actionsValue = useMemo(
    (): TWalletActionsContext => ({
      clearBalanceOverride,
      onRefresh,
      registerBalanceOverrideRefresher,
      setBalanceOverride
    }),
    [clearBalanceOverride, onRefresh, registerBalanceOverrideRefresher, setBalanceOverride]
  )

  return (
    <WalletActionsContext.Provider value={actionsValue}>
      <WalletStatusContext.Provider value={statusValue}>
        <WalletTokensContext.Provider value={tokensValue}>
          <WalletHoldingsContext.Provider value={holdingsValue}>{props.children}</WalletHoldingsContext.Provider>
        </WalletTokensContext.Provider>
      </WalletStatusContext.Provider>
    </WalletActionsContext.Provider>
  )
})

export const useWalletTokens = (): TWalletTokensContext => useContext(WalletTokensContext)
export const useWalletStatus = (): TWalletStatusContext => useContext(WalletStatusContext)
export const useWalletHoldings = (): TWalletHoldingsContext => useContext(WalletHoldingsContext)
export const useWalletActions = (): TWalletActionsContext => useContext(WalletActionsContext)
export const useWallet = (): TWalletContext => {
  const tokensValue = useWalletTokens()
  const statusValue = useWalletStatus()
  const holdingsValue = useWalletHoldings()
  const actionsValue = useWalletActions()

  return useMemo(
    (): TWalletContext => ({
      ...tokensValue,
      ...holdingsValue,
      ...statusValue,
      ...actionsValue
    }),
    [actionsValue, holdingsValue, statusValue, tokensValue]
  )
}
export default useWallet
