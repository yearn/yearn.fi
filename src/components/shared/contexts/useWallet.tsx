import {
  getVaultAddress,
  getVaultAPR,
  getVaultChainID,
  getVaultStaking,
  getVaultToken,
  getVaultVersion,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getCanonicalHoldingsVaultAddress } from '@pages/vaults/domain/normalizeVault'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { getYvUsdSharePrice, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useDeepCompareMemo } from '@react-hookz/web'
import type { ReactElement } from 'react'
import { createContext, memo, useCallback, useContext, useDeferredValue, useMemo, useRef } from 'react'
import type { TUseBalancesTokens } from '../hooks/useBalances.multichains'
import { useBalancesCombined } from '../hooks/useBalancesCombined'
import { useBalancesWithQuery } from '../hooks/useBalancesWithQuery'
import { useStakingAssetConversions } from '../hooks/useStakingAssetConversions'
import { getVaultHoldingsUsdValue } from '../hooks/useVaultFilterUtils'
import type { TAddress, TChainTokens, TDict, TNDict, TNormalizedBN, TToken, TYChainTokens } from '../types'
import { DEFAULT_ERC20, isZeroAddress, toAddress, zeroNormalizedBN } from '../utils'
import { useWeb3 } from './useWeb3'
import { useYearn } from './useYearn'
import { useYearnTokens } from './useYearn.helper'
import { useTokenList } from './WithTokenList'

const USE_ENSO_BALANCES = import.meta.env.VITE_BALANCE_SOURCE !== 'multicall'

type TTokenAndChain = { address: TAddress; chainID: number }

function getTrackedBalanceUsdValue({
  vault,
  tokenValue,
  balanceNormalized,
  getPrice
}: {
  vault: TKongVaultInput
  tokenValue?: number
  balanceNormalized: number
  getPrice: ReturnType<typeof useYearn>['getPrice']
}): number {
  if (Number.isFinite(tokenValue) && (tokenValue || 0) > 0) {
    return tokenValue || 0
  }

  if (!Number.isFinite(balanceNormalized) || balanceNormalized <= 0) {
    return 0
  }

  const chainID = getVaultChainID(vault)
  const sharePriceUsd = getPrice({ address: getVaultAddress(vault), chainID }).normalized
  if (sharePriceUsd > 0) {
    return balanceNormalized * sharePriceUsd
  }

  const assetToken = getVaultToken(vault)
  const assetPrice = getPrice({ address: assetToken.address, chainID }).normalized
  const pricePerShare = getVaultAPR(vault).pricePerShare.today
  if (assetPrice > 0 && pricePerShare > 0) {
    return balanceNormalized * assetPrice * pricePerShare
  }

  return 0
}

type TWalletContext = {
  getToken: ({ address, chainID }: TTokenAndChain) => TToken
  getBalance: ({ address, chainID }: TTokenAndChain) => TNormalizedBN
  getVaultHoldingsUsd: (vault: TKongVaultInput) => number
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
  getVaultHoldingsUsd: (): number => 0,
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
  const { vaults, allVaults, isLoadingVaultList, getPrice } = useYearn()
  const { unlockedVault: yvUsdUnlockedVault, lockedVault: yvUsdLockedVault } = useYvUsdVaults()
  const { address: userAddress } = useWeb3()

  const allTokens = useYearnTokens({
    vaults: allVaults,
    catalogVaults: vaults,
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
  /**************************************************************************
   ** Balance queries stream updates across multiple chains. Deferring the
   ** rendered snapshot keeps vault-list interactions responsive while the
   ** wallet settles.
   **************************************************************************/
  const deferredTokensRaw = useDeferredValue(tokensRaw)
  const balances = useDeepCompareMemo((): TNDict<TDict<TToken>> => {
    const _tokens = { ...deferredTokensRaw }

    return _tokens as TYChainTokens
  }, [deferredTokensRaw])
  const isBalancesPending = deferredTokensRaw !== tokensRaw

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
    [balances, userAddress, getTokenListToken]
  )

  /**************************************************************************
   ** getBalance is a safe retrieval of a balance from the balances state
   **************************************************************************/
  const getBalance = useCallback(
    ({ address, chainID }: TTokenAndChain): TNormalizedBN =>
      balances?.[chainID || 1]?.[address]?.balance || zeroNormalizedBN,
    [balances]
  )

  const yvUsdUnlockedSharePrice = getYvUsdSharePrice(yvUsdUnlockedVault)
  const yvUsdLockedSharePrice = getYvUsdSharePrice(yvUsdLockedVault)

  const stakingConvertedAssets = useStakingAssetConversions({
    allVaults,
    getBalance,
    userAddress
  })

  const getVaultHoldingsUsd = useCallback(
    (vault: TKongVaultInput): number =>
      getVaultHoldingsUsdValue(vault, getToken, getBalance, getPrice, {
        allVaults,
        stakingConvertedAssets
      }),
    [allVaults, getBalance, getPrice, getToken, stakingConvertedAssets]
  )

  const [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults] = useMemo((): [number, number] => {
    // Build staking address → vault address lookup
    const stakingToVault = new Map<string, string>()
    for (const [vaultAddress, vault] of Object.entries(allVaults)) {
      const staking = getVaultStaking(vault)
      if (!isZeroAddress(toAddress(staking.address))) {
        stakingToVault.set(toAddress(staking.address), vaultAddress)
      }
    }

    let cumulatedValueInV2Vaults = 0
    let cumulatedValueInV3Vaults = 0
    const countedVaults = new Set<string>()

    for (const [_chainId, perChain] of Object.entries(balances)) {
      for (const [tokenAddress, tokenData] of Object.entries(perChain)) {
        const normalizedAddress = toAddress(tokenAddress)
        const canonicalAddress = getCanonicalHoldingsVaultAddress(normalizedAddress)

        if (normalizedAddress === YVUSD_UNLOCKED_ADDRESS || normalizedAddress === YVUSD_LOCKED_ADDRESS) {
          const sharePrice =
            normalizedAddress === YVUSD_UNLOCKED_ADDRESS ? yvUsdUnlockedSharePrice : yvUsdLockedSharePrice
          const tokenValue = tokenData.value || tokenData.balance.normalized * sharePrice
          cumulatedValueInV3Vaults += tokenValue
          continue
        }

        // Resolve vault details (direct vault or via staking lookup)
        let vaultDetails = allVaults?.[canonicalAddress]
        if (!vaultDetails && stakingToVault.has(canonicalAddress)) {
          vaultDetails = allVaults?.[stakingToVault.get(canonicalAddress)!]
        }
        if (!vaultDetails && stakingToVault.has(normalizedAddress)) {
          vaultDetails = allVaults?.[stakingToVault.get(normalizedAddress)!]
        }

        if (!vaultDetails) continue
        const vaultKey = `${getVaultChainID(vaultDetails)}/${toAddress(getVaultAddress(vaultDetails))}`
        if (countedVaults.has(vaultKey)) continue
        countedVaults.add(vaultKey)

        const tokenValue = getTrackedBalanceUsdValue({
          vault: vaultDetails,
          tokenValue: tokenData.value,
          balanceNormalized: tokenData.balance.normalized,
          getPrice
        })
        const vaultVersion = getVaultVersion(vaultDetails)
        const isV3 = vaultVersion.startsWith('3') || vaultVersion.startsWith('~3')

        if (isV3) {
          cumulatedValueInV3Vaults += tokenValue
        } else {
          cumulatedValueInV2Vaults += tokenValue
        }
      }
    }
    return [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults]
  }, [allVaults, balances, getPrice, yvUsdLockedSharePrice, yvUsdUnlockedSharePrice])

  /***************************************************************************
   **	Setup and render the Context provider to use in the app.
   ***************************************************************************/
  const contextValue = useDeepCompareMemo(
    (): TWalletContext => ({
      getToken,
      getBalance,
      getVaultHoldingsUsd,
      balances,
      isLoading: isLoading || isBalancesPending,
      onRefresh,
      cumulatedValueInV2Vaults,
      cumulatedValueInV3Vaults
    }),
    [
      getToken,
      getBalance,
      getVaultHoldingsUsd,
      balances,
      isLoading,
      isBalancesPending,
      onRefresh,
      cumulatedValueInV2Vaults,
      cumulatedValueInV3Vaults
    ]
  )

  return <WalletContext.Provider value={contextValue}>{props.children}</WalletContext.Provider>
})

export const useWallet = (): TWalletContext => useContext(WalletContext)
export default useWallet
