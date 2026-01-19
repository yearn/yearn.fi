import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { TokenLogo } from '@lib/components/TokenLogo'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { usePrefetchYearnVaults } from '@lib/hooks/useFetchYearnVaults'
import type { TSortDirection } from '@lib/types'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useMediaQuery } from '@react-hookz/web'
import { VaultsAssetFilter } from '@vaults/components/filters/VaultsAssetFilter'
import type { TVaultsFiltersPanelSection } from '@vaults/components/filters/VaultsFiltersPanel'
import type { TListHead } from '@vaults/components/list/VaultsListHead'
import type { TPossibleSortBy } from '@vaults/hooks/useSortVaults'
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
} from '@vaults/utils/constants'
import {
  deriveListKind,
  getUnderlyingAssetLabel,
  normalizeUnderlyingAssetSymbol,
  type TVaultAggressiveness
} from '@vaults/utils/vaultListFacets'
import type { TVaultType } from '@vaults/utils/vaultTypeCopy'
import { getSupportedChainsForVaultType } from '@vaults/utils/vaultTypeUtils'
import type { RefObject } from 'react'
import {
  type ChangeEvent,
  createElement,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { useVaultsListModel } from './useVaultsListModel'
import { useVaultsQueryState } from './useVaultsQueryState'

const DEFAULT_VAULT_TYPES = ['multi', 'single']
const VAULTS_FILTERS_STORAGE_KEY = 'yearn.fi/vaults-filters@1'

type TVaultsChainConfig = {
  supportedChainIds: number[]
  primaryChainIds?: number[]
  defaultSecondaryChainIds?: number[]
  chainDisplayOrder?: number[]
  showMoreChainsButton?: boolean
  allChainsLabel?: string
}

type TVaultsPinnedSection = {
  key: string
  vaults: TYDaemonVault[]
}

type TVaultsFiltersBarModel = {
  searchValue: string
  chains: number[] | null
  chainConfig: TVaultsChainConfig
  filtersCount: number
  filtersSections: TVaultsFiltersPanelSection[]
  shouldStackFilters: boolean
  isSwitchingVaultType: boolean
  activeVaultType: TVaultType
  onSearch: (value: string) => void
  onChangeChains: (value: number[] | null) => void
  onClearFilters: () => void
  onShareFilters: () => void
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

type TVaultsPageLayoutRefProps = {
  varsRef: RefObject<HTMLDivElement | null>
  filtersRef: RefObject<HTMLDivElement | null>
}

function useVaultsFiltersHeight({ varsRef, filtersRef }: TVaultsPageLayoutRefProps): void {
  useLayoutEffect(() => {
    const filtersElement = filtersRef.current
    const varsElement = varsRef.current
    if (!filtersElement || !varsElement) return

    if (typeof ResizeObserver === 'undefined') {
      const updateHeight = (): void => {
        varsElement.style.setProperty('--vaults-filters-height', `${filtersElement.getBoundingClientRect().height}px`)
      }

      updateHeight()
      const handleResize = (): void => updateHeight()
      window.addEventListener('resize', handleResize, { passive: true })
      return () => window.removeEventListener('resize', handleResize)
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const borderBoxSize = entry?.borderBoxSize as unknown
      let borderBoxHeight: number | undefined
      if (Array.isArray(borderBoxSize)) {
        borderBoxHeight = borderBoxSize[0]?.blockSize
      } else if (borderBoxSize && typeof borderBoxSize === 'object' && 'blockSize' in borderBoxSize) {
        borderBoxHeight = (borderBoxSize as ResizeObserverSize).blockSize
      }
      const height = borderBoxHeight ?? filtersElement.getBoundingClientRect().height
      varsElement.style.setProperty('--vaults-filters-height', `${height}px`)
    })

    varsElement.style.setProperty('--vaults-filters-height', `${filtersElement.getBoundingClientRect().height}px`)
    observer.observe(filtersElement)
    return () => observer.disconnect()
  }, [filtersRef, varsRef])
}

export function useVaultsPageModel(): TVaultsPageModel {
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
    onShareFilters,
    sortBy,
    sortDirection
  } = useVaultsQueryState({
    defaultTypes: DEFAULT_VAULT_TYPES,
    defaultCategories: [],
    defaultPathname: '/vaults',
    defaultSortBy: 'featuringScore',
    resetTypes: DEFAULT_VAULT_TYPES,
    resetCategories: [],
    persistToStorage: true,
    storageKey: VAULTS_FILTERS_STORAGE_KEY,
    clearUrlAfterInit: true,
    shareUpdatesUrl: false
  })

  usePrefetchYearnVaults(V2_SUPPORTED_CHAINS, vaultType === 'v3')

  const varsRef = useRef<HTMLDivElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const searchValue = search ?? ''
  const { isActive: isWalletActive } = useWeb3()
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

  useVaultsFiltersHeight({ varsRef, filtersRef })

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
    const allowed = V3_ASSET_CATEGORIES
    return (displayedCategories || []).filter((value) => allowed.includes(value))
  }, [displayedCategories])

  const displayedAggressivenessSanitized = useMemo(() => {
    const allowed = new Set(AGGRESSIVENESS_OPTIONS)
    return (displayedAggressiveness || []).filter((value): value is TVaultAggressiveness =>
      allowed.has(value as TVaultAggressiveness)
    )
  }, [displayedAggressiveness])

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
  const isHoldingsPinned = activeToggleValues.includes(HOLDINGS_TOGGLE_VALUE)
  const isAvailablePinned = activeToggleValues.includes(AVAILABLE_TOGGLE_VALUE)
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
    listChains,
    listV3Types,
    listCategories,
    listAggressiveness,
    listUnderlyingAssets: listUnderlyingAssetsSanitized,
    listMinTvl,
    listShowLegacyVaults,
    listShowHiddenVaults,
    searchValue,
    sortBy,
    sortDirection,
    isHoldingsPinned,
    isAvailablePinned
  })

  const isSwitchingVaultType = Boolean(optimisticVaultType && optimisticVaultType !== vaultType) || isPending

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
  const resolveApyDisplayVariant = useCallback((vault: TYDaemonVault): 'default' | 'factory-list' => {
    const listKind = deriveListKind(vault)
    return listKind === 'allocator' || listKind === 'strategy' ? 'default' : 'factory-list'
  }, [])
  const handleChainsChange = useCallback(
    (nextChains: number[] | null): void => {
      const normalizedChains = nextChains ?? []
      setOptimisticChains(normalizedChains)
      startTransition(() => {
        onChangeChains(nextChains)
      })
    },
    [onChangeChains]
  )
  const handleTypesChange = useCallback(
    (nextTypes: string[] | null): void => {
      const normalizedTypes = nextTypes ?? []
      setOptimisticTypes(normalizedTypes)
      startTransition(() => {
        onChangeTypes(nextTypes)
      })
    },
    [onChangeTypes]
  )
  const handleCategoriesChange = useCallback(
    (nextCategories: string[] | null): void => {
      const normalizedCategories = nextCategories ?? []
      setOptimisticCategories(normalizedCategories)
      startTransition(() => {
        onChangeCategories(nextCategories)
      })
    },
    [onChangeCategories]
  )
  const handleAggressivenessChange = useCallback(
    (nextAggressiveness: string[] | null): void => {
      const normalizedAggressiveness = nextAggressiveness ?? []
      setOptimisticAggressiveness(normalizedAggressiveness)
      startTransition(() => {
        onChangeAggressiveness(nextAggressiveness)
      })
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
      const normalizedValue = Number.isFinite(nextValue) ? Math.max(0, nextValue) : DEFAULT_MIN_TVL
      setOptimisticMinTvl(normalizedValue)
      startTransition(() => {
        onChangeMinTvl(normalizedValue)
      })
    },
    [onChangeMinTvl]
  )
  const handleShowLegacyVaultsChange = useCallback(
    (nextValue: boolean): void => {
      setOptimisticShowLegacyVaults(nextValue)
      startTransition(() => {
        onChangeShowLegacyVaults(nextValue)
      })
    },
    [onChangeShowLegacyVaults]
  )
  const handleShowHiddenVaultsChange = useCallback(
    (nextValue: boolean): void => {
      setOptimisticShowHiddenVaults(nextValue)
      startTransition(() => {
        onChangeShowHiddenVaults(nextValue)
      })
    },
    [onChangeShowHiddenVaults]
  )
  const handleShowStrategiesChange = useCallback(
    (nextValue: boolean): void => {
      setOptimisticShowStrategies(nextValue)
      startTransition(() => {
        onChangeShowStrategies(nextValue)
      })
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
      startTransition(() => {
        onChangeVaultType(nextType)
      })
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
    startTransition(() => {
      onResetMultiSelect()
      onResetExtraFilters()
    })
  }, [onResetExtraFilters, onResetMultiSelect])

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

  const chainConfig = useMemo((): TVaultsChainConfig => {
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

  const apyColumnSpan = isWalletActive ? 'col-span-4' : 'col-span-6'
  const tvlColumnSpan = isWalletActive ? 'col-span-4' : 'col-span-5'
  const listHeadItems: TListHead['items'] = [
    {
      type: 'sort',
      label: 'Vault / Featuring Score',
      value: 'featuringScore',
      sortable: true,
      className: 'col-span-12'
    },
    {
      type: 'sort',
      label: 'Est. APY',
      value: 'estAPY',
      sortable: true,
      className: apyColumnSpan
    },
    {
      type: 'sort',
      label: 'TVL',
      value: 'tvl',
      sortable: true,
      className: tvlColumnSpan
    }
  ]

  if (!isWalletActive) {
    listHeadItems.push({
      type: 'sort',
      label: '',
      value: 'spacer',
      sortable: false,
      disabled: true,
      className: 'col-span-1'
    })
  }

  if (isWalletActive) {
    listHeadItems.push({
      type: 'toggle',
      label: 'Holdings',
      value: HOLDINGS_TOGGLE_VALUE,
      className: 'col-span-4 justify-end',
      disabled: holdingsVaults.length === 0
    })
  }

  const listHeadProps: TListHead = {
    containerClassName: 'rounded-t-xl bg-surface shrink-0',
    wrapperClassName: 'relative z-10 border border-border rounded-t-xl bg-transparent',
    sortBy,
    sortDirection,
    onSort: (newSortBy: string, newSortDirection: TSortDirection): void => {
      let targetSortBy = newSortBy as TPossibleSortBy
      let targetSortDirection = newSortDirection as TSortDirection

      if (targetSortBy === 'deposited' && totalHoldingsMatching === 0) {
        targetSortBy = 'featuringScore'
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
    items: listHeadItems
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
      searchValue,
      chains: displayedChains,
      chainConfig,
      filtersCount,
      filtersSections,
      shouldStackFilters,
      isSwitchingVaultType,
      activeVaultType: displayedVaultType,
      onSearch,
      onChangeChains: handleChainsChange,
      onClearFilters: handleResetFilters,
      onShareFilters,
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
        listChains,
        defaultCategories,
        totalMatchingVaults
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
