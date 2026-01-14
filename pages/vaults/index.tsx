import Link from '@components/Link'
import { usePrefetchYearnVaults } from '@lib/hooks/useFetchYearnVaults'
import { useV2VaultFilter } from '@lib/hooks/useV2VaultFilter'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import type { TSortDirection } from '@lib/types'
import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useMediaQuery } from '@react-hookz/web'
import { VaultsAuxiliaryList } from '@vaults/components/list/VaultsAuxiliaryList'
import { VaultsListHead } from '@vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@vaults/components/list/VaultsListRow'
import { TrendingVaults } from '@vaults/components/TrendingVaults'
import { ALL_VAULTSV3_CATEGORIES } from '@vaults/constants'
import { VaultsListEmpty } from '@vaults/shared/components/list/VaultsListEmpty'
import { VaultsFilters } from '@vaults/shared/components/VaultsFilters'
import { type TVaultsFiltersPanelSection, VaultsFiltersPanel } from '@vaults/shared/components/VaultsFiltersPanel'
import type { TPossibleSortBy } from '@vaults/shared/hooks/useSortVaults'
import { useSortVaults } from '@vaults/shared/hooks/useSortVaults'
import { useQueryArguments } from '@vaults/shared/hooks/useVaultsQueryArgs'
import { deriveListKind, type TVaultAggressiveness } from '@vaults/shared/utils/vaultListFacets'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { useSearchParams } from 'react-router'
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  HOLDINGS_TOGGLE_VALUE,
  readBooleanParam,
  selectVaultsByType,
  toggleInArray,
  V2_SUPPORTED_CHAINS,
  V3_DEFAULT_SECONDARY_CHAIN_IDS,
  V3_PRIMARY_CHAIN_IDS,
  V3_SUPPORTED_CHAINS
} from './constants'
import { VaultVersionToggle } from './VaultVersionToggle'
import { getVaultTypeLabel, type TVaultType } from './vaultTypeCopy'
import { getSupportedChainsForVaultType, normalizeVaultTypeParam, sanitizeChainsParam } from './vaultTypeUtils'

const V3_ASSET_CATEGORIES = [ALL_VAULTSV3_CATEGORIES.Stablecoin, ALL_VAULTSV3_CATEGORIES.Volatile]
const V2_ASSET_CATEGORIES = ['Stablecoin', 'Volatile']

function useVaultType(): TVaultType {
  const [searchParams] = useSearchParams()
  return normalizeVaultTypeParam(searchParams.get('type'))
}

type TListOfVaultsProps = {
  search: string | null | undefined
  types: string[] | null
  chains: number[] | null
  categories: string[] | null
  aggressiveness: string[] | null
  showLegacyVaults: boolean
  showHiddenVaults: boolean
  showStrategies: boolean
  sortDirection: TSortDirection
  sortBy: TPossibleSortBy
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeAggressiveness: (value: string[] | null) => void
  onChangeShowLegacyVaults: (value: boolean) => void
  onChangeShowHiddenVaults: (value: boolean) => void
  onChangeShowStrategies: (value: boolean) => void
  onChangeChains: (value: number[] | null) => void
  onChangeSortDirection: (value: TSortDirection | '') => void
  onChangeSortBy: (value: TPossibleSortBy | '') => void
  onResetMultiSelect: () => void
  vaultType: TVaultType
  children?: (renderProps: { filters: ReactNode; list: ReactNode }) => ReactNode
}

function ListOfVaults({
  search,
  types,
  chains,
  categories,
  aggressiveness,
  showLegacyVaults,
  showHiddenVaults,
  showStrategies,
  sortDirection,
  sortBy,
  onSearch,
  onChangeTypes,
  onChangeCategories,
  onChangeAggressiveness,
  onChangeShowLegacyVaults,
  onChangeShowHiddenVaults,
  onChangeShowStrategies,
  onChangeChains,
  onChangeSortDirection,
  onChangeSortBy,
  onResetMultiSelect,
  vaultType,
  children
}: TListOfVaultsProps): ReactElement {
  const varsRef = useRef<HTMLDivElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchValue = search ?? ''
  const listVaultType = useDeferredValue(vaultType)
  const isAllVaults = listVaultType === 'all'
  const isV3View = listVaultType === 'v3' || isAllVaults
  const isV2View = listVaultType === 'factory' || isAllVaults
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
  }, [])

  useEffect(() => {
    if (optimisticVaultType && optimisticVaultType === vaultType) {
      setOptimisticVaultType(null)
    }
  }, [optimisticVaultType, vaultType])

  const sanitizedV3Types = useMemo(() => {
    const selected = (types || []).filter((type) => type === 'multi' || type === 'single')
    if (!showStrategies) {
      return ['multi']
    }
    if (!searchParams.has('types') || selected.length === 0) {
      return ['multi', 'single']
    }
    return selected
  }, [types, showStrategies, searchParams])

  const allocatorTypesForTrending = useMemo(() => {
    return isV3View ? ['multi'] : null
  }, [isV3View])

  const sanitizedV2Types = useMemo(() => {
    return showLegacyVaults ? ['factory', 'legacy'] : ['factory']
  }, [showLegacyVaults])

  const sanitizedCategories = useMemo(() => {
    const allowed = V3_ASSET_CATEGORIES
    return (categories || []).filter((value) => allowed.includes(value))
  }, [categories])

  const sanitizedAggressiveness = useMemo(() => {
    const allowed = new Set(AGGRESSIVENESS_OPTIONS)
    return (aggressiveness || []).filter((value): value is TVaultAggressiveness =>
      allowed.has(value as TVaultAggressiveness)
    )
  }, [aggressiveness])
  // Use the appropriate filter hook based on vault type
  const v3FilterResult = useV3VaultFilter(
    isV3View ? sanitizedV3Types : null,
    chains,
    searchValue,
    isV3View ? sanitizedCategories : null,
    isV3View ? sanitizedAggressiveness : null,
    isV3View ? showHiddenVaults : undefined,
    isV3View
  )
  const v2FilterResult = useV2VaultFilter(
    isV2View ? sanitizedV2Types : null,
    chains,
    searchValue,
    isV2View ? sanitizedCategories : null,
    isV2View ? sanitizedAggressiveness : null,
    showHiddenVaults,
    isV2View
  )
  const { filteredVaults: filteredV2VaultsAllChains } = useV2VaultFilter(
    isV2View ? sanitizedV2Types : null,
    null,
    '',
    isV2View ? sanitizedCategories : null,
    isV2View ? sanitizedAggressiveness : null,
    showHiddenVaults,
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

  let isLoadingVaultList = v2FilterResult.isLoading
  if (listVaultType === 'all') {
    isLoadingVaultList = v3FilterResult.isLoading || v2FilterResult.isLoading
  } else if (listVaultType === 'v3') {
    isLoadingVaultList = v3FilterResult.isLoading
  }

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
  }, [listVaultType, v3FilterResult.totalMatchingVaults, v2FilterResult.filteredVaults])

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
  }, [listVaultType, v3FilterResult.totalHoldingsMatching, v2FilterResult.holdingsVaults])

  const { filteredVaults: filteredVaultsAllChains } = useV3VaultFilter(
    allocatorTypesForTrending,
    null,
    '',
    isV3View ? sanitizedCategories : null,
    isV3View ? sanitizedAggressiveness : null,
    isV3View ? showHiddenVaults : undefined,
    isV3View
  )

  const [activeToggleValues, setActiveToggleValues] = useState<string[]>([])
  const isHoldingsPinned = activeToggleValues.includes(HOLDINGS_TOGGLE_VALUE)
  const isAvailablePinned = activeToggleValues.includes(AVAILABLE_TOGGLE_VALUE)
  const displayedVaultType = optimisticVaultType ?? vaultType
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

  const sortedVaults = useSortVaults(filteredVaults, sortBy, sortDirection)
  const holdingsKeySet = useMemo(
    () => new Set(holdingsVaults.map((vault) => `${vault.chainID}_${toAddress(vault.address)}`)),
    [holdingsVaults]
  )
  const availableKeySet = useMemo(
    () => new Set(availableVaults.map((vault) => `${vault.chainID}_${toAddress(vault.address)}`)),
    [availableVaults]
  )
  const sortedHoldingsVaults = useMemo(
    () => sortedVaults.filter((vault) => holdingsKeySet.has(`${vault.chainID}_${toAddress(vault.address)}`)),
    [sortedVaults, holdingsKeySet]
  )
  const sortedAvailableVaults = useMemo(
    () => sortedVaults.filter((vault) => availableKeySet.has(`${vault.chainID}_${toAddress(vault.address)}`)),
    [sortedVaults, availableKeySet]
  )
  const sortedSuggestedV3Candidates = useSortVaults(filteredVaultsAllChains, 'featuringScore', 'desc')
  const sortedSuggestedV2Candidates = useSortVaults(filteredV2VaultsAllChains, 'featuringScore', 'desc')

  const pinnedSections = useMemo(() => {
    const sections: Array<{ key: string; vaults: typeof sortedVaults }> = []
    const seen = new Set<string>()

    if (isAvailablePinned) {
      const availableSectionVaults = sortedAvailableVaults.filter((vault) => {
        const key = `${vault.chainID}_${toAddress(vault.address)}`
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
        const key = `${vault.chainID}_${toAddress(vault.address)}`
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

  const pinnedVaultKeys = useMemo(
    () => new Set(pinnedVaults.map((vault) => `${vault.chainID}_${toAddress(vault.address)}`)),
    [pinnedVaults]
  )

  const mainVaults = useMemo(() => {
    if (pinnedVaults.length === 0) {
      return sortedVaults
    }
    return sortedVaults.filter((vault) => !pinnedVaultKeys.has(`${vault.chainID}_${toAddress(vault.address)}`))
  }, [pinnedVaultKeys, pinnedVaults, sortedVaults])

  const suggestedV3Vaults = useMemo(
    () =>
      sortedSuggestedV3Candidates
        .filter((vault) => !holdingsKeySet.has(`${vault.chainID}_${toAddress(vault.address)}`))
        .slice(0, 8),
    [sortedSuggestedV3Candidates, holdingsKeySet]
  )

  const suggestedV2Vaults = useMemo(
    () =>
      sortedSuggestedV2Candidates
        .filter((vault) => !holdingsKeySet.has(`${vault.chainID}_${toAddress(vault.address)}`))
        .slice(0, 8),
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

  const filtersCount = useMemo(() => {
    const typeCount = sanitizedV3Types.includes('single') ? 1 : 0
    const legacyCount = showLegacyVaults ? 1 : 0
    const hiddenCount = showHiddenVaults ? 1 : 0
    const categoryCount = sanitizedCategories.length
    const aggressivenessCount = sanitizedAggressiveness.length
    return typeCount + legacyCount + hiddenCount + categoryCount + aggressivenessCount
  }, [sanitizedV3Types, showLegacyVaults, showHiddenVaults, sanitizedCategories, sanitizedAggressiveness])
  const activeChains = useMemo(() => chains ?? [], [chains])
  const activeCategories = sanitizedCategories
  const activeProductType = useMemo(() => (listVaultType === 'factory' ? 'lp' : listVaultType), [listVaultType])
  const resolveApyDisplayVariant = useCallback((vault: TYDaemonVault): 'default' | 'factory-list' => {
    const listKind = deriveListKind(vault)
    return listKind === 'allocator' || listKind === 'strategy' ? 'default' : 'factory-list'
  }, [])
  const handleToggleChain = useCallback(
    (chainId: number): void => {
      onChangeChains(toggleInArray(chains, chainId))
    },
    [chains, onChangeChains]
  )
  const handleToggleCategory = useCallback(
    (category: string): void => {
      onChangeCategories(toggleInArray(sanitizedCategories, category))
    },
    [onChangeCategories, sanitizedCategories]
  )
  const handleToggleType = useCallback(
    (type: string): void => {
      if (listVaultType !== 'v3') {
        return
      }
      onChangeTypes(toggleInArray(sanitizedV3Types, type))
    },
    [listVaultType, onChangeTypes, sanitizedV3Types]
  )

  const handleToggleVaultType = useCallback(
    (nextType: 'v3' | 'lp'): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (nextType === 'v3') {
        nextParams.set('type', 'single')
        sanitizeChainsParam(nextParams, getSupportedChainsForVaultType('v3'))
      } else {
        nextParams.set('type', 'liquidity')
        sanitizeChainsParam(nextParams, getSupportedChainsForVaultType('factory'))
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )
  const handleVaultVersionToggle = useCallback(
    (nextType: TVaultType): void => {
      if (nextType === vaultType && !optimisticVaultType) {
        return
      }
      setOptimisticVaultType(nextType)
      startTransition(() => {
        const nextParams = new URLSearchParams(searchParams)
        if (nextType === 'all') {
          nextParams.delete('type')
        } else if (nextType === 'v3') {
          nextParams.set('type', 'single')
        } else {
          nextParams.set('type', 'lp')
        }
        sanitizeChainsParam(nextParams, getSupportedChainsForVaultType(nextType))
        setSearchParams(nextParams, { replace: true })
      })
    },
    [optimisticVaultType, searchParams, setSearchParams, vaultType]
  )

  const filtersSections: TVaultsFiltersPanelSection[] = [
    {
      type: 'checklist',
      title: 'Asset Category',
      options: V3_ASSET_CATEGORIES.map((value) => ({
        label: value,
        checked: sanitizedCategories.includes(value),
        onToggle: (): void => onChangeCategories(toggleInArray(sanitizedCategories, value))
      }))
    },
    {
      type: 'checklist',
      title: 'Vault Aggressiveness',
      options: AGGRESSIVENESS_OPTIONS.map((value) => ({
        label: value,
        checked: sanitizedAggressiveness.includes(value),
        onToggle: (): void => onChangeAggressiveness(toggleInArray(sanitizedAggressiveness, value))
      }))
    },
    {
      type: 'advanced',
      title: 'Advanced',
      toggles: [
        {
          label: 'Show single asset strategies',
          description: 'Checking this will show the underlying strategies used in Single Asset Vaults in the list.',
          checked: showStrategies,
          onChange: (checked: boolean): void => onChangeShowStrategies(checked)
        },
        {
          label: 'Show legacy vaults',
          description: 'Includes legacy vaults in the list.',
          checked: showLegacyVaults,
          onChange: (checked: boolean): void => onChangeShowLegacyVaults(checked)
        },
        {
          label: 'Show hidden vaults',
          description: 'Checking this will show deprioritized and hidden vaults in the list',
          checked: showHiddenVaults,
          onChange: (checked: boolean): void => onChangeShowHiddenVaults(checked)
        }
      ]
    }
  ]
  const filtersPanelContent = <VaultsFiltersPanel sections={filtersSections} />

  const chainConfig = useMemo(() => {
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

  const defaultCategories = isV3View ? V3_ASSET_CATEGORIES : V2_ASSET_CATEGORIES
  const vaultListContent = useMemo(() => {
    if (isLoadingVaultList) {
      return (
        <VaultsListEmpty
          isLoading={isLoadingVaultList}
          currentSearch={searchValue}
          currentCategories={sanitizedCategories}
          currentChains={chains}
          onReset={onResetMultiSelect}
          defaultCategories={defaultCategories}
          potentialResultsCount={totalMatchingVaults}
        />
      )
    }

    if (pinnedVaults.length === 0 && mainVaults.length === 0) {
      return (
        <VaultsListEmpty
          isLoading={false}
          currentSearch={searchValue}
          currentCategories={sanitizedCategories}
          currentChains={chains}
          onReset={onResetMultiSelect}
          defaultCategories={defaultCategories}
          potentialResultsCount={totalMatchingVaults}
        />
      )
    }

    return (
      <div className={'flex flex-col gap-px bg-border'}>
        {pinnedSections.map((section) => (
          <VaultsAuxiliaryList
            key={section.key}
            vaults={section.vaults}
            vaultFlags={vaultFlags}
            resolveApyDisplayVariant={resolveApyDisplayVariant}
            activeChains={activeChains}
            activeCategories={activeCategories}
            activeProductType={activeProductType}
            onToggleChain={handleToggleChain}
            onToggleCategory={handleToggleCategory}
            onToggleType={listVaultType === 'v3' ? handleToggleType : undefined}
            onToggleVaultType={handleToggleVaultType}
            shouldCollapseChips={shouldCollapseChips}
            showStrategies={showStrategies}
          />
        ))}
        {mainVaults.length > 0 ? (
          <div className={'flex flex-col gap-px bg-border'}>
            {mainVaults.map((vault) => {
              const key = `${vault.chainID}_${toAddress(vault.address)}`
              const rowApyDisplayVariant = resolveApyDisplayVariant(vault)
              return (
                <VaultsListRow
                  key={key}
                  currentVault={vault}
                  flags={vaultFlags[key]}
                  apyDisplayVariant={rowApyDisplayVariant}
                  activeChains={activeChains}
                  activeCategories={activeCategories}
                  activeProductType={activeProductType}
                  onToggleChain={handleToggleChain}
                  onToggleCategory={handleToggleCategory}
                  onToggleType={listVaultType === 'v3' ? handleToggleType : undefined}
                  onToggleVaultType={handleToggleVaultType}
                  shouldCollapseChips={shouldCollapseChips}
                  showStrategies={showStrategies}
                />
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }, [
    activeCategories,
    activeChains,
    activeProductType,
    chains,
    defaultCategories,
    handleToggleCategory,
    handleToggleChain,
    handleToggleType,
    handleToggleVaultType,
    isLoadingVaultList,
    listVaultType,
    mainVaults,
    onResetMultiSelect,
    pinnedSections,
    pinnedVaults.length,
    resolveApyDisplayVariant,
    sanitizedCategories,
    searchValue,
    shouldCollapseChips,
    showStrategies,
    totalMatchingVaults,
    vaultFlags
  ])

  const suggestedVaultsElement = <TrendingVaults suggestedVaults={suggestedVaults} />

  const breadcrumbsElement = (
    <div className={'mb-3 mt-2 flex items-center gap-2 text-sm text-text-secondary'}>
      <Link to={'/'} className={'transition-colors hover:text-text-primary'}>
        {'Home'}
      </Link>
      <span>{'>'}</span>
      <Link to={'/vaults'} className={'transition-colors hover:text-text-primary'}>
        {'Vaults'}
      </Link>
      <span>{'>'}</span>
      <span className={'font-medium text-text-primary'}>{getVaultTypeLabel(displayedVaultType)}</span>
    </div>
  )

  const filtersElement = (
    <div ref={filtersRef} className={'sticky z-40 w-full bg-app pb-2 shrink-0'} style={{ top: 'var(--header-height)' }}>
      {breadcrumbsElement}
      {suggestedVaultsElement}
      <VaultsFilters
        shouldDebounce={true}
        searchValue={searchValue}
        chains={chains}
        onChangeChains={onChangeChains}
        onSearch={onSearch}
        chainConfig={chainConfig}
        filtersCount={filtersCount}
        filtersContent={filtersPanelContent}
        filtersPanelContent={filtersPanelContent}
        onClearFilters={onResetMultiSelect}
        mobileExtraContent={
          <VaultVersionToggle
            stretch={true}
            activeType={displayedVaultType}
            onTypeChange={handleVaultVersionToggle}
            isPending={isSwitchingVaultType}
          />
        }
        trailingControls={
          <VaultVersionToggle
            activeType={displayedVaultType}
            onTypeChange={handleVaultVersionToggle}
            isPending={isSwitchingVaultType}
          />
        }
        isStackedLayout={shouldStackFilters}
      />
    </div>
  )

  const listElement = (
    <div aria-busy={isSwitchingVaultType || undefined} className={'relative w-full rounded-xl bg-surface'}>
      <div className={isSwitchingVaultType ? 'pointer-events-none opacity-70 transition' : 'transition'}>
        <div
          className={'relative md:sticky md:z-30'}
          style={{
            top: 'calc(var(--header-height) + var(--vaults-filters-height))'
          }}
        >
          <div
            aria-hidden={true}
            className={'pointer-events-none absolute inset-0 z-0 bg-app border-2'}
            style={{ borderColor: 'var(--color-app)' }}
          />
          <VaultsListHead
            containerClassName={'rounded-t-xl bg-surface shrink-0'}
            wrapperClassName={'relative z-10 border border-border rounded-t-xl bg-transparent'}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
              let targetSortBy = newSortBy as TPossibleSortBy
              let targetSortDirection = newSortDirection as TSortDirection

              if (targetSortBy === 'deposited' && totalHoldingsMatching === 0) {
                targetSortBy = 'featuringScore'
                targetSortDirection = 'desc'
              }

              onChangeSortBy(targetSortBy)
              onChangeSortDirection(targetSortDirection)
            }}
            onToggle={(value): void => {
              setActiveToggleValues((prev) => {
                if (prev.includes(value)) {
                  return prev.filter((entry) => entry !== value)
                }
                return [value]
              })
            }}
            activeToggleValues={activeToggleValues}
            items={[
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
                className: 'col-span-4'
              },
              {
                type: 'sort',
                label: 'TVL',
                value: 'tvl',
                sortable: true,
                className: 'col-span-4'
              },
              // {
              //   type: 'toggle',
              //   label: 'Available',
              //   value: AVAILABLE_TOGGLE_VALUE,
              //   className: 'col-span-3',
              //   disabled: availableVaults.length === 0
              // },
              {
                type: 'toggle',
                label: 'Holdings',
                value: HOLDINGS_TOGGLE_VALUE,
                className: 'col-span-4 justify-end',
                disabled: holdingsVaults.length === 0
              }
            ]}
          />
        </div>
        {/* <div className={'overflow-hidden rounded-b-xl'}> */}
        <div className={'flex flex-col border-x border-b border-border rounded-b-xl overflow-hidden'}>
          {vaultListContent}
        </div>
        {/* </div> */}
      </div>
      {isSwitchingVaultType ? (
        <output
          aria-live={'polite'}
          className={'absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-app/30 text-text-primary'}
        >
          <span className={'flex flex-col items-center gap-2'}>
            <span className={'loader'} />
            <span className={'text-sm font-medium'}>{'Updating vaults…'}</span>
          </span>
        </output>
      ) : null}
    </div>
  )

  if (typeof children === 'function') {
    const content = children({ filters: filtersElement, list: listElement })
    return (
      <div ref={varsRef} className={'flex flex-col'} style={{ '--vaults-filters-height': '0px' } as CSSProperties}>
        {content}
      </div>
    )
  }

  return (
    <div ref={varsRef} className={'flex flex-col'} style={{ '--vaults-filters-height': '0px' } as CSSProperties}>
      {filtersElement}
      {listElement}
    </div>
  )
}

function useVaultListExtraFilters(): {
  aggressiveness: string[] | null
  showLegacyVaults: boolean
  showHiddenVaults: boolean
  showStrategies: boolean
  onChangeAggressiveness: (value: string[] | null) => void
  onChangeShowLegacyVaults: (value: boolean) => void
  onChangeShowHiddenVaults: (value: boolean) => void
  onChangeShowStrategies: (value: boolean) => void
  onResetExtraFilters: () => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const readStringList = (key: string): string[] => {
    const raw = searchParams.get(key)
    if (!raw || raw === 'none') return []
    return raw
      .split('_')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  const aggressiveness = readStringList('aggr')
  const showHiddenVaults = readBooleanParam(searchParams, 'showHidden')
  const showStrategies = readBooleanParam(searchParams, 'showStrategies')
  const showLegacyParam = searchParams.get('showLegacy')
  const showLegacyFromParam = showLegacyParam !== null ? readBooleanParam(searchParams, 'showLegacy') : false
  const legacyFallback = readStringList('types').includes('legacy')
  const showLegacyVaults = showLegacyParam !== null ? showLegacyFromParam : Boolean(legacyFallback)

  const updateParam = (key: string, value: string[] | null): void => {
    const nextParams = new URLSearchParams(searchParams)
    if (!value || value.length === 0) {
      nextParams.delete(key)
    } else {
      nextParams.set(key, value.join('_'))
    }
    setSearchParams(nextParams, { replace: true })
  }

  return {
    aggressiveness,
    showLegacyVaults,
    showHiddenVaults,
    showStrategies,
    onChangeAggressiveness: (value): void => {
      updateParam('aggr', value)
    },
    onChangeShowLegacyVaults: (value): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (value) {
        nextParams.set('showLegacy', '1')
      } else {
        nextParams.delete('showLegacy')
        const rawTypes = nextParams.get('types')
        if (rawTypes) {
          const nextTypes = rawTypes
            .split('_')
            .map((type) => type.trim())
            .filter((type) => type && type !== 'legacy' && type !== 'factory')
          if (nextTypes.length === 0) {
            nextParams.delete('types')
          } else {
            nextParams.set('types', nextTypes.join('_'))
          }
        }
      }
      setSearchParams(nextParams, { replace: true })
    },
    onChangeShowHiddenVaults: (value): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (value) {
        nextParams.set('showHidden', '1')
      } else {
        nextParams.delete('showHidden')
      }
      setSearchParams(nextParams, { replace: true })
    },
    onChangeShowStrategies: (value): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (value) {
        nextParams.set('showStrategies', '1')
      } else {
        nextParams.delete('showStrategies')
      }
      setSearchParams(nextParams, { replace: true })
    },
    onResetExtraFilters: (): void => {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('aggr')
      nextParams.delete('showLegacy')
      nextParams.delete('showHidden')
      nextParams.delete('showStrategies')
      setSearchParams(nextParams, { replace: true })
    }
  }
}

function VaultsIndexContent({ vaultType }: { vaultType: TVaultType }): ReactElement {
  usePrefetchYearnVaults(V2_SUPPORTED_CHAINS, vaultType === 'v3')
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    aggressiveness,
    showLegacyVaults,
    showHiddenVaults,
    showStrategies,
    onChangeAggressiveness,
    onChangeShowLegacyVaults,
    onChangeShowHiddenVaults,
    onChangeShowStrategies,
    onResetExtraFilters
  } = useVaultListExtraFilters()

  const queryArgs = useQueryArguments({
    defaultTypes: ['multi', 'single'],
    defaultCategories: [],
    defaultPathname: '/vaults',
    defaultSortBy: 'featuringScore',
    resetTypes: ['multi', 'single'],
    resetCategories: []
  })
  const [sortBy, setSortBy] = useState<TPossibleSortBy>('featuringScore')
  const [sortDirection, setSortDirection] = useState<TSortDirection>('desc')

  useEffect(() => {
    if (!searchParams.has('sortDirection') && !searchParams.has('sortBy')) {
      return
    }
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('sortDirection')
    nextParams.delete('sortBy')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  function handleSortByChange(value: TPossibleSortBy | ''): void {
    setSortBy(value || 'featuringScore')
  }

  function handleSortDirectionChange(value: TSortDirection | ''): void {
    setSortDirection(value || 'desc')
  }

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4 pb-4'}>
        <ListOfVaults
          {...queryArgs}
          sortBy={sortBy}
          sortDirection={sortDirection}
          aggressiveness={aggressiveness}
          showLegacyVaults={showLegacyVaults}
          showHiddenVaults={showHiddenVaults}
          showStrategies={showStrategies}
          onChangeAggressiveness={onChangeAggressiveness}
          onChangeShowLegacyVaults={onChangeShowLegacyVaults}
          onChangeShowHiddenVaults={onChangeShowHiddenVaults}
          onChangeShowStrategies={onChangeShowStrategies}
          onChangeSortBy={handleSortByChange}
          onChangeSortDirection={handleSortDirectionChange}
          onResetMultiSelect={(): void => {
            queryArgs.onResetMultiSelect()
            onResetExtraFilters()
          }}
          vaultType={vaultType}
        >
          {({ filters, list }) => (
            <div className={'flex flex-col'}>
              {filters}
              {list}
            </div>
          )}
        </ListOfVaults>
      </div>
    </div>
  )
}

function Index(): ReactElement {
  const vaultType = useVaultType()
  return <VaultsIndexContent vaultType={vaultType} />
}

export default Index
