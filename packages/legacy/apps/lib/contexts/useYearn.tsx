import { useFetchYearnEarnedForUser } from '@lib/hooks/useFetchYearnEarnedForUser'
import { useFetchYearnPrices } from '@lib/hooks/useFetchYearnPrices'
import { useFetchYearnVaults } from '@lib/hooks/useFetchYearnVaults'
import type { TAddress, TDict, TNormalizedBN } from '@lib/types'
import { toAddress, toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import type { TYDaemonEarned } from '@lib/utils/schemas/yDaemonEarnedSchema'
import type { TYDaemonPricesChain } from '@lib/utils/schemas/yDaemonPricesSchema'
import type { TYDaemonVault, TYDaemonVaults } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useLocalStorageValue } from '@react-hookz/web'
import { Solver, type TSolver } from '@vaults-v2/types/solvers'
import type { ReactElement } from 'react'
import { createContext, memo, useCallback, useContext, useMemo } from 'react'
import type { KeyedMutator } from 'swr'
import { deserialize, serialize } from 'wagmi'

export const DEFAULT_SLIPPAGE = 0.5
export const DEFAULT_MAX_LOSS = 1n

type TTokenAndChain = { address: TAddress; chainID: number }
export type TYearnContext = {
  currentPartner: TAddress
  earned?: TYDaemonEarned
  prices?: TYDaemonPricesChain
  vaults: TDict<TYDaemonVault>
  vaultsMigrations: TDict<TYDaemonVault>
  vaultsRetired: TDict<TYDaemonVault>
  isLoadingVaultList: boolean
  zapSlippage: number
  maxLoss: bigint
  zapProvider: TSolver
  isAutoStakingEnabled: boolean
  mutateVaultList: KeyedMutator<TYDaemonVaults>
  setMaxLoss: (value: bigint) => void
  setZapSlippage: (value: number) => void
  setZapProvider: (value: TSolver) => void
  setIsAutoStakingEnabled: (value: boolean) => void
  //
  //Price context
  getPrice: ({ address, chainID }: TTokenAndChain) => TNormalizedBN
}

const YearnContext = createContext<TYearnContext>({
  currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
  earned: {
    earned: {},
    totalRealizedGainsUSD: 0,
    totalUnrealizedGainsUSD: 0
  },
  prices: {},
  vaults: {},
  vaultsMigrations: {},
  vaultsRetired: {},
  isLoadingVaultList: false,
  maxLoss: DEFAULT_MAX_LOSS,
  zapSlippage: 0.1,
  zapProvider: Solver.enum.Cowswap,
  isAutoStakingEnabled: true,
  mutateVaultList: (): Promise<TYDaemonVaults> => Promise.resolve([]),
  setMaxLoss: (): void => undefined,
  setZapSlippage: (): void => undefined,
  setZapProvider: (): void => undefined,
  setIsAutoStakingEnabled: (): void => undefined,

  //Price context
  getPrice: (): TNormalizedBN => zeroNormalizedBN
})

export const YearnContextApp = memo(function YearnContextApp({ children }: { children: ReactElement }): ReactElement {
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

  const prices = useFetchYearnPrices()
  const earned = useFetchYearnEarnedForUser()
  const { vaults: rawVaults, vaultsMigrations, vaultsRetired, isLoading, mutate } = useFetchYearnVaults()

  const vaults = useMemo(() => {
    const vaults: TDict<TYDaemonVault> = {}
    for (const vault of Object.values(rawVaults)) {
      vaults[toAddress(vault.address)] = { ...vault }
    }
    return vaults
  }, [rawVaults])

  const getPrice = useCallback(
    ({ address, chainID }: TTokenAndChain): TNormalizedBN => {
      return toNormalizedBN(prices?.[chainID]?.[address] || 0, 6) || zeroNormalizedBN
    },
    [prices]
  )

  return (
    <YearnContext.Provider
      value={{
        currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
        prices,
        earned,
        zapSlippage: zapSlippage ?? DEFAULT_SLIPPAGE,
        maxLoss: maxLoss ?? DEFAULT_MAX_LOSS,
        zapProvider: zapProvider ?? Solver.enum.Cowswap,
        isAutoStakingEnabled: isAutoStakingEnabled ?? true,
        setZapSlippage,
        setMaxLoss,
        setZapProvider,
        setIsAutoStakingEnabled,
        vaults,
        vaultsMigrations,
        vaultsRetired,
        isLoadingVaultList: isLoading,
        mutateVaultList: mutate,
        getPrice
      }}
    >
      {children}
    </YearnContext.Provider>
  )
})

export const useYearn = (): TYearnContext => useContext(YearnContext)
