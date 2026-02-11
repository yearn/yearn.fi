import { VaultsAssetFilter } from '@pages/vaults/components/filters/VaultsAssetFilter'
import type { TChainConfig } from '@pages/vaults/components/filters/VaultsFiltersBar'
import type {
  TFiltersConfig,
  TPendingFiltersState,
  TVaultsFiltersPanelSection
} from '@pages/vaults/components/filters/VaultsFiltersPanel'
import type { TListHead } from '@pages/vaults/components/list/VaultsListHead'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  DEFAULT_MIN_TVL,
  HOLDINGS_TOGGLE_VALUE,
  toggleInArray,
  V2_ASSET_CATEGORIES,
  V2_SUPPORTED_CHAINS,
  V3_ASSET_CATEGORIES,
  V3_DEFAULT_SECONDARY_CHAIN_IDS,
  V3_PRIMARY_CHAIN_IDS,
  V3_SUPPORTED_CHAINS
} from '@pages/vaults/utils/constants'
import {
  deriveListKind,
  getUnderlyingAssetLabel,
  normalizeUnderlyingAssetSymbol,
  type TVaultAggressiveness
} from '@pages/vaults/utils/vaultListFacets'
import type { TVaultType } from '@pages/vaults/utils/vaultTypeCopy'
import { getSupportedChainsForVaultType } from '@pages/vaults/utils/vaultTypeUtils'
import { useMediaQuery } from '@react-hookz/web'
import type { TMultiSelectOptionProps } from '@shared/components/MultiSelectDropdown'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { usePrefetchYearnVaults } from '@shared/hooks/useFetchYearnVaults'
import { useV2VaultFilter } from '@shared/hooks/useV2VaultFilter'
import { useV3VaultFilter } from '@shared/hooks/useV3VaultFilter'
import type { TSortDirection } from '@shared/types'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { RefObject } from 'react'
import {
  type ChangeEvent,
  createElement,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useVaultsListModel } from './useVaultsListModel'
import { useVaultsQueryState } from './useVaultsQueryState'

const DEFAULT_VAULT_TYPES = ['multi', 'single']
const DEFAULT_SORT_BY: TPossibleSortBy = 'tvl'
const VAULTS_FILTERS_STORAGE_KEY = 'yearn.fi/vaults-filters@1'
const PARTNER_DEFAULT_MIN_TVL = 0
const PARTNER_DEFAULT_SHOW_LEGACY_VAULTS = true
const PARTNER_DEFAULT_SHOW_HIDDEN_VAULTS = true
const PARTNER_DEFAULT_SHOW_STRATEGIES = true

type TVaultsPinnedSection = {
  key: string
  vaults: TYDaemonVault[]
}

type TVaultsFiltersBarModel = {
  search: {
    value: string
    onChange: (value: string) => void
    trailingControls?: React.ReactNode
  }
  filters: {
    count: number
    sections: TVaultsFiltersPanelSection[]
    config: TFiltersConfig
    initialState: TPendingFiltersState
    onApply: (state: TPendingFiltersState) => void
    onClear: () => void
  }
  chains: {
    selected: number[] | null
    onChange: (value: number[] | null) => void
    config: TChainConfig
  }
  shouldStackFilters: boolean
  showChainSelector: boolean
  showTypeSelector: boolean
  activeVaultType: TVaultType
  onChangeVaultType: (value: TVaultType) => void
}

type TVaultsListData = {
  isLoading: boolean
  pinnedSections: TVaultsPinnedSection[]
  pinnedVaults: TYDaemonVault[]
  mainVaults: TYDaemonVault[]
  vaultFlags: Record<string, { hasHoldings: boolean; isMigratable: boolean; isRetired: boolean; isHidden: boolean }>
  listCategoriesSanitized: string[]
  listChains: number[] | null
  defaultCategories: string[]
  totalMatchingVaults: number
  hasHoldings: boolean
}

type TVaultsListModel = {
  listHeadProps: TListHead
  listVaultType: TVaultType
  shouldCollapseChips: boolean
  displayedShowStrategies: boolean
  activeFilters: {
    activeChains: number[]
    activeCategories: string[]
    activeProductType: 'all' | 'v3' | 'lp'
  }
  data: TVaultsListData
  handlers: {
    onToggleChain: (chainId: number) => void
    onToggleCategory: (category: string) => void
    onToggleType: (type: string) => void
    onToggleVaultType: (type: 'v3' | 'lp') => void
  }
  onResetFilters: () => void
  resolveApyDisplayVariant: (vault: TYDaemonVault) => 'default' | 'factory-list'
}

export type TVaultsPageModel = {
  refs: {
    varsRef: RefObject<HTMLDivElement | null>
    filtersRef: RefObject<HTMLDivElement | null>
  }
  header: {
    vaultType: TVaultType
    suggestedVaults: TYDaemonVault[]
  }
  filtersBar: TVaultsFiltersBarModel
  list: TVaultsListModel
}

export function useVaultsPageModel(): TVaultsPageModel {
  const { address } = useWeb3()
  const { activePartnerSlug } = useYearn()
  const isPartnerPage = Boolean(activePartnerSlug)
  const defaultMinTvl = isPartnerPage ? PARTNER_DEFAULT_MIN_TVL : DEFAULT_MIN_TVL
  const defaultShowLegacyVaults = isPartnerPage ? PARTNER_DEFAULT_SHOW_LEGACY_VAULTS : false
  const defaultShowHiddenVaults = isPartnerPage ? PARTNER_DEFAULT_SHOW_HIDDEN_VAULTS : false
  const defaultShowStrategies = isPartnerPage ? PARTNER_DEFAULT_SHOW_STRATEGIES : false
  const hasWalletAddress = !!address
  const {
    vaultType,
    hasTypesParam,
    search,
    types,
    categories,
    chains,
    aggressiveness,
    underlyingAssets,
    minTvl,
    showLegacyVaults,
    showHiddenVaults,
    showStrategies,
    onSearch,
    onChangeTypes,
    onChangeCategories,
    onChangeChains,
    onChangeAggressiveness,
    onChangeUnderlyingAssets,
    onChangeMinTvl,
    onChangeShowLegacyVaults,
    onChangeShowHiddenVaults,
    onChangeShowStrategies,
    onChangeVaultType,
    onChangeSortBy,
    onChangeSortDirection,
    onResetMultiSelect,
    onResetExtraFilters,
    sortBy,
    sortDirection
  } = useVaultsQueryState({
    defaultTypes: DEFAULT_VAULT_TYPES,
    defaultCategories: [],
    defaultPathname: '/vaults',
    defaultSortBy: DEFAULT_SORT_BY,
    defaultMinTvl,
    defaultShowLegacyVaults,
    defaultShowHiddenVaults,
    defaultShowStrategies,
    resetTypes: DEFAULT_VAULT_TYPES,
    resetCategories: [],
    persistToStorage: true,
    storageKey: VAULTS_FILTERS_STORAGE_KEY,
    clearUrlAfterInit: false,
    shareUpdatesUrl: true,
    syncUrlOnChange: true
  })

  usePrefetchYearnVaults(vaultType === 'v3')

  useEffect(() => {
    if (sortBy !== 'featuringScore') {
      return
    }
    onChangeSortBy(DEFAULT_SORT_BY)
    if (sortDirection !== 'desc') {
      onChangeSortDirection('desc')
    }
  }, [sortBy, sortDirection, onChangeSortBy, onChangeSortDirection])

  const varsRef = useRef<HTMLDivElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const searchValue = search ?? ''
  const listVaultType = useDeferredValue(vaultType)
  const isBelow1000 =
    useMediaQuery('(max-width: 1000px)', {
      initializeWithValue: false
    }) ?? false
  const isBelow768 =
    useMediaQuery('(max-width: 767px)', {
      initializeWithValue: false
    }) ?? false
  const shouldCollapseChips = isBelow1000
  const shouldStackFilters = isBelow1000 && !isBelow768
  const [optimisticVaultType, setOptimisticVaultType] = useState<TVaultType | null>(null)
  const [optimisticChains, setOptimisticChains] = useState<number[] | null>(null)
  const [optimisticTypes, setOptimisticTypes] = useState<string[] | null>(null)
  const [optimisticCategories, setOptimisticCategories] = useState<string[] | null>(null)
  const [optimisticAggressiveness, setOptimisticAggressiveness] = useState<string[] | null>(null)
  const [optimisticUnderlyingAssets, setOptimisticUnderlyingAssets] = useState<string[] | null>(null)
  const [optimisticMinTvl, setOptimisticMinTvl] = useState<number | null>(null)
  const [optimisticShowLegacyVaults, setOptimisticShowLegacyVaults] = useState<boolean | null>(null)
  const [optimisticShowHiddenVaults, setOptimisticShowHiddenVaults] = useState<boolean | null>(null)
  const [optimisticShowStrategies, setOptimisticShowStrategies] = useState<boolean | null>(null)
  const listChains = useDeferredValue(chains)
  const listTypes = useDeferredValue(types)
  const listCategories = useDeferredValue(categories)
  const listAggressiveness = useDeferredValue(aggressiveness)
  const listUnderlyingAssets = useDeferredValue(underlyingAssets)
  const listMinTvl = useDeferredValue(minTvl)
  const listShowLegacyVaults = useDeferredValue(showLegacyVaults)
  const listShowHiddenVaults = useDeferredValue(showHiddenVaults)
  const listShowStrategies = useDeferredValue(showStrategies)
  const areArraysEquivalent = useCallback(
    (a: Array<string | number> | null | undefined, b: Array<string | number> | null | undefined): boolean => {
      const normalize = (value: Array<string | number> | null | undefined): Array<string | number> => {
        if (!value || value.length === 0) {
          return []
        }
        return [...new Set(value)].sort((left, right) => String(left).localeCompare(String(right)))
      }
      const normalizedA = normalize(a)
      const normalizedB = normalize(b)
      if (normalizedA.length !== normalizedB.length) {
        return false
      }
      return normalizedA.every((value, index) => value === normalizedB[index])
    },
    []
  )

  useEffect(() => {
    if (optimisticVaultType && optimisticVaultType === vaultType) {
      setOptimisticVaultType(null)
    }
  }, [optimisticVaultType, vaultType])

  useEffect(() => {
    if (optimisticChains && areArraysEquivalent(optimisticChains, chains)) {
      setOptimisticChains(null)
    }
  }, [optimisticChains, chains, areArraysEquivalent])

  useEffect(() => {
    if (optimisticTypes && areArraysEquivalent(optimisticTypes, types)) {
      setOptimisticTypes(null)
    }
  }, [optimisticTypes, types, areArraysEquivalent])

  useEffect(() => {
    if (optimisticCategories && areArraysEquivalent(optimisticCategories, categories)) {
      setOptimisticCategories(null)
    }
  }, [optimisticCategories, categories, areArraysEquivalent])

  useEffect(() => {
    if (optimisticAggressiveness && areArraysEquivalent(optimisticAggressiveness, aggressiveness)) {
      setOptimisticAggressiveness(null)
    }
  }, [optimisticAggressiveness, aggressiveness, areArraysEquivalent])

  useEffect(() => {
    if (optimisticUnderlyingAssets && areArraysEquivalent(optimisticUnderlyingAssets, underlyingAssets)) {
      setOptimisticUnderlyingAssets(null)
    }
  }, [optimisticUnderlyingAssets, underlyingAssets, areArraysEquivalent])

  useEffect(() => {
    if (optimisticMinTvl !== null && optimisticMinTvl === minTvl) {
      setOptimisticMinTvl(null)
    }
  }, [optimisticMinTvl, minTvl])

  useEffect(() => {
    if (optimisticShowLegacyVaults !== null && optimisticShowLegacyVaults === showLegacyVaults) {
      setOptimisticShowLegacyVaults(null)
    }
  }, [optimisticShowLegacyVaults, showLegacyVaults])

  useEffect(() => {
    if (optimisticShowHiddenVaults !== null && optimisticShowHiddenVaults === showHiddenVaults) {
      setOptimisticShowHiddenVaults(null)
    }
  }, [optimisticShowHiddenVaults, showHiddenVaults])

  useEffect(() => {
    if (optimisticShowStrategies !== null && optimisticShowStrategies === showStrategies) {
      setOptimisticShowStrategies(null)
    }
  }, [optimisticShowStrategies, showStrategies])

  const displayedVaultType = optimisticVaultType ?? vaultType
  const displayedChains = optimisticChains ?? chains
  const displayedTypes = optimisticTypes ?? types
  const displayedCategories = optimisticCategories ?? categories
  const displayedAggressiveness = optimisticAggressiveness ?? aggressiveness
  const displayedUnderlyingAssets = optimisticUnderlyingAssets ?? underlyingAssets
  const displayedMinTvl = optimisticMinTvl ?? minTvl
  const displayedShowLegacyVaults = optimisticShowLegacyVaults ?? showLegacyVaults
  const displayedShowHiddenVaults = optimisticShowHiddenVaults ?? showHiddenVaults
  const displayedShowStrategies = optimisticShowStrategies ?? showStrategies
  const hasDisplayedTypesParam = hasTypesParam || optimisticTypes !== null
  const hasListTypesParam = hasTypesParam
  const sanitizeChainSelection = useCallback((selection: number[] | null | undefined, supportedChainIds: number[]) => {
    if (supportedChainIds.length === 0) {
      return null
    }

    const supportedSet = new Set(supportedChainIds)
    const normalized = Array.from(new Set((selection ?? []).filter((chainId) => supportedSet.has(chainId)))).sort(
      (left, right) => left - right
    )

    if (normalized.length === 0 || normalized.length === supportedChainIds.length) {
      return null
    }

    return normalized
  }, [])
  const baseChainConfig = useMemo((): TChainConfig => {
    if (listVaultType === 'v3') {
      return {
        supportedChainIds: V3_SUPPORTED_CHAINS,
        primaryChainIds: V3_PRIMARY_CHAIN_IDS,
        defaultSecondaryChainIds: V3_DEFAULT_SECONDARY_CHAIN_IDS,
        chainDisplayOrder: V3_SUPPORTED_CHAINS,
        showMoreChainsButton: false,
        allChainsLabel: 'All Chains'
      }
    }
    if (listVaultType === 'all') {
      const allChains = getSupportedChainsForVaultType('all')
      return {
        supportedChainIds: allChains,
        primaryChainIds: allChains,
        defaultSecondaryChainIds: [],
        chainDisplayOrder: allChains,
        showMoreChainsButton: false,
        allChainsLabel: 'All Chains'
      }
    }
    return {
      supportedChainIds: V2_SUPPORTED_CHAINS,
      primaryChainIds: V2_SUPPORTED_CHAINS,
      defaultSecondaryChainIds: [],
      chainDisplayOrder: V2_SUPPORTED_CHAINS,
      showMoreChainsButton: false,
      allChainsLabel: 'All Chains'
    }
  }, [listVaultType])

  const categoryOptions = useMemo(
    () => (isPartnerPage ? Array.from(new Set([...V2_ASSET_CATEGORIES, ...V3_ASSET_CATEGORIES])) : V3_ASSET_CATEGORIES),
    [isPartnerPage]
  )

  const resolveV3Types = useCallback(
    (selected: string[] | null | undefined, shouldShowStrategies: boolean, hasTypesParam: boolean): string[] => {
      const filtered = (selected || []).filter((type) => type === 'multi' || type === 'single')
      if (!shouldShowStrategies) {
        return ['multi']
      }
      if (!hasTypesParam || filtered.length === 0) {
        return ['multi', 'single']
      }
      return filtered
    },
    []
  )

  const displayedV3Types = useMemo(
    () => resolveV3Types(displayedTypes, displayedShowStrategies, hasDisplayedTypesParam),
    [displayedTypes, displayedShowStrategies, hasDisplayedTypesParam, resolveV3Types]
  )
  const listV3Types = useMemo(
    () => resolveV3Types(listTypes, listShowStrategies, hasListTypesParam),
    [listTypes, listShowStrategies, hasListTypesParam, resolveV3Types]
  )

  const displayedCategoriesSanitized = useMemo(() => {
    const allowed = categoryOptions
    return (displayedCategories || []).filter((value) => allowed.includes(value))
  }, [categoryOptions, displayedCategories])

  const listCategoriesForChainAvailability = useMemo(() => {
    const allowed = categoryOptions
    return (listCategories || []).filter((value) => allowed.includes(value))
  }, [categoryOptions, listCategories])

  const displayedAggressivenessSanitized = useMemo(() => {
    const allowed = new Set(AGGRESSIVENESS_OPTIONS)
    return (displayedAggressiveness || []).filter((value): value is TVaultAggressiveness =>
      allowed.has(value as TVaultAggressiveness)
    )
  }, [displayedAggressiveness])

  const listAggressivenessForChainAvailability = useMemo(() => {
    const allowed = new Set(AGGRESSIVENESS_OPTIONS)
    return (listAggressiveness || []).filter((value): value is TVaultAggressiveness =>
      allowed.has(value as TVaultAggressiveness)
    )
  }, [listAggressiveness])

  const displayedUnderlyingAssetsSanitized = useMemo(() => {
    const normalized = (displayedUnderlyingAssets || [])
      .map((asset) => normalizeUnderlyingAssetSymbol(asset))
      .filter(Boolean)
    return Array.from(new Set(normalized))
  }, [displayedUnderlyingAssets])

  const listUnderlyingAssetsSanitized = useMemo(() => {
    const normalized = (listUnderlyingAssets || [])
      .map((asset) => normalizeUnderlyingAssetSymbol(asset))
      .filter(Boolean)
    return Array.from(new Set(normalized))
  }, [listUnderlyingAssets])

  const isV3ViewForChainAvailability = isPartnerPage && (listVaultType === 'v3' || listVaultType === 'all')
  const isV2ViewForChainAvailability = isPartnerPage && (listVaultType === 'factory' || listVaultType === 'all')
  const listV2TypesForChainAvailability = useMemo(
    () => (listShowLegacyVaults ? ['factory', 'legacy'] : ['factory']),
    [listShowLegacyVaults]
  )

  const { filteredVaults: filteredV3VaultsForChainAvailability } = useV3VaultFilter(
    isV3ViewForChainAvailability ? listV3Types : null,
    null,
    '',
    isV3ViewForChainAvailability ? listCategoriesForChainAvailability : null,
    isV3ViewForChainAvailability ? listAggressivenessForChainAvailability : null,
    isV3ViewForChainAvailability ? listUnderlyingAssetsSanitized : null,
    listMinTvl,
    isV3ViewForChainAvailability ? listShowHiddenVaults : undefined,
    isV3ViewForChainAvailability
  )

  const { filteredVaults: filteredV2VaultsForChainAvailability } = useV2VaultFilter(
    isV2ViewForChainAvailability ? listV2TypesForChainAvailability : null,
    null,
    '',
    isV2ViewForChainAvailability ? listCategoriesForChainAvailability : null,
    isV2ViewForChainAvailability ? listAggressivenessForChainAvailability : null,
    isV2ViewForChainAvailability ? listUnderlyingAssetsSanitized : null,
    listMinTvl,
    listShowHiddenVaults,
    isV2ViewForChainAvailability
  )

  const partnerChainIds = useMemo(() => {
    if (!isPartnerPage) {
      return []
    }

    const chainSourceVaults =
      listVaultType === 'v3'
        ? filteredV3VaultsForChainAvailability
        : listVaultType === 'factory'
          ? filteredV2VaultsForChainAvailability
          : [...filteredV3VaultsForChainAvailability, ...filteredV2VaultsForChainAvailability]

    const uniqueChainIds = new Set<number>()
    for (const vault of chainSourceVaults) {
      uniqueChainIds.add(vault.chainID)
    }
    return Array.from(uniqueChainIds).sort((left, right) => left - right)
  }, [filteredV2VaultsForChainAvailability, filteredV3VaultsForChainAvailability, isPartnerPage, listVaultType])
  const chainConfig = useMemo((): TChainConfig => {
    if (!isPartnerPage) {
      return baseChainConfig
    }

    const partnerSet = new Set(partnerChainIds)
    const supportedChainIds = baseChainConfig.supportedChainIds.filter((chainId) => partnerSet.has(chainId))
    const supportedSet = new Set(supportedChainIds)

    return {
      ...baseChainConfig,
      supportedChainIds,
      primaryChainIds: (baseChainConfig.primaryChainIds ?? supportedChainIds).filter((chainId) =>
        supportedSet.has(chainId)
      ),
      defaultSecondaryChainIds: (baseChainConfig.defaultSecondaryChainIds ?? []).filter((chainId) =>
        supportedSet.has(chainId)
      ),
      chainDisplayOrder: (baseChainConfig.chainDisplayOrder ?? supportedChainIds).filter((chainId) =>
        supportedSet.has(chainId)
      )
    }
  }, [baseChainConfig, isPartnerPage, partnerChainIds])
  const constrainedDisplayedChains = useMemo(
    () => sanitizeChainSelection(displayedChains, chainConfig.supportedChainIds),
    [displayedChains, sanitizeChainSelection, chainConfig.supportedChainIds]
  )
  const constrainedListChains = useMemo(
    () => sanitizeChainSelection(listChains, chainConfig.supportedChainIds),
    [listChains, sanitizeChainSelection, chainConfig.supportedChainIds]
  )
  const showChainSelector = !isPartnerPage || chainConfig.supportedChainIds.length > 1
  const showTypeSelector = !isPartnerPage
  const [activeToggleValues, setActiveToggleValues] = useState<string[]>([])
  const effectiveSortBy = sortBy === 'featuringScore' ? DEFAULT_SORT_BY : sortBy
  const effectiveSortDirection = sortBy === 'featuringScore' ? 'desc' : sortDirection
  const isHoldingsPinned = activeToggleValues.includes(HOLDINGS_TOGGLE_VALUE)
  const isAvailablePinned = activeToggleValues.includes(AVAILABLE_TOGGLE_VALUE)
  const defaultDisplayedV3Types = useMemo(
    () => (defaultShowStrategies ? ['multi', 'single'] : ['multi']),
    [defaultShowStrategies]
  )
  const {
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
  } = useVaultsListModel({
    listVaultType,
    categoryOptions,
    listChains: constrainedListChains,
    listV3Types,
    listCategories,
    listAggressiveness,
    listUnderlyingAssets: listUnderlyingAssetsSanitized,
    listMinTvl: listMinTvl,
    listShowLegacyVaults,
    listShowHiddenVaults,
    searchValue,
    sortBy: effectiveSortBy,
    sortDirection: effectiveSortDirection,
    isHoldingsPinned,
    isAvailablePinned
  })

  useEffect(() => {
    if (holdingsVaults.length === 0 && isHoldingsPinned) {
      setActiveToggleValues((prev) => prev.filter((value) => value !== HOLDINGS_TOGGLE_VALUE))
    }
  }, [holdingsVaults.length, isHoldingsPinned])

  useEffect(() => {
    if (availableVaults.length === 0 && isAvailablePinned) {
      setActiveToggleValues((prev) => prev.filter((value) => value !== AVAILABLE_TOGGLE_VALUE))
    }
  }, [availableVaults.length, isAvailablePinned])

  const filtersCount = useMemo(() => {
    const typeCount = areArraysEquivalent(displayedV3Types, defaultDisplayedV3Types) ? 0 : 1
    const legacyCount = displayedShowLegacyVaults !== defaultShowLegacyVaults ? 1 : 0
    const hiddenCount = displayedShowHiddenVaults !== defaultShowHiddenVaults ? 1 : 0
    const categoryCount = displayedCategoriesSanitized.length
    const aggressivenessCount = displayedAggressivenessSanitized.length
    const underlyingAssetCount = displayedUnderlyingAssetsSanitized.length
    const minTvlCount = displayedMinTvl !== defaultMinTvl ? 1 : 0
    return (
      typeCount + legacyCount + hiddenCount + categoryCount + aggressivenessCount + underlyingAssetCount + minTvlCount
    )
  }, [
    areArraysEquivalent,
    defaultDisplayedV3Types,
    defaultShowHiddenVaults,
    defaultShowLegacyVaults,
    displayedAggressivenessSanitized.length,
    displayedCategoriesSanitized.length,
    displayedShowHiddenVaults,
    displayedShowLegacyVaults,
    displayedUnderlyingAssetsSanitized.length,
    displayedMinTvl,
    displayedV3Types,
    defaultMinTvl
  ])
  const activeChains = useMemo(() => constrainedDisplayedChains ?? [], [constrainedDisplayedChains])
  const activeCategories = displayedCategoriesSanitized
  const activeProductType = useMemo<'all' | 'v3' | 'lp'>(
    () => (displayedVaultType === 'factory' ? 'lp' : displayedVaultType),
    [displayedVaultType]
  )
  const resolveApyDisplayVariant = useCallback((vault: TYDaemonVault): 'default' | 'factory-list' => {
    const listKind = deriveListKind(vault)
    return listKind === 'allocator' || listKind === 'strategy' ? 'default' : 'factory-list'
  }, [])
  const handleChainsChange = useCallback(
    (nextChains: number[] | null): void => {
      const sanitizedSelection = sanitizeChainSelection(nextChains, chainConfig.supportedChainIds)
      setOptimisticChains(sanitizedSelection ?? [])
      onChangeChains(sanitizedSelection)
    },
    [chainConfig.supportedChainIds, onChangeChains, sanitizeChainSelection]
  )
  const handleTypesChange = useCallback(
    (nextTypes: string[] | null): void => {
      const normalizedTypes = nextTypes ?? []
      setOptimisticTypes(normalizedTypes)
      onChangeTypes(nextTypes)
    },
    [onChangeTypes]
  )
  const handleCategoriesChange = useCallback(
    (nextCategories: string[] | null): void => {
      const normalizedCategories = nextCategories ?? []
      setOptimisticCategories(normalizedCategories)
      onChangeCategories(nextCategories)
    },
    [onChangeCategories]
  )
  const handleAggressivenessChange = useCallback(
    (nextAggressiveness: string[] | null): void => {
      const normalizedAggressiveness = nextAggressiveness ?? []
      setOptimisticAggressiveness(normalizedAggressiveness)
      onChangeAggressiveness(nextAggressiveness)
    },
    [onChangeAggressiveness]
  )
  const handleUnderlyingAssetsChange = useCallback(
    (nextAssets: string[] | null): void => {
      const normalizedAssets = nextAssets ?? []
      setOptimisticUnderlyingAssets(normalizedAssets)
      startTransition(() => {
        onChangeUnderlyingAssets(nextAssets)
      })
    },
    [onChangeUnderlyingAssets]
  )
  const handleMinTvlChange = useCallback(
    (nextValue: number): void => {
      const normalizedValue = Number.isFinite(nextValue) ? Math.max(0, nextValue) : defaultMinTvl
      setOptimisticMinTvl(normalizedValue)
      startTransition(() => {
        onChangeMinTvl(normalizedValue)
      })
    },
    [defaultMinTvl, onChangeMinTvl]
  )
  const handleShowLegacyVaultsChange = useCallback(
    (nextValue: boolean): void => {
      setOptimisticShowLegacyVaults(nextValue)
      onChangeShowLegacyVaults(nextValue)
    },
    [onChangeShowLegacyVaults]
  )
  const handleShowHiddenVaultsChange = useCallback(
    (nextValue: boolean): void => {
      setOptimisticShowHiddenVaults(nextValue)
      onChangeShowHiddenVaults(nextValue)
    },
    [onChangeShowHiddenVaults]
  )
  const handleShowStrategiesChange = useCallback(
    (nextValue: boolean): void => {
      setOptimisticShowStrategies(nextValue)
      onChangeShowStrategies(nextValue)
    },
    [onChangeShowStrategies]
  )
  const handleToggleChain = useCallback(
    (chainId: number): void => {
      handleChainsChange(toggleInArray(constrainedDisplayedChains ?? null, chainId))
    },
    [constrainedDisplayedChains, handleChainsChange]
  )
  const handleToggleCategory = useCallback(
    (category: string): void => {
      handleCategoriesChange(toggleInArray(displayedCategoriesSanitized, category))
    },
    [displayedCategoriesSanitized, handleCategoriesChange]
  )
  const handleToggleType = useCallback(
    (type: string): void => {
      if (displayedVaultType !== 'v3') {
        return
      }
      handleTypesChange(toggleInArray(displayedV3Types, type))
    },
    [displayedVaultType, displayedV3Types, handleTypesChange]
  )

  const underlyingAssetOptions = useMemo((): TMultiSelectOptionProps[] => {
    const selectedAssets = new Set(displayedUnderlyingAssetsSanitized)
    const options: TMultiSelectOptionProps[] = Object.entries(underlyingAssetVaults).map(([assetKey, vault]) => {
      const label = getUnderlyingAssetLabel(assetKey)
      const tokenAddress = vault.token.address.toLowerCase()
      const tokenLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${tokenAddress}/logo-32.png`
      return {
        label,
        value: assetKey,
        isSelected: selectedAssets.has(assetKey),
        icon: createElement(TokenLogo, {
          src: tokenLogoSrc,
          tokenSymbol: vault.token.symbol,
          width: 20,
          height: 20
        })
      }
    })
    for (const assetKey of selectedAssets) {
      if (options.some((option) => option.value === assetKey)) {
        continue
      }
      options.push({
        label: getUnderlyingAssetLabel(assetKey),
        value: assetKey,
        isSelected: true
      })
    }

    return options.sort((left, right) => left.label.localeCompare(right.label))
  }, [displayedUnderlyingAssetsSanitized, underlyingAssetVaults])

  const handleUnderlyingAssetsSelect = useCallback(
    (options: TMultiSelectOptionProps[]): void => {
      const selected = options.filter((option) => option.isSelected).map((option) => String(option.value))
      const isAllSelected = options.length > 0 && selected.length === options.length
      const nextSelection = selected.length > 0 ? selected : null
      handleUnderlyingAssetsChange(isAllSelected ? null : nextSelection)
    },
    [handleUnderlyingAssetsChange]
  )

  const handleVaultVersionToggle = useCallback(
    (nextType: TVaultType): void => {
      if (nextType === vaultType && !optimisticVaultType) {
        return
      }
      setOptimisticVaultType(nextType)
      onChangeVaultType(nextType)
    },
    [optimisticVaultType, onChangeVaultType, vaultType]
  )
  const handleToggleVaultType = useCallback(
    (nextType: 'v3' | 'lp'): void => {
      const targetType = nextType === 'lp' ? 'factory' : 'v3'
      handleVaultVersionToggle(targetType)
    },
    [handleVaultVersionToggle]
  )

  const handleResetFilters = useCallback((): void => {
    setOptimisticChains([])
    setOptimisticCategories([])
    setOptimisticAggressiveness([])
    setOptimisticUnderlyingAssets([])
    setOptimisticMinTvl(defaultMinTvl)
    setOptimisticTypes(DEFAULT_VAULT_TYPES)
    setOptimisticShowLegacyVaults(defaultShowLegacyVaults)
    setOptimisticShowHiddenVaults(defaultShowHiddenVaults)
    setOptimisticShowStrategies(defaultShowStrategies)
    onResetMultiSelect()
    onResetExtraFilters()
  }, [
    defaultMinTvl,
    defaultShowHiddenVaults,
    defaultShowLegacyVaults,
    defaultShowStrategies,
    onResetExtraFilters,
    onResetMultiSelect
  ])

  const minTvlInput = createElement(
    'div',
    { className: 'flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2' },
    createElement('span', { className: 'text-sm text-text-secondary' }, '$'),
    createElement('input', {
      type: 'number',
      min: 0,
      step: 1,
      value: displayedMinTvl,
      onChange: (event: ChangeEvent<HTMLInputElement>): void => handleMinTvlChange(Number(event.target.value)),
      className: 'w-full bg-transparent text-sm text-text-primary outline-hidden',
      'aria-label': 'Minimum TVL'
    })
  )

  const filtersSections: TVaultsFiltersPanelSection[] = [
    {
      type: 'custom',
      title: 'Underlying Asset',
      content: createElement(VaultsAssetFilter, {
        options: underlyingAssetOptions,
        onSelect: handleUnderlyingAssetsSelect,
        buttonLabel: 'Filter by assets'
      })
    },
    {
      type: 'custom',
      title: 'Minimum TVL',
      content: minTvlInput
    },
    {
      type: 'checklist',
      title: 'Asset Category',
      options: categoryOptions.map((value) => ({
        label: value,
        checked: displayedCategoriesSanitized.includes(value),
        onToggle: (): void => handleCategoriesChange(toggleInArray(displayedCategoriesSanitized, value))
      }))
    },
    {
      type: 'checklist',
      title: 'Vault Aggressiveness',
      options: AGGRESSIVENESS_OPTIONS.map((value) => ({
        label: value,
        checked: displayedAggressivenessSanitized.includes(value),
        onToggle: (): void => handleAggressivenessChange(toggleInArray(displayedAggressivenessSanitized, value))
      }))
    },
    {
      type: 'advanced',
      title: 'Advanced',
      toggles: [
        {
          label: 'Show single asset strategies',
          description: 'Checking this will show the underlying strategies used in Single Asset Vaults in the list.',
          checked: displayedShowStrategies,
          onChange: (checked: boolean): void => handleShowStrategiesChange(checked)
        },
        {
          label: 'Show legacy vaults',
          description: 'Includes legacy vaults in the list.',
          checked: displayedShowLegacyVaults,
          onChange: (checked: boolean): void => handleShowLegacyVaultsChange(checked)
        },
        {
          label: 'Show hidden vaults',
          description: 'Checking this will show deprioritized and hidden vaults in the list',
          checked: displayedShowHiddenVaults,
          onChange: (checked: boolean): void => handleShowHiddenVaultsChange(checked)
        }
      ]
    }
  ]

  const filtersConfig = useMemo(
    (): TFiltersConfig => ({
      categoryOptions,
      aggressivenessOptions: AGGRESSIVENESS_OPTIONS,
      toggleOptions: [
        {
          key: 'showStrategies',
          label: 'Show single asset strategies',
          description: 'Checking this will show the underlying strategies used in Single Asset Vaults in the list.'
        },
        {
          key: 'showLegacyVaults',
          label: 'Show legacy vaults',
          description: 'Includes legacy vaults in the list.'
        },
        {
          key: 'showHiddenVaults',
          label: 'Show hidden vaults',
          description: 'Checking this will show deprioritized and hidden vaults in the list'
        }
      ],
      underlyingAssetOptions,
      minTvlEnabled: true
    }),
    [categoryOptions, underlyingAssetOptions]
  )

  const filtersInitialState = useMemo(
    (): TPendingFiltersState => ({
      categories: displayedCategoriesSanitized,
      aggressiveness: displayedAggressivenessSanitized,
      underlyingAssets: displayedUnderlyingAssetsSanitized,
      minTvl: displayedMinTvl,
      showStrategies: displayedShowStrategies,
      showLegacyVaults: displayedShowLegacyVaults,
      showHiddenVaults: displayedShowHiddenVaults
    }),
    [
      displayedCategoriesSanitized,
      displayedAggressivenessSanitized,
      displayedUnderlyingAssetsSanitized,
      displayedMinTvl,
      displayedShowStrategies,
      displayedShowLegacyVaults,
      displayedShowHiddenVaults
    ]
  )

  const onApplyFilters = useCallback(
    (state: TPendingFiltersState): void => {
      const normalizedMinTvl = state.minTvl
      setOptimisticCategories(state.categories)
      setOptimisticAggressiveness(state.aggressiveness)
      setOptimisticUnderlyingAssets(state.underlyingAssets)
      setOptimisticMinTvl(normalizedMinTvl)
      setOptimisticShowStrategies(state.showStrategies)
      setOptimisticShowLegacyVaults(state.showLegacyVaults)
      setOptimisticShowHiddenVaults(state.showHiddenVaults)

      onChangeCategories(state.categories.length > 0 ? state.categories : null)
      onChangeAggressiveness(state.aggressiveness.length > 0 ? state.aggressiveness : null)
      onChangeUnderlyingAssets(state.underlyingAssets.length > 0 ? state.underlyingAssets : null)
      onChangeMinTvl(normalizedMinTvl)
      onChangeShowStrategies(state.showStrategies)
      onChangeShowLegacyVaults(state.showLegacyVaults)
      onChangeShowHiddenVaults(state.showHiddenVaults)
    },
    [
      onChangeCategories,
      onChangeAggressiveness,
      onChangeUnderlyingAssets,
      onChangeMinTvl,
      onChangeShowStrategies,
      onChangeShowLegacyVaults,
      onChangeShowHiddenVaults
    ]
  )

  const listHeadProps: TListHead = {
    containerClassName: 'rounded-t-xl bg-surface shrink-0',
    wrapperClassName: 'relative z-10 border border-border rounded-t-xl bg-transparent',
    sortBy: effectiveSortBy,
    sortDirection: effectiveSortDirection,
    onSort: (newSortBy: string, newSortDirection: TSortDirection): void => {
      let targetSortBy = newSortBy as TPossibleSortBy
      let targetSortDirection = newSortDirection as TSortDirection

      if (targetSortBy === 'deposited' && totalHoldingsMatching === 0) {
        targetSortBy = DEFAULT_SORT_BY
        targetSortDirection = 'desc'
      }

      onChangeSortBy(targetSortBy)
      onChangeSortDirection(targetSortDirection)
    },
    onToggle: (value): void => {
      setActiveToggleValues((prev) => {
        if (prev.includes(value)) {
          return prev.filter((entry) => entry !== value)
        }
        return [value]
      })
    },
    activeToggleValues,
    items: [
      {
        type: 'sort',
        label: 'Vault',
        value: 'vault',
        sortable: false,
        className: 'col-span-12'
      },
      {
        type: 'sort',
        label: 'Est. APY',
        value: 'estAPY',
        sortable: true,
        className: hasWalletAddress ? 'col-span-4' : 'col-span-6'
      },
      {
        type: 'sort',
        label: 'TVL',
        value: 'tvl',
        sortable: true,
        className: hasWalletAddress ? 'col-span-4' : 'col-span-5'
      },
      // {
      //   type: 'toggle',
      //   label: 'Available',
      //   value: AVAILABLE_TOGGLE_VALUE,
      //   className: 'col-span-3',
      //   disabled: availableVaults.length === 0
      // },
      ...(hasWalletAddress
        ? ([
            {
              type: 'toggle',
              label: 'Holdings',
              value: HOLDINGS_TOGGLE_VALUE,
              className: 'col-span-4 justify-end',
              disabled: holdingsVaults.length === 0
            }
          ] satisfies TListHead['items'])
        : [])
    ]
  }

  return {
    refs: {
      varsRef,
      filtersRef
    },
    header: {
      vaultType: displayedVaultType,
      suggestedVaults
    },
    filtersBar: {
      search: {
        value: searchValue,
        onChange: onSearch
      },
      filters: {
        count: filtersCount,
        sections: filtersSections,
        config: filtersConfig,
        initialState: filtersInitialState,
        onApply: onApplyFilters,
        onClear: handleResetFilters
      },
      chains: {
        selected: constrainedDisplayedChains,
        onChange: handleChainsChange,
        config: chainConfig
      },
      shouldStackFilters,
      showChainSelector,
      showTypeSelector,
      activeVaultType: displayedVaultType,
      onChangeVaultType: handleVaultVersionToggle
    },
    list: {
      listHeadProps,
      listVaultType,
      shouldCollapseChips,
      displayedShowStrategies,
      activeFilters: {
        activeChains,
        activeCategories,
        activeProductType
      },
      data: {
        isLoading: isLoadingVaultList,
        pinnedSections,
        pinnedVaults,
        mainVaults,
        vaultFlags,
        listCategoriesSanitized,
        listChains: constrainedListChains,
        defaultCategories,
        totalMatchingVaults,
        hasHoldings: holdingsVaults.length > 0
      },
      handlers: {
        onToggleChain: handleToggleChain,
        onToggleCategory: handleToggleCategory,
        onToggleType: handleToggleType,
        onToggleVaultType: handleToggleVaultType
      },
      onResetFilters: handleResetFilters,
      resolveApyDisplayVariant
    }
  }
}
