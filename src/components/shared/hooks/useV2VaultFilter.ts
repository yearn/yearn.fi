import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
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
import { isZeroAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
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
  isActive: boolean
  isMigratable: boolean
  isRetired: boolean
  isBypassedHolding: boolean
}

type TVaultWalletFlags = {
  hasHoldings: boolean
  hasAvailableBalance: boolean
}

type TOptimizedV2VaultFilterResult = {
  filteredVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  availableVaults: TYDaemonVault[]
  vaultFlags: Record<string, TVaultFlags>
  availableUnderlyingAssets: string[]
  underlyingAssetVaults: Record<string, TYDaemonVault>
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
  const { vaults, allVaults, getPrice, isLoadingVaultList } = useYearn()
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
  const checkHasRawHoldings = useMemo(
    () =>
      (vault: TYDaemonVault): boolean => {
        const vaultBalance = getBalance({
          address: vault.address,
          chainID: vault.chainID
        })
        if (vaultBalance.raw > 0n) {
          return true
        }
        if (isZeroAddress(vault.staking.address)) {
          return false
        }
        const stakingBalance = getBalance({
          address: vault.staking.address,
          chainID: vault.chainID
        })
        return stakingBalance.raw > 0n
      },
    [getBalance]
  )

  const vaultIndex = useDeepCompareMemo(() => {
    if (!isEnabled) {
      return new Map<string, TVaultIndexEntry>()
    }
    const vaultMap = new Map<string, TVaultIndexEntry>()

    const shouldIncludeVault = (vault: TYDaemonVault): boolean =>
      !isAllocatorVaultOverride(vault) && !isV3Vault(vault, false)

    const upsertVault = (
      vault: TYDaemonVault,
      updates: Partial<Pick<TVaultIndexEntry, 'isActive' | 'isMigratable' | 'isRetired' | 'isBypassedHolding'>>
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
        isActive: Boolean(updates.isActive),
        isMigratable: Boolean(updates.isMigratable),
        isRetired: Boolean(updates.isRetired),
        isBypassedHolding: Boolean(updates.isBypassedHolding)
      })
    }

    Object.values(vaults).forEach((vault) => {
      if (!shouldIncludeVault(vault)) {
        return
      }
      const isRetired = Boolean(vault.info?.isRetired)
      upsertVault(vault, { isActive: !isRetired, isRetired, isMigratable: Boolean(vault.migration?.available) })
    })

    Object.values(allVaults).forEach((vault) => {
      if (!shouldIncludeVault(vault)) {
        return
      }
      const key = getVaultKey(vault)
      if (vaultMap.has(key)) {
        return
      }
      if (!checkHasRawHoldings(vault)) {
        return
      }
      const isRetired = Boolean(vault.info?.isRetired)
      upsertVault(vault, {
        isActive: !isRetired,
        isRetired,
        isMigratable: Boolean(vault.migration?.available),
        isBypassedHolding: true
      })
    })

    return vaultMap
  }, [isEnabled, isEnabled ? vaults : null, isEnabled ? allVaults : null, checkHasRawHoldings])

  const walletFlags = useMemo(() => {
    const flags = new Map<string, TVaultWalletFlags>()
    vaultIndex.forEach((entry, key) => {
      const hasRawHoldings = entry.isBypassedHolding ? checkHasRawHoldings(entry.vault) : false
      flags.set(key, {
        hasHoldings: hasRawHoldings || checkHasHoldings(entry.vault),
        hasAvailableBalance: checkHasAvailableBalance(entry.vault)
      })
    })
    return flags
  }, [vaultIndex, checkHasHoldings, checkHasAvailableBalance, checkHasRawHoldings])

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
    const shouldShowHidden = Boolean(showHiddenVaults)
    const hasChainFilter = Boolean(chains?.length)
    const hasTypeFilter = Boolean(types?.length)
    const hasCategoryFilter = Boolean(categories?.length)
    const hasAggressivenessFilter = Boolean(aggressiveness?.length)
    const hasUnderlyingAssetFilter = normalizedUnderlyingAssets.size > 0
    const availableUnderlyingAssets = new Set<string>()
    const underlyingAssetVaults: Record<string, TYDaemonVault> = {}

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
      const isMigratableVault = Boolean(isMigratable && hasHoldings)
      const isRetiredVault = Boolean(isRetired && hasHoldings)
      const hasUserHoldings = hasHoldings || isMigratableVault || isRetiredVault

      if (!isActive && !hasHoldings) {
        return
      }
      if (!shouldShowHidden && isHidden) {
        return
      }

      if (!matchesSearch(searchableText)) {
        return
      }

      if (!hasUserHoldings && hasChainFilter && !chains?.includes(vault.chainID)) {
        return
      }

      const vaultTvl = vault.tvl?.tvl || 0
      if (!hasUserHoldings && vaultTvl < minTvlValue) {
        return
      }

      vaultFlags[key] = {
        hasHoldings: hasUserHoldings,
        isMigratable: isMigratableVault,
        isRetired: isRetiredVault,
        isHidden
      }

      const matchesKind = hasUserHoldings || !hasTypeFilter || Boolean(types?.includes(kind))
      const matchesCategory = hasUserHoldings || !hasCategoryFilter || Boolean(categories?.includes(category))
      const matchesAggressiveness =
        hasUserHoldings ||
        !hasAggressivenessFilter ||
        (aggressivenessScore !== null && Boolean(aggressiveness?.includes(aggressivenessScore)))

      if (matchesKind && matchesCategory && matchesAggressiveness) {
        const assetKey = normalizeUnderlyingAssetSymbol(vault.token?.symbol)
        if (assetKey && !underlyingAssetVaults[assetKey]) {
          availableUnderlyingAssets.add(assetKey)
          underlyingAssetVaults[assetKey] = vault
        } else if (assetKey) {
          availableUnderlyingAssets.add(assetKey)
        }

        const matchesUnderlyingAsset =
          hasUserHoldings || !hasUnderlyingAssetFilter || (assetKey && expandedUnderlyingAssets.has(assetKey))
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
