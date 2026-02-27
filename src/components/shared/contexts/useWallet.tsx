import {
  getVaultAddress,
  getVaultChainID,
  getVaultDecimals,
  getVaultStaking,
  getVaultVersion,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { getVaultSharePriceUsd } from '@pages/vaults/utils/holdingsValue'
import { useDeepCompareMemo } from '@react-hookz/web'
import type { ReactElement } from 'react'
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { TUseBalancesTokens } from '../hooks/useBalances.multichains'
import { useBalancesCombined } from '../hooks/useBalancesCombined'
import { useBalancesWithQuery } from '../hooks/useBalancesWithQuery'
import type { TAddress, TChainTokens, TDict, TNDict, TNormalizedBN, TToken, TYChainTokens } from '../types'
import { DEFAULT_ERC20, isZeroAddress, toAddress, toNormalizedBN, zeroNormalizedBN } from '../utils'
import { useWeb3 } from './useWeb3'
import { useYearn } from './useYearn'
import { useYearnTokens } from './useYearn.helper'
import { useTokenList } from './WithTokenList'

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
  const { vaults, isLoadingVaultList, getPrice } = useYearn()
  const { address: userAddress } = useWeb3()

  const allTokens = useYearnTokens({
    vaults,
    isLoadingVaultList,
    isEnabled: Boolean(userAddress)
  })

  const { getToken: getTokenListToken } = useTokenList()

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
      return tokenCache.current[cacheKey] || getTokenListToken({ address, chainID })
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
    const vaultByAddress = new Map<string, TKongVault>()
    const stakingToVault = new Map<string, TKongVault>()

    for (const vault of Object.values(vaults)) {
      const chainId = getVaultChainID(vault)
      const vaultAddress = toAddress(getVaultAddress(vault))
      vaultByAddress.set(`${chainId}:${vaultAddress}`, vault as TKongVault)

      const staking = getVaultStaking(vault)
      if (staking.address && !isZeroAddress(staking.address)) {
        stakingToVault.set(`${chainId}:${toAddress(staking.address)}`, vault as TKongVault)
      }
    }

    let cumulatedValueInV2Vaults = 0
    let cumulatedValueInV3Vaults = 0

    for (const [chainIdKey, perChain] of Object.entries(balances)) {
      const parsedChainId = Number(chainIdKey)
      if (!Number.isFinite(parsedChainId)) {
        continue
      }

      for (const [tokenAddress, tokenData] of Object.entries(perChain || {})) {
        const rawBalance = tokenData?.balance?.raw ?? 0n
        if (rawBalance <= 0n) {
          continue
        }

        const key = `${parsedChainId}:${toAddress(tokenAddress)}`

        // Staking mapping takes precedence when an address is both a vault token and a staking token.
        const vault = stakingToVault.get(key) ?? vaultByAddress.get(key)
        if (!vault) {
          continue
        }

        const vaultDecimals = getVaultDecimals(vault)
        const sharePriceUsd = getVaultSharePriceUsd(vault, getPrice)
        if (!Number.isFinite(sharePriceUsd) || sharePriceUsd <= 0) {
          continue
        }

        const tokenValue = toNormalizedBN(rawBalance, vaultDecimals).normalized * sharePriceUsd
        if (!Number.isFinite(tokenValue) || tokenValue <= 0) {
          continue
        }

        const version = getVaultVersion(vault)
        const isV3 = version.split('.')?.[0] === '3' || version.split('.')?.[0] === '~3'
        if (isV3) {
          cumulatedValueInV3Vaults += tokenValue
        } else {
          cumulatedValueInV2Vaults += tokenValue
        }
      }
    }

    return [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults]
  }, [vaults, balances, getPrice])

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
