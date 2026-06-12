import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultMigration,
  getVaultName,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getHoldingsAliasVaultAddress } from '@pages/vaults/domain/normalizeVault'
import { DEFAULT_MIN_TVL } from '@pages/vaults/utils/constants'
import { getVaultFeeStructureKey } from '@pages/vaults/utils/vaultFees'
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
import { useWalletStatus, useWalletTokens } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import type { TDict } from '@shared/types'
import { isZeroAddress } from '@shared/utils'
import { useMemo } from 'react'
import {
  createCheckHasAvailableBalance,
  createCheckHasHoldings,
  getVaultKey,
  isV3Vault,
  matchesSelectedChains,
  type TVaultFlags
} from './useVaultFilterUtils'

type TVaultIndexEntry = {
  key: string
  vault: TKongVaultInput
  searchableText: string
  kind: ReturnType<typeof deriveListKind>
  category: string
  aggressiveness: TVaultAggressiveness | null
  feeStructureKey: string
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
  filteredVaults: TKongVaultInput[]
  holdingsVaults: TKongVaultInput[]
  availableVaults: TKongVaultInput[]
  vaultFlags: Record<string, TVaultFlags>
  availableUnderlyingAssets: string[]
  underlyingAssetVaults: Record<string, TKongVaultInput>
  isLoading: boolean
}

type TVaultFilterSource = {
  vaults: TDict<TKongVaultInput>
  allVaults: TDict<TKongVaultInput>
  isLoadingVaultList?: boolean
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
  feeStructureKey?: string | null,
  enabled?: boolean,
  vaultSource?: TVaultFilterSource
): TOptimizedV2VaultFilterResult {
  const yearn = useYearn()
  const { getPrice } = yearn
  const vaults = vaultSource?.vaults ?? yearn.vaults
  const allVaults = vaultSource?.allVaults ?? yearn.allVaults
  const isLoadingVaultList = vaultSource?.isLoadingVaultList ?? yearn.isLoadingVaultList
  const { getBalance } = useWalletTokens()
  const { isLoading: isWalletLoading } = useWalletStatus()
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
      (vault: TKongVaultInput): boolean => {
        if (isWalletLoading) {
          return false
        }
        const chainID = getVaultChainID(vault)
        const vaultBalance = getBalance({
          address: getVaultAddress(vault),
          chainID
        })
        if (vaultBalance.raw > 0n) {
          return true
        }

        const staking = getVaultStaking(vault)
        if (isZeroAddress(staking.address)) {
          return false
        }

        const stakingBalance = getBalance({
          address: staking.address,
          chainID
        })
        return stakingBalance.raw > 0n
      },
    [getBalance, isWalletLoading]
  )

  const vaultIndex = useDeepCompareMemo(() => {
    if (!isEnabled) {
      return new Map<string, TVaultIndexEntry>()
    }
    const vaultMap = new Map<string, TVaultIndexEntry>()

    const shouldIncludeVault = (vault: TKongVaultInput): boolean =>
      !isAllocatorVaultOverride(vault) && !isV3Vault(vault, false)

    const upsertVault = (
      vault: TKongVaultInput,
      updates: Partial<Pick<TVaultIndexEntry, 'isActive' | 'isMigratable' | 'isRetired' | 'isBypassedHolding'>>
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
        feeStructureKey: getVaultFeeStructureKey(vault),
        isHidden: Boolean(getVaultInfo(vault)?.isHidden),
        isActive: Boolean(updates.isActive),
        isMigratable: Boolean(updates.isMigratable),
        isRetired: Boolean(updates.isRetired),
        isBypassedHolding: Boolean(updates.isBypassedHolding)
      })
    }

    Object.values(vaults).forEach((vault) => {
      if (getHoldingsAliasVaultAddress(getVaultAddress(vault))) {
        return
      }
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

    if (!isWalletLoading) {
      Object.values(allVaults).forEach((vault) => {
        if (getHoldingsAliasVaultAddress(getVaultAddress(vault))) {
          return
        }
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
        const isRetired = Boolean(getVaultInfo(vault)?.isRetired)
        upsertVault(vault, {
          isActive: !isRetired,
          isRetired,
          isMigratable: Boolean(getVaultMigration(vault)?.available),
          isBypassedHolding: true
        })
      })
    }

    return vaultMap
  }, [isEnabled, isEnabled ? vaults : null, isEnabled ? allVaults : null, checkHasRawHoldings, isWalletLoading])

  const walletFlags = useMemo(() => {
    if (isWalletLoading) {
      return new Map<string, TVaultWalletFlags>()
    }
    const flags = new Map<string, TVaultWalletFlags>()
    vaultIndex.forEach((entry, key) => {
      const hasRawHoldings = entry.isBypassedHolding ? checkHasRawHoldings(entry.vault) : false
      flags.set(key, {
        hasHoldings: hasRawHoldings || checkHasHoldings(entry.vault),
        hasAvailableBalance: checkHasAvailableBalance(entry.vault)
      })
    })
    return flags
  }, [vaultIndex, checkHasHoldings, checkHasAvailableBalance, checkHasRawHoldings, isWalletLoading])

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
    const filteredVaults: TKongVaultInput[] = []
    const vaultFlags: Record<string, TVaultFlags> = {}
    const shouldShowHidden = Boolean(showHiddenVaults)
    const hasChainFilter = Boolean(chains?.length)
    const hasTypeFilter = Boolean(types?.length)
    const hasCategoryFilter = Boolean(categories?.length)
    const hasAggressivenessFilter = Boolean(aggressiveness?.length)
    const hasUnderlyingAssetFilter = normalizedUnderlyingAssets.size > 0
    const hasFeeStructureFilter = Boolean(feeStructureKey)
    const availableUnderlyingAssets = new Set<string>()
    const underlyingAssetVaults: Record<string, TKongVaultInput> = {}

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
        feeStructureKey: entryFeeStructureKey,
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

      if (hasChainFilter && !matchesSelectedChains(getVaultChainID(vault), chains)) {
        return
      }

      const vaultTvl = getVaultTVL(vault)?.tvl || 0
      if (!hasUserHoldings && vaultTvl < minTvlValue) {
        return
      }

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
      const matchesFeeStructure = !hasFeeStructureFilter || entryFeeStructureKey === feeStructureKey

      if (matchesKind && matchesCategory && matchesAggressiveness && matchesFeeStructure) {
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
    showHiddenVaults,
    feeStructureKey
  ])

  return {
    ...filteredResults,
    holdingsVaults,
    availableVaults,
    isLoading: isEnabled ? isLoadingVaultList : false
  }
}
