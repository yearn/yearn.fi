import { getTranchedVaultRowsByKind, type TTranchedVaultRow } from '@pages/vaults/constants/tranchedProducts'
import {
  getVaultAddress,
  getVaultCategory,
  getVaultChainID,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  type TKongVault,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { type TPossibleSortBy, useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  HOLDINGS_TOGGLE_VALUE,
  selectVaultsByType,
  V3_ASSET_CATEGORIES
} from '@pages/vaults/utils/constants'
import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'
import type { TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { isYvBtcVault } from '@pages/vaults/utils/yvBtc'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useV2VaultFilter } from '@shared/hooks/useV2VaultFilter'
import { useV3VaultFilter } from '@shared/hooks/useV3VaultFilter'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { useMemo } from 'react'
import type { TVaultsPinnedSection } from './useVaultsListModel.helpers'

type TVaultsListModelArgs = {
  enabled?: boolean
  listVaultType: TVaultType
  listChains: number[] | null
  listV3Types: string[]
  listCategories: string[] | null
  listAggressiveness: string[] | null
  listUnderlyingAssets: string[] | null
  listFeeStructureKey: string | null
  listMinTvl: number
  listShowLegacyVaults: boolean
  listShowHiddenVaults: boolean
  searchValue: string
  sortBy: TPossibleSortBy
  sortDirection: TSortDirection
  holdingsPinnedSortDirection: TSortDirection
  isHoldingsPinned: boolean
  isAvailablePinned: boolean
}

type TVaultsListModel = {
  listCategoriesSanitized: string[]
  holdingsVaults: TKongVaultInput[]
  availableVaults: TKongVaultInput[]
  vaultFlags: Record<string, { hasHoldings: boolean; isMigratable: boolean; isRetired: boolean; isHidden: boolean }>
  underlyingAssetVaults: Record<string, TKongVault>
  pinnedSections: TVaultsPinnedSection[]
  pinnedVaults: TKongVaultInput[]
  mainVaults: TKongVaultInput[]
  suggestedVaults: TKongVault[]
  totalMatchingVaults: number
  totalHoldingsMatching: number
  isLoadingVaultList: boolean
}

function isYvUsdVariantVault(vault: TKongVaultInput): boolean {
  const chainID = getVaultChainID(vault)
  if (chainID !== YVUSD_CHAIN_ID) {
    return false
  }

  const address = getVaultAddress(vault)
  return address === YVUSD_UNLOCKED_ADDRESS || address === YVUSD_LOCKED_ADDRESS
}

function removeRawYvUsdVariants<TVault extends TKongVaultInput>(vaults: TVault[]): TVault[] {
  return vaults.filter((vault) => !isYvUsdVariantVault(vault))
}

function removePrelaunchYvBtcVaults<TVault extends TKongVaultInput>(vaults: TVault[]): TVault[] {
  return vaults.filter((vault) => !isYvBtcVault(vault))
}

function matchesTranchedVaultFilters({
  row,
  listChains,
  listCategories,
  listMinTvl,
  searchValue
}: {
  row: TTranchedVaultRow
  listChains: number[] | null
  listCategories: string[]
  listMinTvl: number
  searchValue: string
}): boolean {
  const { vault, product } = row
  const matchesChain = !listChains?.length || listChains.includes(getVaultChainID(vault))
  const category = getVaultCategory(vault)
  const matchesCategory = listCategories.length === 0 || listCategories.includes(category)
  const minTvlValue = Number.isFinite(listMinTvl) ? Math.max(0, listMinTvl || 0) : 0
  const meetsMinTvl = (getVaultTVL(vault).tvl ?? 0) >= minTvlValue
  const trimmedSearch = searchValue.trim().toLowerCase()
  const token = getVaultToken(vault)
  const matchesSearch =
    trimmedSearch.length === 0 ||
    `${getVaultName(vault)} ${getVaultSymbol(vault)} ${token.symbol} ${token.name} ${product.asset}`
      .toLowerCase()
      .includes(trimmedSearch)

  return matchesChain && matchesCategory && meetsMinTvl && matchesSearch
}

function getFilteredTranchedVaults({
  kind,
  listChains,
  listCategories,
  listMinTvl,
  searchValue
}: {
  kind: 'senior' | 'junior'
  listChains: number[] | null
  listCategories: string[]
  listMinTvl: number
  searchValue: string
}): TKongVaultInput[] {
  return getTranchedVaultRowsByKind(kind)
    .filter((row) => matchesTranchedVaultFilters({ row, listChains, listCategories, listMinTvl, searchValue }))
    .map((row) => row.vault)
}

export function useVaultsListModel({
  enabled = true,
  listVaultType,
  listChains,
  listV3Types,
  listCategories,
  listAggressiveness,
  listUnderlyingAssets,
  listFeeStructureKey,
  listMinTvl,
  listShowLegacyVaults,
  listShowHiddenVaults,
  searchValue,
  sortBy,
  sortDirection,
  holdingsPinnedSortDirection,
  isHoldingsPinned,
  isAvailablePinned
}: TVaultsListModelArgs): TVaultsListModel {
  const isAllVaults = listVaultType === 'all'

  const isV3View = enabled && (listVaultType === 'v3' || isAllVaults)
  const isV2View = enabled && (listVaultType === 'factory' || isAllVaults)

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

  const filteredSeniorTranchedVaults = useMemo(
    () =>
      listVaultType === 'fixed' || isAllVaults
        ? getFilteredTranchedVaults({
            kind: 'senior',
            listChains,
            listCategories: listCategoriesSanitized,
            listMinTvl,
            searchValue
          })
        : [],
    [isAllVaults, listVaultType, listChains, listCategoriesSanitized, listMinTvl, searchValue]
  )

  const filteredJuniorTranchedVaults = useMemo(
    () =>
      listVaultType === 'v3' || isAllVaults
        ? getFilteredTranchedVaults({
            kind: 'junior',
            listChains,
            listCategories: listCategoriesSanitized,
            listMinTvl,
            searchValue
          })
        : [],
    [isAllVaults, listVaultType, listChains, listCategoriesSanitized, listMinTvl, searchValue]
  )

  const v3FilterResult = useV3VaultFilter(
    isV3View ? listV3Types : null,
    listChains,
    searchValue,
    isV3View ? listCategoriesSanitized : null,
    isV3View ? listAggressivenessSanitized : null,
    isV3View ? listUnderlyingAssets : null,
    listMinTvl,
    isV3View ? listShowHiddenVaults : undefined,
    listFeeStructureKey,
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
    listFeeStructureKey,
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
    listFeeStructureKey,
    isV2View
  )

  const sanitizedV3FilteredVaults = useMemo(
    () => removePrelaunchYvBtcVaults(removeRawYvUsdVariants(v3FilterResult.filteredVaults)),
    [v3FilterResult.filteredVaults]
  )

  const sanitizedV3HoldingsVaults = useMemo(
    () => removePrelaunchYvBtcVaults(removeRawYvUsdVariants(v3FilterResult.holdingsVaults)),
    [v3FilterResult.holdingsVaults]
  )

  const sanitizedV3AvailableVaults = useMemo(
    () => removePrelaunchYvBtcVaults(removeRawYvUsdVariants(v3FilterResult.availableVaults)),
    [v3FilterResult.availableVaults]
  )

  const filteredVaults = useMemo<TKongVaultInput[]>(() => {
    if (listVaultType === 'fixed') {
      return filteredSeniorTranchedVaults
    }
    const v3Vaults = isAllVaults
      ? [...filteredSeniorTranchedVaults, ...filteredJuniorTranchedVaults, ...sanitizedV3FilteredVaults]
      : [...filteredJuniorTranchedVaults, ...sanitizedV3FilteredVaults]
    return selectVaultsByType(listVaultType, v3Vaults, v2FilterResult.filteredVaults, true)
  }, [
    filteredJuniorTranchedVaults,
    filteredSeniorTranchedVaults,
    isAllVaults,
    listVaultType,
    sanitizedV3FilteredVaults,
    v2FilterResult.filteredVaults
  ])

  const holdingsVaults = useMemo<TKongVaultInput[]>(() => {
    if (listVaultType === 'fixed') {
      return []
    }
    return selectVaultsByType(listVaultType, sanitizedV3HoldingsVaults, v2FilterResult.holdingsVaults, true)
  }, [listVaultType, sanitizedV3HoldingsVaults, v2FilterResult.holdingsVaults])

  const availableVaults = useMemo<TKongVaultInput[]>(() => {
    if (listVaultType === 'fixed') {
      return filteredSeniorTranchedVaults
    }
    const v3Vaults = isAllVaults
      ? [...filteredSeniorTranchedVaults, ...filteredJuniorTranchedVaults, ...sanitizedV3AvailableVaults]
      : [...filteredJuniorTranchedVaults, ...sanitizedV3AvailableVaults]
    return selectVaultsByType(listVaultType, v3Vaults, v2FilterResult.availableVaults, true)
  }, [
    filteredJuniorTranchedVaults,
    filteredSeniorTranchedVaults,
    isAllVaults,
    listVaultType,
    sanitizedV3AvailableVaults,
    v2FilterResult.availableVaults
  ])

  const vaultFlags = useMemo(() => {
    const baseFlags = selectVaultsByType(listVaultType, v3FilterResult.vaultFlags, v2FilterResult.vaultFlags)
    const tranchedFlags = Object.fromEntries(
      [...filteredSeniorTranchedVaults, ...filteredJuniorTranchedVaults].map((vault) => [
        getVaultKey(vault),
        {
          hasHoldings: false,
          isMigratable: false,
          isRetired: false,
          isHidden: false
        }
      ])
    ) as TVaultsListModel['vaultFlags']
    return { ...baseFlags, ...tranchedFlags }
  }, [
    filteredJuniorTranchedVaults,
    filteredSeniorTranchedVaults,
    listVaultType,
    v2FilterResult.vaultFlags,
    v3FilterResult.vaultFlags
  ])

  const isLoadingVaultList =
    listVaultType === 'all'
      ? v3FilterResult.isLoading || v2FilterResult.isLoading
      : listVaultType === 'v3'
        ? v3FilterResult.isLoading
        : v2FilterResult.isLoading

  const totalMatchingVaults = useMemo(() => {
    return filteredVaults.length
  }, [filteredVaults.length])

  const totalHoldingsMatching = useMemo(() => {
    return holdingsVaults.length
  }, [holdingsVaults.length])

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
    listFeeStructureKey,
    isV3View
  )

  const sortedVaults = useSortVaults(filteredVaults, sortBy, sortDirection)

  const holdingsKeySet = useMemo(() => new Set(holdingsVaults.map((vault) => getVaultKey(vault))), [holdingsVaults])

  const availableKeySet = useMemo(() => new Set(availableVaults.map((vault) => getVaultKey(vault))), [availableVaults])

  const sortedHoldingsVaults = useMemo(
    () => sortedVaults.filter((vault) => holdingsKeySet.has(getVaultKey(vault))),
    [sortedVaults, holdingsKeySet]
  )

  const sortedHoldingsVaultsByDeposited = useSortVaults(
    sortedHoldingsVaults,
    'deposited',
    holdingsPinnedSortDirection || 'desc'
  )

  const sortedAvailableVaults = useMemo(
    () => sortedVaults.filter((vault) => availableKeySet.has(getVaultKey(vault))),
    [sortedVaults, availableKeySet]
  )

  const sortedSuggestedV3Candidates = useSortVaults(
    removePrelaunchYvBtcVaults(removeRawYvUsdVariants(filteredVaultsAllChains)),
    'featuringScore',
    'desc'
  )
  const sortedSuggestedV2Candidates = useSortVaults(filteredV2VaultsAllChains, 'featuringScore', 'desc')

  const pinnedSections = useMemo(() => {
    const sections: TVaultsPinnedSection[] = []
    const seen = new Set(sections.flatMap((section) => section.vaults.map((vault) => getVaultKey(vault))))
    const takeUnseenVaults = (vaults: TKongVaultInput[]): TKongVaultInput[] =>
      vaults.filter((vault) => {
        const key = getVaultKey(vault)
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })

    if (isAvailablePinned) {
      const availableSectionVaults = takeUnseenVaults(sortedAvailableVaults)
      if (availableSectionVaults.length > 0) {
        sections.push({
          key: AVAILABLE_TOGGLE_VALUE,
          vaults: availableSectionVaults
        })
      }
    }

    if (isHoldingsPinned) {
      const holdingsSourceVaults =
        holdingsPinnedSortDirection === '' ? sortedHoldingsVaults : sortedHoldingsVaultsByDeposited
      const holdingsSectionVaults = takeUnseenVaults(holdingsSourceVaults)
      if (holdingsSectionVaults.length > 0) {
        sections.push({
          key: HOLDINGS_TOGGLE_VALUE,
          vaults: holdingsSectionVaults
        })
      }
    }

    return sections
  }, [
    isAvailablePinned,
    holdingsPinnedSortDirection,
    isHoldingsPinned,
    sortedHoldingsVaults,
    sortedHoldingsVaultsByDeposited,
    sortedAvailableVaults,
    sortedVaults
  ])

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
