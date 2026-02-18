import { useDeepCompareMemo } from '@react-hookz/web'
import type { ReactElement } from 'react'
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { TUseBalancesTokens } from '../hooks/useBalances.multichains'
import { useBalancesCombined } from '../hooks/useBalancesCombined'
import { useBalancesWithQuery } from '../hooks/useBalancesWithQuery'
import { getVaultHoldingsUsdValue } from '../hooks/useVaultFilterUtils'
import type { TAddress, TChainTokens, TDict, TNDict, TNormalizedBN, TToken, TYChainTokens } from '../types'
import { DEFAULT_ERC20, isZeroAddress, toAddress, zeroNormalizedBN } from '../utils'
import type { TYDaemonVault } from '../utils/schemas/yDaemonVaultsSchemas'
import { useWeb3 } from './useWeb3'
import { useYearn } from './useYearn'
import { useYearnTokens } from './useYearn.helper'

const USE_ENSO_BALANCES = import.meta.env.VITE_BALANCE_SOURCE !== 'multicall'

type TTokenAndChain = { address: TAddress; chainID: number }
type TWalletContext = {
  getToken: ({ address, chainID }: TTokenAndChain) => TToken
  getBalance: ({ address, chainID }: TTokenAndChain) => TNormalizedBN
  balances: TChainTokens
  isLoading: boolean
  cumulatedValueInV2Vaults: number
  cumulatedValueInV3Vaults: number
  onRefresh: (
    tokenList?: TUseBalancesTokens[],
    shouldSaveInStorage?: boolean,
    shouldForceFetch?: boolean
  ) => Promise<TChainTokens>
}

const defaultProps = {
  getToken: (): TToken => DEFAULT_ERC20,
  getBalance: (): TNormalizedBN => zeroNormalizedBN,
  balances: {},
  isLoading: true,
  cumulatedValueInV2Vaults: 0,
  cumulatedValueInV3Vaults: 0,
  onRefresh: async (): Promise<TChainTokens> => ({})
}

/*******************************************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletContext = createContext<TWalletContext>(defaultProps)
export const WalletContextApp = memo(function WalletContextApp(props: {
  children: ReactElement
  shouldWorkOnTestnet?: boolean
}): ReactElement {
  const { allVaults, isLoadingVaultList, getPrice } = useYearn()
  const { address: userAddress } = useWeb3()

  const allTokens = useYearnTokens({
    vaults: allVaults,
    isLoadingVaultList,
    isEnabled: Boolean(userAddress)
  })
  const useBalancesHook = USE_ENSO_BALANCES ? useBalancesCombined : useBalancesWithQuery
  const {
    data: tokensRaw, // Expected to be TDict<TNormalizedBN | undefined>
    onUpdate,
    onUpdateSome,
    isLoading
  } = useBalancesHook({
    tokens: allTokens,
    priorityChainID: 1
  })
  const balances = useDeepCompareMemo((): TNDict<TDict<TToken>> => {
    const _tokens = { ...tokensRaw }

    return _tokens as TYChainTokens
  }, [tokensRaw])

  useEffect(() => {
    if (Object.keys(balances).length > 0) {
      console.log({ balances, source: USE_ENSO_BALANCES ? 'enso' : 'multicall' })
    }
  }, [balances])

  const onRefresh = useCallback(
    async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TYChainTokens> => {
      if (tokenToUpdate) {
        const updatedBalances = await onUpdateSome(tokenToUpdate)
        return updatedBalances as TYChainTokens
      }
      const updatedBalances = await onUpdate(true)
      return updatedBalances as TYChainTokens
    },
    [onUpdate, onUpdateSome]
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

      // If we have a valid token from balances, update the cache
      if (token && token.address !== DEFAULT_ERC20.address) {
        tokenCache.current[cacheKey] = token
        return token
      }
      // If balances is empty (during refetch), return cached token if available
      return tokenCache.current[cacheKey] || DEFAULT_ERC20
    },
    [balances, userAddress]
  )

  /**************************************************************************
   ** getBalance is a safe retrieval of a balance from the balances state
   **************************************************************************/
  const getBalance = useCallback(
    ({ address, chainID }: TTokenAndChain): TNormalizedBN =>
      balances?.[chainID || 1]?.[address]?.balance || zeroNormalizedBN,
    [balances]
  )

  const [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults] = useMemo((): [number, number] => {
    const stakingToVault = Object.entries(allVaults).reduce((acc, [vaultAddress, vault]) => {
      if (vault.staking?.address && !isZeroAddress(toAddress(vault.staking.address))) {
        acc.set(toAddress(vault.staking.address), vaultAddress)
      }
      return acc
    }, new Map<string, string>())

    const uniqueHoldingsVaults = Object.entries(balances)
      .flatMap(([, perChain]) => Object.keys(perChain))
      .map((tokenAddress) => {
        const normalizedAddress = toAddress(tokenAddress)
        const directVault = allVaults?.[normalizedAddress]
        if (directVault) {
          return directVault
        }
        const stakingVaultAddress = stakingToVault.get(normalizedAddress)
        if (!stakingVaultAddress) {
          return undefined
        }
        return allVaults?.[stakingVaultAddress]
      })
      .filter((vault): vault is TYDaemonVault => Boolean(vault))
      .reduce((acc, vault) => {
        const key = `${vault.chainID}/${toAddress(vault.address)}`
        acc.set(key, vault)
        return acc
      }, new Map<string, TYDaemonVault>())

    return Array.from(uniqueHoldingsVaults.values()).reduce(
      (acc, vault) => {
        const tokenValue = getVaultHoldingsUsdValue(vault, getToken, getBalance, getPrice)
        const isV3 = vault.version?.split('.')?.[0] === '3' || vault.version?.split('.')?.[0] === '~3'
        return isV3 ? [acc[0], acc[1] + tokenValue] : [acc[0] + tokenValue, acc[1]]
      },
      [0, 0] as [number, number]
    )
  }, [allVaults, balances, getBalance, getPrice, getToken])

  /***************************************************************************
   **	Setup and render the Context provider to use in the app.
   ***************************************************************************/
  const contextValue = useDeepCompareMemo(
    (): TWalletContext => ({
      getToken,
      getBalance,
      balances,
      isLoading: isLoading || false,
      onRefresh,
      cumulatedValueInV2Vaults,
      cumulatedValueInV3Vaults
    }),
    [getToken, getBalance, balances, isLoading, onRefresh, cumulatedValueInV2Vaults, cumulatedValueInV3Vaults]
  )

  return <WalletContext.Provider value={contextValue}>{props.children}</WalletContext.Provider>
})

export const useWallet = (): TWalletContext => useContext(WalletContext)
export default useWallet
