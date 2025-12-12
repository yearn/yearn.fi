import Link from '@components/Link'
import { Button } from '@lib/components/Button'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import type { TSortDirection } from '@lib/types'
import { toAddress } from '@lib/utils'
import { VaultsListEmpty } from '@vaults-v2/components/list/VaultsListEmpty'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-v2/hooks/useVaultsQueryArgs'
import { Filters } from '@vaults-v3/components/Filters'
import { VaultsV3AuxiliaryList } from '@vaults-v3/components/list/VaultsV3AuxiliaryList'
import { VaultsV3ListHead } from '@vaults-v3/components/list/VaultsV3ListHead'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'
import { TrendingVaults } from '@vaults-v3/components/TrendingVaults'
import {
  ALL_VAULTSV3_CATEGORIES,
  ALL_VAULTSV3_KINDS_KEYS,
  DEFAULT_SELECTED_VAULTSV3_CATEGORIES
} from '@vaults-v3/constants'
// import { V3Mask } from '@vaults-v3/Mark'
import type { ReactElement, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

// function V3Card(): ReactElement {
//   return (
//     <div
//       className={cl(
//         'flex h-full w-full flex-col items-center justify-center',
//         'gap-y-0 rounded-2xl bg-neutral-200 p-4 md:gap-y-6'
//       )}
//     >
//       <V3Mask className={'size-34'} />
//     </div>
//   )
// }

type TListOfVaultsProps = {
  search: string | null | undefined
  types: string[] | null
  chains: number[] | null
  categories: string[] | null
  sortDirection: TSortDirection
  sortBy: TPossibleSortBy
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeChains: (value: number[] | null) => void
  onChangeSortDirection: (value: TSortDirection | '') => void
  onChangeSortBy: (value: TPossibleSortBy | '') => void
  onResetMultiSelect: () => void
  children?: (renderProps: { filters: ReactNode; list: ReactNode }) => ReactNode
}

const AVAILABLE_TOGGLE_VALUE = 'available'
const HOLDINGS_TOGGLE_VALUE = 'holdings'

function ListOfVaults({
  search,
  types,
  chains,
  categories,
  sortDirection,
  sortBy,
  onSearch,
  onChangeTypes,
  onChangeCategories,
  onChangeChains,
  onChangeSortDirection,
  onChangeSortBy,
  onResetMultiSelect,
  children
}: TListOfVaultsProps): ReactElement {
  const {
    filteredVaults,
    holdingsVaults,
    availableVaults,
    vaultFlags,
    totalMatchingVaults,
    totalHoldingsMatching,
    totalMigratableMatching,
    totalRetiredMatching,
    isLoading: isLoadingVaultList
  } = useV3VaultFilter(types, chains, search || '', categories)
  const { filteredVaults: filteredVaultsAllChains } = useV3VaultFilter(types, null, search || '', categories)

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
  const sortedSuggestedCandidates = useSortVaults(filteredVaultsAllChains, 'featuringScore', 'desc')

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

  const displayedVaults = useMemo(() => [...pinnedVaults, ...mainVaults], [pinnedVaults, mainVaults])

  const holdingsKeySet = useMemo(
    () => new Set(holdingsVaults.map((vault) => `${vault.chainID}_${toAddress(vault.address)}`)),
    [holdingsVaults]
  )

  const suggestedVaults = useMemo(
    () =>
      sortedSuggestedCandidates
        .filter((vault) => !holdingsKeySet.has(`${vault.chainID}_${toAddress(vault.address)}`))
        .slice(0, 8),
    [sortedSuggestedCandidates, holdingsKeySet]
  )

  const visibleFlagCounts = displayedVaults.reduce(
    (counts, vault) => {
      const key = `${vault.chainID}_${toAddress(vault.address)}`
      const flags = vaultFlags[key]

      if (flags?.hasHoldings) {
        counts.holdings += 1
      }
      if (flags?.isMigratable) {
        counts.migratable += 1
      }
      if (flags?.isRetired) {
        counts.retired += 1
      }

      return counts
    },
    { holdings: 0, migratable: 0, retired: 0 }
  )

  const hiddenHoldingsCount = Math.max(totalHoldingsMatching - visibleFlagCounts.holdings, 0)
  const hiddenMigratableCount = Math.max(totalMigratableMatching - visibleFlagCounts.migratable, 0)
  const hiddenRetiredCount = Math.max(totalRetiredMatching - visibleFlagCounts.retired, 0)

  const hiddenByFiltersCount = Math.max(totalMatchingVaults - sortedVaults.length, 0)
  const hasHiddenResults = hiddenByFiltersCount > 0
  const hasHiddenFlagged = hiddenHoldingsCount > 0 || hiddenMigratableCount > 0 || hiddenRetiredCount > 0

  const renderHiddenBadge = (): ReactNode => {
    if (!hasHiddenResults) return null

    return (
      <div className={'flex items-center gap-2 rounded-lg px-3 py-1 text-xs text-text-secondary'}>
        <span>
          {hiddenByFiltersCount} {`vault${hiddenByFiltersCount > 1 ? 's' : ''} hidden by filters`}
        </span>
        <Button
          onClick={onResetMultiSelect}
          className={
            'h-6 rounded-md bg-text-primary px-3 py-1 text-xs text-surface transition-opacity hover:opacity-90'
          }
        >
          {'Show all'}
        </Button>
      </div>
    )
  }

  const renderHiddenSearchAlert = (): ReactNode => {
    if (!hasHiddenResults && !hasHiddenFlagged) {
      return null
    }

    return (
      <div className={'flex flex-wrap items-center gap-2 text-xs text-text-secondary'}>
        {renderHiddenBadge()}
        {hiddenHoldingsCount > 0 ? (
          <span>
            {hiddenHoldingsCount} {`holding${hiddenHoldingsCount > 1 ? 's' : ''} hidden by filters`}
          </span>
        ) : null}
        {hiddenMigratableCount > 0 ? (
          <span>
            {hiddenMigratableCount} {`migratable vault${hiddenMigratableCount > 1 ? 's are' : ' is'} hidden`}
          </span>
        ) : null}
        {hiddenRetiredCount > 0 ? (
          <span>
            {hiddenRetiredCount} {`retired vault${hiddenRetiredCount > 1 ? 's are' : ' is'} hidden`}
          </span>
        ) : null}
      </div>
    )
  }

  function renderVaultList(): ReactNode {
    if (isLoadingVaultList) {
      return (
        <VaultsListEmpty
          isLoading={isLoadingVaultList}
          currentSearch={search || ''}
          currentCategories={categories}
          currentChains={chains}
          onReset={onResetMultiSelect}
          defaultCategories={Object.values(ALL_VAULTSV3_CATEGORIES)}
          potentialResultsCount={totalMatchingVaults}
        />
      )
    }

    if (pinnedVaults.length === 0 && mainVaults.length === 0) {
      return (
        <VaultsListEmpty
          isLoading={false}
          currentSearch={search || ''}
          currentCategories={categories}
          currentChains={chains}
          onReset={onResetMultiSelect}
          defaultCategories={Object.values(ALL_VAULTSV3_CATEGORIES)}
          potentialResultsCount={totalMatchingVaults}
        />
      )
    }

    const hasRows = pinnedSections.length > 0 || mainVaults.length > 0

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
        {hasRows ? (
          <div className={'shrink-0 border-t border-border bg-surface px-4 py-3 md:px-8 rounded-b-xl'} />
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
      <span className={'font-medium text-text-primary'}>{'Vaults'}</span>
    </div>
  )

  const filtersElement = (
    <div className={'w-full bg-app pb-2 shrink-0'}>
      {/* TODO: Deprecate when decide on Header display */}
      {breadcrumbsElement}
      {suggestedVaultsElement}
      <Filters
        types={types}
        shouldDebounce={true}
        categories={categories}
        searchValue={search || ''}
        chains={chains}
        onChangeChains={onChangeChains}
        onChangeTypes={onChangeTypes}
        onChangeCategories={onChangeCategories}
        onSearch={onSearch}
        searchAlertContent={renderHiddenSearchAlert()}
        holdingsVaults={holdingsVaults}
      />
    </div>
  )

  const listElement = (
    <div className={'flex w-full flex-1 flex-col'} style={{ minHeight: 0 }}>
      <div className={'flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface'}>
        <VaultsV3ListHead
          containerClassName={'rounded-t-xl bg-surface shrink-0'}
          wrapperClassName={'sticky top-0 z-10 mt-0 bg-surface'}
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
              className: 'col-span-9'
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
              label: 'Hist. APY',
              value: 'APY',
              sortable: true,
              className: 'col-span-3'
            },
            {
              type: 'sort',
              label: 'Risk Level',
              value: 'score',
              sortable: true,
              className: 'col-span-3 whitespace-nowrap'
            },
            // {
            //   type: 'toggle',
            //   label: 'Available',
            //   value: AVAILABLE_TOGGLE_VALUE,
            //   className: 'col-span-2',
            //   disabled: availableVaults.length === 0
            // },
            {
              type: 'toggle',
              label: 'Holdings',
              value: HOLDINGS_TOGGLE_VALUE,
              className: 'col-span-3',
              disabled: holdingsVaults.length === 0
            },
            {
              type: 'sort',
              label: 'TVL',
              value: 'tvl',
              sortable: true,
              className: 'col-span-3 justify-end'
            }
          ]}
        />
        <div className={'flex flex-1 flex-col overflow-auto'}>{renderVaultList()}</div>
      </div>
    </div>
  )

  if (typeof children === 'function') {
    const content = children({ filters: filtersElement, list: listElement })
    return <div className={'flex h-full flex-col'}>{content}</div>
  }

  return <div className={'flex h-full flex-col'}>{[filtersElement, listElement]}</div>
}

function Index(): ReactElement {
  const queryArgs = useQueryArguments({
    defaultTypes: [ALL_VAULTSV3_KINDS_KEYS[0]],
    defaultCategories: DEFAULT_SELECTED_VAULTSV3_CATEGORIES,
    defaultPathname: '/v3',
    defaultSortBy: 'featuringScore'
  })

  return (
    <div className={'h-[calc(100vh-var(--header-height))] w-full overflow-hidden bg-app max-w-[1232px] mx-auto'}>
      <div
        className={'relative z-50 flex w-full flex-col gap-4 bg-transparent md:gap-3 pb-4 px-4'}
        style={{
          height: 'calc(100vh - var(--header-height))'
        }}
      >
        <ListOfVaults {...queryArgs}>
          {({ filters, list }) => (
            <div className={'flex h-full flex-col'}>
              {filters}
              {list}
            </div>
          )}
        </ListOfVaults>
      </div>
    </div>
  )
}

export default Index
