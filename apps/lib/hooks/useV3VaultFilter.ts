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

type TVaultFlags = {
  hasHoldings: boolean
  isMigratable: boolean
  isRetired: boolean
}

type TV3VaultFilterResult = {
  filteredVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  vaultFlags: Record<string, TVaultFlags>
  totalMatchingVaults: number
  totalHoldingsMatching: number
  totalMigratableMatching: number
  totalRetiredMatching: number
  isLoading: boolean
}

export function useV3VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string,
  categories?: string[] | null
): TV3VaultFilterResult {
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
  const holdingsVaults = useMemo(() => {
    return Array.from(processedVaults.values())
      .filter(({ hasHoldings }) => hasHoldings)
      .map(({ vault }) => vault)
  }, [processedVaults])

  const filteredResults = useMemo(() => {
    const filteredVaults: TYDaemonVault[] = []
    const vaultFlags: Record<string, TVaultFlags> = {}

    let totalMatchingVaults = 0
    let totalHoldingsMatching = 0
    let totalMigratableMatching = 0
    let totalRetiredMatching = 0

    processedVaults.forEach(({ vault, hasHoldings, isHoldingsVault, isMigratableVault, isRetiredVault }) => {
      // Apply search filter
      if (search) {
        const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`

        try {
          const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const searchRegex = new RegExp(escapedSearch, 'i')
          if (!searchRegex.test(searchableText)) {
            return
          }
        } catch {
          const lowercaseSearch = search.toLowerCase()
          if (!searchableText.toLowerCase().includes(lowercaseSearch)) {
            return
          }
        }
      }

      // Chain filter
      if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
        return
      }

      // Type filter (highlight, multi, single)
      if (types && types.length > 0) {
        const hasHighlight = types.includes('highlight')
        const hasMulti = types.includes('multi')
        const hasSingle = types.includes('single')

        const matchesHighlight = hasHighlight && Boolean(vault.info?.isHighlighted)
        const matchesMulti = hasMulti && vault.kind === 'Multi Strategy'
        const matchesSingle = hasSingle && vault.kind === 'Single Strategy'

        if (!(matchesHighlight || matchesMulti || matchesSingle)) {
          return
        }
      }

      const key = `${vault.chainID}_${toAddress(vault.address)}`
      const hasUserHoldings = Boolean(hasHoldings || isHoldingsVault)

      vaultFlags[key] = {
        hasHoldings: hasUserHoldings,
        isMigratable: isMigratableVault,
        isRetired: isRetiredVault
      }

      totalMatchingVaults++
      if (hasUserHoldings) {
        totalHoldingsMatching++
      }
      if (isMigratableVault) {
        totalMigratableMatching++
      }
      if (isRetiredVault) {
        totalRetiredMatching++
      }

      const vaultCategorySet = new Set<string>()
      if (vault.category) {
        vaultCategorySet.add(vault.category)
      }
      if (hasUserHoldings) {
        vaultCategorySet.add('Your Holdings')
      }
      if (isMigratableVault) {
        vaultCategorySet.add('Migratable')
      }
      if (isRetiredVault) {
        vaultCategorySet.add('Retired')
      }

      const shouldIncludeByCategory =
        !categories || categories.length === 0 || categories.some((category) => vaultCategorySet.has(category))

      if (shouldIncludeByCategory) {
        filteredVaults.push(vault)
      }
    })

    return {
      filteredVaults,
      holdingsVaults,
      vaultFlags,
      totalMatchingVaults,
      totalHoldingsMatching,
      totalMigratableMatching,
      totalRetiredMatching
    }
  }, [processedVaults, types, chains, search, categories, holdingsVaults])

  return {
    ...filteredResults,
    isLoading: isLoadingVaultList
  }
}
