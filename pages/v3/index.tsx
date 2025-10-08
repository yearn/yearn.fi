import { Button } from '@lib/components/Button'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import type { TSortDirection } from '@lib/types'
import { cl, toAddress } from '@lib/utils'
import { VaultsListEmpty } from '@vaults-v2/components/list/VaultsListEmpty'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-v2/hooks/useVaultsQueryArgs'
import { Filters } from '@vaults-v3/components/Filters'
import { VaultsV3ListHead } from '@vaults-v3/components/list/VaultsV3ListHead'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'
import {
  ALL_VAULTSV3_CATEGORIES,
  ALL_VAULTSV3_KINDS_KEYS,
  DEFAULT_SELECTED_VAULTSV3_CATEGORIES
} from '@vaults-v3/constants'
import { V3Mask } from '@vaults-v3/Mark'
import type { ReactElement, ReactNode } from 'react'
import { Fragment } from 'react'

function V3Card(): ReactElement {
  return (
    <div className={'col-span-12 hidden w-full rounded-3xl bg-neutral-100 p-2 md:col-span-3 md:block'}>
      <div
        className={cl(
          'flex h-full w-full flex-col items-center justify-center',
          'gap-y-0 rounded-2xl bg-neutral-200 p-2 md:gap-y-6'
        )}
      >
        <V3Mask className={'size-[90%]'} />
      </div>
    </div>
  )
}

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
}

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
  onResetMultiSelect
}: TListOfVaultsProps): ReactElement {
  const {
    filteredVaults,
    vaultFlags,
    totalMatchingVaults,
    totalHoldingsMatching,
    totalMigratableMatching,
    totalRetiredMatching,
    isLoading: isLoadingVaultList
  } = useV3VaultFilter(types, chains, search || '', categories)

  const sortedVaults = useSortVaults(filteredVaults, sortBy, sortDirection)

  const visibleFlagCounts = sortedVaults.reduce(
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
      <div className={'flex items-center gap-2 rounded-lg px-3 py-1 text-xs text-neutral-700'}>
        <span>
          {hiddenByFiltersCount} {`vault${hiddenByFiltersCount > 1 ? 's' : ''} hidden by filters`}
        </span>
        <Button
          onClick={onResetMultiSelect}
          className={'yearn--button-smaller h-6 rounded-md px-3 py-1 text-xs text-white hover:bg-neutral-800'}
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
      <div className={'flex flex-wrap items-center gap-2 text-xs text-neutral-600'}>
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
    if (isLoadingVaultList || sortedVaults.length === 0) {
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

    return sortedVaults.map((vault) => {
      const key = `${vault.chainID}_${toAddress(vault.address)}`
      return <VaultsV3ListRow key={key} currentVault={vault} flags={vaultFlags[key]} />
    })
  }

  return (
    <Fragment>
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
      />
      <div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
        <VaultsV3ListHead
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
            if (newSortDirection === '') {
              onChangeSortBy('featuringScore')
              onChangeSortDirection('')
              return
            }
            onChangeSortBy(newSortBy as TPossibleSortBy)
            onChangeSortDirection(newSortDirection as TSortDirection)
          }}
          items={[
            {
              label: 'Vault / Featuring Score',
              value: 'featuringScore',
              sortable: true,
              className: 'col-span-4'
            },
            {
              label: 'Est. APY',
              value: 'estAPY',
              sortable: true,
              className: 'col-span-2'
            },
            {
              label: 'Hist. APY',
              value: 'APY',
              sortable: true,
              className: 'col-span-2'
            },
            {
              label: 'Risk Level',
              value: 'score',
              sortable: true,
              className: 'col-span-2 whitespace-nowrap'
            },
            {
              label: 'Available',
              value: 'available',
              sortable: true,
              className: 'col-span-2'
            },
            {
              label: 'Holdings',
              value: 'deposited',
              sortable: true,
              className: 'col-span-2'
            },
            {
              label: 'Deposits',
              value: 'tvl',
              sortable: true,
              className: 'col-span-2 justify-end'
            }
          ]}
        />
        <div className={'grid gap-3'}>{renderVaultList()}</div>
      </div>
    </Fragment>
  )
}

function Index(): ReactElement {
  const queryArgs = useQueryArguments({
    defaultTypes: [ALL_VAULTSV3_KINDS_KEYS[0]],
    defaultCategories: DEFAULT_SELECTED_VAULTSV3_CATEGORIES,
    defaultPathname: '/v3',
    defaultSortBy: 'featuringScore'
  })

  return (
    <div
      className={
        'relative z-50 mx-auto grid w-full max-w-[1232px] grid-cols-12 gap-4 bg-neutral-0 px-4 pb-8 pt-20 md:gap-2'
      }
    >
      <V3Card />
      <ListOfVaults {...queryArgs} />
    </div>
  )
}

export default Index
