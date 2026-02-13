import { VaultsAssetFilter } from '@pages/vaults/components/filters/VaultsAssetFilter'
import type { TChainConfig } from '@pages/vaults/components/filters/VaultsFiltersBar'
import type {
  TFiltersConfig,
  TPendingFiltersState,
  TVaultsFiltersPanelSection
} from '@pages/vaults/components/filters/VaultsFiltersPanel'
import type { TListHead } from '@pages/vaults/components/list/VaultsListHead'
import {
  getVaultChainID,
  getVaultInfo,
  getVaultToken,
  getVaultTVL,
  type TKongVault,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import {
  getAdditionalResultsForCombo,
  getCommonBlockingKeys,
  shouldShowComboBlockingAction
} from '@pages/vaults/utils/blockingFilterInsights'
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  DEFAULT_MIN_TVL,
  HOLDINGS_TOGGLE_VALUE,
  toggleInArray,
  V2_SUPPORTED_CHAINS,
  V3_ASSET_CATEGORIES,
  V3_DEFAULT_SECONDARY_CHAIN_IDS,
  V3_PRIMARY_CHAIN_IDS,
  V3_SUPPORTED_CHAINS
} from '@pages/vaults/utils/constants'
import {
  deriveAssetCategory,
  deriveListKind,
  deriveV3Aggressiveness,
  expandUnderlyingAssetSelection,
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
import { usePrefetchYearnVaults } from '@shared/hooks/useFetchYearnVaults'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@shared/types'
import type { RefObject } from 'react'
import {
  type ChangeEvent,
  createElement,
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

type TVaultsPinnedSection = {
  key: string
  vaults: TKongVault[]
}

type TVaultsBlockingFilterActionKey =
  | 'showStrategies'
  | 'showLegacyVaults'
  | 'showHiddenVaults'
  | 'showAllChains'
  | 'showAllCategories'
  | 'showAllAggressiveness'
  | 'showAllUnderlyingAssets'
  | 'clearMinTvl'
  | 'showAllTypes'
  | 'showAllVaults'
  | 'applyCommonFilters'

type TVaultsBlockingFilterBaseActionKey = Exclude<TVaultsBlockingFilterActionKey, 'applyCommonFilters'>

export type TVaultsBlockingFilterAction = {
  key: TVaultsBlockingFilterActionKey
  label: string
  additionalResults: number
  onApply: () => void
}

const BLOCKING_FILTER_LABELS: Record<TVaultsBlockingFilterBaseActionKey, string> = {
  showStrategies: 'Show single asset strategies',
  showLegacyVaults: 'Show legacy vaults',
  showHiddenVaults: 'Show hidden vaults',
  showAllChains: 'Show all chains',
  showAllCategories: 'Show all categories',
  showAllAggressiveness: 'Show all aggressiveness levels',
  showAllUnderlyingAssets: 'Show all underlying assets',
  clearMinTvl: 'Clear minimum TVL',
  showAllTypes: 'Show all strategy types',
  showAllVaults: 'Show all vaults'
}

function capitalizeLabel(value: string): string {
  if (value.length === 0) {
    return value
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function formatCombinedBlockingFilterLabel(keys: TVaultsBlockingFilterBaseActionKey[]): string {
  const normalizedKeys = Array.from(new Set(keys))
  if (
    normalizedKeys.length === 2 &&
    normalizedKeys.includes('showAllChains') &&
    normalizedKeys.includes('showAllVaults')
  ) {
    return 'Show all chains and vaults'
  }

  const labels = normalizedKeys.map((key) => BLOCKING_FILTER_LABELS[key].toLowerCase())
  if (labels.length === 2) {
    return `${capitalizeLabel(labels[0])} and ${labels[1]}`
  }
  if (labels.length > 2) {
    return `Apply ${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`
  }
  return 'Apply suggested filters'
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
  activeVaultType: TVaultType
  onChangeVaultType: (value: TVaultType) => void
}

type TVaultsListData = {
  isLoading: boolean
  pinnedSections: TVaultsPinnedSection[]
  pinnedVaults: TKongVault[]
  mainVaults: TKongVault[]
  vaultFlags: Record<string, { hasHoldings: boolean; isMigratable: boolean; isRetired: boolean; isHidden: boolean }>
  listChains: number[] | null
  totalMatchingVaults: number
  hiddenByFiltersCount: number
  blockingFilterActions: TVaultsBlockingFilterAction[]
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
  resolveApyDisplayVariant: (vault: TKongVaultInput) => 'default' | 'factory-list'
}

export type TVaultsPageModel = {
  refs: {
    varsRef: RefObject<HTMLDivElement | null>
    filtersRef: RefObject<HTMLDivElement | null>
  }
  header: {
    vaultType: TVaultType
    suggestedVaults: TKongVault[]
  }
  filtersBar: TVaultsFiltersBarModel
  list: TVaultsListModel
}

export function useVaultsPageModel(): TVaultsPageModel {
  const { address } = useWeb3()
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
    if (optimisticChains !== null && areArraysEquivalent(optimisticChains, chains)) {
      setOptimisticChains(null)
    }
  }, [optimisticChains, chains, areArraysEquivalent])

  useEffect(() => {
    if (optimisticTypes !== null && areArraysEquivalent(optimisticTypes, types)) {
      setOptimisticTypes(null)
    }
  }, [optimisticTypes, types, areArraysEquivalent])

  useEffect(() => {
    if (optimisticCategories !== null && areArraysEquivalent(optimisticCategories, categories)) {
      setOptimisticCategories(null)
    }
  }, [optimisticCategories, categories, areArraysEquivalent])

  useEffect(() => {
    if (optimisticAggressiveness !== null && areArraysEquivalent(optimisticAggressiveness, aggressiveness)) {
      setOptimisticAggressiveness(null)
    }
  }, [optimisticAggressiveness, aggressiveness, areArraysEquivalent])

  useEffect(() => {
    if (optimisticUnderlyingAssets !== null && areArraysEquivalent(optimisticUnderlyingAssets, underlyingAssets)) {
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
  const listV3TypesWithStrategies = useMemo(
    () => resolveV3Types(listTypes, true, hasListTypesParam),
    [listTypes, hasListTypesParam, resolveV3Types]
  )

  const displayedCategoriesSanitized = useMemo(() => {
    const allowed = V3_ASSET_CATEGORIES
    return (displayedCategories || []).filter((value) => allowed.includes(value))
  }, [displayedCategories])

  const displayedAggressivenessSanitized = useMemo(() => {
    const allowed = new Set(AGGRESSIVENESS_OPTIONS)
    return (displayedAggressiveness || []).filter((value): value is TVaultAggressiveness =>
      allowed.has(value as TVaultAggressiveness)
    )
  }, [displayedAggressiveness])

  const listAggressivenessSanitized = useMemo(() => {
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
  const [activeToggleValues, setActiveToggleValues] = useState<string[]>([])
  const [holdingsPinnedSortDirection, setHoldingsPinnedSortDirection] = useState<TSortDirection>('')
  const effectiveSortBy = sortBy === 'featuringScore' ? DEFAULT_SORT_BY : sortBy
  const effectiveSortDirection = sortBy === 'featuringScore' ? 'desc' : sortDirection
  const isHoldingsPinned = activeToggleValues.includes(HOLDINGS_TOGGLE_VALUE)
  const isAvailablePinned = activeToggleValues.includes(AVAILABLE_TOGGLE_VALUE)
  const {
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
    listChains,
    listV3Types,
    listCategories,
    listAggressiveness,
    listUnderlyingAssets: listUnderlyingAssetsSanitized,
    listMinTvl,
    listShowLegacyVaults,
    listShowHiddenVaults,
    searchValue,
    sortBy: effectiveSortBy,
    sortDirection: effectiveSortDirection,
    holdingsPinnedSortDirection,
    isHoldingsPinned,
    isAvailablePinned
  })

  const shouldComputeBlockingInsights = searchValue !== '' && pinnedVaults.length === 0 && mainVaults.length === 0
  const isTypesFilterBlockingResults =
    listVaultType !== 'factory' &&
    listShowStrategies &&
    hasListTypesParam &&
    !areArraysEquivalent(listV3Types, DEFAULT_VAULT_TYPES)
  const hasVaultTypeFilterBlockingResults = listVaultType !== 'all'
  const listUnderlyingAssetsExpanded = useMemo(
    () => expandUnderlyingAssetSelection(listUnderlyingAssetsSanitized),
    [listUnderlyingAssetsSanitized]
  )
  const activeV3Kinds = useMemo(() => {
    const kinds = new Set<'allocator' | 'strategy'>()
    if (listV3Types.includes('multi')) {
      kinds.add('allocator')
    }
    if (listV3Types.includes('single')) {
      kinds.add('strategy')
    }
    return kinds
  }, [listV3Types])
  const blockingProbeSortDirection: TSortDirection = ''
  const blockingProbeBaseArgs: Parameters<typeof useVaultsListModel>[0] = {
    enabled: shouldComputeBlockingInsights,
    listVaultType,
    listChains,
    listV3Types,
    listCategories,
    listAggressiveness: listAggressivenessSanitized.length > 0 ? listAggressivenessSanitized : null,
    listUnderlyingAssets: listUnderlyingAssetsSanitized,
    listMinTvl,
    listShowLegacyVaults,
    listShowHiddenVaults,
    searchValue,
    sortBy: effectiveSortBy,
    sortDirection: blockingProbeSortDirection,
    holdingsPinnedSortDirection: blockingProbeSortDirection,
    isHoldingsPinned: false,
    isAvailablePinned: false
  }

  const { pinnedVaults: showStrategiesPinnedVaults, mainVaults: showStrategiesMainVaults } = useVaultsListModel({
    ...blockingProbeBaseArgs,
    listV3Types: listV3TypesWithStrategies
  })

  const { pinnedVaults: showLegacyPinnedVaults, mainVaults: showLegacyMainVaults } = useVaultsListModel({
    ...blockingProbeBaseArgs,
    listShowLegacyVaults: true
  })

  const { pinnedVaults: showHiddenPinnedVaults, mainVaults: showHiddenMainVaults } = useVaultsListModel({
    ...blockingProbeBaseArgs,
    listShowHiddenVaults: true
  })

  const { pinnedVaults: showAllChainsPinnedVaults, mainVaults: showAllChainsMainVaults } = useVaultsListModel({
    ...blockingProbeBaseArgs,
    listChains: null
  })

  const { pinnedVaults: showAllCategoriesPinnedVaults, mainVaults: showAllCategoriesMainVaults } = useVaultsListModel({
    ...blockingProbeBaseArgs,
    listCategories: null
  })

  const { pinnedVaults: showAllAggressivenessPinnedVaults, mainVaults: showAllAggressivenessMainVaults } =
    useVaultsListModel({
      ...blockingProbeBaseArgs,
      listAggressiveness: null
    })

  const { pinnedVaults: showAllUnderlyingAssetsPinnedVaults, mainVaults: showAllUnderlyingAssetsMainVaults } =
    useVaultsListModel({
      ...blockingProbeBaseArgs,
      listUnderlyingAssets: null
    })

  const { pinnedVaults: clearMinTvlPinnedVaults, mainVaults: clearMinTvlMainVaults } = useVaultsListModel({
    ...blockingProbeBaseArgs,
    listMinTvl: DEFAULT_MIN_TVL
  })

  const { pinnedVaults: showAllTypesPinnedVaults, mainVaults: showAllTypesMainVaults } = useVaultsListModel({
    ...blockingProbeBaseArgs,
    listV3Types: DEFAULT_VAULT_TYPES
  })

  const { pinnedVaults: showAllVaultsPinnedVaults, mainVaults: showAllVaultsMainVaults } = useVaultsListModel({
    ...blockingProbeBaseArgs,
    enabled: shouldComputeBlockingInsights && hasVaultTypeFilterBlockingResults,
    listVaultType: 'all'
  })

  const { pinnedVaults: allBlockingFiltersPinnedVaults, mainVaults: allBlockingFiltersMainVaults } = useVaultsListModel(
    {
      ...blockingProbeBaseArgs,
      listVaultType: 'all',
      listChains: null,
      listV3Types: DEFAULT_VAULT_TYPES,
      listCategories: null,
      listAggressiveness: null,
      listUnderlyingAssets: null,
      listMinTvl: DEFAULT_MIN_TVL,
      listShowLegacyVaults: true,
      listShowHiddenVaults: true
    }
  )

  const currentVisibleVaultKeys = useMemo(() => {
    return new Set([...pinnedVaults, ...mainVaults].map((vault) => getVaultKey(vault)))
  }, [mainVaults, pinnedVaults])

  const allBlockingFiltersVaults = useMemo(
    () => [...allBlockingFiltersPinnedVaults, ...allBlockingFiltersMainVaults],
    [allBlockingFiltersMainVaults, allBlockingFiltersPinnedVaults]
  )

  const hiddenByFiltersVaults = useMemo(() => {
    return allBlockingFiltersVaults.filter((vault) => !currentVisibleVaultKeys.has(getVaultKey(vault)))
  }, [allBlockingFiltersVaults, currentVisibleVaultKeys])

  const getBlockingFilterKeysForVault = useCallback(
    (vault: TKongVaultInput): TVaultsBlockingFilterBaseActionKey[] => {
      const blockingKeys = new Set<TVaultsBlockingFilterBaseActionKey>()
      const listKind = deriveListKind(vault)
      const isV3Kind = listKind === 'allocator' || listKind === 'strategy'
      const isV2Kind = listKind === 'factory' || listKind === 'legacy'

      if ((listVaultType === 'v3' && isV2Kind) || (listVaultType === 'factory' && isV3Kind)) {
        blockingKeys.add('showAllVaults')
      }

      if (!listShowHiddenVaults && Boolean(getVaultInfo(vault).isHidden)) {
        blockingKeys.add('showHiddenVaults')
      }
      if (!listShowLegacyVaults && listKind === 'legacy') {
        blockingKeys.add('showLegacyVaults')
      }
      if (listChains !== null && !listChains.includes(getVaultChainID(vault))) {
        blockingKeys.add('showAllChains')
      }

      if (listCategoriesSanitized.length > 0) {
        const vaultCategory = deriveAssetCategory(vault)
        if (!listCategoriesSanitized.includes(vaultCategory)) {
          blockingKeys.add('showAllCategories')
        }
      }

      if (listAggressivenessSanitized.length > 0) {
        const vaultAggressiveness = deriveV3Aggressiveness(vault)
        if (!vaultAggressiveness || !listAggressivenessSanitized.includes(vaultAggressiveness)) {
          blockingKeys.add('showAllAggressiveness')
        }
      }

      if (listUnderlyingAssetsExpanded.size > 0) {
        const assetKey = normalizeUnderlyingAssetSymbol(getVaultToken(vault).symbol)
        if (!assetKey || !listUnderlyingAssetsExpanded.has(assetKey)) {
          blockingKeys.add('showAllUnderlyingAssets')
        }
      }

      if (listMinTvl !== DEFAULT_MIN_TVL) {
        const tvl = getVaultTVL(vault).tvl || 0
        if (tvl < listMinTvl) {
          blockingKeys.add('clearMinTvl')
        }
      }

      if (isV3Kind) {
        if (!listShowStrategies && listKind === 'strategy') {
          blockingKeys.add('showStrategies')
        }
        if (isTypesFilterBlockingResults && !activeV3Kinds.has(listKind)) {
          blockingKeys.add('showAllTypes')
        }
      }

      return Array.from(blockingKeys)
    },
    [
      activeV3Kinds,
      isTypesFilterBlockingResults,
      listAggressivenessSanitized,
      listCategoriesSanitized,
      listChains,
      listMinTvl,
      listShowHiddenVaults,
      listShowLegacyVaults,
      listShowStrategies,
      listUnderlyingAssetsExpanded,
      listVaultType
    ]
  )

  const hiddenByFiltersBlockingKeys = useMemo((): TVaultsBlockingFilterBaseActionKey[][] => {
    if (!shouldComputeBlockingInsights || hiddenByFiltersVaults.length === 0) {
      return []
    }
    return hiddenByFiltersVaults.map((vault) => getBlockingFilterKeysForVault(vault))
  }, [getBlockingFilterKeysForVault, hiddenByFiltersVaults, shouldComputeBlockingInsights])

  const commonBlockingFilterKeys = useMemo((): TVaultsBlockingFilterBaseActionKey[] => {
    return getCommonBlockingKeys(hiddenByFiltersBlockingKeys)
  }, [hiddenByFiltersBlockingKeys])

  const commonBlockingFilterAdditionalResults = useMemo((): number => {
    return getAdditionalResultsForCombo(hiddenByFiltersBlockingKeys, commonBlockingFilterKeys)
  }, [commonBlockingFilterKeys, hiddenByFiltersBlockingKeys])

  useEffect(() => {
    if (holdingsVaults.length === 0 && isHoldingsPinned) {
      setHoldingsPinnedSortDirection('')
      setActiveToggleValues((prev) => prev.filter((value) => value !== HOLDINGS_TOGGLE_VALUE))
    }
  }, [holdingsVaults.length, isHoldingsPinned])

  useEffect(() => {
    if (availableVaults.length === 0 && isAvailablePinned) {
      setActiveToggleValues((prev) => prev.filter((value) => value !== AVAILABLE_TOGGLE_VALUE))
    }
  }, [availableVaults.length, isAvailablePinned])

  const filtersCount = useMemo(() => {
    const typeCount = displayedV3Types.includes('single') ? 1 : 0
    const legacyCount = displayedShowLegacyVaults ? 1 : 0
    const hiddenCount = displayedShowHiddenVaults ? 1 : 0
    const categoryCount = displayedCategoriesSanitized.length
    const aggressivenessCount = displayedAggressivenessSanitized.length
    const underlyingAssetCount = displayedUnderlyingAssetsSanitized.length
    const minTvlCount = displayedMinTvl !== DEFAULT_MIN_TVL ? 1 : 0
    return (
      typeCount + legacyCount + hiddenCount + categoryCount + aggressivenessCount + underlyingAssetCount + minTvlCount
    )
  }, [
    displayedAggressivenessSanitized.length,
    displayedCategoriesSanitized.length,
    displayedShowHiddenVaults,
    displayedShowLegacyVaults,
    displayedUnderlyingAssetsSanitized.length,
    displayedMinTvl,
    displayedV3Types
  ])
  const activeChains = useMemo(() => displayedChains ?? [], [displayedChains])
  const activeCategories = displayedCategoriesSanitized
  const activeProductType = useMemo<'all' | 'v3' | 'lp'>(
    () => (displayedVaultType === 'factory' ? 'lp' : displayedVaultType),
    [displayedVaultType]
  )
  const resolveApyDisplayVariant = useCallback((vault: TKongVaultInput): 'default' | 'factory-list' => {
    const listKind = deriveListKind(vault)
    return listKind === 'allocator' || listKind === 'strategy' ? 'default' : 'factory-list'
  }, [])
  const handleChainsChange = useCallback(
    (nextChains: number[] | null): void => {
      const normalizedChains = nextChains ?? []
      setOptimisticChains(normalizedChains)
      onChangeChains(nextChains)
    },
    [onChangeChains]
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
      onChangeUnderlyingAssets(nextAssets)
    },
    [onChangeUnderlyingAssets]
  )
  const handleMinTvlChange = useCallback(
    (nextValue: number): void => {
      const normalizedValue = Number.isFinite(nextValue) ? Math.max(0, nextValue) : DEFAULT_MIN_TVL
      setOptimisticMinTvl(normalizedValue)
      onChangeMinTvl(normalizedValue)
    },
    [onChangeMinTvl]
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
      handleChainsChange(toggleInArray(displayedChains ?? null, chainId))
    },
    [displayedChains, handleChainsChange]
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
      const token = getVaultToken(vault)
      const tokenAddress = token.address.toLowerCase()
      const tokenLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${getVaultChainID(vault)}/${tokenAddress}/logo-32.png`
      return {
        label,
        value: assetKey,
        isSelected: selectedAssets.has(assetKey),
        icon: createElement(TokenLogo, {
          src: tokenLogoSrc,
          tokenSymbol: token.symbol,
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
    setOptimisticMinTvl(DEFAULT_MIN_TVL)
    setOptimisticTypes(DEFAULT_VAULT_TYPES)
    setOptimisticShowLegacyVaults(false)
    setOptimisticShowHiddenVaults(false)
    setOptimisticShowStrategies(false)
    onResetMultiSelect()
    onResetExtraFilters()
  }, [onResetExtraFilters, onResetMultiSelect])

  const handleEnableShowStrategies = useCallback((): void => {
    setOptimisticShowStrategies(true)
    onChangeShowStrategies(true)
  }, [onChangeShowStrategies])

  const handleEnableShowLegacyVaults = useCallback((): void => {
    setOptimisticShowLegacyVaults(true)
    onChangeShowLegacyVaults(true)
  }, [onChangeShowLegacyVaults])

  const handleEnableShowHiddenVaults = useCallback((): void => {
    setOptimisticShowHiddenVaults(true)
    onChangeShowHiddenVaults(true)
  }, [onChangeShowHiddenVaults])

  const handleShowAllChains = useCallback((): void => {
    handleChainsChange(null)
  }, [handleChainsChange])

  const handleShowAllCategories = useCallback((): void => {
    handleCategoriesChange(null)
  }, [handleCategoriesChange])

  const handleShowAllAggressiveness = useCallback((): void => {
    handleAggressivenessChange(null)
  }, [handleAggressivenessChange])

  const handleShowAllUnderlyingAssets = useCallback((): void => {
    handleUnderlyingAssetsChange(null)
  }, [handleUnderlyingAssetsChange])

  const handleClearMinTvl = useCallback((): void => {
    handleMinTvlChange(DEFAULT_MIN_TVL)
  }, [handleMinTvlChange])

  const handleShowAllTypes = useCallback((): void => {
    handleTypesChange(DEFAULT_VAULT_TYPES)
  }, [handleTypesChange])

  const handleShowAllVaults = useCallback((): void => {
    handleVaultVersionToggle('all')
  }, [handleVaultVersionToggle])

  const currentVisibleResultsCount = pinnedVaults.length + mainVaults.length
  const showStrategiesResultsCount = showStrategiesPinnedVaults.length + showStrategiesMainVaults.length
  const showLegacyResultsCount = showLegacyPinnedVaults.length + showLegacyMainVaults.length
  const showHiddenResultsCount = showHiddenPinnedVaults.length + showHiddenMainVaults.length
  const showAllChainsResultsCount = showAllChainsPinnedVaults.length + showAllChainsMainVaults.length
  const showAllCategoriesResultsCount = showAllCategoriesPinnedVaults.length + showAllCategoriesMainVaults.length
  const showAllAggressivenessResultsCount =
    showAllAggressivenessPinnedVaults.length + showAllAggressivenessMainVaults.length
  const showAllUnderlyingAssetsResultsCount =
    showAllUnderlyingAssetsPinnedVaults.length + showAllUnderlyingAssetsMainVaults.length
  const clearMinTvlResultsCount = clearMinTvlPinnedVaults.length + clearMinTvlMainVaults.length
  const showAllTypesResultsCount = showAllTypesPinnedVaults.length + showAllTypesMainVaults.length
  const showAllVaultsResultsCount = showAllVaultsPinnedVaults.length + showAllVaultsMainVaults.length
  const allBlockingFiltersResultsCount = allBlockingFiltersPinnedVaults.length + allBlockingFiltersMainVaults.length

  const showStrategiesAdditionalResults = Math.max(0, showStrategiesResultsCount - currentVisibleResultsCount)
  const showLegacyAdditionalResults = Math.max(0, showLegacyResultsCount - currentVisibleResultsCount)
  const showHiddenAdditionalResults = Math.max(0, showHiddenResultsCount - currentVisibleResultsCount)
  const showAllChainsAdditionalResults = Math.max(0, showAllChainsResultsCount - currentVisibleResultsCount)
  const showAllCategoriesAdditionalResults = Math.max(0, showAllCategoriesResultsCount - currentVisibleResultsCount)
  const showAllAggressivenessAdditionalResults = Math.max(
    0,
    showAllAggressivenessResultsCount - currentVisibleResultsCount
  )
  const showAllUnderlyingAssetsAdditionalResults = Math.max(
    0,
    showAllUnderlyingAssetsResultsCount - currentVisibleResultsCount
  )
  const clearMinTvlAdditionalResults = Math.max(0, clearMinTvlResultsCount - currentVisibleResultsCount)
  const showAllTypesAdditionalResults = Math.max(0, showAllTypesResultsCount - currentVisibleResultsCount)
  const showAllVaultsAdditionalResults = Math.max(0, showAllVaultsResultsCount - currentVisibleResultsCount)
  const hiddenByFiltersCount = Math.max(0, allBlockingFiltersResultsCount - currentVisibleResultsCount)

  const blockingFilterActions = useMemo((): TVaultsBlockingFilterAction[] => {
    const actionHandlers: Record<TVaultsBlockingFilterBaseActionKey, () => void> = {
      showStrategies: handleEnableShowStrategies,
      showLegacyVaults: handleEnableShowLegacyVaults,
      showHiddenVaults: handleEnableShowHiddenVaults,
      showAllChains: handleShowAllChains,
      showAllCategories: handleShowAllCategories,
      showAllAggressiveness: handleShowAllAggressiveness,
      showAllUnderlyingAssets: handleShowAllUnderlyingAssets,
      clearMinTvl: handleClearMinTvl,
      showAllTypes: handleShowAllTypes,
      showAllVaults: handleShowAllVaults
    }

    const actionCandidates: Array<{
      key: TVaultsBlockingFilterBaseActionKey
      isApplicable: boolean
      additionalResults: number
    }> = [
      { key: 'showStrategies', isApplicable: !listShowStrategies, additionalResults: showStrategiesAdditionalResults },
      { key: 'showLegacyVaults', isApplicable: !listShowLegacyVaults, additionalResults: showLegacyAdditionalResults },
      { key: 'showHiddenVaults', isApplicable: !listShowHiddenVaults, additionalResults: showHiddenAdditionalResults },
      { key: 'showAllChains', isApplicable: listChains !== null, additionalResults: showAllChainsAdditionalResults },
      {
        key: 'showAllCategories',
        isApplicable: listCategoriesSanitized.length > 0,
        additionalResults: showAllCategoriesAdditionalResults
      },
      {
        key: 'showAllAggressiveness',
        isApplicable: listAggressivenessSanitized.length > 0,
        additionalResults: showAllAggressivenessAdditionalResults
      },
      {
        key: 'showAllUnderlyingAssets',
        isApplicable: listUnderlyingAssetsSanitized.length > 0,
        additionalResults: showAllUnderlyingAssetsAdditionalResults
      },
      {
        key: 'clearMinTvl',
        isApplicable: listMinTvl !== DEFAULT_MIN_TVL,
        additionalResults: clearMinTvlAdditionalResults
      },
      {
        key: 'showAllTypes',
        isApplicable: isTypesFilterBlockingResults,
        additionalResults: showAllTypesAdditionalResults
      },
      {
        key: 'showAllVaults',
        isApplicable: hasVaultTypeFilterBlockingResults,
        additionalResults: showAllVaultsAdditionalResults
      }
    ]
    const actionableCandidates = actionCandidates.filter(
      (candidate) => candidate.isApplicable && candidate.additionalResults > 0
    )

    const sortedActions = actionableCandidates
      .map(
        (candidate): TVaultsBlockingFilterAction => ({
          key: candidate.key,
          label: BLOCKING_FILTER_LABELS[candidate.key],
          additionalResults: candidate.additionalResults,
          onApply: actionHandlers[candidate.key]
        })
      )
      .sort((left, right) => right.additionalResults - left.additionalResults)
    const actionableKeys = new Set(actionableCandidates.map((candidate) => candidate.key))
    const comboKeys = commonBlockingFilterKeys
    const shouldShowComboAction = shouldShowComboBlockingAction({
      hiddenByFiltersCount,
      comboKeys,
      actionableKeys
    })

    if (shouldShowComboAction) {
      const comboAction: TVaultsBlockingFilterAction = {
        key: 'applyCommonFilters',
        label: formatCombinedBlockingFilterLabel(comboKeys),
        additionalResults: commonBlockingFilterAdditionalResults,
        onApply: (): void => {
          for (const key of comboKeys) {
            actionHandlers[key]()
          }
        }
      }
      return [comboAction, ...sortedActions]
    }

    return sortedActions
  }, [
    clearMinTvlAdditionalResults,
    handleClearMinTvl,
    handleEnableShowHiddenVaults,
    handleEnableShowLegacyVaults,
    handleEnableShowStrategies,
    handleShowAllAggressiveness,
    handleShowAllCategories,
    handleShowAllChains,
    handleShowAllTypes,
    handleShowAllUnderlyingAssets,
    handleShowAllVaults,
    hasVaultTypeFilterBlockingResults,
    hiddenByFiltersCount,
    isTypesFilterBlockingResults,
    listAggressivenessSanitized.length,
    listCategoriesSanitized.length,
    listChains,
    listShowHiddenVaults,
    listShowLegacyVaults,
    listShowStrategies,
    listUnderlyingAssetsSanitized.length,
    listMinTvl,
    showAllAggressivenessAdditionalResults,
    showAllCategoriesAdditionalResults,
    showAllChainsAdditionalResults,
    showAllTypesAdditionalResults,
    showAllUnderlyingAssetsAdditionalResults,
    showAllVaultsAdditionalResults,
    showHiddenAdditionalResults,
    showLegacyAdditionalResults,
    showStrategiesAdditionalResults,
    commonBlockingFilterAdditionalResults,
    commonBlockingFilterKeys
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
      options: V3_ASSET_CATEGORIES.map((value) => ({
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
      categoryOptions: V3_ASSET_CATEGORIES,
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
    [underlyingAssetOptions]
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
      setOptimisticCategories(state.categories)
      setOptimisticAggressiveness(state.aggressiveness)
      setOptimisticUnderlyingAssets(state.underlyingAssets)
      setOptimisticMinTvl(state.minTvl)
      setOptimisticShowStrategies(state.showStrategies)
      setOptimisticShowLegacyVaults(state.showLegacyVaults)
      setOptimisticShowHiddenVaults(state.showHiddenVaults)

      onChangeCategories(state.categories.length > 0 ? state.categories : null)
      onChangeAggressiveness(state.aggressiveness.length > 0 ? state.aggressiveness : null)
      onChangeUnderlyingAssets(state.underlyingAssets.length > 0 ? state.underlyingAssets : null)
      onChangeMinTvl(state.minTvl)
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

  const chainConfig = useMemo((): TChainConfig => {
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
      if (value === HOLDINGS_TOGGLE_VALUE) {
        const isHoldingsActive = activeToggleValues.includes(HOLDINGS_TOGGLE_VALUE)
        if (!isHoldingsActive) {
          setHoldingsPinnedSortDirection('')
          setActiveToggleValues([HOLDINGS_TOGGLE_VALUE])
          return
        }
        if (holdingsPinnedSortDirection === '') {
          setHoldingsPinnedSortDirection('desc')
          return
        }
        if (holdingsPinnedSortDirection === 'desc') {
          setHoldingsPinnedSortDirection('asc')
          return
        }
        setHoldingsPinnedSortDirection('')
        setActiveToggleValues((prev) => prev.filter((entry) => entry !== value))
        return
      }

      setHoldingsPinnedSortDirection('')
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
        selected: displayedChains,
        onChange: handleChainsChange,
        config: chainConfig
      },
      shouldStackFilters,
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
        listChains,
        totalMatchingVaults,
        hiddenByFiltersCount,
        blockingFilterActions
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
