import { isPortfolioDustValueVisible } from '@pages/portfolio/hooks/portfolioVisibility'
import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultStaking,
  getVaultVersion
} from '@pages/vaults/domain/kongVaultSelectors'
import { getCanonicalHoldingsVaultAddress } from '@pages/vaults/domain/normalizeVault'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { getYvUsdSharePrice, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useMemo } from 'react'
import { isZeroAddress, toAddress } from '../utils'
import { useWallet } from './useWallet'
import { useYearn } from './useYearn'

type TWalletVaultTotals = {
  cumulatedValueInV2Vaults: number
  cumulatedValueInV3Vaults: number
  totalValue: number
}

export function useWalletVaultTotals(): TWalletVaultTotals {
  const { allVaults } = useYearn()
  const { balances, getVaultHoldingsUsd } = useWallet()
  const { unlockedVault: yvUsdUnlockedVault, lockedVault: yvUsdLockedVault } = useYvUsdVaults()
  const { shouldHideDust } = useAppSettings()
  const yvUsdUnlockedSharePrice = getYvUsdSharePrice(yvUsdUnlockedVault)
  const yvUsdLockedSharePrice = getYvUsdSharePrice(yvUsdLockedVault)

  const stakingToVault = useMemo(() => {
    const map = new Map<string, string>()
    for (const [vaultAddress, vault] of Object.entries(allVaults)) {
      const staking = getVaultStaking(vault)
      if (!isZeroAddress(toAddress(staking.address))) {
        map.set(toAddress(staking.address), vaultAddress)
      }
    }
    return map
  }, [allVaults])

  const [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults] = useMemo((): [number, number] => {
    let cumulatedValueInV2Vaults = 0
    let cumulatedValueInV3Vaults = 0
    const countedVaults = new Set<string>()

    for (const perChain of Object.values(balances)) {
      for (const [tokenAddress, tokenData] of Object.entries(perChain || {})) {
        const normalizedAddress = toAddress(tokenAddress)
        const canonicalAddress = getCanonicalHoldingsVaultAddress(normalizedAddress)

        if (normalizedAddress === YVUSD_UNLOCKED_ADDRESS || normalizedAddress === YVUSD_LOCKED_ADDRESS) {
          const sharePrice =
            normalizedAddress === YVUSD_UNLOCKED_ADDRESS ? yvUsdUnlockedSharePrice : yvUsdLockedSharePrice
          const tokenValue = tokenData.value || tokenData.balance.normalized * sharePrice
          if (!isPortfolioDustValueVisible(tokenValue, shouldHideDust)) {
            continue
          }
          cumulatedValueInV3Vaults += tokenValue
          continue
        }

        let vaultDetails = allVaults?.[canonicalAddress]
        if (!vaultDetails && stakingToVault.has(canonicalAddress)) {
          vaultDetails = allVaults?.[stakingToVault.get(canonicalAddress)!]
        }
        if (!vaultDetails && stakingToVault.has(normalizedAddress)) {
          vaultDetails = allVaults?.[stakingToVault.get(normalizedAddress)!]
        }

        if (!vaultDetails) {
          continue
        }
        const vaultKey = `${getVaultChainID(vaultDetails)}/${toAddress(getVaultAddress(vaultDetails))}`
        if (countedVaults.has(vaultKey)) {
          continue
        }
        countedVaults.add(vaultKey)

        const tokenValue = getVaultHoldingsUsd(vaultDetails)
        if (!isPortfolioDustValueVisible(tokenValue, shouldHideDust)) {
          continue
        }
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
  }, [
    allVaults,
    balances,
    getVaultHoldingsUsd,
    shouldHideDust,
    stakingToVault,
    yvUsdLockedSharePrice,
    yvUsdUnlockedSharePrice
  ])

  return useMemo(
    () => ({
      cumulatedValueInV2Vaults,
      cumulatedValueInV3Vaults,
      totalValue: cumulatedValueInV2Vaults + cumulatedValueInV3Vaults
    }),
    [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults]
  )
}
