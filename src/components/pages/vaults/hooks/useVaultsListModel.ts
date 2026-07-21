import { getTranchedVaultRowsByKind, type TTranchedVaultRow } from '@pages/vaults/constants/tranchedProducts'
import {
  getVaultAddress,
  getVaultCategory,
  getVaultChainID,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  type TKongVaultInput,
  type TKongVaultView
} from '@pages/vaults/domain/kongVaultSelectors'
import { type TPossibleSortBy, useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import { type TYvUsdListVaults, useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  HOLDINGS_TOGGLE_VALUE,
  selectVaultsByType,
  V3_ASSET_CATEGORIES
} from '@pages/vaults/utils/constants'
import { getVaultFeeStructureKey } from '@pages/vaults/utils/vaultFees'
import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'
import type { TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { shouldIncludeFixedYieldVaults, type TYieldRateFilter } from '@pages/vaults/utils/yieldRateFilter'
import { isYvBtcVault } from '@pages/vaults/utils/yvBtc'
import {
  getYvUsdPositionValues,
  isYvUsdAddress,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import { useWalletHoldings, useWalletStatus, useWalletTokens } from '@shared/contexts/useWallet'
import { useV2VaultFilter } from '@shared/hooks/useV2VaultFilter'
import { useV3VaultFilter } from '@shared/hooks/useV3VaultFilter'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import type { TDict, TSortDirection } from '@shared/types'
import { useMemo } from 'react'
import { getProductPinnedSections, type TVaultsPinnedSection } from './useVaultsListModel.helpers'

type TVaultsListModelArgs = {
  enabled?: boolean
  vaultSource?: TVaultsListVaultSource
  listVaultType: TVaultType
  listYieldRate?: TYieldRateFilter
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

export type TVaultsListVaultSource = {
  vaults: TDict<TKongVaultInput>
  allVaults: TDict<TKongVaultInput>
  isLoadingVaultList?: boolean
}

type TVaultsListModel = {
  listCategoriesSanitized: string[]
  holdingsVaults: TKongVaultInput[]
  availableVaults: TKongVaultInput[]
  vaultFlags: Record<string, { hasHoldings: boolean; isMigratable: boolean; isRetired: boolean; isHidden: boolean }>
  vaultHoldingsValues: Record<string, number>
  underlyingAssetVaults: Record<string, TKongVaultInput>
  pinnedSections: TVaultsPinnedSection[]
  pinnedVaults: TKongVaultInput[]
  mainVaults: TKongVaultInput[]
  yvUsdVaults: TYvUsdListVaults
  isWalletLoading: boolean
  totalMatchingVaults: number
  totalHoldingsMatching: number
  isLoadingVaultList: boolean
}

function matchesYvUsdFilters({
  isV3View,
  listChains,
  listCategories,
  listFeeStructureKey,
  listMinTvl,
  searchValue,
  yvUsdVault
}: {
  isV3View: boolean
  listChains: number[] | null
  listCategories: string[]
  listFeeStructureKey: string | null
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
  const matchesFeeStructure = !listFeeStructureKey || getVaultFeeStructureKey(yvUsdVault) === listFeeStructureKey
  const minTvlValue = Number.isFinite(listMinTvl) ? Math.max(0, listMinTvl || 0) : 0
  const meetsMinTvl = (yvUsdVault.tvl?.tvl ?? 0) >= minTvlValue

  return matchesChain && matchesCategory && matchesSearch && matchesFeeStructure && meetsMinTvl
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
  const matchesCategory = listCategories.length === 0 || listCategories.includes(getVaultCategory(vault))
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
  vaultSource,
  listVaultType,
  listYieldRate = 'all',
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
  const yvUsdVaults = useYvUsdVaults(
    vaultSource
      ? {
          vaults: vaultSource.vaults,
          isLoadingVaultList: vaultSource.isLoadingVaultList
        }
      : undefined
  )
  const { listVault: yvUsdVault } = yvUsdVaults
  const { getToken, getBalance } = useWalletTokens()
  const { getVaultHoldingsUsd } = useWalletHoldings()
  const { isLoading: isWalletLoading } = useWalletStatus()

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
        listFeeStructureKey,
        listMinTvl,
        searchValue,
        yvUsdVault
      }),
    [isV3View, listChains, listCategoriesSanitized, listFeeStructureKey, listMinTvl, searchValue, yvUsdVault]
  )

  const filteredSeniorTranchedVaults = useMemo(
    () =>
      shouldIncludeFixedYieldVaults(listVaultType, listYieldRate)
        ? getFilteredTranchedVaults({
            kind: 'senior',
            listChains,
            listCategories: listCategoriesSanitized,
            listMinTvl,
            searchValue
          })
        : [],
    [listVaultType, listYieldRate, listChains, listCategoriesSanitized, listMinTvl, searchValue]
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

  const yvUsdHasHoldings = useMemo(() => {
    const unlockedBalance = getBalance({ address: YVUSD_UNLOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).raw
    const lockedBalance = getBalance({ address: YVUSD_LOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).raw
    return unlockedBalance > 0n || lockedBalance > 0n
  }, [getBalance])
  const yvUsdHoldingsValue = useMemo(() => {
    return getYvUsdPositionValues({
      unlockedVault: yvUsdVaults.unlockedVault,
      lockedVault: yvUsdVaults.lockedVault,
      getToken,
      getBalance
    }).combinedValue
  }, [getBalance, getToken, yvUsdVaults.lockedVault, yvUsdVaults.unlockedVault])
  const yvUsdListVaults = useMemo(
    (): TYvUsdListVaults => ({
      metrics: yvUsdVaults.metrics,
      unlockedVault: yvUsdVaults.unlockedVault,
      lockedVault: yvUsdVaults.lockedVault
    }),
    [yvUsdVaults.lockedVault, yvUsdVaults.metrics, yvUsdVaults.unlockedVault]
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
    isV3View,
    vaultSource
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
    isV2View,
    vaultSource
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
    const baseV3Vaults = shouldShowYvUsd
      ? appendUniqueVault(sanitizedV3FilteredVaults, yvUsdVault)
      : sanitizedV3FilteredVaults
    const v3Vaults = isAllVaults
      ? [...filteredSeniorTranchedVaults, ...filteredJuniorTranchedVaults, ...baseV3Vaults]
      : [...filteredJuniorTranchedVaults, ...baseV3Vaults]
    return selectVaultsByType(listVaultType, v3Vaults, v2FilterResult.filteredVaults, true)
  }, [
    filteredJuniorTranchedVaults,
    filteredSeniorTranchedVaults,
    isAllVaults,
    listVaultType,
    sanitizedV3FilteredVaults,
    shouldShowYvUsd,
    v2FilterResult.filteredVaults,
    yvUsdVault
  ])

  const holdingsVaults = useMemo<TKongVaultInput[]>(() => {
    if (listVaultType === 'fixed') {
      return []
    }
    return selectVaultsByType(
      listVaultType,
      shouldShowYvUsd && yvUsdHasHoldings
        ? appendUniqueVault(sanitizedV3HoldingsVaults, yvUsdVault)
        : sanitizedV3HoldingsVaults,
      v2FilterResult.holdingsVaults,
      true
    )
  }, [
    listVaultType,
    sanitizedV3HoldingsVaults,
    shouldShowYvUsd,
    yvUsdHasHoldings,
    v2FilterResult.holdingsVaults,
    yvUsdVault
  ])

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
    const yvUsdFlags = yvUsdVault
      ? {
          [getVaultKey(yvUsdVault)]: {
            hasHoldings: yvUsdHasHoldings,
            isMigratable: false,
            isRetired: false,
            isHidden: false
          }
        }
      : {}
    const tranchedFlags = Object.fromEntries(
      [...filteredSeniorTranchedVaults, ...filteredJuniorTranchedVaults].map((vault) => [
        getVaultKey(vault),
        { hasHoldings: false, isMigratable: false, isRetired: false, isHidden: false }
      ])
    )
    return {
      ...baseFlags,
      ...yvUsdFlags,
      ...tranchedFlags
    }
  }, [
    filteredJuniorTranchedVaults,
    filteredSeniorTranchedVaults,
    listVaultType,
    v3FilterResult.vaultFlags,
    v2FilterResult.vaultFlags,
    yvUsdHasHoldings,
    yvUsdVault
  ])

  const isLoadingVaultList =
    listVaultType === 'all'
      ? v3FilterResult.isLoading || v2FilterResult.isLoading
      : listVaultType === 'v3'
        ? v3FilterResult.isLoading
        : listVaultType === 'fixed'
          ? false
          : v2FilterResult.isLoading

  const totalMatchingVaults = useMemo(() => {
    return filteredVaults.length
  }, [filteredVaults.length])

  const totalHoldingsMatching = useMemo(() => {
    return holdingsVaults.length
  }, [holdingsVaults.length])

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

  const pinnedSections = useMemo(() => {
    const sections: TVaultsPinnedSection[] = [...getProductPinnedSections({ shouldShowYvUsd, yvUsdVault })]
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
    sortedVaults,
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

  const vaultHoldingsValues = useMemo(() => {
    if (isWalletLoading) {
      return {}
    }

    const values: Record<string, number> = {}
    for (const vault of [...pinnedVaults, ...mainVaults]) {
      const key = getVaultKey(vault)
      values[key] = isYvUsdAddress(getVaultAddress(vault)) ? yvUsdHoldingsValue : getVaultHoldingsUsd(vault)
    }
    return values
  }, [getVaultHoldingsUsd, isWalletLoading, mainVaults, pinnedVaults, yvUsdHoldingsValue])

  const underlyingAssetVaults = useMemo(() => {
    if (listVaultType === 'all') {
      return { ...v3FilterResult.underlyingAssetVaults, ...v2FilterResult.underlyingAssetVaults }
    }
    if (listVaultType === 'v3') {
      return v3FilterResult.underlyingAssetVaults
    }
    if (listVaultType === 'fixed') {
      return {}
    }
    return v2FilterResult.underlyingAssetVaults
  }, [listVaultType, v2FilterResult.underlyingAssetVaults, v3FilterResult.underlyingAssetVaults])

  return {
    listCategoriesSanitized,
    holdingsVaults,
    availableVaults,
    vaultFlags,
    vaultHoldingsValues,
    underlyingAssetVaults,
    pinnedSections,
    pinnedVaults,
    mainVaults,
    yvUsdVaults: yvUsdListVaults,
    isWalletLoading,
    totalMatchingVaults,
    totalHoldingsMatching,
    isLoadingVaultList
  }
}
