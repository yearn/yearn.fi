import { isPortfolioDustValueVisible } from '@pages/portfolio/hooks/portfolioVisibility'
import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultStaking,
  getVaultVersion
} from '@pages/vaults/domain/kongVaultSelectors'
import { getCanonicalHoldingsVaultAddress } from '@pages/vaults/domain/normalizeVault'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { getYvUsdSharePrice, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useWalletHoldings, useWalletStatus, useWalletTokens } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import { isZeroAddress, toAddress } from '@shared/utils'
import { createContext, createElement, type ReactNode, useContext, useMemo } from 'react'

type TWalletVaultTotals = {
  cumulatedValueInV2Vaults: number
  cumulatedValueInV3Vaults: number
  totalValue: number
  isLoading: boolean
}

const WalletVaultTotalsContext = createContext<TWalletVaultTotals>({
  cumulatedValueInV2Vaults: 0,
  cumulatedValueInV3Vaults: 0,
  totalValue: 0,
  isLoading: true
})

export const useWalletVaultTotals = (): TWalletVaultTotals => useContext(WalletVaultTotalsContext)

export function WalletVaultTotalsProvider({ children }: { children: ReactNode }) {
  const { allVaults, isLoadingVaultList } = useYearn()
  const { isLoading: isWalletLoading } = useWalletStatus()
  const isLoading = Boolean(isWalletLoading || (isLoadingVaultList && Object.keys(allVaults).length === 0))
  const { balances } = useWalletTokens()
  const { getVaultHoldingsUsd } = useWalletHoldings()
  const { unlockedVault: yvUsdUnlockedVault, lockedVault: yvUsdLockedVault } = useYvUsdVaults()
  const { shouldHideDust } = useAppSettings()
  const yvUsdUnlockedSharePrice = getYvUsdSharePrice(yvUsdUnlockedVault)
  const yvUsdLockedSharePrice = getYvUsdSharePrice(yvUsdLockedVault)

  const stakingToVault = useMemo(
    () =>
      new Map(
        Object.entries(allVaults).flatMap(([vaultAddress, vault]) => {
          const stakingAddress = toAddress(getVaultStaking(vault).address)
          return isZeroAddress(stakingAddress) ? [] : [[stakingAddress, vaultAddress] as const]
        })
      ),
    [allVaults]
  )

  const [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults] = useMemo(() => {
    const countedVaults = new Set<string>()
    return Object.values(balances).reduce<[number, number]>(
      (totals, perChain) =>
        Object.entries(perChain || {}).reduce<[number, number]>((values, [tokenAddress, tokenData]) => {
          const normalizedAddress = toAddress(tokenAddress)
          const canonicalAddress = getCanonicalHoldingsVaultAddress(normalizedAddress)
          if (normalizedAddress === YVUSD_UNLOCKED_ADDRESS || normalizedAddress === YVUSD_LOCKED_ADDRESS) {
            const sharePrice =
              normalizedAddress === YVUSD_UNLOCKED_ADDRESS ? yvUsdUnlockedSharePrice : yvUsdLockedSharePrice
            const tokenValue = tokenData.value || tokenData.balance.normalized * sharePrice
            return isPortfolioDustValueVisible(tokenValue, shouldHideDust)
              ? [values[0], values[1] + tokenValue]
              : values
          }

          const vaultDetails =
            allVaults[canonicalAddress] ??
            allVaults[stakingToVault.get(canonicalAddress) ?? ''] ??
            allVaults[stakingToVault.get(normalizedAddress) ?? '']
          if (!vaultDetails || getVaultInfo(vaultDetails).isHidden) return values
          const vaultKey = `${getVaultChainID(vaultDetails)}/${toAddress(getVaultAddress(vaultDetails))}`
          if (countedVaults.has(vaultKey)) return values
          countedVaults.add(vaultKey)
          const tokenValue = getVaultHoldingsUsd(vaultDetails)
          if (!isPortfolioDustValueVisible(tokenValue, shouldHideDust)) return values
          const version = getVaultVersion(vaultDetails)
          return version.startsWith('3') || version.startsWith('~3')
            ? [values[0], values[1] + tokenValue]
            : [values[0] + tokenValue, values[1]]
        }, totals),
      [0, 0]
    )
  }, [
    allVaults,
    balances,
    getVaultHoldingsUsd,
    shouldHideDust,
    stakingToVault,
    yvUsdLockedSharePrice,
    yvUsdUnlockedSharePrice
  ])

  const value = useMemo(
    () => ({
      cumulatedValueInV2Vaults,
      cumulatedValueInV3Vaults,
      totalValue: cumulatedValueInV2Vaults + cumulatedValueInV3Vaults,
      isLoading
    }),
    [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults, isLoading]
  )

  return createElement(WalletVaultTotalsContext.Provider, { value }, children)
}
