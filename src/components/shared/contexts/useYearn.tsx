import { Solver, type TSolver } from '@pages/vaults/types/solvers'
import { useLocalStorageValue } from '@react-hookz/web'
import { useFetchYearnPrices } from '@shared/hooks/useFetchYearnPrices'
import { useFetchYearnVaults } from '@shared/hooks/useFetchYearnVaults'
import { type TKatanaAprs, useKatanaAprs } from '@shared/hooks/useKatanaAprs'
import type { TAddress, TDict, TNormalizedBN } from '@shared/types'
import { toAddress, toNormalizedBN, zeroNormalizedBN } from '@shared/utils'
import type { TKongVaultList } from '@shared/utils/schemas/kongVaultListSchema'
import type { TYDaemonEarned } from '@shared/utils/schemas/yDaemonEarnedSchema'
import type { TYDaemonPricesChain } from '@shared/utils/schemas/yDaemonPricesSchema'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { QueryObserverResult } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { createContext, memo, useCallback, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { deserialize, serialize } from 'wagmi'

export const DEFAULT_SLIPPAGE = 0.5
export const DEFAULT_MAX_LOSS = 1n

type TTokenAndChain = { address: TAddress; chainID: number }
export type TYearnContext = {
  currentPartner: TAddress
  earned?: TYDaemonEarned
  prices?: TYDaemonPricesChain
  vaults: TDict<TYDaemonVault>
  isLoadingVaultList: boolean
  katanaAprs: Partial<TKatanaAprs>
  isLoadingKatanaAprs: boolean
  zapSlippage: number
  maxLoss: bigint
  zapProvider: TSolver
  isAutoStakingEnabled: boolean
  mutateVaultList: () => Promise<QueryObserverResult<TKongVaultList, Error>>
  enableVaultListFetch: () => void
  setMaxLoss: (value: bigint) => void
  setZapSlippage: (value: number) => void
  setZapProvider: (value: TSolver) => void
  setIsAutoStakingEnabled: (value: boolean) => void
  //
  //Price context
  getPrice: ({ address, chainID }: TTokenAndChain) => TNormalizedBN
}

const YearnContext = createContext<TYearnContext>({
  currentPartner: toAddress(import.meta.env.VITE_PARTNER_ID_ADDRESS),
  earned: {
    earned: {},
    totalRealizedGainsUSD: 0,
    totalUnrealizedGainsUSD: 0
  },
  prices: {},
  vaults: {},
  isLoadingVaultList: false,
  katanaAprs: {},
  isLoadingKatanaAprs: false,
  maxLoss: DEFAULT_MAX_LOSS,
  zapSlippage: 0.1,
  zapProvider: Solver.enum.Cowswap,
  isAutoStakingEnabled: true,
  mutateVaultList: (): Promise<QueryObserverResult<TKongVaultList, Error>> =>
    Promise.resolve({} as QueryObserverResult<TKongVaultList, Error>),
  enableVaultListFetch: (): void => undefined,
  setMaxLoss: (): void => undefined,
  setZapSlippage: (): void => undefined,
  setZapProvider: (): void => undefined,
  setIsAutoStakingEnabled: (): void => undefined,

  //Price context
  getPrice: (): TNormalizedBN => zeroNormalizedBN
})

export const YearnContextApp = memo(function YearnContextApp({ children }: { children: ReactElement }): ReactElement {
  const location = useLocation()
  const { value: maxLoss, set: setMaxLoss } = useLocalStorageValue<bigint>('yearn.fi/max-loss', {
    defaultValue: DEFAULT_MAX_LOSS,
    parse: (str, fallback): bigint => (str ? deserialize(str) : (fallback ?? DEFAULT_MAX_LOSS)),
    stringify: (data: bigint): string => serialize(data)
  })
  const { value: zapSlippage, set: setZapSlippage } = useLocalStorageValue<number>('yearn.fi/zap-slippage', {
    defaultValue: DEFAULT_SLIPPAGE
  })
  const { value: zapProvider, set: setZapProvider } = useLocalStorageValue<TSolver>('yearn.fi/zap-provider', {
    defaultValue: Solver.enum.Cowswap
  })
  const { value: isAutoStakingEnabled, set: setIsAutoStakingEnabled } = useLocalStorageValue<boolean>(
    'yearn.fi/staking-op-boosted-vaults',
    {
      defaultValue: true
    }
  )

  const isVaultsRoute = location.pathname.startsWith('/vaults')
  const isVaultDetailPage = isVaultsRoute && location.pathname.split('/').length === 4
  const isPortfolioRoute = location.pathname.startsWith('/portfolio')
  const shouldEnableVaultList = (isVaultsRoute && !isVaultDetailPage) || isPortfolioRoute
  const [isVaultListEnabled, setIsVaultListEnabled] = useState(shouldEnableVaultList)

  useEffect(() => {
    if (shouldEnableVaultList) {
      setIsVaultListEnabled(true)
    }
  }, [shouldEnableVaultList])

  const enableVaultListFetch = useCallback(() => {
    setIsVaultListEnabled(true)
  }, [])

  const prices = useFetchYearnPrices()
  //RG this endpoint returns empty objects for retired and migrations
  const { vaults, isLoading, refetch } = useFetchYearnVaults(undefined, {
    enabled: isVaultListEnabled
  })
  const { data: katanaAprs, isLoading: isLoadingKatanaAprs } = useKatanaAprs()

  const getPrice = useCallback(
    ({ address, chainID }: TTokenAndChain): TNormalizedBN => {
      return toNormalizedBN(prices?.[chainID]?.[address] || 0, 6) || zeroNormalizedBN
    },
    [prices]
  )

  return (
    <YearnContext.Provider
      value={{
        currentPartner: toAddress(import.meta.env.VITE_PARTNER_ID_ADDRESS),
        prices,
        zapSlippage: zapSlippage ?? DEFAULT_SLIPPAGE,
        maxLoss: maxLoss ?? DEFAULT_MAX_LOSS,
        zapProvider: zapProvider ?? Solver.enum.Cowswap,
        isAutoStakingEnabled: isAutoStakingEnabled ?? true,
        setZapSlippage,
        setMaxLoss,
        setZapProvider,
        setIsAutoStakingEnabled,
        vaults,
        isLoadingVaultList: isLoading,
        katanaAprs,
        isLoadingKatanaAprs,
        mutateVaultList: refetch,
        enableVaultListFetch,
        getPrice
      }}
    >
      {children}
    </YearnContext.Provider>
  )
})

export const useYearn = (): TYearnContext => useContext(YearnContext)
