import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import type { TDict } from '@lib/types'
import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { isAutomatedVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useAppSettings } from '@vaults-v2/contexts/useAppSettings'
import { useCallback } from 'react'

export function useFilteredVaults(
  vaultMap: TDict<TYDaemonVault>,
  condition: (v: TYDaemonVault) => boolean
): TYDaemonVault[] {
  return useDeepCompareMemo(
    (): TYDaemonVault[] => Object.values(vaultMap).filter((vault): boolean => condition(vault)),
    [vaultMap, condition]
  )
}

export function useVaultFilter(
  categories: string[] | null,
  _chains: number[] | null,
  v3?: boolean
): {
  activeVaults: TYDaemonVault[]
  retiredVaults: TYDaemonVault[]
  migratableVaults: TYDaemonVault[]
} {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()

  const filterHoldingsCallback = useCallback(
    (vault: TYDaemonVault, isFactoryOnly: boolean, isForV3: boolean): boolean => {
      if (isForV3 && !vault.version?.startsWith('3') && !vault.version?.startsWith('~3')) {
        return false
      }
      if (!isForV3 && vault.version?.startsWith('3') && !vault.version?.startsWith('~3')) {
        return false
      }
      const vaultBalance = getBalance({ address: vault.address, chainID: vault.chainID })
      const vaultPrice = getPrice({ address: vault.address, chainID: vault.chainID })

      // Check the staking balance
      if (vault.staking.available) {
        const stakingBalance = getBalance({
          address: vault.staking.address,
          chainID: vault.chainID
        })
        const hasValidStakedBalance = stakingBalance.raw > 0n
        const stakedBalanceValue = Number(stakingBalance.normalized) * vaultPrice.normalized
        if (hasValidStakedBalance && !(shouldHideDust && stakedBalanceValue < 0.01)) {
          return true
        }
      }

      const hasValidBalance = vaultBalance.raw > 0n
      const balanceValue = vaultBalance.normalized * vaultPrice.normalized
      if (shouldHideDust && balanceValue < 0.01) {
        return false
      }
      if (hasValidBalance) {
        if (isFactoryOnly) {
          if (vault.category === 'Curve' && isAutomatedVault(vault)) {
            return true
          }
          return false
        }
        return true
      }
      return false
    },
    [shouldHideDust, getBalance, getPrice]
  )

  const filterMigrationCallback = useCallback(
    (vault: TYDaemonVault): boolean => {
      const isV3Vault = vault.version?.startsWith('3') || vault.version?.startsWith('~3')
      if ((v3 && !isV3Vault) || (!v3 && isV3Vault)) {
        return false
      }

      const vaultBalance = getBalance({ address: vault.address, chainID: vault.chainID })
      if (vault.staking.available) {
        const stakingBalance = getBalance({
          address: vault.staking.address,
          chainID: vault.chainID
        })
        const hasValidStakedBalance = stakingBalance.raw > 0n
        if (hasValidStakedBalance) {
          return true
        }
      }

      const hasValidBalance = vaultBalance.raw > 0n
      if (hasValidBalance) {
        return true
      }
      return false
    },
    [getBalance, v3]
  )

  // Specific filter
  const highlightedVaults = useFilteredVaults(vaults, ({ info }): boolean => info.isHighlighted)
  const holdingsVaults = useFilteredVaults(vaults, (vault): boolean =>
    filterHoldingsCallback(vault, false, false)
  )
  const holdingsV3Vaults = useFilteredVaults(vaults, (vault): boolean =>
    filterHoldingsCallback(vault, false, true)
  )

  // V3 Filtered Vaults
  const singleVaults = useFilteredVaults(
    vaults,
    ({ version, kind }): boolean =>
      ((version || '')?.split('.')?.[0] === '3' && kind === 'Single Strategy') ||
      ((version || '')?.split('.')?.[0] === '~3' && kind === 'Single Strategy')
  )
  const MultiVaults = useFilteredVaults(
    vaults,
    ({ version, kind }): boolean =>
      ((version || '')?.split('.')?.[0] === '3' && kind === 'Multi Strategy') ||
      ((version || '')?.split('.')?.[0] === '~3' && kind === 'Multi Strategy')
  )

  //V2 Filtered Vaults
  const boostedVaults = useFilteredVaults(vaults, ({ apr }) => apr.extra.stakingRewardsAPR > 0)
  const curveVaults = useFilteredVaults(vaults, ({ category }) => category === 'Curve')
  const prismaVaults = useFilteredVaults(vaults, ({ category }) => category === 'Prisma')
  const velodromeVaults = useFilteredVaults(vaults, ({ category }) => category === 'Velodrome')
  const aerodromeVaults = useFilteredVaults(vaults, ({ category }) => category === 'Aerodrome')
  const stablesVaults = useFilteredVaults(vaults, ({ category }) => category === 'Stablecoin')
  const balancerVaults = useFilteredVaults(vaults, ({ category }) => category === 'Balancer')
  const cryptoVaults = useFilteredVaults(vaults, ({ category }) => category === 'Volatile')
  const curveFactoryVaults = useFilteredVaults(
    vaults,
    vault => vault.category === 'Curve' && isAutomatedVault(vault)
  )
  const migratableVaults = useFilteredVaults(vaultsMigrations, v => filterMigrationCallback(v))
  const retiredVaults = useFilteredVaults(vaultsRetired, v => filterMigrationCallback(v))

  /* 🔵 - Yearn Finance **************************************************************************
   **	First, we need to determine in which category we are. The activeVaults function will
   **	decide which vaults to display based on the category. No extra filters are applied.
   **	The possible lists are memoized to avoid unnecessary re-renders.
   **********************************************************************************************/
  const activeVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    let _vaultList: TYDaemonVault[] = []
    if (v3) {
      if (categories?.includes('highlight')) {
        _vaultList = [..._vaultList, ...highlightedVaults]
      }
      if (categories?.includes('single')) {
        _vaultList = [..._vaultList, ...singleVaults]
      }
      if (categories?.includes('multi')) {
        _vaultList = [..._vaultList, ...MultiVaults]
      }

      //Remove duplicates
      const alreadyInList: TDict<boolean> = {}
      const noDuplicateVaultList = []
      for (const vault of holdingsV3Vaults) {
        if (!alreadyInList[`${toAddress(vault.address)}${vault.chainID}`]) {
          noDuplicateVaultList.push(vault)
          alreadyInList[`${toAddress(vault.address)}${vault.chainID}`] = true
        }
      }

      for (const vault of _vaultList) {
        if (!alreadyInList[`${toAddress(vault.address)}${vault.chainID}`]) {
          noDuplicateVaultList.push(vault)
          alreadyInList[`${toAddress(vault.address)}${vault.chainID}`] = true
        }
      }
      _vaultList = noDuplicateVaultList
      return [..._vaultList]
    }

    if (categories?.includes('featured')) {
      _vaultList.sort(
        (a, b): number =>
          (b.tvl.tvl || 0) * (b?.apr?.netAPR || 0) - (a.tvl.tvl || 0) * (a?.apr?.netAPR || 0)
      )
      _vaultList = _vaultList.slice(0, 10)
    }
    if (categories?.includes('curveF')) {
      _vaultList = [..._vaultList, ...curveFactoryVaults]
    }
    if (categories?.includes('curve')) {
      _vaultList = [..._vaultList, ...curveVaults]
    }
    if (categories?.includes('prisma')) {
      _vaultList = [..._vaultList, ...prismaVaults]
    }
    if (categories?.includes('balancer')) {
      _vaultList = [..._vaultList, ...balancerVaults]
    }
    if (categories?.includes('velodrome')) {
      _vaultList = [..._vaultList, ...velodromeVaults]
    }
    if (categories?.includes('aerodrome')) {
      _vaultList = [..._vaultList, ...aerodromeVaults]
    }
    if (categories?.includes('boosted')) {
      _vaultList = [..._vaultList, ...boostedVaults]
    }
    if (categories?.includes('stables')) {
      _vaultList = [..._vaultList, ...stablesVaults]
    }
    if (categories?.includes('crypto')) {
      _vaultList = [..._vaultList, ...cryptoVaults]
    }
    if (categories?.includes('holdings')) {
      _vaultList = [..._vaultList, ...holdingsVaults]
    }

    //remove duplicates
    _vaultList = _vaultList.filter(
      (vault, index, self): boolean =>
        index === self.findIndex((v): boolean => v.address === vault.address)
    )

    // Remove v3 vaults
    _vaultList = _vaultList.filter(
      (vault): boolean => !vault.version?.startsWith('3') && !vault.version?.startsWith('~3')
    )

    // Remove duplicates
    const alreadyInList: TDict<boolean> = {}
    const noDuplicateVaultList = []
    for (const vault of _vaultList) {
      if (!alreadyInList[`${toAddress(vault.address)}${vault.chainID}`]) {
        noDuplicateVaultList.push(vault)
        alreadyInList[`${toAddress(vault.address)}${vault.chainID}`] = true
      }
    }
    _vaultList = noDuplicateVaultList
    return _vaultList
  }, [
    v3,
    categories,
    holdingsVaults,
    holdingsV3Vaults,
    highlightedVaults,
    singleVaults,
    MultiVaults,
    curveFactoryVaults,
    curveVaults,
    prismaVaults,
    balancerVaults,
    velodromeVaults,
    aerodromeVaults,
    boostedVaults,
    stablesVaults,
    cryptoVaults
  ])

  return { activeVaults, migratableVaults, retiredVaults }
}
