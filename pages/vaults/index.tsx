import Link from '@components/Link'
import { useV2VaultFilter } from '@lib/hooks/useV2VaultFilter'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import type { TSortDirection } from '@lib/types'
import { toAddress } from '@lib/utils'
import { VaultsListEmpty } from '@vaults-shared/components/list/VaultsListEmpty'
import type { TPossibleSortBy } from '@vaults-shared/hooks/useSortVaults'
import { useSortVaults } from '@vaults-shared/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-shared/hooks/useVaultsQueryArgs'
import { FiltersV2 } from '@vaults-v2/components/FiltersV2'
import { Filters } from '@vaults-v3/components/Filters'
import { VaultsV3AuxiliaryList } from '@vaults-v3/components/list/VaultsV3AuxiliaryList'
import { VaultsV3ListHead } from '@vaults-v3/components/list/VaultsV3ListHead'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'
import { TrendingVaults } from '@vaults-v3/components/TrendingVaults'
import { ALL_VAULTSV3_CATEGORIES } from '@vaults-v3/constants'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

const AVAILABLE_TOGGLE_VALUE = 'available'
const HOLDINGS_TOGGLE_VALUE = 'holdings'

type TVaultType = 'factory' | 'v3'

function useVaultType(): TVaultType {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')
  return type === 'factory' ? 'factory' : 'v3'
}

type TListOfVaultsProps = {
  search: string | null | undefined
  types: string[] | null
  chains: number[] | null
  categories: string[] | null
  protocols: string[] | null
  aggressiveness: number[] | null
  showHiddenYearnVaults: boolean
  sortDirection: TSortDirection
  sortBy: TPossibleSortBy
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeChains: (value: number[] | null) => void
  onChangeProtocols: (value: string[] | null) => void
  onChangeAggressiveness: (value: number[] | null) => void
  onChangeShowHiddenYearnVaults: (value: boolean) => void
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
  showHiddenYearnVaults,
  sortDirection,
  sortBy,
  onSearch,
  onChangeTypes,
  onChangeCategories,
  onChangeChains,
  onChangeProtocols,
  onChangeAggressiveness,
  onChangeShowHiddenYearnVaults,
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

  // Use the appropriate filter hook based on vault type
  const sanitizedTypes = useMemo(() => {
    const selected = types ?? []
    const allowed = vaultType === 'v3' ? new Set(['multi', 'single']) : new Set(['factory', 'legacy'])
    const result = selected.filter((value) => allowed.has(value))
    if (vaultType === 'v3' && result.length === 0) {
      return ['multi']
    }
    return result
  }, [types, vaultType])

  const sanitizedCategories = useMemo(() => {
    const selected = categories ?? []
    if (vaultType === 'v3') {
      return selected.filter(
        (value) => value === ALL_VAULTSV3_CATEGORIES.Stablecoin || value === ALL_VAULTSV3_CATEGORIES.Volatile
      )
    }
    const allowed = new Set(['Stablecoin', 'Volatile'])
    return selected.filter((value) => allowed.has(value))
  }, [categories, vaultType])

  const v3FilterResult = useV3VaultFilter(
    vaultType === 'v3' ? sanitizedTypes : null,
    chains,
    search || '',
    vaultType === 'v3' ? sanitizedCategories : null,
    vaultType === 'v3' ? protocols : null,
    vaultType === 'v3' ? aggressiveness : null,
    vaultType === 'v3' ? showHiddenYearnVaults : undefined
  )
  const v2FilterResult = useV2VaultFilter(
    vaultType === 'factory' ? sanitizedTypes : null,
    chains,
    search || '',
    vaultType === 'factory' ? sanitizedCategories : null,
    vaultType === 'factory' ? protocols : null
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
    vaultType === 'v3' ? sanitizedTypes : null,
    null,
    '',
    vaultType === 'v3' ? sanitizedCategories : null,
    vaultType === 'v3' ? protocols : null,
    vaultType === 'v3' ? aggressiveness : null,
    vaultType === 'v3' ? showHiddenYearnVaults : undefined
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

  function renderVaultList(): ReactNode {
    const defaultCategories =
      vaultType === 'v3'
        ? [ALL_VAULTSV3_CATEGORIES.Stablecoin, ALL_VAULTSV3_CATEGORIES.Volatile]
        : ['Stablecoin', 'Volatile']

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
          <VaultsV3AuxiliaryList key={section.key} vaults={section.vaults} vaultFlags={vaultFlags} />
        ))}
        {mainVaults.length > 0 ? (
          <div className={'flex flex-col gap-px bg-app'}>
            {mainVaults.map((vault) => {
              const key = `${vault.chainID}_${toAddress(vault.address)}`
              return <VaultsV3ListRow key={key} currentVault={vault} flags={vaultFlags[key]} />
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
      <span className={'font-medium text-text-primary'}>{vaultType === 'v3' ? 'V3' : 'Factory'}</span>
    </div>
  )

  const filtersElement = (
    <div ref={filtersRef} className={'sticky z-40 w-full bg-app pb-2 shrink-0'} style={{ top: 'var(--header-height)' }}>
      {breadcrumbsElement}
      {suggestedVaultsElement}
      {vaultType === 'v3' ? (
        <Filters
          types={sanitizedTypes}
          shouldDebounce={true}
          categories={sanitizedCategories}
          protocols={protocols}
          aggressiveness={aggressiveness}
          showHiddenYearnVaults={showHiddenYearnVaults}
          searchValue={search || ''}
          chains={chains}
          onChangeChains={onChangeChains}
          onChangeTypes={onChangeTypes}
          onChangeCategories={onChangeCategories}
          onChangeProtocols={onChangeProtocols}
          onChangeAggressiveness={onChangeAggressiveness}
          onChangeShowHiddenYearnVaults={onChangeShowHiddenYearnVaults}
          onSearch={onSearch}
          holdingsVaults={holdingsVaults}
        />
      ) : (
        <FiltersV2
          shouldDebounce={true}
          types={sanitizedTypes}
          categories={sanitizedCategories}
          protocols={protocols}
          searchValue={search || ''}
          chains={chains}
          onChangeChains={onChangeChains}
          onSearch={onSearch}
          onChangeTypes={onChangeTypes}
          onChangeCategories={onChangeCategories}
          onChangeProtocols={onChangeProtocols}
          holdingsVaults={holdingsVaults}
        />
      )}
    </div>
  )

  const listElement = (
    <div className={'w-full rounded-xl bg-surface'}>
      <div className={''}>
        <div
          className={'relative md:sticky md:z-30'}
          style={{ top: 'calc(var(--header-height) + var(--vaults-filters-height) + 8px)' }}
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
        <div
          className={
            'flex flex-col border-x border-b border-border rounded-b-xl overflow-hidden hover:overflow-visible focus-within:overflow-visible'
          }
        >
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
  showHiddenYearnVaults: boolean
  onChangeProtocols: (value: string[] | null) => void
  onChangeAggressiveness: (value: number[] | null) => void
  onChangeShowHiddenYearnVaults: (value: boolean) => void
  onResetExtraFilters: () => void
} {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

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

  const [protocols, setProtocols] = useState<string[] | null>(() => readStringList('protocol'))
  const [aggressiveness, setAggressiveness] = useState<number[] | null>(() => readNumberList('aggr'))
  const [showHiddenYearnVaults, setShowHiddenYearnVaults] = useState<boolean>(() => {
    const raw = searchParams.get('showHidden')
    return raw === '1' || raw === 'true'
  })

  const updateParam = (key: string, value: string[] | number[] | null): void => {
    const nextParams = new URLSearchParams(window.location.search)
    if (!value || value.length === 0) {
      nextParams.delete(key)
    } else {
      nextParams.set(key, value.join('_'))
    }
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true })
  }

  return {
    protocols,
    aggressiveness,
    showHiddenYearnVaults,
    onChangeProtocols: (value): void => {
      setProtocols(value)
      updateParam('protocol', value)
    },
    onChangeAggressiveness: (value): void => {
      setAggressiveness(value)
      updateParam('aggr', value)
    },
    onChangeShowHiddenYearnVaults: (value): void => {
      setShowHiddenYearnVaults(value)
      const nextParams = new URLSearchParams(window.location.search)
      if (value) {
        nextParams.set('showHidden', '1')
      } else {
        nextParams.delete('showHidden')
      }
      navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true })
    },
    onResetExtraFilters: (): void => {
      setProtocols([])
      setAggressiveness([])
      setShowHiddenYearnVaults(false)
      const nextParams = new URLSearchParams(window.location.search)
      nextParams.delete('protocol')
      nextParams.delete('aggr')
      nextParams.delete('showHidden')
      navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true })
    }
  }
}

function VaultsIndexContent({ vaultType }: { vaultType: TVaultType }): ReactElement {
  const {
    protocols,
    aggressiveness,
    showHiddenYearnVaults,
    onChangeProtocols,
    onChangeAggressiveness,
    onChangeShowHiddenYearnVaults,
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
          showHiddenYearnVaults={showHiddenYearnVaults}
          onChangeProtocols={onChangeProtocols}
          onChangeAggressiveness={onChangeAggressiveness}
          onChangeShowHiddenYearnVaults={onChangeShowHiddenYearnVaults}
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
