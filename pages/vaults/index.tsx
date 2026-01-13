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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  HOLDINGS_TOGGLE_VALUE,
  readBooleanParam,
  selectVaultsByType,
  toggleInArray,
  V2_DEFAULT_TYPES,
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
  showHiddenVaults: boolean
  showStrategies: boolean
  sortDirection: TSortDirection
  sortBy: TPossibleSortBy
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeAggressiveness: (value: string[] | null) => void
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
  showHiddenVaults,
  showStrategies,
  sortDirection,
  sortBy,
  onSearch,
  onChangeTypes,
  onChangeCategories,
  onChangeAggressiveness,
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
  const [searchParams, setSearchParams] = useSearchParams()
  const isAllVaults = vaultType === 'all'
  const isV3View = vaultType === 'v3' || isAllVaults
  const isV2View = vaultType === 'factory' || isAllVaults
  const shouldCollapseChips =
    useMediaQuery('(max-width: 1000px)', {
      initializeWithValue: false
    }) ?? false

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
      const borderBoxHeight = Array.isArray(borderBoxSize)
        ? borderBoxSize[0]?.blockSize
        : borderBoxSize && typeof borderBoxSize === 'object' && 'blockSize' in borderBoxSize
          ? (borderBoxSize as ResizeObserverSize).blockSize
          : undefined
      const height = borderBoxHeight ?? filtersElement.getBoundingClientRect().height
      varsElement.style.setProperty('--vaults-filters-height', `${height}px`)
    })

    varsElement.style.setProperty('--vaults-filters-height', `${filtersElement.getBoundingClientRect().height}px`)
    observer.observe(filtersElement)
    return () => observer.disconnect()
  }, [])

  const sanitizedV3Types = useMemo(() => {
    if (!isV3View) {
      return []
    }
    const selected = (types || []).filter((type) => type === 'multi' || type === 'single')
    if (!showStrategies) {
      return ['multi']
    }
    if (!searchParams.has('types') || selected.length === 0) {
      return ['multi', 'single']
    }
    return selected
  }, [types, isV3View, showStrategies, searchParams])

  const allocatorTypesForTrending = useMemo(() => {
    return isV3View ? ['multi'] : null
  }, [isV3View])

  const sanitizedV2Types = useMemo(() => {
    if (!isV2View) {
      return []
    }
    if (vaultType === 'factory') {
      return ['factory']
    }
    const selected = (types || []).filter((type) => type === 'factory' || type === 'legacy')
    if (selected.length === 0) {
      return V2_DEFAULT_TYPES
    }
    if (!selected.includes('factory')) {
      return ['factory', ...selected]
    }
    return selected
  }, [types, isV2View, vaultType])

  useEffect(() => {
    if (!isV3View) {
      return
    }
    const selected = (types || []).filter((type) => type === 'multi' || type === 'single')
    if (!showStrategies) {
      if (selected.includes('single')) {
        onChangeTypes(['multi'])
      }
      return
    }
    if (!searchParams.has('types')) {
      onChangeTypes(['multi', 'single'])
    }
  }, [isV3View, showStrategies, types, onChangeTypes, searchParams])

  const sanitizedCategories = useMemo(() => {
    const allowed = isV3View ? V3_ASSET_CATEGORIES : V2_ASSET_CATEGORIES
    return (categories || []).filter((value) => allowed.includes(value))
  }, [categories, isV3View])

  const sanitizedAggressiveness = useMemo(() => {
    const allowed = new Set(AGGRESSIVENESS_OPTIONS)
    return (aggressiveness || []).filter((value): value is TVaultAggressiveness =>
      allowed.has(value as TVaultAggressiveness)
    )
  }, [aggressiveness])
  const showLegacyVaults = sanitizedV2Types.includes('legacy')

  // Use the appropriate filter hook based on vault type
  const v3FilterResult = useV3VaultFilter(
    isV3View ? sanitizedV3Types : null,
    chains,
    search || '',
    isV3View ? sanitizedCategories : null,
    isV3View ? sanitizedAggressiveness : null,
    isV3View ? showHiddenVaults : undefined
  )
  const v2FilterResult = useV2VaultFilter(
    isV2View ? sanitizedV2Types : null,
    chains,
    search || '',
    isV2View ? sanitizedCategories : null
  )
  const { filteredVaults: filteredV2VaultsAllChains } = useV2VaultFilter(
    isV2View ? sanitizedV2Types : null,
    null,
    '',
    isV2View ? sanitizedCategories : null
  )

  const filteredVaults = useMemo(
    () => selectVaultsByType(vaultType, v3FilterResult.filteredVaults, v2FilterResult.filteredVaults, true),
    [vaultType, v3FilterResult.filteredVaults, v2FilterResult.filteredVaults]
  )

  const holdingsVaults = useMemo(
    () => selectVaultsByType(vaultType, v3FilterResult.holdingsVaults, v2FilterResult.holdingsVaults, true),
    [vaultType, v3FilterResult.holdingsVaults, v2FilterResult.holdingsVaults]
  )

  const availableVaults = useMemo(
    () => selectVaultsByType(vaultType, v3FilterResult.availableVaults, v2FilterResult.availableVaults, true),
    [vaultType, v3FilterResult.availableVaults, v2FilterResult.availableVaults]
  )

  const vaultFlags = useMemo(
    () => selectVaultsByType(vaultType, v3FilterResult.vaultFlags, v2FilterResult.vaultFlags),
    [vaultType, v3FilterResult.vaultFlags, v2FilterResult.vaultFlags]
  )

  const isLoadingVaultList =
    vaultType === 'all'
      ? v3FilterResult.isLoading || v2FilterResult.isLoading
      : vaultType === 'v3'
        ? v3FilterResult.isLoading
        : v2FilterResult.isLoading

  const totalMatchingVaults = useMemo(() => {
    if (vaultType === 'v3') {
      return v3FilterResult.totalMatchingVaults ?? 0
    }
    if (vaultType === 'factory') {
      return v2FilterResult.filteredVaults.length
    }
    return (v3FilterResult.totalMatchingVaults ?? 0) + v2FilterResult.filteredVaults.length
  }, [vaultType, v3FilterResult.totalMatchingVaults, v2FilterResult.filteredVaults])

  const totalHoldingsMatching = useMemo(() => {
    if (vaultType === 'v3') {
      return v3FilterResult.totalHoldingsMatching ?? 0
    }
    if (vaultType === 'factory') {
      return v2FilterResult.holdingsVaults.length
    }
    return (v3FilterResult.totalHoldingsMatching ?? 0) + v2FilterResult.holdingsVaults.length
  }, [vaultType, v3FilterResult.totalHoldingsMatching, v2FilterResult.holdingsVaults])

  const { filteredVaults: filteredVaultsAllChains } = useV3VaultFilter(
    allocatorTypesForTrending,
    null,
    '',
    isV3View ? sanitizedCategories : null,
    isV3View ? sanitizedAggressiveness : null,
    isV3View ? showHiddenVaults : undefined
  )

  const [activeToggleValues, setActiveToggleValues] = useState<string[]>([])
  const isHoldingsPinned = activeToggleValues.includes(HOLDINGS_TOGGLE_VALUE)
  const isAvailablePinned = activeToggleValues.includes(AVAILABLE_TOGGLE_VALUE)

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
    if (vaultType === 'all') {
      return [...suggestedV3Vaults, ...suggestedV2Vaults].slice(0, 8)
    }
    return vaultType === 'v3' ? suggestedV3Vaults : suggestedV2Vaults
  }, [vaultType, suggestedV3Vaults, suggestedV2Vaults])

  const v3FiltersCount = useMemo(() => {
    const typeCount = sanitizedV3Types.includes('single') ? 1 : 0
    const hiddenCount = showHiddenVaults ? 1 : 0
    const categoryCount = sanitizedCategories.length
    const aggressivenessCount = sanitizedAggressiveness.length
    return typeCount + categoryCount + aggressivenessCount + hiddenCount
  }, [sanitizedV3Types, sanitizedCategories, sanitizedAggressiveness, showHiddenVaults])

  const v2FiltersCount = useMemo(() => {
    const legacyCount = showLegacyVaults ? 1 : 0
    return legacyCount + sanitizedCategories.length
  }, [sanitizedCategories, showLegacyVaults])
  const activeChains = chains ?? []
  const activeCategories = sanitizedCategories
  const activeProductType = vaultType === 'factory' ? 'lp' : vaultType
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
      if (vaultType !== 'v3') {
        return
      }
      onChangeTypes(toggleInArray(sanitizedV3Types, type))
    },
    [onChangeTypes, sanitizedV3Types, vaultType]
  )

  const handleToggleLegacyVaults = useCallback(
    (shouldShow: boolean): void => {
      if (!isV2View || !isAllVaults) {
        return
      }
      if (shouldShow) {
        onChangeTypes(['factory', 'legacy'])
      } else {
        onChangeTypes(['factory'])
      }
    },
    [isV2View, isAllVaults, onChangeTypes]
  )

  const handleToggleVaultType = useCallback(
    (nextType: 'v3' | 'lp'): void => {
      const nextParams = new URLSearchParams(searchParams)
      if (nextType === 'v3') {
        nextParams.set('type', 'single')
        nextParams.delete('types')
        sanitizeChainsParam(nextParams, getSupportedChainsForVaultType('v3'))
      } else {
        nextParams.set('type', 'liquidity')
        nextParams.delete('types')
        sanitizeChainsParam(nextParams, getSupportedChainsForVaultType('factory'))
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const v3FiltersSections: TVaultsFiltersPanelSection[] = [
    {
      type: 'checklist',
      title: 'Asset Type',
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
        ...(isV3View
          ? [
              {
                label: 'Show legacy vaults',
                description:
                  'Checking this will show older single asset vaults (built on the Yearn v2 contracts) in the list.',
                checked: showLegacyVaults,
                onChange: (checked: boolean): void => handleToggleLegacyVaults(checked)
              }
            ]
          : []),
        {
          label: 'Show hidden vaults',
          description: 'Checking this will show deprioritized and hidden vaults in the list',
          checked: showHiddenVaults,
          onChange: (checked: boolean): void => onChangeShowHiddenVaults(checked)
        }
      ]
    }
  ]
  const v3FiltersPanel = <VaultsFiltersPanel sections={v3FiltersSections} />

  const v2FiltersSections: TVaultsFiltersPanelSection[] = [
    {
      type: 'checklist',
      title: 'Asset Category',
      options: V2_ASSET_CATEGORIES.map((value) => ({
        label: value,
        checked: sanitizedCategories.includes(value),
        onToggle: (): void => onChangeCategories(toggleInArray(sanitizedCategories, value))
      }))
    },
    {
      type: 'advanced',
      title: 'Advanced',
      toggles: [
        ...(isAllVaults
          ? [
              {
                label: 'Show legacy vaults',
                description: 'Includes legacy LP vaults in the list.',
                checked: showLegacyVaults,
                onChange: (checked: boolean): void => handleToggleLegacyVaults(checked)
              }
            ]
          : []),
        {
          label: 'Show hidden vaults',
          description: 'Checking this will show deprioritized and hidden vaults in the list',
          checked: showHiddenVaults,
          onChange: (checked: boolean): void => onChangeShowHiddenVaults(checked)
        }
      ]
    }
  ]
  const v2FiltersPanel = <VaultsFiltersPanel sections={v2FiltersSections} />

  const filtersPanelContent = vaultType === 'factory' ? v2FiltersPanel : v3FiltersPanel
  const filtersCount =
    vaultType === 'all'
      ? v3FiltersCount + (showLegacyVaults ? 1 : 0)
      : vaultType === 'v3'
        ? v3FiltersCount
        : v2FiltersCount

  const chainConfig = useMemo(() => {
    if (vaultType === 'v3') {
      return {
        supportedChainIds: V3_SUPPORTED_CHAINS,
        primaryChainIds: V3_PRIMARY_CHAIN_IDS,
        defaultSecondaryChainIds: V3_DEFAULT_SECONDARY_CHAIN_IDS,
        chainDisplayOrder: V3_SUPPORTED_CHAINS,
        showMoreChainsButton: false,
        allChainsLabel: 'All Chains'
      }
    }
    if (vaultType === 'all') {
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
  }, [vaultType])

  function renderVaultList(): ReactNode {
    const defaultCategories = isV3View ? V3_ASSET_CATEGORIES : V2_ASSET_CATEGORIES

    if (isLoadingVaultList) {
      return (
        <VaultsListEmpty
          isLoading={isLoadingVaultList}
          currentSearch={search || ''}
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
          currentSearch={search || ''}
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
            onToggleType={vaultType === 'v3' ? handleToggleType : undefined}
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
                  onToggleType={vaultType === 'v3' ? handleToggleType : undefined}
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
  }

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
      <span className={'font-medium text-text-primary'}>{getVaultTypeLabel(vaultType)}</span>
    </div>
  )

  const filtersElement = (
    <div ref={filtersRef} className={'sticky z-40 w-full bg-app pb-2 shrink-0'} style={{ top: 'var(--header-height)' }}>
      {breadcrumbsElement}
      {suggestedVaultsElement}
      <VaultsFilters
        shouldDebounce={true}
        searchValue={search || ''}
        chains={chains}
        onChangeChains={onChangeChains}
        onSearch={onSearch}
        chainConfig={chainConfig}
        filtersCount={filtersCount}
        filtersContent={filtersPanelContent}
        filtersPanelContent={filtersPanelContent}
        onClearFilters={onResetMultiSelect}
        mobileExtraContent={<VaultVersionToggle stretch={true} />}
        trailingControls={<VaultVersionToggle />}
      />
    </div>
  )

  const listElement = (
    <div className={'w-full rounded-xl bg-surface'}>
      <div className={''}>
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
          {renderVaultList()}
        </div>
        {/* </div> */}
      </div>
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
  showHiddenVaults: boolean
  showStrategies: boolean
  onChangeAggressiveness: (value: string[] | null) => void
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
    showHiddenVaults,
    showStrategies,
    onChangeAggressiveness: (value): void => {
      updateParam('aggr', value)
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
    showHiddenVaults,
    showStrategies,
    onChangeAggressiveness,
    onChangeShowHiddenVaults,
    onChangeShowStrategies,
    onResetExtraFilters
  } = useVaultListExtraFilters()

  const queryArgs = useQueryArguments({
    defaultTypes: vaultType === 'v3' ? ['multi'] : V2_DEFAULT_TYPES,
    defaultCategories: [],
    defaultPathname: '/vaults',
    defaultSortBy: 'featuringScore',
    resetTypes: vaultType === 'v3' ? ['multi'] : V2_DEFAULT_TYPES,
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

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4 pb-4'}>
        <ListOfVaults
          {...queryArgs}
          sortBy={sortBy}
          sortDirection={sortDirection}
          aggressiveness={aggressiveness}
          showHiddenVaults={showHiddenVaults}
          showStrategies={showStrategies}
          onChangeAggressiveness={onChangeAggressiveness}
          onChangeShowHiddenVaults={onChangeShowHiddenVaults}
          onChangeShowStrategies={onChangeShowStrategies}
          onChangeSortBy={(value): void => {
            if (!value) {
              setSortBy('featuringScore')
              return
            }
            setSortBy(value)
          }}
          onChangeSortDirection={(value): void => {
            if (!value) {
              setSortDirection('desc')
              return
            }
            setSortDirection(value)
          }}
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
  return <VaultsIndexContent key={vaultType} vaultType={vaultType} />
}

export default Index
