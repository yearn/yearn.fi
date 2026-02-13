import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { type TPossibleSortBy, useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  HOLDINGS_TOGGLE_VALUE,
  selectVaultsByType,
  V2_ASSET_CATEGORIES,
  V3_ASSET_CATEGORIES
} from '@pages/vaults/utils/constants'
import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'
import type { TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { useV2VaultFilter } from '@shared/hooks/useV2VaultFilter'
import { useV3VaultFilter } from '@shared/hooks/useV3VaultFilter'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { useMemo } from 'react'

type TVaultsPinnedSection = {
  key: string
  vaults: TKongVault[]
}

type TVaultsListModelArgs = {
  listVaultType: TVaultType
  listChains: number[] | null
  listV3Types: string[]
  listCategories: string[] | null
  listAggressiveness: string[] | null
  listUnderlyingAssets: string[] | null
  listMinTvl: number
  listShowLegacyVaults: boolean
  listShowHiddenVaults: boolean
  searchValue: string
  sortBy: TPossibleSortBy
  sortDirection: TSortDirection
  isHoldingsPinned: boolean
  isAvailablePinned: boolean
}

type TVaultsListModel = {
  defaultCategories: string[]
  listCategoriesSanitized: string[]
  holdingsVaults: TKongVault[]
  availableVaults: TKongVault[]
  vaultFlags: Record<string, { hasHoldings: boolean; isMigratable: boolean; isRetired: boolean; isHidden: boolean }>
  underlyingAssetVaults: Record<string, TKongVault>
  pinnedSections: TVaultsPinnedSection[]
  pinnedVaults: TKongVault[]
  mainVaults: TKongVault[]
  suggestedVaults: TKongVault[]
  totalMatchingVaults: number
  totalHoldingsMatching: number
  isLoadingVaultList: boolean
}

export function useVaultsListModel({
  listVaultType,
  listChains,
  listV3Types,
  listCategories,
  listAggressiveness,
  listUnderlyingAssets,
  listMinTvl,
  listShowLegacyVaults,
  listShowHiddenVaults,
  searchValue,
  sortBy,
  sortDirection,
  isHoldingsPinned,
  isAvailablePinned
}: TVaultsListModelArgs): TVaultsListModel {
  const isAllVaults = listVaultType === 'all'
  const isV3View = listVaultType === 'v3' || isAllVaults
  const isV2View = listVaultType === 'factory' || isAllVaults

  const listV2Types = useMemo(
    () => (listShowLegacyVaults ? ['factory', 'legacy'] : ['factory']),
    [listShowLegacyVaults]
  )

  const listCategoriesSanitized = useMemo(() => {
    const allowed = V3_ASSET_CATEGORIES
    return (listCategories || []).filter((value) => allowed.includes(value))
  }, [listCategories])

  const listAggressivenessSanitized = useMemo(() => {
    const allowed = new Set(AGGRESSIVENESS_OPTIONS)
    return (listAggressiveness || []).filter((value): value is TVaultAggressiveness =>
      allowed.has(value as TVaultAggressiveness)
    )
  }, [listAggressiveness])

  const v3FilterResult = useV3VaultFilter(
    isV3View ? listV3Types : null,
    listChains,
    searchValue,
    isV3View ? listCategoriesSanitized : null,
    isV3View ? listAggressivenessSanitized : null,
    isV3View ? listUnderlyingAssets : null,
    listMinTvl,
    isV3View ? listShowHiddenVaults : undefined,
    isV3View
  )

  const v2FilterResult = useV2VaultFilter(
    isV2View ? listV2Types : null,
    listChains,
    searchValue,
    isV2View ? listCategoriesSanitized : null,
    isV2View ? listAggressivenessSanitized : null,
    isV2View ? listUnderlyingAssets : null,
    listMinTvl,
    listShowHiddenVaults,
    isV2View
  )

  const { filteredVaults: filteredV2VaultsAllChains } = useV2VaultFilter(
    isV2View ? listV2Types : null,
    null,
    '',
    isV2View ? listCategoriesSanitized : null,
    isV2View ? listAggressivenessSanitized : null,
    isV2View ? listUnderlyingAssets : null,
    listMinTvl,
    listShowHiddenVaults,
    isV2View
  )

  const filteredVaults = useMemo(
    () => selectVaultsByType(listVaultType, v3FilterResult.filteredVaults, v2FilterResult.filteredVaults, true),
    [listVaultType, v3FilterResult.filteredVaults, v2FilterResult.filteredVaults]
  )

  const holdingsVaults = useMemo(
    () => selectVaultsByType(listVaultType, v3FilterResult.holdingsVaults, v2FilterResult.holdingsVaults, true),
    [listVaultType, v3FilterResult.holdingsVaults, v2FilterResult.holdingsVaults]
  )

  const availableVaults = useMemo(
    () => selectVaultsByType(listVaultType, v3FilterResult.availableVaults, v2FilterResult.availableVaults, true),
    [listVaultType, v3FilterResult.availableVaults, v2FilterResult.availableVaults]
  )

  const vaultFlags = useMemo(
    () => selectVaultsByType(listVaultType, v3FilterResult.vaultFlags, v2FilterResult.vaultFlags),
    [listVaultType, v3FilterResult.vaultFlags, v2FilterResult.vaultFlags]
  )

  const isLoadingVaultList =
    listVaultType === 'all'
      ? v3FilterResult.isLoading || v2FilterResult.isLoading
      : listVaultType === 'v3'
        ? v3FilterResult.isLoading
        : v2FilterResult.isLoading

  const totalMatchingVaults = useMemo(() => {
    const v3Total = v3FilterResult.totalMatchingVaults ?? 0
    const v2Total = v2FilterResult.filteredVaults.length
    if (listVaultType === 'v3') {
      return v3Total
    }
    if (listVaultType === 'factory') {
      return v2Total
    }
    return v3Total + v2Total
  }, [listVaultType, v3FilterResult.totalMatchingVaults, v2FilterResult.filteredVaults.length])

  const totalHoldingsMatching = useMemo(() => {
    const v3Total = v3FilterResult.totalHoldingsMatching ?? 0
    const v2Total = v2FilterResult.holdingsVaults.length
    if (listVaultType === 'v3') {
      return v3Total
    }
    if (listVaultType === 'factory') {
      return v2Total
    }
    return v3Total + v2Total
  }, [listVaultType, v3FilterResult.totalHoldingsMatching, v2FilterResult.holdingsVaults.length])

  const allocatorTypesForTrending = useMemo(() => (isV3View ? ['multi'] : null), [isV3View])

  const { filteredVaults: filteredVaultsAllChains } = useV3VaultFilter(
    allocatorTypesForTrending,
    null,
    '',
    isV3View ? listCategoriesSanitized : null,
    isV3View ? listAggressivenessSanitized : null,
    isV3View ? listUnderlyingAssets : null,
    listMinTvl,
    isV3View ? listShowHiddenVaults : undefined,
    isV3View
  )

  const sortedVaults = useSortVaults(filteredVaults, sortBy, sortDirection)

  const holdingsKeySet = useMemo(() => new Set(holdingsVaults.map((vault) => getVaultKey(vault))), [holdingsVaults])

  const availableKeySet = useMemo(() => new Set(availableVaults.map((vault) => getVaultKey(vault))), [availableVaults])

  const sortedHoldingsVaults = useMemo(
    () => sortedVaults.filter((vault) => holdingsKeySet.has(getVaultKey(vault))),
    [sortedVaults, holdingsKeySet]
  )

  const sortedAvailableVaults = useMemo(
    () => sortedVaults.filter((vault) => availableKeySet.has(getVaultKey(vault))),
    [sortedVaults, availableKeySet]
  )

  const sortedSuggestedV3Candidates = useSortVaults(filteredVaultsAllChains, 'featuringScore', 'desc')
  const sortedSuggestedV2Candidates = useSortVaults(filteredV2VaultsAllChains, 'featuringScore', 'desc')

  const pinnedSections = useMemo(() => {
    const sections: TVaultsPinnedSection[] = []
    const seen = new Set<string>()

    if (isAvailablePinned) {
      const availableSectionVaults = sortedAvailableVaults.filter((vault) => {
        const key = getVaultKey(vault)
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })

      if (availableSectionVaults.length > 0) {
        sections.push({
          key: AVAILABLE_TOGGLE_VALUE,
          vaults: availableSectionVaults
        })
      }
    }

    if (isHoldingsPinned) {
      const holdingsSectionVaults = sortedHoldingsVaults.filter((vault) => {
        const key = getVaultKey(vault)
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })

      if (holdingsSectionVaults.length > 0) {
        sections.push({
          key: HOLDINGS_TOGGLE_VALUE,
          vaults: holdingsSectionVaults
        })
      }
    }

    return sections
  }, [isAvailablePinned, sortedAvailableVaults, isHoldingsPinned, sortedHoldingsVaults])

  const pinnedVaults = useMemo(() => pinnedSections.flatMap((section) => section.vaults), [pinnedSections])

  const pinnedVaultKeys = useMemo(() => new Set(pinnedVaults.map((vault) => getVaultKey(vault))), [pinnedVaults])

  const mainVaults = useMemo(() => {
    if (pinnedVaults.length === 0) {
      return sortedVaults
    }
    return sortedVaults.filter((vault) => !pinnedVaultKeys.has(getVaultKey(vault)))
  }, [pinnedVaultKeys, pinnedVaults.length, sortedVaults])

  const suggestedV3Vaults = useMemo(
    () => sortedSuggestedV3Candidates.filter((vault) => !holdingsKeySet.has(getVaultKey(vault))).slice(0, 8),
    [sortedSuggestedV3Candidates, holdingsKeySet]
  )

  const suggestedV2Vaults = useMemo(
    () => sortedSuggestedV2Candidates.filter((vault) => !holdingsKeySet.has(getVaultKey(vault))).slice(0, 8),
    [sortedSuggestedV2Candidates, holdingsKeySet]
  )

  const suggestedVaults = useMemo(() => {
    if (listVaultType === 'all') {
      return [...suggestedV3Vaults, ...suggestedV2Vaults].slice(0, 8)
    }
    if (listVaultType === 'v3') {
      return suggestedV3Vaults
    }
    return suggestedV2Vaults
  }, [listVaultType, suggestedV3Vaults, suggestedV2Vaults])

  const defaultCategories = isV3View ? V3_ASSET_CATEGORIES : V2_ASSET_CATEGORIES
  const underlyingAssetVaults = useMemo(() => {
    if (listVaultType === 'all') {
      return { ...v3FilterResult.underlyingAssetVaults, ...v2FilterResult.underlyingAssetVaults }
    }
    if (listVaultType === 'v3') {
      return v3FilterResult.underlyingAssetVaults
    }
    return v2FilterResult.underlyingAssetVaults
  }, [listVaultType, v2FilterResult.underlyingAssetVaults, v3FilterResult.underlyingAssetVaults])

  return {
    defaultCategories,
    listCategoriesSanitized,
    holdingsVaults,
    availableVaults,
    vaultFlags,
    underlyingAssetVaults,
    pinnedSections,
    pinnedVaults,
    mainVaults,
    suggestedVaults,
    totalMatchingVaults,
    totalHoldingsMatching,
    isLoadingVaultList
  }
}
