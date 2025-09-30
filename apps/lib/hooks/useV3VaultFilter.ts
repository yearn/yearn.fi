import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useAppSettings } from '@vaults-v2/contexts/useAppSettings'
import { useCallback, useMemo } from 'react'

type TVaultWithMetadata = {
  vault: TYDaemonVault
  hasHoldings: boolean
  isHoldingsVault: boolean
  isMigratableVault: boolean
  isRetiredVault: boolean
}

type TOptimizedVaultFilterResult = {
  // Main filtered results
  activeVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  migratableVaults: TYDaemonVault[]
  retiredVaults: TYDaemonVault[]
  multiVaults: TYDaemonVault[]
  singleVaults: TYDaemonVault[]

  // Counts for showing hidden items
  totalPotentialVaults: number
  totalHoldingsVaults: number
  totalMigratableVaults: number
  totalRetiredVaults: number

  // Utility data
  isLoading: boolean
}

export function useV3VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string,
  categories?: string[] | null
): TOptimizedVaultFilterResult {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust: _shouldHideDust } = useAppSettings()
  const shouldHideDust = true // Always true for v3 as per original code

  // Check if a vault has holdings
  const checkHasHoldings = useCallback(
    (vault: TYDaemonVault): boolean => {
      const vaultBalance = getBalance({ address: vault.address, chainID: vault.chainID })
      const vaultPrice = getPrice({ address: vault.address, chainID: vault.chainID })

      // Check staking balance
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

      // Check regular balance
      const hasValidBalance = vaultBalance.raw > 0n
      const balanceValue = Number(vaultBalance.normalized) * vaultPrice.normalized

      return hasValidBalance && !(shouldHideDust && balanceValue < 0.01)
    },
    [getBalance, getPrice]
  )

  // Main processing function - single pass through all vaults
  const processedVaults = useDeepCompareMemo(() => {
    const vaultMap = new Map<string, TVaultWithMetadata>()

    // Process main vaults
    Object.values(vaults).forEach((vault) => {
      // Only v3 vaults
      if (!vault.version?.startsWith('3') && !vault.version?.startsWith('~3')) {
        return
      }

      const hasHoldings = checkHasHoldings(vault)
      const key = `${vault.chainID}_${toAddress(vault.address)}`

      vaultMap.set(key, {
        vault,
        hasHoldings,
        isHoldingsVault: hasHoldings,
        isMigratableVault: false,
        isRetiredVault: false
      })
    })

    // Process migratable vaults
    Object.values(vaultsMigrations).forEach((vault) => {
      // Only v3 vaults
      if (!vault.version?.startsWith('3') && !vault.version?.startsWith('~3')) {
        return
      }

      const hasHoldings = checkHasHoldings(vault)
      if (!hasHoldings) return // Only include if has holdings

      const key = `${vault.chainID}_${toAddress(vault.address)}`

      // Update if already exists, otherwise add
      const existing = vaultMap.get(key)
      if (existing) {
        existing.isMigratableVault = true
        existing.hasHoldings = true
        existing.isHoldingsVault = true
      } else {
        vaultMap.set(key, {
          vault,
          hasHoldings: true,
          isHoldingsVault: false,
          isMigratableVault: true,
          isRetiredVault: false
        })
      }
    })

    // Process retired vaults
    Object.values(vaultsRetired).forEach((vault) => {
      // Only v3 vaults
      if (!vault.version?.startsWith('3') && !vault.version?.startsWith('~3')) {
        return
      }

      const hasHoldings = checkHasHoldings(vault)
      if (!hasHoldings) return // Only include if has holdings
      const key = `${vault.chainID}_${toAddress(vault.address)}`

      // Update if already exists, otherwise add
      const existing = vaultMap.get(key)
      if (existing) {
        existing.isRetiredVault = true
        existing.hasHoldings = true
        existing.isHoldingsVault = false
      } else {
        vaultMap.set(key, {
          vault,
          hasHoldings: true,
          isHoldingsVault: false,
          isMigratableVault: false,
          isRetiredVault: true
        })
      }
    })

    return vaultMap
  }, [vaults, vaultsMigrations, vaultsRetired, checkHasHoldings])

  // Apply filters
  const filteredResults = useMemo(() => {
    const results = {
      activeVaults: [] as TYDaemonVault[],
      holdingsVaults: [] as TYDaemonVault[],
      migratableVaults: [] as TYDaemonVault[],
      retiredVaults: [] as TYDaemonVault[],
      multiVaults: [] as TYDaemonVault[],
      singleVaults: [] as TYDaemonVault[],

      totalPotentialVaults: 0,
      totalHoldingsVaults: 0,
      totalMigratableVaults: 0,
      totalRetiredVaults: 0
    }

    // Track totals before filtering
    let totalHoldingsBeforeFilters = 0
    let totalMigratableBeforeFilters = 0
    let totalRetiredBeforeFilters = 0

    processedVaults.forEach(({ vault, hasHoldings, isHoldingsVault, isMigratableVault, isRetiredVault }) => {
      // Count totals before filtering
      if (isHoldingsVault) {
        totalHoldingsBeforeFilters++
      }
      if (isMigratableVault) {
        totalMigratableBeforeFilters++
      }
      if (isRetiredVault) {
        totalRetiredBeforeFilters++
      }

      // Apply search filter first (affects potential counts)
      if (search) {
        const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`

        try {
          const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const searchRegex = new RegExp(escapedSearch, 'i')
          if (!searchRegex.test(searchableText)) {
            return
          }
        } catch {
          // Fallback to simple string matching if regex fails
          const lowercaseSearch = search.toLowerCase()
          if (!searchableText.toLowerCase().includes(lowercaseSearch)) {
            return
          }
        }
      }

      // Count after search filter (for potential results)
      if (!isMigratableVault && !isRetiredVault) {
        results.totalPotentialVaults++
      }

      // Chain filter
      if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
        return
      }

      // Category filter (including holdings logic)
      if (categories && categories.length > 0) {
        const hasHoldingsCategory = categories.includes('Your Holdings')
        const otherCategories = categories.filter((c) => c !== 'Your Holdings')
        const onlyHoldingsSelected = hasHoldingsCategory && otherCategories.length === 0

        if (onlyHoldingsSelected) {
          if (!hasHoldings) {
            return
          }
        } else if (!hasHoldingsCategory) {
          if (hasHoldings) {
            return
          }
          if (otherCategories.length > 0 && !otherCategories.includes(vault.category)) {
            return
          }
        } else {
          const allowedByHoldings = hasHoldings
          const allowedByCategory =
            !hasHoldings && (otherCategories.length === 0 || otherCategories.includes(vault.category))

          if (!allowedByHoldings && !allowedByCategory) {
            return
          }
        }
      }

      // Type filter (highlight, multi, single)
      if (types && types.length > 0) {
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
          return
        }
      }

      // Add to appropriate lists
      if (isRetiredVault) {
        results.retiredVaults.push(vault)
      } else if (isMigratableVault) {
        results.migratableVaults.push(vault)
      } else {
        // Active vault
        results.activeVaults.push(vault)

        // Add to categorized lists
        if (vault.kind === 'Multi Strategy') {
          results.multiVaults.push(vault)
        } else if (vault.kind === 'Single Strategy') {
          results.singleVaults.push(vault)
        }
      }

      // Add to holdings if applicable
      if (isHoldingsVault && !isMigratableVault && !isRetiredVault) {
        results.holdingsVaults.push(vault)
      }
    })

    // Set total counts (before chain/category/type filters)
    results.totalHoldingsVaults = totalHoldingsBeforeFilters
    results.totalMigratableVaults = totalMigratableBeforeFilters
    results.totalRetiredVaults = totalRetiredBeforeFilters
    return results
  }, [processedVaults, types, chains, search, categories])

  return {
    ...filteredResults,
    isLoading: isLoadingVaultList
  }
}
