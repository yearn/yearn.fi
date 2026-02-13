import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultMigration,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { DEFAULT_MIN_TVL } from '@pages/vaults/utils/constants'
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
import { useMemo } from 'react'
import {
  createCheckHasAvailableBalance,
  createCheckHasHoldings,
  getVaultKey,
  isV3Vault,
  type TVaultFlags
} from './useVaultFilterUtils'

export type TVaultVersion = 'v2' | 'v3' | 'all'

type TVaultIndexEntry = {
  key: string
  vault: TKongVault
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

export type TVaultFilterResult = {
  filteredVaults: TKongVault[]
  holdingsVaults: TKongVault[]
  availableVaults: TKongVault[]
  vaultFlags: Record<string, TVaultFlags>
  availableUnderlyingAssets: string[]
  underlyingAssetVaults: Record<string, TKongVault>
  totalMatchingVaults: number
  totalHoldingsMatching: number
  totalAvailableMatching: number
  totalMigratableMatching: number
  totalRetiredMatching: number
  isLoading: boolean
}

export type TVaultFilterParams = {
  version: TVaultVersion
  types: string[] | null
  chains: number[] | null
  search?: string
  categories?: string[] | null
  aggressiveness?: TVaultAggressiveness[] | null
  underlyingAssets?: string[] | null
  minTvl?: number
  showHiddenVaults?: boolean
  enabled?: boolean
}

function shouldIncludeVaultByVersion(vault: TKongVault, version: TVaultVersion, isAllocatorOverride: boolean): boolean {
  const isV3 = isV3Vault(vault, isAllocatorOverride)
  if (version === 'v2') return !isAllocatorOverride && !isV3
  if (version === 'v3') return isV3
  return true
}

export function useVaultFilter(params: TVaultFilterParams): TVaultFilterResult {
  const {
    version,
    types,
    chains,
    search,
    categories,
    aggressiveness,
    underlyingAssets,
    minTvl,
    showHiddenVaults,
    enabled
  } = params

  const { vaults, getPrice, isLoadingVaultList } = useYearn()
  const { getBalance } = useWallet()
  const { shouldHideDust } = useAppSettings()
  const isEnabled = enabled ?? true
  const searchValue = search ?? ''
  const minTvlValue = Number.isFinite(minTvl) ? Math.max(0, minTvl || 0) : DEFAULT_MIN_TVL
  const isSearchEnabled = isEnabled && searchValue !== ''
  const searchRegex = useMemo(() => {
    if (!isSearchEnabled || searchValue === '') return null
    try {
      const escapedSearch = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(escapedSearch, 'i')
    } catch {
      return null
    }
  }, [searchValue, isSearchEnabled])
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
      const info = getVaultInfo(vault)
      const kind = deriveListKind(vault)

      vaultMap.set(key, {
        key,
        vault,
        searchableText:
          `${getVaultName(vault)} ${getVaultSymbol(vault)} ${token.name} ${token.symbol} ${getVaultAddress(vault)} ${token.address}`.toLowerCase(),
        kind,
        category: deriveAssetCategory(vault),
        aggressiveness: deriveV3Aggressiveness(vault),
        isHidden: Boolean(info?.isHidden),
        isFeatured: Boolean(info?.isHighlighted),
        isActive: Boolean(updates.isActive),
        isMigratable: Boolean(updates.isMigratable),
        isRetired: Boolean(updates.isRetired)
      })
    }

    Object.values(vaults).forEach((vault) => {
      const isAllocatorOverride = isAllocatorVaultOverride(vault)
      if (!shouldIncludeVaultByVersion(vault, version, isAllocatorOverride)) {
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
  }, [isEnabled, version, isEnabled ? vaults : null])

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

  const holdingsVaults = useMemo(
    () =>
      Array.from(vaultIndex.values())
        .filter(({ key }) => walletFlags.get(key)?.hasHoldings)
        .map(({ vault }) => vault),
    [vaultIndex, walletFlags]
  )

  const availableVaults = useMemo(
    () =>
      Array.from(vaultIndex.values())
        .filter(({ key, isActive }) => {
          const flags = walletFlags.get(key)
          return Boolean(flags?.hasAvailableBalance && (isActive || flags?.hasHoldings))
        })
        .map(({ vault }) => vault),
    [vaultIndex, walletFlags]
  )

  const filteredResults = useMemo(() => {
    const filteredVaults: TKongVault[] = []
    const vaultFlags: Record<string, TVaultFlags> = {}

    let totalMatchingVaults = 0
    let totalHoldingsMatching = 0
    let totalAvailableMatching = 0
    let totalMigratableMatching = 0
    let totalRetiredMatching = 0

    const availableUnderlyingAssets = new Set<string>()
    const underlyingAssetVaults: Record<string, TKongVault> = {}
    const shouldShowHidden = Boolean(showHiddenVaults)
    const hasChainFilter = Boolean(chains?.length)
    const hasTypeFilter = Boolean(types?.length)
    const hasCategoryFilter = Boolean(categories?.length)
    const hasAggressivenessFilter = Boolean(aggressiveness?.length)
    const hasUnderlyingAssetFilter = normalizedUnderlyingAssets.size > 0

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

      const matchesKind = !hasTypeFilter || Boolean(types?.includes(kind))
      const matchesCategory = !hasCategoryFilter || Boolean(categories?.includes(category))
      const matchesAggressiveness =
        !hasAggressivenessFilter ||
        (aggressivenessScore !== null && Boolean(aggressiveness?.includes(aggressivenessScore)))

      const isPinnedByUserContext = hasUserHoldings || isMigratableVault || isRetiredVault
      const isStrategy = kind === 'strategy'
      const shouldIncludeByFeaturedGate =
        version !== 'v3' || shouldShowHidden || isStrategy || isFeatured || isPinnedByUserContext
      const shouldIncludeByKind =
        version !== 'v3'
          ? matchesKind
          : !hasTypeFilter ||
            (Boolean(types?.includes('multi')) && kind === 'allocator') ||
            (Boolean(types?.includes('single')) && kind === 'strategy')

      if (shouldIncludeByFeaturedGate && shouldIncludeByKind && matchesCategory && matchesAggressiveness) {
        const assetKey = normalizeUnderlyingAssetSymbol(getVaultToken(vault)?.symbol)
        if (assetKey && !underlyingAssetVaults[assetKey]) {
          availableUnderlyingAssets.add(assetKey)
          underlyingAssetVaults[assetKey] = vault
        } else if (assetKey) {
          availableUnderlyingAssets.add(assetKey)
        }

        const matchesUnderlyingAsset =
          !hasUnderlyingAssetFilter || (assetKey ? expandedUnderlyingAssets.has(assetKey) : false)
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
      underlyingAssetVaults,
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
    normalizedUnderlyingAssets,
    expandedUnderlyingAssets,
    minTvlValue,
    searchRegex,
    lowercaseSearch,
    isSearchEnabled,
    showHiddenVaults,
    version
  ])

  return {
    ...filteredResults,
    holdingsVaults,
    availableVaults,
    isLoading: isEnabled ? isLoadingVaultList : false
  }
}
