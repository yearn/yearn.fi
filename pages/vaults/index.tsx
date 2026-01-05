import Link from '@components/Link'
import { useV2VaultFilter } from '@lib/hooks/useV2VaultFilter'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import type { TSortDirection } from '@lib/types'
import { cl, toAddress } from '@lib/utils'
import { VaultsListEmpty } from '@vaults-shared/components/list/VaultsListEmpty'
import { VaultsFilters } from '@vaults-shared/components/VaultsFilters'
import type { TPossibleSortBy } from '@vaults-shared/hooks/useSortVaults'
import { useSortVaults } from '@vaults-shared/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-shared/hooks/useVaultsQueryArgs'
import { VaultsV3AuxiliaryList } from '@vaults-v3/components/list/VaultsV3AuxiliaryList'
import { VaultsV3ListHead } from '@vaults-v3/components/list/VaultsV3ListHead'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'
import { TrendingVaults } from '@vaults-v3/components/TrendingVaults'
import { ALL_VAULTSV3_CATEGORIES } from '@vaults-v3/constants'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { VaultVersionToggle } from './VaultVersionToggle'
import { getVaultTypeLabel, type TVaultType } from './vaultTypeCopy'

const AVAILABLE_TOGGLE_VALUE = 'available'
const HOLDINGS_TOGGLE_VALUE = 'holdings'
const V2_SUPPORTED_CHAINS = [1, 10, 8453, 42161]
const V3_SUPPORTED_CHAINS = [1, 747474, 8453, 42161, 137]
const V3_PRIMARY_CHAIN_IDS = [1, 747474]
const V3_DEFAULT_SECONDARY_CHAIN_IDS = [8453, 42161, 137]
const V3_ASSET_CATEGORIES = [ALL_VAULTSV3_CATEGORIES.Stablecoin, ALL_VAULTSV3_CATEGORIES.Volatile]
const V2_ASSET_CATEGORIES = ['Stablecoin', 'Volatile']
const V2_KIND_OPTIONS = [
  { value: 'factory', label: 'Factory' },
  { value: 'legacy', label: 'Legacy' }
] as const
const PROTOCOL_OPTIONS = [
  'Curve',
  'Velodrome',
  'Aerodrome',
  'Balancer',
  'Fluid',
  'Morpho',
  'Aave',
  'Sky',
  'Silo',
  'Compound'
]
const AGGRESSIVENESS_OPTIONS = [-1, -2, -3]

function useVaultType(): TVaultType {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')
  return type === 'factory' ? 'factory' : 'v3'
}

const toggleString = (current: string[] | null, next: string): string[] => {
  const existing = current ?? []
  if (existing.includes(next)) {
    return existing.filter((value) => value !== next)
  }
  return [...existing, next]
}

const toggleNumber = (current: number[] | null, next: number): number[] => {
  const existing = current ?? []
  if (existing.includes(next)) {
    return existing.filter((value) => value !== next)
  }
  return [...existing, next]
}

type TListOfVaultsProps = {
  search: string | null | undefined
  types: string[] | null
  chains: number[] | null
  categories: string[] | null
  protocols: string[] | null
  aggressiveness: number[] | null
  showHiddenVaults: boolean
  showStrategies: boolean
  sortDirection: TSortDirection
  sortBy: TPossibleSortBy
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeProtocols: (value: string[] | null) => void
  onChangeAggressiveness: (value: number[] | null) => void
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
  protocols,
  aggressiveness,
  showHiddenVaults,
  showStrategies,
  sortDirection,
  sortBy,
  onSearch,
  onChangeTypes,
  onChangeCategories,
  onChangeProtocols,
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
    if (vaultType !== 'v3') {
      return []
    }
    const selected = (types || []).filter((type) => type === 'multi' || type === 'single')
    const hasSingle = selected.includes('single')
    if (showStrategies && hasSingle) {
      return ['single']
    }
    return ['multi']
  }, [types, vaultType, showStrategies])

  const allocatorTypesForTrending = useMemo(() => {
    return vaultType === 'v3' ? ['multi'] : null
  }, [vaultType])

  const sanitizedV2Types = useMemo(() => {
    if (vaultType !== 'factory') {
      return []
    }
    return (types || []).filter((type) => type === 'factory' || type === 'legacy')
  }, [types, vaultType])

  useEffect(() => {
    if (vaultType !== 'v3') {
      return
    }
    if (showStrategies) {
      return
    }
    if (types?.includes('single')) {
      onChangeTypes(['multi'])
    }
  }, [vaultType, showStrategies, types, onChangeTypes])

  const sanitizedCategories = useMemo(() => {
    const allowed = vaultType === 'v3' ? V3_ASSET_CATEGORIES : V2_ASSET_CATEGORIES
    return (categories || []).filter((value) => allowed.includes(value))
  }, [categories, vaultType])

  const sanitizedProtocols = useMemo(() => {
    return (protocols || []).filter((value) => PROTOCOL_OPTIONS.includes(value))
  }, [protocols])

  const sanitizedAggressiveness = useMemo(() => {
    return (aggressiveness || []).filter((value) => AGGRESSIVENESS_OPTIONS.includes(value))
  }, [aggressiveness])

  // Use the appropriate filter hook based on vault type
  const v3FilterResult = useV3VaultFilter(
    vaultType === 'v3' ? sanitizedV3Types : null,
    chains,
    search || '',
    vaultType === 'v3' ? sanitizedCategories : null,
    vaultType === 'v3' ? sanitizedProtocols : null,
    vaultType === 'v3' ? sanitizedAggressiveness : null,
    vaultType === 'v3' ? showHiddenVaults : undefined
  )
  const v2FilterResult = useV2VaultFilter(
    vaultType === 'factory' ? sanitizedV2Types : null,
    chains,
    search || '',
    vaultType === 'factory' ? sanitizedCategories : null,
    vaultType === 'factory' ? sanitizedProtocols : null
  )

  const {
    filteredVaults,
    holdingsVaults,
    availableVaults,
    vaultFlags,
    isLoading: isLoadingVaultList
  } = vaultType === 'v3' ? v3FilterResult : v2FilterResult

  const totalMatchingVaults = vaultType === 'v3' ? (v3FilterResult.totalMatchingVaults ?? 0) : 0
  const totalHoldingsMatching = vaultType === 'v3' ? (v3FilterResult.totalHoldingsMatching ?? 0) : 0

  const { filteredVaults: filteredVaultsAllChains } = useV3VaultFilter(
    allocatorTypesForTrending,
    null,
    '',
    vaultType === 'v3' ? sanitizedCategories : null,
    vaultType === 'v3' ? sanitizedProtocols : null,
    vaultType === 'v3' ? sanitizedAggressiveness : null,
    vaultType === 'v3' ? showHiddenVaults : undefined
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
  const sortedHoldingsVaults = useSortVaults(holdingsVaults, sortBy, sortDirection)
  const sortedAvailableVaults = useSortVaults(availableVaults, sortBy, sortDirection)
  const sortedSuggestedV3Candidates = useSortVaults(filteredVaultsAllChains, 'featuringScore', 'desc')
  const sortedSuggestedV2Candidates = useSortVaults(v2FilterResult.filteredVaultsNoSearch, 'featuringScore', 'desc')

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

  const holdingsKeySet = useMemo(
    () => new Set(holdingsVaults.map((vault) => `${vault.chainID}_${toAddress(vault.address)}`)),
    [holdingsVaults]
  )

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

  const v3FiltersCount = useMemo(() => {
    const typeCount = sanitizedV3Types.includes('single') ? 1 : 0
    const hiddenCount = showHiddenVaults ? 1 : 0
    const categoryCount = sanitizedCategories.length
    const protocolCount = sanitizedProtocols.length
    const aggressivenessCount = sanitizedAggressiveness.length
    return typeCount + categoryCount + protocolCount + aggressivenessCount + hiddenCount
  }, [sanitizedV3Types, sanitizedCategories, sanitizedProtocols, sanitizedAggressiveness, showHiddenVaults])

  const v2FiltersCount = useMemo(() => {
    return sanitizedV2Types.length + sanitizedCategories.length + sanitizedProtocols.length
  }, [sanitizedV2Types, sanitizedCategories, sanitizedProtocols])

  const apyDisplayVariant = vaultType === 'factory' ? 'factory-list' : 'default'

  const v3FiltersPanel = (
    <div className={'mt-4 grid grid-cols-1 gap-6 md:grid-cols-2'}>
      <div className={'flex flex-col gap-6'}>
        <div>
          <p className={'mb-2 text-sm text-text-secondary'}>{'Asset Category'}</p>
          <div className={'space-y-2'}>
            {V3_ASSET_CATEGORIES.map((value) => {
              const isChecked = sanitizedCategories.includes(value)
              return (
                <label
                  key={value}
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <span className={'text-sm font-medium text-text-primary'}>{value}</span>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isChecked}
                    onChange={(): void => onChangeCategories(toggleString(sanitizedCategories, value))}
                  />
                </label>
              )
            })}
          </div>
        </div>
      </div>
      <div className={'flex flex-col gap-6'}>
        <div>
          <p className={'mb-2 text-sm text-text-secondary'}>{'Protocol'}</p>
          <div className={'max-h-[260px] space-y-2 overflow-y-auto pr-1'}>
            {PROTOCOL_OPTIONS.map((protocol) => {
              const isChecked = sanitizedProtocols.includes(protocol)
              return (
                <label
                  key={protocol}
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <span className={'text-sm font-medium text-text-primary'}>{protocol}</span>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isChecked}
                    onChange={(): void => onChangeProtocols(toggleString(sanitizedProtocols, protocol))}
                  />
                </label>
              )
            })}
          </div>
        </div>
        <div>
          <p className={'mb-2 text-sm text-text-secondary'}>{'Aggressiveness'}</p>
          <div className={'space-y-2'}>
            {AGGRESSIVENESS_OPTIONS.map((value) => {
              const isChecked = sanitizedAggressiveness.includes(value)
              return (
                <label
                  key={value}
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <span className={'text-sm font-medium text-text-primary'}>{value}</span>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isChecked}
                    onChange={(): void => onChangeAggressiveness(toggleNumber(sanitizedAggressiveness, value))}
                  />
                </label>
              )
            })}
          </div>
        </div>
        <details className={'rounded-xl border border-border bg-surface-secondary p-4'}>
          <summary className={'cursor-pointer text-sm font-semibold text-text-primary'}>{'Advanced'}</summary>
          <div className={'mt-4 flex flex-col gap-6'}>
            <label
              className={
                'flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2'
              }
            >
              <div className={'min-w-0'}>
                <p className={'text-sm font-medium text-text-primary'}>{'Show strategies'}</p>
                <p className={'text-xs text-text-secondary'}>{'Enables the v3 Strategies tab.'}</p>
              </div>
              <input
                type={'checkbox'}
                className={'checkbox accent-blue-500'}
                checked={showStrategies}
                onChange={(event): void => onChangeShowStrategies(event.target.checked)}
              />
            </label>

            <label
              className={
                'flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2'
              }
            >
              <div className={'min-w-0'}>
                <p className={'text-sm font-medium text-text-primary'}>{'Show hidden vaults'}</p>
                <p className={'text-xs text-text-secondary'}>
                  {'Includes vaults without featured status and vaults marked hidden.'}
                </p>
              </div>
              <input
                type={'checkbox'}
                className={'checkbox accent-blue-500'}
                checked={showHiddenVaults}
                onChange={(event): void => onChangeShowHiddenVaults(event.target.checked)}
              />
            </label>
          </div>
        </details>
      </div>
    </div>
  )

  const v2FiltersPanel = (
    <div className={'mt-4 grid grid-cols-1 gap-6 md:grid-cols-2'}>
      <div className={'flex flex-col gap-6'}>
        <div>
          <p className={'mb-2 text-sm text-text-secondary'}>{'Asset Category'}</p>
          <div className={'space-y-2'}>
            {V2_ASSET_CATEGORIES.map((value) => {
              const isChecked = sanitizedCategories.includes(value)
              return (
                <label
                  key={value}
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <span className={'text-sm font-medium text-text-primary'}>{value}</span>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isChecked}
                    onChange={(): void => onChangeCategories(toggleString(sanitizedCategories, value))}
                  />
                </label>
              )
            })}
          </div>
        </div>
        <details className={'rounded-xl border border-border bg-surface-secondary p-4'}>
          <summary className={'cursor-pointer text-sm font-semibold text-text-primary'}>{'Advanced'}</summary>
          <div className={'mt-4'}>
            <p className={'mb-2 text-sm text-text-secondary'}>{'Vault Kind'}</p>
            <div className={'space-y-2'}>
              {V2_KIND_OPTIONS.map((option) => {
                const isChecked = sanitizedV2Types.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className={cl(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                      isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                    )}
                  >
                    <span className={'text-sm font-medium text-text-primary'}>{option.label}</span>
                    <input
                      type={'checkbox'}
                      className={'checkbox accent-blue-500'}
                      checked={isChecked}
                      onChange={(): void => onChangeTypes(toggleString(sanitizedV2Types, option.value))}
                    />
                  </label>
                )
              })}
            </div>
          </div>
        </details>
      </div>
      <div className={'flex flex-col gap-6'}>
        <div>
          <p className={'mb-2 text-sm text-text-secondary'}>{'Protocol'}</p>
          <div className={'max-h-[320px] space-y-2 overflow-y-auto pr-1'}>
            {PROTOCOL_OPTIONS.map((protocol) => {
              const isChecked = sanitizedProtocols.includes(protocol)
              return (
                <label
                  key={protocol}
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <span className={'text-sm font-medium text-text-primary'}>{protocol}</span>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isChecked}
                    onChange={(): void => onChangeProtocols(toggleString(sanitizedProtocols, protocol))}
                  />
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  const filtersPanelContent = vaultType === 'v3' ? v3FiltersPanel : v2FiltersPanel
  const filtersCount = vaultType === 'v3' ? v3FiltersCount : v2FiltersCount

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
    return {
      supportedChainIds: V2_SUPPORTED_CHAINS,
      primaryChainIds: V2_SUPPORTED_CHAINS,
      defaultSecondaryChainIds: [],
      chainDisplayOrder: V2_SUPPORTED_CHAINS,
      showMoreChainsButton: false,
      allChainsLabel: 'All'
    }
  }, [vaultType])

  function renderVaultList(): ReactNode {
    const defaultCategories = vaultType === 'v3' ? V3_ASSET_CATEGORIES : V2_ASSET_CATEGORIES

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
      <div className={'flex flex-col gap-px bg-app'}>
        {pinnedSections.map((section) => (
          <VaultsV3AuxiliaryList
            key={section.key}
            vaults={section.vaults}
            vaultFlags={vaultFlags}
            apyDisplayVariant={apyDisplayVariant}
          />
        ))}
        {mainVaults.length > 0 ? (
          <div className={'flex flex-col gap-px bg-app'}>
            {mainVaults.map((vault) => {
              const key = `${vault.chainID}_${toAddress(vault.address)}`
              return (
                <VaultsV3ListRow
                  key={key}
                  currentVault={vault}
                  flags={vaultFlags[key]}
                  apyDisplayVariant={apyDisplayVariant}
                />
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }

  const suggestedVaultsElement =
    vaultType === 'v3' ? (
      <TrendingVaults suggestedVaults={suggestedV3Vaults} />
    ) : (
      <TrendingVaults suggestedVaults={suggestedV2Vaults} />
    )

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
        leadingControls={<VaultVersionToggle showStrategies={showStrategies} />}
      />
    </div>
  )

  const listElement = (
    <div className={'w-full rounded-xl bg-surface'}>
      <div className={''}>
        <div
          className={'relative md:sticky md:z-30'}
          style={{ top: 'calc(var(--header-height) + var(--vaults-filters-height))' }}
        >
          <div
            aria-hidden={true}
            className={'pointer-events-none absolute inset-0 z-0 bg-app border-2'}
            style={{ borderColor: 'var(--color-app)' }}
          />
          <VaultsV3ListHead
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
                className: 'col-span-10'
              },
              {
                type: 'sort',
                label: 'Est. APY',
                value: 'estAPY',
                sortable: true,
                className: 'col-span-3'
              },
              {
                type: 'sort',
                label: '30D APY',
                value: 'APY',
                sortable: true,
                className: 'col-span-3'
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
  protocols: string[] | null
  aggressiveness: number[] | null
  showHiddenVaults: boolean
  showStrategies: boolean
  onChangeProtocols: (value: string[] | null) => void
  onChangeAggressiveness: (value: number[] | null) => void
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

  const readNumberList = (key: string): number[] => {
    return readStringList(key)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  }

  const protocols = readStringList('protocol')
  const aggressiveness = readNumberList('aggr')
  const showHiddenVaults = (() => {
    const raw = searchParams.get('showHidden')
    return raw === '1' || raw === 'true'
  })()
  const showStrategies = (() => {
    const raw = searchParams.get('showStrategies')
    return raw === '1' || raw === 'true'
  })()

  const updateParam = (key: string, value: string[] | number[] | null): void => {
    const nextParams = new URLSearchParams(searchParams)
    if (!value || value.length === 0) {
      nextParams.delete(key)
    } else {
      nextParams.set(key, value.join('_'))
    }
    setSearchParams(nextParams, { replace: true })
  }

  return {
    protocols,
    aggressiveness,
    showHiddenVaults,
    showStrategies,
    onChangeProtocols: (value): void => {
      updateParam('protocol', value)
    },
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
      nextParams.delete('protocol')
      nextParams.delete('aggr')
      nextParams.delete('showHidden')
      nextParams.delete('showStrategies')
      setSearchParams(nextParams, { replace: true })
    }
  }
}

function VaultsIndexContent({ vaultType }: { vaultType: TVaultType }): ReactElement {
  const {
    protocols,
    aggressiveness,
    showHiddenVaults,
    showStrategies,
    onChangeProtocols,
    onChangeAggressiveness,
    onChangeShowHiddenVaults,
    onChangeShowStrategies,
    onResetExtraFilters
  } = useVaultListExtraFilters()

  const queryArgs = useQueryArguments({
    defaultTypes: vaultType === 'v3' ? ['multi'] : [],
    defaultCategories: [],
    defaultPathname: '/vaults',
    defaultSortBy: 'featuringScore',
    resetTypes: vaultType === 'v3' ? ['multi'] : [],
    resetCategories: []
  })

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4 pb-4'}>
        <ListOfVaults
          {...queryArgs}
          protocols={protocols}
          aggressiveness={aggressiveness}
          showHiddenVaults={showHiddenVaults}
          showStrategies={showStrategies}
          onChangeProtocols={onChangeProtocols}
          onChangeAggressiveness={onChangeAggressiveness}
          onChangeShowHiddenVaults={onChangeShowHiddenVaults}
          onChangeShowStrategies={onChangeShowStrategies}
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
