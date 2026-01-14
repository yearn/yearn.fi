import Link from '@components/Link'
import { usePrefetchYearnVaults } from '@lib/hooks/useFetchYearnVaults'
import { getVaultKey } from '@lib/hooks/useVaultFilterUtils'
import type { TSortDirection } from '@lib/types'
import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useMediaQuery } from '@react-hookz/web'
import { VaultsAuxiliaryList } from '@vaults/components/list/VaultsAuxiliaryList'
import { type TListHead, VaultsListHead } from '@vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@vaults/components/list/VaultsListRow'
import { TrendingVaults } from '@vaults/components/TrendingVaults'
import { VaultsListEmpty } from '@vaults/shared/components/list/VaultsListEmpty'
import { VaultsFilters } from '@vaults/shared/components/VaultsFilters'
import { type TVaultsFiltersPanelSection, VaultsFiltersPanel } from '@vaults/shared/components/VaultsFiltersPanel'
import type { TPossibleSortBy } from '@vaults/shared/hooks/useSortVaults'
import { deriveListKind, type TVaultAggressiveness } from '@vaults/shared/utils/vaultListFacets'
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react'
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
import {
  AGGRESSIVENESS_OPTIONS,
  AVAILABLE_TOGGLE_VALUE,
  HOLDINGS_TOGGLE_VALUE,
  toggleInArray,
  V2_SUPPORTED_CHAINS,
  V3_ASSET_CATEGORIES,
  V3_DEFAULT_SECONDARY_CHAIN_IDS,
  V3_PRIMARY_CHAIN_IDS,
  V3_SUPPORTED_CHAINS
} from './constants'
import { useVaultsListModel } from './useVaultsListModel'
import { useVaultsQueryState } from './useVaultsQueryState'
import { VaultVersionToggle } from './VaultVersionToggle'
import { getVaultTypeLabel, type TVaultType } from './vaultTypeCopy'
import { getSupportedChainsForVaultType } from './vaultTypeUtils'

const DEFAULT_VAULT_TYPES = ['multi', 'single']
const VAULTS_FILTERS_STORAGE_KEY = 'yearn.fi/vaults-filters@1'

type TVaultsPageLayoutProps = {
  varsRef: RefObject<HTMLDivElement | null>
  stickyHeader: ReactNode
  list: ReactNode
}

function VaultsPageLayout({ varsRef, stickyHeader, list }: TVaultsPageLayoutProps): ReactElement {
  return (
    <div ref={varsRef} className={'flex flex-col'} style={{ '--vaults-filters-height': '0px' } as CSSProperties}>
      {stickyHeader}
      {list}
    </div>
  )
}

type TVaultsStickyHeaderProps = {
  filtersRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

function VaultsStickyHeader({ filtersRef, children }: TVaultsStickyHeaderProps): ReactElement {
  return (
    <div ref={filtersRef} className={'sticky z-40 w-full bg-app pb-2 shrink-0'} style={{ top: 'var(--header-height)' }}>
      {children}
    </div>
  )
}

function VaultsBreadcrumbs({ vaultType }: { vaultType: TVaultType }): ReactElement {
  return (
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
}

function TrendingVaultsSection({ suggestedVaults }: { suggestedVaults: TYDaemonVault[] }): ReactElement {
  return <TrendingVaults suggestedVaults={suggestedVaults} />
}

type TVaultsFiltersBarProps = {
  searchValue: string
  chains: number[] | null
  onChangeChains: (chains: number[] | null) => void
  onSearch: (searchValue: string) => void
  chainConfig: {
    supportedChainIds: number[]
    primaryChainIds?: number[]
    defaultSecondaryChainIds?: number[]
    chainDisplayOrder?: number[]
    showMoreChainsButton?: boolean
    allChainsLabel?: string
  }
  filtersCount: number
  filtersPanel: ReactNode
  onClearFilters: () => void
  searchTrailingControls?: ReactNode
  mobileExtraContent: ReactNode
  trailingControls: ReactNode
  isStackedLayout: boolean
}

function VaultsFiltersBar({
  searchValue,
  chains,
  onChangeChains,
  onSearch,
  chainConfig,
  filtersCount,
  filtersPanel,
  onClearFilters,
  searchTrailingControls,
  mobileExtraContent,
  trailingControls,
  isStackedLayout
}: TVaultsFiltersBarProps): ReactElement {
  return (
    <VaultsFilters
      shouldDebounce={true}
      searchValue={searchValue}
      chains={chains}
      onChangeChains={onChangeChains}
      onSearch={onSearch}
      chainConfig={chainConfig}
      filtersCount={filtersCount}
      filtersContent={filtersPanel}
      filtersPanelContent={filtersPanel}
      onClearFilters={onClearFilters}
      mobileExtraContent={mobileExtraContent}
      searchTrailingControls={searchTrailingControls}
      trailingControls={trailingControls}
      isStackedLayout={isStackedLayout}
    />
  )
}

type TVaultsListSectionProps = {
  isSwitchingVaultType: boolean
  listHeadProps: TListHead
  vaultListContent: ReactNode
}

function VaultsListSection({
  isSwitchingVaultType,
  listHeadProps,
  vaultListContent
}: TVaultsListSectionProps): ReactElement {
  return (
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
          <VaultsListHead {...listHeadProps} />
        </div>
        <div className={'flex flex-col border-x border-b border-border rounded-b-xl overflow-hidden'}>
          {vaultListContent}
        </div>
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
  onChangeVaultType: (value: TVaultType) => void
  onChangeSortDirection: (value: TSortDirection | '') => void
  onChangeSortBy: (value: TPossibleSortBy | '') => void
  onResetMultiSelect: () => void
  onShareFilters: () => void
  vaultType: TVaultType
  hasTypesParam: boolean
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
  onChangeVaultType,
  onChangeSortDirection,
  onChangeSortBy,
  onResetMultiSelect,
  onShareFilters,
  vaultType,
  hasTypesParam
}: TListOfVaultsProps): ReactElement {
  const varsRef = useRef<HTMLDivElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const [isPending, startTransition] = useTransition()
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
  const [optimisticShowLegacyVaults, setOptimisticShowLegacyVaults] = useState<boolean | null>(null)
  const [optimisticShowHiddenVaults, setOptimisticShowHiddenVaults] = useState<boolean | null>(null)
  const [optimisticShowStrategies, setOptimisticShowStrategies] = useState<boolean | null>(null)
  const listChains = useDeferredValue(chains)
  const listTypes = useDeferredValue(types)
  const listCategories = useDeferredValue(categories)
  const listAggressiveness = useDeferredValue(aggressiveness)
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
  const [activeToggleValues, setActiveToggleValues] = useState<string[]>([])
  const isHoldingsPinned = activeToggleValues.includes(HOLDINGS_TOGGLE_VALUE)
  const isAvailablePinned = activeToggleValues.includes(AVAILABLE_TOGGLE_VALUE)
  const {
    defaultCategories,
    listCategoriesSanitized,
    holdingsVaults,
    availableVaults,
    vaultFlags,
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
    return typeCount + legacyCount + hiddenCount + categoryCount + aggressivenessCount
  }, [
    displayedAggressivenessSanitized.length,
    displayedCategoriesSanitized.length,
    displayedShowHiddenVaults,
    displayedShowLegacyVaults,
    displayedV3Types
  ])
  const activeChains = useMemo(() => displayedChains ?? [], [displayedChains])
  const activeCategories = displayedCategoriesSanitized
  const activeProductType = useMemo(
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

  const handleResetMultiSelect = useCallback((): void => {
    setOptimisticChains([])
    setOptimisticCategories([])
    setOptimisticAggressiveness([])
    setOptimisticTypes(DEFAULT_VAULT_TYPES)
    setOptimisticShowLegacyVaults(false)
    setOptimisticShowHiddenVaults(false)
    setOptimisticShowStrategies(false)
    startTransition(() => {
      onResetMultiSelect()
    })
  }, [onResetMultiSelect])

  const filtersSections: TVaultsFiltersPanelSection[] = [
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

  const shareButtonElement = (
    <button
      type={'button'}
      className={cl(
        'flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-3',
        'text-sm font-medium text-text-secondary',
        'transition-colors hover:border-border-hover hover:text-text-primary'
      )}
      onClick={onShareFilters}
      aria-label={'Share filters'}
    >
      <svg
        xmlns={'http://www.w3.org/2000/svg'}
        viewBox={'0 0 24 24'}
        fill={'none'}
        stroke={'currentColor'}
        strokeWidth={'2'}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
        className={'size-4'}
      >
        <path d={'M12 2v13'} />
        <path d={'m16 6-4-4-4 4'} />
        <path d={'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'} />
      </svg>
    </button>
  )

  const vaultListContent = useMemo(() => {
    if (isLoadingVaultList) {
      return (
        <VaultsListEmpty
          isLoading={isLoadingVaultList}
          currentSearch={searchValue}
          currentCategories={listCategoriesSanitized}
          currentChains={listChains}
          onReset={handleResetMultiSelect}
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
          currentCategories={listCategoriesSanitized}
          currentChains={listChains}
          onReset={handleResetMultiSelect}
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
            showStrategies={displayedShowStrategies}
          />
        ))}
        {mainVaults.length > 0 ? (
          <div className={'flex flex-col gap-px bg-border'}>
            {mainVaults.map((vault) => {
              const key = getVaultKey(vault)
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
                  showStrategies={displayedShowStrategies}
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
    defaultCategories,
    handleToggleCategory,
    handleToggleChain,
    handleToggleType,
    handleToggleVaultType,
    isLoadingVaultList,
    listChains,
    listVaultType,
    mainVaults,
    handleResetMultiSelect,
    pinnedSections,
    pinnedVaults.length,
    resolveApyDisplayVariant,
    listCategoriesSanitized,
    searchValue,
    shouldCollapseChips,
    displayedShowStrategies,
    totalMatchingVaults,
    vaultFlags
  ])

  const breadcrumbsElement = <VaultsBreadcrumbs vaultType={displayedVaultType} />

  const trendingElement = <TrendingVaultsSection suggestedVaults={suggestedVaults} />

  const filtersBarElement = (
    <VaultsFiltersBar
      searchValue={searchValue}
      chains={displayedChains}
      onChangeChains={handleChainsChange}
      onSearch={onSearch}
      chainConfig={chainConfig}
      filtersCount={filtersCount}
      filtersPanel={filtersPanelContent}
      onClearFilters={handleResetMultiSelect}
      searchTrailingControls={shareButtonElement}
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
  )

  const stickyHeaderElement = (
    <VaultsStickyHeader filtersRef={filtersRef}>
      {breadcrumbsElement}
      {trendingElement}
      {filtersBarElement}
    </VaultsStickyHeader>
  )

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
    items: [
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
    ]
  }

  const listElement = (
    <VaultsListSection
      isSwitchingVaultType={isSwitchingVaultType}
      listHeadProps={listHeadProps}
      vaultListContent={vaultListContent}
    />
  )

  return <VaultsPageLayout varsRef={varsRef} stickyHeader={stickyHeaderElement} list={listElement} />
}

function VaultsIndexContent(): ReactElement {
  const {
    vaultType,
    hasTypesParam,
    search,
    types,
    categories,
    chains,
    aggressiveness,
    showLegacyVaults,
    showHiddenVaults,
    showStrategies,
    onSearch,
    onChangeTypes,
    onChangeCategories,
    onChangeChains,
    onChangeAggressiveness,
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

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4 pb-4'}>
        <ListOfVaults
          search={search}
          types={types}
          categories={categories}
          chains={chains}
          onSearch={onSearch}
          onChangeTypes={onChangeTypes}
          onChangeCategories={onChangeCategories}
          onChangeChains={onChangeChains}
          onChangeSortBy={onChangeSortBy}
          onChangeSortDirection={onChangeSortDirection}
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
          onResetMultiSelect={(): void => {
            onResetMultiSelect()
            onResetExtraFilters()
          }}
          vaultType={vaultType}
          onChangeVaultType={onChangeVaultType}
          hasTypesParam={hasTypesParam}
          onShareFilters={onShareFilters}
        />
      </div>
    </div>
  )
}

function Index(): ReactElement {
  return <VaultsIndexContent />
}

export default Index
