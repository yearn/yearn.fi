'use client'

import {
  getVaultAddress,
  getVaultChainID,
  type TKongVault,
  type TKongVaultInput,
  type TKongVaultView
} from '@pages/vaults/domain/kongVaultSelectors'
import { type TPossibleSortBy, useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  HOLDINGS_TOGGLE_VALUE,
  selectVaultsByType,
  V3_ASSET_CATEGORIES
} from '@pages/vaults/utils/constants'
import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'
import type { TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useWallet } from '@shared/contexts/useWallet'
import { useV2VaultFilter } from '@shared/hooks/useV2VaultFilter'
import { useV3VaultFilter } from '@shared/hooks/useV3VaultFilter'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import { useMemo } from 'react'

type TVaultsPinnedSection = {
  key: string
  vaults: TKongVaultInput[]
}

type TVaultsListModelArgs = {
  enabled?: boolean
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

function matchesYvUsdFilters({
  isV3View,
  listChains,
  listCategories,
  listMinTvl,
  searchValue,
  yvUsdVault
}: {
  isV3View: boolean
  listChains: number[] | null
  listCategories: string[]
  listMinTvl: number
  searchValue: string
  yvUsdVault?: TKongVaultView
}): boolean {
  if (!yvUsdVault || !isV3View) {
    return false
  }

  const matchesChain = !listChains?.length || listChains.includes(yvUsdVault.chainID)
  const matchesCategory = listCategories.length === 0 || listCategories.includes(yvUsdVault.category)
  const trimmedSearch = searchValue.trim().toLowerCase()
  const matchesSearch =
    trimmedSearch.length === 0 ||
    `${yvUsdVault.name} ${yvUsdVault.symbol} ${yvUsdVault.token.symbol} ${yvUsdVault.token.name} ${yvUsdVault.address}`
      .toLowerCase()
      .includes(trimmedSearch)
  const minTvlValue = Number.isFinite(listMinTvl) ? Math.max(0, listMinTvl || 0) : 0
  const meetsMinTvl = (yvUsdVault.tvl?.tvl ?? 0) >= minTvlValue

  return matchesChain && matchesCategory && matchesSearch && meetsMinTvl
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

function appendUniqueVault(vaults: TKongVaultInput[], vaultToAppend?: TKongVaultInput): TKongVaultInput[] {
  if (!vaultToAppend) {
    return vaults
  }

  const nextKey = getVaultKey(vaultToAppend)
  if (vaults.some((vault) => getVaultKey(vault) === nextKey)) {
    return vaults
  }

  return [...vaults, vaultToAppend]
}

export function useVaultsListModel({
  enabled = true,
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
  holdingsPinnedSortDirection,
  isHoldingsPinned,
  isAvailablePinned
}: TVaultsListModelArgs): TVaultsListModel {
  const isAllVaults = listVaultType === 'all'

  const isV3View = enabled && (listVaultType === 'v3' || isAllVaults)
  const isV2View = enabled && (listVaultType === 'factory' || isAllVaults)
  const { listVault: yvUsdVault } = useYvUsdVaults()
  const { getBalance } = useWallet()

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

  const shouldShowYvUsd = useMemo(
    () =>
      matchesYvUsdFilters({
        isV3View,
        listChains,
        listCategories: listCategoriesSanitized,
        listMinTvl,
        searchValue,
        yvUsdVault
      }),
    [isV3View, listChains, listCategoriesSanitized, listMinTvl, searchValue, yvUsdVault]
  )

  const yvUsdHasHoldings = useMemo(() => {
    const unlockedBalance = getBalance({ address: YVUSD_UNLOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).raw
    const lockedBalance = getBalance({ address: YVUSD_LOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).raw
    return unlockedBalance > 0n || lockedBalance > 0n
  }, [getBalance])
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

  const sanitizedV3FilteredVaults = useMemo(
    () => removeRawYvUsdVariants(v3FilterResult.filteredVaults),
    [v3FilterResult.filteredVaults]
  )

  const sanitizedV3HoldingsVaults = useMemo(
    () => removeRawYvUsdVariants(v3FilterResult.holdingsVaults),
    [v3FilterResult.holdingsVaults]
  )

  const sanitizedV3AvailableVaults = useMemo(
    () => removeRawYvUsdVariants(v3FilterResult.availableVaults),
    [v3FilterResult.availableVaults]
  )

  const filteredVaults = useMemo<TKongVaultInput[]>(
    () =>
      selectVaultsByType(
        listVaultType,
        shouldShowYvUsd ? appendUniqueVault(sanitizedV3FilteredVaults, yvUsdVault) : sanitizedV3FilteredVaults,
        v2FilterResult.filteredVaults,
        true
      ),
    [listVaultType, sanitizedV3FilteredVaults, shouldShowYvUsd, v2FilterResult.filteredVaults, yvUsdVault]
  )

  const holdingsVaults = useMemo<TKongVaultInput[]>(
    () =>
      selectVaultsByType(
        listVaultType,
        shouldShowYvUsd && yvUsdHasHoldings
          ? appendUniqueVault(sanitizedV3HoldingsVaults, yvUsdVault)
          : sanitizedV3HoldingsVaults,
        v2FilterResult.holdingsVaults,
        true
      ),
    [
      listVaultType,
      sanitizedV3HoldingsVaults,
      shouldShowYvUsd,
      yvUsdHasHoldings,
      v2FilterResult.holdingsVaults,
      yvUsdVault
    ]
  )

  const availableVaults = useMemo<TKongVaultInput[]>(
    () => selectVaultsByType(listVaultType, sanitizedV3AvailableVaults, v2FilterResult.availableVaults, true),
    [listVaultType, sanitizedV3AvailableVaults, v2FilterResult.availableVaults]
  )

  const vaultFlags = useMemo(() => {
    const baseFlags = selectVaultsByType(listVaultType, v3FilterResult.vaultFlags, v2FilterResult.vaultFlags)
    if (!yvUsdVault) {
      return baseFlags
    }
    const yvUsdKey = getVaultKey(yvUsdVault)
    return {
      ...baseFlags,
      [yvUsdKey]: {
        hasHoldings: yvUsdHasHoldings,
        isMigratable: false,
        isRetired: false,
        isHidden: false
      }
    }
  }, [listVaultType, v3FilterResult.vaultFlags, v2FilterResult.vaultFlags, yvUsdHasHoldings, yvUsdVault])

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
    removeRawYvUsdVariants(filteredVaultsAllChains),
    'featuringScore',
    'desc'
  )
  const sortedSuggestedV2Candidates = useSortVaults(filteredV2VaultsAllChains, 'featuringScore', 'desc')

  const pinnedSections = useMemo(() => {
    const sections: TVaultsPinnedSection[] = []
    const seen = new Set<string>()
    const takeUnseenVaults = (vaults: TKongVaultInput[]): TKongVaultInput[] =>
      vaults.filter((vault) => {
        const key = getVaultKey(vault)
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })

    if (shouldShowYvUsd && yvUsdVault) {
      const yvUsdSectionVaults = takeUnseenVaults([yvUsdVault])
      if (yvUsdSectionVaults.length > 0) {
        sections.push({
          key: 'yvUSD',
          vaults: yvUsdSectionVaults
        })
      }
    }

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
    shouldShowYvUsd,
    yvUsdVault
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
