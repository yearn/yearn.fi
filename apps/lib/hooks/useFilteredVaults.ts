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
  types: string[] | null,
  chains: number[] | null,
  v3?: boolean,
  search?: string,
  categories?: string[] | null
): {
  activeVaults: TYDaemonVault[]
  retiredVaults: TYDaemonVault[]
  migratableVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  multiVaults: TYDaemonVault[]
  singleVaults: TYDaemonVault[]
} {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust: _shouldHideDust } = useAppSettings()
  const shouldHideDust = v3 ? true : _shouldHideDust

  // Comprehensive filter function that applies all filters
  const applyAllFilters = useCallback(
    (vault: TYDaemonVault, hasHoldings?: boolean): boolean => {
      // Chain filter
      if (chains && !chains.includes(vault.chainID)) {
        return false
      }

      // Holdings vs Non-holdings filter logic
      if (categories && categories.length > 0) {
        const hasHoldingsCategory = categories.includes('Your Holdings')
        const otherCategories = categories.filter((c) => c !== 'Your Holdings')
        const onlyHoldingsSelected = hasHoldingsCategory && otherCategories.length === 0

        // If only Holdings is selected
        if (onlyHoldingsSelected) {
          // Only allow vaults that have holdings
          if (!hasHoldings) {
            return false
          }
        }
        // If Holdings is not selected at all
        else if (!hasHoldingsCategory) {
          // Only allow vaults that don't have holdings, and match the category filter
          if (hasHoldings) {
            return false
          }
          if (otherCategories.length > 0 && !otherCategories.includes(vault.category)) {
            return false
          }
        }
        // If Holdings + other categories are selected
        else {
          // Allow holdings vaults regardless of category, OR non-holdings that match category
          const allowedByHoldings = hasHoldings
          const allowedByCategory =
            !hasHoldings && (otherCategories.length === 0 || otherCategories.includes(vault.category))

          if (!allowedByHoldings && !allowedByCategory) {
            return false
          }
        }
      }

      // Type filter (highlight, multi, single) - for v3 vaults only
      if (v3 && types && types.length > 0) {
        const hasHighlight = types.includes('highlight')
        const hasMulti = types.includes('multi')
        const hasSingle = types.includes('single')

        let matchesType = false

        if (hasHighlight && vault.info?.isHighlighted) {
          matchesType = true
        }
        if (hasMulti && vault.kind === 'Multi Strategy') {
          matchesType = true
        }
        if (hasSingle && vault.kind === 'Single Strategy') {
          matchesType = true
        }

        if (!matchesType) {
          return false
        }
      }

      // Search filter (skip for holdings so they stay visible during search)
      if (search && !hasHoldings) {
        const tokens = search
          .split(/\s+/)
          .map((token) => token.trim())
          .filter((token) => token.length > 0)

        if (tokens.length > 0) {
          const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`

          const matchesAtLeastOneToken = tokens.some((token) => {
            try {
              const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const tokenRegex = new RegExp(escapedToken, 'i')
              return tokenRegex.test(searchableText)
            } catch {
              const lowercaseSearchable = searchableText.toLowerCase()
              const lowercaseToken = token.toLowerCase()
              return lowercaseSearchable.includes(lowercaseToken)
            }
          })

          if (!matchesAtLeastOneToken) {
            return false
          }
        }
      }

      return true
    },
    [chains, categories, search, types, v3]
  )

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
  const holdingsVaults = useFilteredVaults(vaults, (vault): boolean => filterHoldingsCallback(vault, false, false))
  const holdingsV3Vaults = useFilteredVaults(vaults, (vault): boolean => filterHoldingsCallback(vault, false, true))

  // V3 Filtered Vaults
  const singleVaults = useFilteredVaults(
    vaults,
    ({ version, kind }): boolean =>
      ((version || '')?.split('.')?.[0] === '3' && kind === 'Single Strategy') ||
      ((version || '')?.split('.')?.[0] === '~3' && kind === 'Single Strategy')
  )
  const multiVaults = useFilteredVaults(
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
  const curveFactoryVaults = useFilteredVaults(vaults, (vault) => vault.category === 'Curve' && isAutomatedVault(vault))
  const migratableVaults = useFilteredVaults(vaultsMigrations, (v) => filterMigrationCallback(v))
  const retiredVaults = useFilteredVaults(vaultsRetired, (v) => filterMigrationCallback(v))

  /* 🔵 - Yearn Finance **************************************************************************
   **	First, we need to determine in which category we are. The activeVaults function will
   **	decide which vaults to display based on the category. No extra filters are applied.
   **	The possible lists are memoized to avoid unnecessary re-renders.
   **********************************************************************************************/
  const activeVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    let _vaultList: TYDaemonVault[] = []
    if (v3) {
      if (types?.includes('highlight')) {
        _vaultList = [..._vaultList, ...highlightedVaults]
      }
      if (types?.includes('single')) {
        _vaultList = [..._vaultList, ...singleVaults]
      }
      if (types?.includes('multi')) {
        _vaultList = [..._vaultList, ...multiVaults]
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

    if (types?.includes('featured')) {
      _vaultList.sort(
        (a, b): number => (b.tvl.tvl || 0) * (b?.apr?.netAPR || 0) - (a.tvl.tvl || 0) * (a?.apr?.netAPR || 0)
      )
      _vaultList = _vaultList.slice(0, 10)
    }
    if (types?.includes('curveF')) {
      _vaultList = [..._vaultList, ...curveFactoryVaults]
    }
    if (types?.includes('curve')) {
      _vaultList = [..._vaultList, ...curveVaults]
    }
    if (types?.includes('prisma')) {
      _vaultList = [..._vaultList, ...prismaVaults]
    }
    if (types?.includes('balancer')) {
      _vaultList = [..._vaultList, ...balancerVaults]
    }
    if (types?.includes('velodrome')) {
      _vaultList = [..._vaultList, ...velodromeVaults]
    }
    if (types?.includes('aerodrome')) {
      _vaultList = [..._vaultList, ...aerodromeVaults]
    }
    if (types?.includes('boosted')) {
      _vaultList = [..._vaultList, ...boostedVaults]
    }
    if (types?.includes('stables')) {
      _vaultList = [..._vaultList, ...stablesVaults]
    }
    if (types?.includes('crypto')) {
      _vaultList = [..._vaultList, ...cryptoVaults]
    }
    if (types?.includes('holdings')) {
      _vaultList = [..._vaultList, ...holdingsVaults]
    }

    //remove duplicates
    _vaultList = _vaultList.filter(
      (vault, index, self): boolean => index === self.findIndex((v): boolean => v.address === vault.address)
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
    types,
    holdingsVaults,
    holdingsV3Vaults,
    highlightedVaults,
    singleVaults,
    multiVaults,
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

  // Apply comprehensive filtering to all vault lists
  const filteredActiveVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    const holdings = v3 ? holdingsV3Vaults : holdingsVaults
    return activeVaults.filter((vault) =>
      applyAllFilters(
        vault,
        holdings.some((v) => v.address === vault.address)
      )
    )
  }, [activeVaults, applyAllFilters])

  const filteredHoldingsVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    const holdings = v3 ? holdingsV3Vaults : holdingsVaults
    return holdings.filter((vault) => applyAllFilters(vault, true))
  }, [holdingsVaults, holdingsV3Vaults, v3, applyAllFilters])

  const filteredMigratableVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    return migratableVaults.filter((vault) => applyAllFilters(vault, true))
  }, [migratableVaults, applyAllFilters])

  const filteredRetiredVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    return retiredVaults.filter((vault) => applyAllFilters(vault, true))
  }, [retiredVaults, applyAllFilters])

  // Create categorized lists for v3
  const filteredMultiVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    if (!v3) return []
    return filteredActiveVaults.filter((vault) => vault.kind === 'Multi Strategy')
  }, [filteredActiveVaults, v3])

  const filteredSingleVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    if (!v3) return []
    return filteredActiveVaults.filter((vault) => vault.kind === 'Single Strategy')
  }, [filteredActiveVaults, v3])

  return {
    activeVaults: filteredActiveVaults,
    holdingsVaults: filteredHoldingsVaults,
    migratableVaults: filteredMigratableVaults,
    retiredVaults: filteredRetiredVaults,
    multiVaults: filteredMultiVaults,
    singleVaults: filteredSingleVaults
  }
}
