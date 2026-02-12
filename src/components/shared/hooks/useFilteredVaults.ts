import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
import {
  getVaultAPR,
  getVaultAddress,
  getVaultCategory,
  getVaultChainID,
  getVaultInfo,
  getVaultKind,
  getVaultStaking,
  getVaultVersion,
  isAutomatedVault,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import { useCallback, useMemo } from 'react'

export function useFilteredVaults(vaultMap: TDict<TKongVault>, condition: (v: TKongVault) => boolean): TKongVault[] {
  return useDeepCompareMemo(
    (): TKongVault[] => Object.values(vaultMap).filter((vault): boolean => condition(vault)),
    [vaultMap, condition]
  )
}

export function useVaultFilter(
  categories: string[] | null,
  _chains: number[] | null,
  v3?: boolean
): {
  activeVaults: TKongVault[]
  retiredVaults: TKongVault[]
  migratableVaults: TKongVault[]
} {
  const { vaults, getPrice } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()

  const visibleVaults = useMemo((): TDict<TKongVault> => {
    const filteredVaults: TDict<TKongVault> = {}
    for (const [address, vault] of Object.entries(vaults)) {
      if (!getVaultInfo(vault).isHidden) {
        filteredVaults[address] = vault
      }
    }
    return filteredVaults
  }, [vaults])

  const filterHoldingsCallback = useCallback(
    (vault: TKongVault, isFactoryOnly: boolean, isForV3: boolean): boolean => {
      const version = getVaultVersion(vault)
      if (isForV3 && !version.startsWith('3') && !version.startsWith('~3')) {
        return false
      }
      if (!isForV3 && version.startsWith('3') && !version.startsWith('~3')) {
        return false
      }

      const address = getVaultAddress(vault)
      const chainID = getVaultChainID(vault)
      const staking = getVaultStaking(vault)
      const category = getVaultCategory(vault)

      const vaultBalance = getBalance({ address, chainID })
      const vaultPrice = getPrice({ address, chainID })

      if (staking.available) {
        const stakingBalance = getBalance({
          address: staking.address,
          chainID
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
          if (category === 'Curve' && isAutomatedVault(vault)) {
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
    (vault: TKongVault): boolean => {
      const version = getVaultVersion(vault)
      const isV3Vault = version.startsWith('3') || version.startsWith('~3')
      if ((v3 && !isV3Vault) || (!v3 && isV3Vault)) {
        return false
      }

      const address = getVaultAddress(vault)
      const chainID = getVaultChainID(vault)
      const staking = getVaultStaking(vault)

      const vaultBalance = getBalance({ address, chainID })
      if (staking.available) {
        const stakingBalance = getBalance({
          address: staking.address,
          chainID
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

  const highlightedVaults = useFilteredVaults(visibleVaults, (vault): boolean => getVaultInfo(vault).isHighlighted)
  const holdingsVaults = useFilteredVaults(vaults, (vault): boolean => filterHoldingsCallback(vault, false, false))
  const holdingsV3Vaults = useFilteredVaults(vaults, (vault): boolean => filterHoldingsCallback(vault, false, true))

  const singleVaults = useFilteredVaults(visibleVaults, (vault): boolean => {
    const version = getVaultVersion(vault)
    const kind = getVaultKind(vault)
    return (version.split('.')?.[0] === '3' || version.split('.')?.[0] === '~3') && kind === 'Single Strategy'
  })
  const MultiVaults = useFilteredVaults(visibleVaults, (vault): boolean => {
    const version = getVaultVersion(vault)
    const kind = getVaultKind(vault)
    return (version.split('.')?.[0] === '3' || version.split('.')?.[0] === '~3') && kind === 'Multi Strategy'
  })

  const boostedVaults = useFilteredVaults(visibleVaults, (vault) => getVaultAPR(vault).extra.stakingRewardsAPR > 0)
  const curveVaults = useFilteredVaults(visibleVaults, (vault) => getVaultCategory(vault) === 'Curve')
  const prismaVaults = useFilteredVaults(visibleVaults, (vault) => getVaultCategory(vault) === 'Prisma')
  const velodromeVaults = useFilteredVaults(visibleVaults, (vault) => getVaultCategory(vault) === 'Velodrome')
  const aerodromeVaults = useFilteredVaults(visibleVaults, (vault) => getVaultCategory(vault) === 'Aerodrome')
  const stablesVaults = useFilteredVaults(visibleVaults, (vault) => getVaultCategory(vault) === 'Stablecoin')
  const balancerVaults = useFilteredVaults(visibleVaults, (vault) => getVaultCategory(vault) === 'Balancer')
  const cryptoVaults = useFilteredVaults(visibleVaults, (vault) => getVaultCategory(vault) === 'Volatile')
  const curveFactoryVaults = useFilteredVaults(
    visibleVaults,
    (vault) => getVaultCategory(vault) === 'Curve' && isAutomatedVault(vault)
  )
  const migratableVaults = useMemo((): TKongVault[] => [], [])
  const retiredVaults = useFilteredVaults(
    visibleVaults,
    (vault) => Boolean(getVaultInfo(vault)?.isRetired) && filterMigrationCallback(vault)
  )

  const activeVaults = useDeepCompareMemo((): TKongVault[] => {
    let _vaultList: TKongVault[] = []
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

      const alreadyInList: TDict<boolean> = {}
      const noDuplicateVaultList = []
      for (const vault of holdingsV3Vaults) {
        const key = `${toAddress(getVaultAddress(vault))}${getVaultChainID(vault)}`
        if (!alreadyInList[key]) {
          noDuplicateVaultList.push(vault)
          alreadyInList[key] = true
        }
      }
      for (const vault of _vaultList) {
        const key = `${toAddress(getVaultAddress(vault))}${getVaultChainID(vault)}`
        if (!alreadyInList[key]) {
          noDuplicateVaultList.push(vault)
          alreadyInList[key] = true
        }
      }
      _vaultList = noDuplicateVaultList
      return [..._vaultList]
    }

    if (categories?.includes('featured')) {
      _vaultList = _vaultList
        .toSorted((a, b): number => {
          const aTvl = a.tvl || 0
          const bTvl = b.tvl || 0
          const aApr = a.performance?.historical?.net || 0
          const bApr = b.performance?.historical?.net || 0
          return bTvl * bApr - aTvl * aApr
        })
        .slice(0, 10)
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

    _vaultList = _vaultList.filter(
      (vault, index, self): boolean =>
        index ===
        self.findIndex(
          (item): boolean =>
            getVaultAddress(item) === getVaultAddress(vault) && getVaultChainID(item) === getVaultChainID(vault)
        )
    )

    _vaultList = _vaultList.filter((vault): boolean => {
      const version = getVaultVersion(vault)
      return !version.startsWith('3') && !version.startsWith('~3')
    })

    const alreadyInList: TDict<boolean> = {}
    const noDuplicateVaultList = []
    for (const vault of _vaultList) {
      const key = `${toAddress(getVaultAddress(vault))}${getVaultChainID(vault)}`
      if (!alreadyInList[key]) {
        noDuplicateVaultList.push(vault)
        alreadyInList[key] = true
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
