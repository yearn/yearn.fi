import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useAppSettings } from '@vaults/contexts/useAppSettings'
import {
  deriveAssetCategory,
  deriveListKind,
  deriveV3Aggressiveness,
  isAllocatorVaultOverride,
  type TVaultAggressiveness
} from '@vaults/utils/vaultListFacets'
import { useMemo } from 'react'
import {
  createCheckHasAvailableBalance,
  createCheckHasHoldings,
  getVaultKey,
  isV3Vault,
  type TVaultFlags
} from './useVaultFilterUtils'

type TVaultIndexEntry = {
  key: string
  vault: TYDaemonVault
  searchableText: string
  kind: ReturnType<typeof deriveListKind>
  category: string
  aggressiveness: TVaultAggressiveness | null
  isHidden: boolean
  isFeatured: boolean
  isActive: boolean
  isMigratable: boolean
  isRetired: boolean
}

type TVaultWalletFlags = {
  hasHoldings: boolean
  hasAvailableBalance: boolean
}

type TV3VaultFilterResult = {
  filteredVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  availableVaults: TYDaemonVault[]
  vaultFlags: Record<string, TVaultFlags>
  totalMatchingVaults: number
  totalHoldingsMatching: number
  totalAvailableMatching: number
  totalMigratableMatching: number
  totalRetiredMatching: number
  isLoading: boolean
}

export function useV3VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string,
  categories?: string[] | null,
  aggressiveness?: TVaultAggressiveness[] | null,
  showHiddenVaults?: boolean,
  enabled?: boolean
): TV3VaultFilterResult {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()
  const isEnabled = enabled ?? true
  const searchValue = search ?? ''
  const isSearchEnabled = isEnabled && searchValue !== ''
  const searchRegex = useMemo(() => {
    if (!isSearchEnabled) {
      return null
    }
    try {
      const escapedSearch = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(escapedSearch, 'i')
    } catch {
      return null
    }
  }, [isSearchEnabled, searchValue])
  const lowercaseSearch = useMemo(
    () => (isSearchEnabled ? searchValue.toLowerCase() : ''),
    [isSearchEnabled, searchValue]
  )

  const checkHasHoldings = useMemo(
    () => createCheckHasHoldings(getBalance, getPrice, shouldHideDust),
    [getBalance, getPrice, shouldHideDust]
  )

  const checkHasAvailableBalance = useMemo(() => createCheckHasAvailableBalance(getBalance), [getBalance])

  const vaultIndex = useDeepCompareMemo(() => {
    if (!isEnabled) {
      return new Map<string, TVaultIndexEntry>()
    }
    const vaultMap = new Map<string, TVaultIndexEntry>()

    const shouldIncludeVault = (vault: TYDaemonVault): boolean => isV3Vault(vault, isAllocatorVaultOverride(vault))

    const upsertVault = (
      vault: TYDaemonVault,
      updates: Partial<Pick<TVaultIndexEntry, 'isActive' | 'isMigratable' | 'isRetired'>>
    ): void => {
      const key = getVaultKey(vault)
      const existing = vaultMap.get(key)
      if (existing) {
        vaultMap.set(key, { ...existing, ...updates })
        return
      }

      const kind = deriveListKind(vault)
      vaultMap.set(key, {
        key,
        vault,
        searchableText:
          `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`.toLowerCase(),
        kind,
        category: deriveAssetCategory(vault),
        aggressiveness: deriveV3Aggressiveness(vault),
        isHidden: Boolean(vault.info?.isHidden),
        isFeatured: Boolean(vault.info?.isHighlighted),
        isActive: Boolean(updates.isActive),
        isMigratable: Boolean(updates.isMigratable),
        isRetired: Boolean(updates.isRetired)
      })
    }

    Object.values(vaults).forEach((vault) => {
      if (!shouldIncludeVault(vault)) {
        return
      }
      upsertVault(vault, { isActive: true })
    })

    Object.values(vaultsMigrations).forEach((vault) => {
      if (!shouldIncludeVault(vault)) {
        return
      }
      upsertVault(vault, { isMigratable: true })
    })

    Object.values(vaultsRetired).forEach((vault) => {
      if (!shouldIncludeVault(vault)) {
        return
      }
      upsertVault(vault, { isRetired: true })
    })

    return vaultMap
  }, [isEnabled, isEnabled ? vaults : null, isEnabled ? vaultsMigrations : null, isEnabled ? vaultsRetired : null])

  const walletFlags = useMemo(() => {
    const flags = new Map<string, TVaultWalletFlags>()
    vaultIndex.forEach((entry, key) => {
      flags.set(key, {
        hasHoldings: checkHasHoldings(entry.vault),
        hasAvailableBalance: checkHasAvailableBalance(entry.vault)
      })
    })
    return flags
  }, [vaultIndex, checkHasHoldings, checkHasAvailableBalance])

  const holdingsVaults = useMemo(() => {
    return Array.from(vaultIndex.values())
      .filter(({ key }) => walletFlags.get(key)?.hasHoldings)
      .map(({ vault }) => vault)
  }, [vaultIndex, walletFlags])

  const availableVaults = useMemo(() => {
    return Array.from(vaultIndex.values())
      .filter(({ key, isActive }) => {
        const flags = walletFlags.get(key)
        return Boolean(flags?.hasAvailableBalance && (isActive || flags?.hasHoldings))
      })
      .map(({ vault }) => vault)
  }, [vaultIndex, walletFlags])

  const filteredResults = useMemo(() => {
    const filteredVaults: TYDaemonVault[] = []
    const vaultFlags: Record<string, TVaultFlags> = {}

    let totalMatchingVaults = 0
    let totalHoldingsMatching = 0
    let totalAvailableMatching = 0
    let totalMigratableMatching = 0
    let totalRetiredMatching = 0
    const hasChainFilter = Boolean(chains?.length)
    const hasCategoryFilter = Boolean(categories?.length)
    const hasAggressivenessFilter = Boolean(aggressiveness?.length)
    const hasTypeFilter = Boolean(types?.length)

    const matchesSearch = (searchableText: string): boolean => {
      if (!isSearchEnabled) {
        return true
      }
      if (searchRegex) {
        return searchRegex.test(searchableText)
      }
      return searchableText.includes(lowercaseSearch)
    }

    vaultIndex.forEach((entry) => {
      const {
        key,
        vault,
        searchableText,
        kind,
        category,
        aggressiveness: aggressivenessScore,
        isHidden,
        isFeatured,
        isActive,
        isMigratable,
        isRetired
      } = entry
      const walletFlag = walletFlags.get(key)
      const hasHoldings = Boolean(walletFlag?.hasHoldings)
      const hasAvailableBalance = Boolean(walletFlag?.hasAvailableBalance)

      if (!isActive && !hasHoldings) {
        return
      }
      if (!matchesSearch(searchableText)) {
        return
      }

      if (hasChainFilter && !chains?.includes(vault.chainID)) {
        return
      }

      const isMigratableVault = Boolean(isMigratable && hasHoldings)
      const isRetiredVault = Boolean(isRetired && hasHoldings)
      const hasUserHoldings = hasHoldings || isMigratableVault || isRetiredVault

      vaultFlags[key] = {
        hasHoldings: hasUserHoldings,
        isMigratable: isMigratableVault,
        isRetired: isRetiredVault,
        isHidden
      }

      totalMatchingVaults++
      if (hasUserHoldings) {
        totalHoldingsMatching++
      }
      if (hasAvailableBalance) {
        totalAvailableMatching++
      }
      if (isMigratableVault) {
        totalMigratableMatching++
      }
      if (isRetiredVault) {
        totalRetiredMatching++
      }

      const shouldIncludeByCategory = !hasCategoryFilter || Boolean(categories?.includes(category))
      const isPinnedByUserContext = hasUserHoldings || isMigratableVault || isRetiredVault
      const isStrategy = kind === 'strategy'
      const shouldIncludeByFeaturedGate =
        showHiddenVaults || (!isHidden && (isStrategy || isFeatured || isPinnedByUserContext))
      const shouldIncludeByKind =
        !hasTypeFilter ||
        (Boolean(types?.includes('multi')) && kind === 'allocator') ||
        (Boolean(types?.includes('single')) && kind === 'strategy')
      const shouldIncludeByAggressiveness =
        !hasAggressivenessFilter ||
        (aggressivenessScore !== null && Boolean(aggressiveness?.includes(aggressivenessScore)))

      if (
        shouldIncludeByCategory &&
        shouldIncludeByFeaturedGate &&
        shouldIncludeByKind &&
        shouldIncludeByAggressiveness
      ) {
        filteredVaults.push(vault)
      }
    })

    return {
      filteredVaults,
      holdingsVaults,
      vaultFlags,
      totalMatchingVaults,
      totalHoldingsMatching,
      totalAvailableMatching,
      totalMigratableMatching,
      totalRetiredMatching
    }
  }, [
    vaultIndex,
    walletFlags,
    types,
    chains,
    categories,
    aggressiveness,
    holdingsVaults,
    showHiddenVaults,
    searchRegex,
    lowercaseSearch,
    isSearchEnabled
  ])

  return {
    ...filteredResults,
    availableVaults,
    isLoading: isEnabled ? isLoadingVaultList : false
  }
}
