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
} from '@vaults/shared/utils/vaultListFacets'
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
  showHiddenVaults?: boolean
): TV3VaultFilterResult {
  const { vaults, vaultsMigrations, vaultsRetired, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()
  const searchRegex = useMemo(() => {
    if (!search) {
      return null
    }
    try {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(escapedSearch, 'i')
    } catch {
      return null
    }
  }, [search])
  const lowercaseSearch = useMemo(() => (search ? search.toLowerCase() : ''), [search])

  const checkHasHoldings = useMemo(
    () => createCheckHasHoldings(getBalance, getPrice, shouldHideDust),
    [getBalance, getPrice, shouldHideDust]
  )

  const checkHasAvailableBalance = useMemo(() => createCheckHasAvailableBalance(getBalance), [getBalance])

  const vaultIndex = useDeepCompareMemo(() => {
    const vaultMap = new Map<string, TVaultIndexEntry>()

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
      if (!isV3Vault(vault, isAllocatorVaultOverride(vault))) {
        return
      }
      upsertVault(vault, { isActive: true })
    })

    Object.values(vaultsMigrations).forEach((vault) => {
      if (!isV3Vault(vault, isAllocatorVaultOverride(vault))) {
        return
      }
      upsertVault(vault, { isMigratable: true })
    })

    Object.values(vaultsRetired).forEach((vault) => {
      if (!isV3Vault(vault, isAllocatorVaultOverride(vault))) {
        return
      }
      upsertVault(vault, { isRetired: true })
    })

    return vaultMap
  }, [vaults, vaultsMigrations, vaultsRetired])

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
        if (!flags?.hasAvailableBalance) {
          return false
        }
        if (isActive) {
          return true
        }
        return Boolean(flags.hasHoldings)
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
      if (search) {
        if (searchRegex) {
          if (!searchRegex.test(searchableText)) {
            return
          }
        } else if (!searchableText.includes(lowercaseSearch)) {
          return
        }
      }

      if (chains && chains.length > 0 && !chains.includes(vault.chainID)) {
        return
      }

      const isMigratableVault = Boolean(isMigratable && hasHoldings)
      const isRetiredVault = Boolean(isRetired && hasHoldings)
      const hasUserHoldings = Boolean(hasHoldings || isMigratableVault || isRetiredVault)

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

      const shouldIncludeByCategory =
        !categories || categories.length === 0 || categories.some((item) => item === category)

      const isPinnedByUserContext = Boolean(hasUserHoldings || isMigratableVault || isRetiredVault)
      const isStrategy = kind === 'strategy'
      const shouldIncludeByFeaturedGate = Boolean(
        showHiddenVaults || (!isHidden && (isStrategy || isFeatured || isPinnedByUserContext))
      )

      let shouldIncludeByKind = true
      if (types && types.length > 0) {
        const hasMulti = types.includes('multi')
        const hasSingle = types.includes('single')

        const matchesAllocator = hasMulti && kind === 'allocator'
        const matchesStrategy = hasSingle && kind === 'strategy'

        shouldIncludeByKind = Boolean(matchesAllocator || matchesStrategy)
      }

      let shouldIncludeByAggressiveness = true
      if (aggressiveness && aggressiveness.length > 0) {
        shouldIncludeByAggressiveness = Boolean(
          aggressivenessScore !== null && aggressiveness.includes(aggressivenessScore)
        )
      }

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
    search,
    categories,
    aggressiveness,
    holdingsVaults,
    showHiddenVaults,
    searchRegex,
    lowercaseSearch
  ])

  return {
    ...filteredResults,
    availableVaults,
    isLoading: isLoadingVaultList
  }
}
