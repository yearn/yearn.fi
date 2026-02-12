import { DEFAULT_MIN_TVL } from '@pages/vaults/utils/constants'
import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
import {
  deriveAssetCategory,
  deriveListKind,
  deriveV3Aggressiveness,
  expandUnderlyingAssetSelection,
  isAllocatorVaultOverride,
  normalizeUnderlyingAssetSymbol,
  type TVaultAggressiveness
} from '@pages/vaults/utils/vaultListFacets'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultMigration,
  getVaultName,
  getVaultSymbol,
  getVaultTVL,
  getVaultToken,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
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
  vault: TKongVault
  searchableText: string
  kind: ReturnType<typeof deriveListKind>
  category: string
  aggressiveness: TVaultAggressiveness | null
  isHidden: boolean
  isActive: boolean
  isMigratable: boolean
  isRetired: boolean
}

type TVaultWalletFlags = {
  hasHoldings: boolean
  hasAvailableBalance: boolean
}

type TOptimizedV2VaultFilterResult = {
  filteredVaults: TKongVault[]
  holdingsVaults: TKongVault[]
  availableVaults: TKongVault[]
  vaultFlags: Record<string, TVaultFlags>
  availableUnderlyingAssets: string[]
  underlyingAssetVaults: Record<string, TKongVault>
  isLoading: boolean
}

export function useV2VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string,
  categories?: string[] | null,
  aggressiveness?: TVaultAggressiveness[] | null,
  underlyingAssets?: string[] | null,
  minTvl?: number,
  showHiddenVaults?: boolean,
  enabled?: boolean
): TOptimizedV2VaultFilterResult {
  const { vaults, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()
  const isEnabled = enabled ?? true
  const searchValue = search ?? ''
  const minTvlValue = Number.isFinite(minTvl) ? Math.max(0, minTvl || 0) : DEFAULT_MIN_TVL
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
  const normalizedUnderlyingAssets = useMemo(() => {
    if (!underlyingAssets || underlyingAssets.length === 0) {
      return new Set<string>()
    }
    const normalized = underlyingAssets.map((asset) => normalizeUnderlyingAssetSymbol(asset)).filter(Boolean)
    return new Set(normalized)
  }, [underlyingAssets])
  const expandedUnderlyingAssets = useMemo(
    () => expandUnderlyingAssetSelection(normalizedUnderlyingAssets),
    [normalizedUnderlyingAssets]
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

    const shouldIncludeVault = (vault: TKongVault): boolean =>
      !isAllocatorVaultOverride(vault) && !isV3Vault(vault, false)

    const upsertVault = (
      vault: TKongVault,
      updates: Partial<Pick<TVaultIndexEntry, 'isActive' | 'isMigratable' | 'isRetired'>>
    ): void => {
      const key = getVaultKey(vault)
      const existing = vaultMap.get(key)
      if (existing) {
        vaultMap.set(key, { ...existing, ...updates })
        return
      }

      const token = getVaultToken(vault)
      const kind = deriveListKind(vault)
      vaultMap.set(key, {
        key,
        vault,
        searchableText:
          `${getVaultName(vault)} ${getVaultSymbol(vault)} ${token.name} ${token.symbol} ${getVaultAddress(vault)} ${token.address}`.toLowerCase(),
        kind,
        category: deriveAssetCategory(vault),
        aggressiveness: deriveV3Aggressiveness(vault),
        isHidden: Boolean(getVaultInfo(vault)?.isHidden),
        isActive: Boolean(updates.isActive),
        isMigratable: Boolean(updates.isMigratable),
        isRetired: Boolean(updates.isRetired)
      })
    }

    Object.values(vaults).forEach((vault) => {
      if (!shouldIncludeVault(vault)) {
        return
      }
      const isRetired = Boolean(getVaultInfo(vault)?.isRetired)
      upsertVault(vault, {
        isActive: !isRetired,
        isRetired,
        isMigratable: Boolean(getVaultMigration(vault)?.available)
      })
    })

    return vaultMap
  }, [isEnabled, isEnabled ? vaults : null])

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
    const filteredVaults: TKongVault[] = []
    const vaultFlags: Record<string, TVaultFlags> = {}
    const shouldShowHidden = Boolean(showHiddenVaults)
    const hasChainFilter = Boolean(chains?.length)
    const hasTypeFilter = Boolean(types?.length)
    const hasCategoryFilter = Boolean(categories?.length)
    const hasAggressivenessFilter = Boolean(aggressiveness?.length)
    const hasUnderlyingAssetFilter = normalizedUnderlyingAssets.size > 0
    const availableUnderlyingAssets = new Set<string>()
    const underlyingAssetVaults: Record<string, TKongVault> = {}

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
        isActive,
        isMigratable,
        isRetired
      } = entry
      const walletFlag = walletFlags.get(key)
      const hasHoldings = Boolean(walletFlag?.hasHoldings)

      if (!isActive && !hasHoldings) {
        return
      }
      if (!shouldShowHidden && isHidden) {
        return
      }

      if (!matchesSearch(searchableText)) {
        return
      }

      if (hasChainFilter && !chains?.includes(getVaultChainID(vault))) {
        return
      }

      const vaultTvl = getVaultTVL(vault)?.tvl || 0
      if (vaultTvl < minTvlValue) {
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

      const matchesKind = !hasTypeFilter || Boolean(types?.includes(kind))
      const matchesCategory = !hasCategoryFilter || Boolean(categories?.includes(category))
      const matchesAggressiveness =
        !hasAggressivenessFilter ||
        (aggressivenessScore !== null && Boolean(aggressiveness?.includes(aggressivenessScore)))

      if (matchesKind && matchesCategory && matchesAggressiveness) {
        const assetKey = normalizeUnderlyingAssetSymbol(getVaultToken(vault)?.symbol)
        if (assetKey && !underlyingAssetVaults[assetKey]) {
          availableUnderlyingAssets.add(assetKey)
          underlyingAssetVaults[assetKey] = vault
        } else if (assetKey) {
          availableUnderlyingAssets.add(assetKey)
        }

        const matchesUnderlyingAsset = !hasUnderlyingAssetFilter || (assetKey && expandedUnderlyingAssets.has(assetKey))
        if (!matchesUnderlyingAsset) {
          return
        }

        filteredVaults.push(vault)
      }
    })

    return {
      filteredVaults,
      vaultFlags,
      availableUnderlyingAssets: Array.from(availableUnderlyingAssets),
      underlyingAssetVaults
    }
  }, [
    vaultIndex,
    walletFlags,
    types,
    chains,
    categories,
    aggressiveness,
    normalizedUnderlyingAssets,
    expandedUnderlyingAssets,
    minTvlValue,
    searchRegex,
    lowercaseSearch,
    isSearchEnabled,
    showHiddenVaults
  ])

  return {
    ...filteredResults,
    holdingsVaults,
    availableVaults,
    isLoading: isEnabled ? isLoadingVaultList : false
  }
}
