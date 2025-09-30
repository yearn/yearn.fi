import { Button } from '@lib/components/Button'
import { Counter } from '@lib/components/Counter'
import { ListHead } from '@lib/components/ListHead'
import { Pagination } from '@lib/components/Pagination'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { useChainOptions } from '@lib/hooks/useChains'
import { useVaultFilter } from '@lib/hooks/useFilteredVaults'
import { useSupportedChains } from '@lib/hooks/useSupportedChains'
import { IconChain } from '@lib/icons/IconChain'
import type { TSortDirection } from '@lib/types'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { ListHero } from '@vaults-v2/components/ListHero'
import { VaultListOptions } from '@vaults-v2/components/list/VaultListOptions'
import { VaultsListEmpty } from '@vaults-v2/components/list/VaultsListEmpty'
import { VaultsListRow } from '@vaults-v2/components/list/VaultsListRow'
import {
  ALL_VAULTS_CATEGORIES,
  ALL_VAULTS_CATEGORIES_KEYS,
} from '@vaults-v2/constants'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-v2/hooks/useVaultsQueryArgs'
import type { ReactElement, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

function HeaderUserPosition(): ReactElement {
  const { cumulatedValueInV2Vaults } = useWallet()
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()

  if (!isActive) {
    return (
      <div className={'col-span-12 h-auto w-full md:col-span-8 md:h-[136px]'}>
        <p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>
          {'Wallet not connected'}
        </p>
        <Button
          onClick={(): void => {
            if (!isActive && address) {
              onSwitchChain(1)
            } else {
              openLoginModal()
            }
          }}
        >
          {'Connect Wallet'}
        </Button>
      </div>
    )
  }
  return (
    <div className={'col-span-12 w-full md:col-span-8'}>
      <p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>
        {'Deposited'}
      </p>
      <b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
        {'$'}
        <Counter value={Number(cumulatedValueInV2Vaults)} decimals={2} />
      </b>
    </div>
  )
}

function ListOfVaults(): ReactElement {
  const { isLoadingVaultList } = useYearn()
  const allChainsSupported = useSupportedChains().map((chain) => chain.id)
  const {
    search,
    types,
    chains,
    sortDirection,
    sortBy,
    onSearch,
    onChangeTypes,
    onChangeChains,
    onChangeSortDirection,
    onChangeSortBy,
    onReset,
  } = useQueryArguments({
    defaultTypes: ALL_VAULTS_CATEGORIES_KEYS,
    defaultPathname: '/vaults',
  })
  const { activeVaults, migratableVaults, retiredVaults, holdingsVaults } =
    useVaultFilter(types, chains, false, search || '')
  const {
    holdingsVaults: allHoldingsVaults,
    migratableVaults: allMigratableHoldings,
    retiredVaults: allRetiredHoldings,
  } = useVaultFilter(
    ALL_VAULTS_CATEGORIES_KEYS,
    allChainsSupported,
    false,
    '',
    ALL_VAULTS_CATEGORIES_KEYS
  )
  const [page, setPage] = useState(0)
  const [showHiddenHoldings, setShowHiddenHoldings] = useState(false)
  const chainOptions = useChainOptions(chains)

  /**********************************************************************************************
   **	Apply sorting to the filtered active vaults
   *********************************************************************************************/
  const sortedVaultsToDisplay = useSortVaults(
    [...activeVaults],
    sortBy,
    sortDirection
  )

  /**********************************************************************************************
   **	Prepare vault lists for rendering. All filtering is now done in useVaultFilter.
   *********************************************************************************************/
  const vaultLists = useMemo((): {
    holdings: TYDaemonVault[]
    all: TYDaemonVault[]
  } | null => {
    // Combine holdings from various sources (all already filtered)
    const combinedHoldings = new Map<string, TYDaemonVault>()

    // Add from holdingsVaults
    for (const vault of holdingsVaults) {
      combinedHoldings.set(`${vault.chainID}_${vault.address}`, vault)
    }

    // Add migratable vaults
    for (const vault of migratableVaults) {
      combinedHoldings.set(`${vault.chainID}_${vault.address}`, vault)
    }

    // Add retired vaults
    for (const vault of retiredVaults) {
      combinedHoldings.set(`${vault.chainID}_${vault.address}`, vault)
    }

    const holdingsArray = Array.from(combinedHoldings.values())

    // Get non-holdings vaults from sorted display
    const holdingsSet = new Set(combinedHoldings.keys())
    const nonHoldingsVaults = sortedVaultsToDisplay.filter(
      (vault) => !holdingsSet.has(`${vault.chainID}_${vault.address}`)
    )

    const shouldShowEmptyState =
      isLoadingVaultList ||
      !chains ||
      chains.length === 0 ||
      (holdingsArray.length === 0 && nonHoldingsVaults.length === 0)

    if (shouldShowEmptyState) {
      return null
    }

    return {
      holdings: holdingsArray,
      all: nonHoldingsVaults,
    }
  }, [
    sortedVaultsToDisplay,
    isLoadingVaultList,
    chains,
    migratableVaults,
    retiredVaults,
    holdingsVaults,
  ])

  const { holdings, all } = vaultLists || { holdings: [], all: [] }
  const holdingsFilterSelected = Boolean(types?.includes('holdings'))
  const shouldShowHoldings = holdingsFilterSelected && holdings.length > 0

  const sortedHoldings = useSortVaults(holdings, sortBy, sortDirection)
  const sortedNonHoldings = useSortVaults(all, sortBy, sortDirection)

  const hiddenHoldingsVaultsList = useMemo((): TYDaemonVault[] => {
    if (!holdingsFilterSelected) {
      return []
    }

    const visibleKeys = new Set(
      holdings.map((vault) => `${vault.chainID}_${vault.address}`)
    )
    const combined = new Map<string, TYDaemonVault>()

    for (const vault of allHoldingsVaults) {
      combined.set(`${vault.chainID}_${vault.address}`, vault)
    }
    for (const vault of allMigratableHoldings) {
      combined.set(`${vault.chainID}_${vault.address}`, vault)
    }
    for (const vault of allRetiredHoldings) {
      combined.set(`${vault.chainID}_${vault.address}`, vault)
    }

    return Array.from(combined.entries())
      .filter(([key]) => !visibleKeys.has(key))
      .map(([, vault]) => vault)
  }, [
    holdingsFilterSelected,
    holdings,
    allHoldingsVaults,
    allMigratableHoldings,
    allRetiredHoldings,
  ])

  const hiddenHoldingsCount = hiddenHoldingsVaultsList.length
  const hasHiddenHoldings = holdingsFilterSelected && hiddenHoldingsCount > 0

  const filtersSignature = useMemo(() => {
    return [
      search ?? '',
      (types || []).join('_'),
      (chains || []).join('_'),
    ].join('|')
  }, [search, types, chains])
  const lastFiltersSignature = useRef(filtersSignature)

  useEffect(() => {
    if (lastFiltersSignature.current !== filtersSignature) {
      lastFiltersSignature.current = filtersSignature
      setShowHiddenHoldings(false)
    }
  }, [filtersSignature])

  useEffect(() => {
    if (!hasHiddenHoldings) {
      setShowHiddenHoldings(false)
    }
  }, [hasHiddenHoldings])

  const renderHoldingsCard = (): ReactNode => {
    if (!shouldShowHoldings && !hasHiddenHoldings) {
      return null
    }

    const shouldShowToggle =
      hasHiddenHoldings && hiddenHoldingsVaultsList.length > 0

    return (
      <div className={'mb-2 rounded-2xl shadow-sm'}>
        <div className={'flex flex-wrap items-center justify-between gap-3'}>
          <div className={'flex items-center gap-2 px-6 pt-4'}>
            <p className={'text-sm font-semibold text-neutral-900 '}>
              {'Your holdings'}
            </p>
            {shouldShowHoldings ? (
              <span className={'text-xs text-neutral-500'}>
                {sortedHoldings.length} vault
                {sortedHoldings.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          {shouldShowToggle ? (
            <div className={'flex items-center gap-2 text-xs text-neutral-600'}>
              <span>{hiddenHoldingsCount} hidden by filters</span>
              <Button
                onClick={(): void => setShowHiddenHoldings((prev) => !prev)}
                className={
                  'yearn--button-smaller rounded-md bg-neutral-900 px-3 py-1 text-xs text-white hover:bg-neutral-800'
                }
              >
                {showHiddenHoldings ? 'Hide' : 'Show'}
              </Button>
              <Button
                onClick={onReset}
                className={
                  'yearn--button-smaller rounded-md border border-neutral-200 px-3 py-1 text-xs text-neutral-900'
                }
              >
                Reset filters
              </Button>
            </div>
          ) : null}
        </div>
        {shouldShowHoldings ? (
          <div className={'mt-3 grid gap-0'}>
            {sortedHoldings.map((vault) => (
              <VaultsListRow
                key={`${vault.chainID}_${vault.address}`}
                currentVault={vault}
              />
            ))}
          </div>
        ) : null}
        {showHiddenHoldings && hiddenHoldingsVaultsList.length > 0 ? (
          <div className={'mt-4 grid gap-0'}>
            <p
              className={
                'pb-2 text-xs uppercase tracking-wide text-neutral-500'
              }
            >
              {'Filtered holdings'}
            </p>
            {hiddenHoldingsVaultsList.map((vault) => (
              <VaultsListRow
                key={`filtered_${vault.chainID}_${vault.address}`}
                currentVault={vault}
              />
            ))}
          </div>
        ) : null}
        {!shouldShowHoldings && shouldShowToggle && !showHiddenHoldings ? (
          <p className={'mt-3 text-xs text-neutral-500'}>
            {'Use the buttons above to inspect or reset the filtered holdings.'}
          </p>
        ) : null}
      </div>
    )
  }

  function renderVaultList(): ReactNode {
    if (!vaultLists) {
      return (
        <VaultsListEmpty
          isLoading={isLoadingVaultList}
          currentSearch={search || ''}
          currentCategories={types}
          currentChains={chains}
          onReset={onReset}
          defaultCategories={ALL_VAULTS_CATEGORIES_KEYS}
        />
      )
    }

    return (
      <>
        {renderHoldingsCard()}
        {sortedNonHoldings
          .slice(page * pageSize, (page + 1) * pageSize)
          .map((vault) => (
            <VaultsListRow
              key={`${vault.chainID}_${vault.address}`}
              currentVault={vault}
            />
          ))}
      </>
    )
  }

  const totalVaults = sortedNonHoldings.length
  const pageSize = 20

  /* 🔵 - Yearn Finance **************************************************************************
   **	This effect ensures that the pagination resets properly when search results change,
   **	especially when a search returns fewer results than would fill the current page.
   **********************************************************************************************/
  useEffect(() => {
    const totalPages = Math.ceil(totalVaults / pageSize)

    // If current page is beyond available pages, reset to first page
    if (page >= totalPages && totalPages > 0) {
      setPage(0)
    }
  }, [page, totalVaults])

  return (
    <div
      className={
        'relative col-span-12 flex min-h-[240px] w-full flex-col overflow-x-hidden bg-neutral-100 md:overflow-x-visible'
      }
    >
      <div className={'absolute right-5 top-3 md:right-8 md:top-8'}>
        <VaultListOptions />
      </div>
      <ListHero
        categories={types}
        possibleCategories={ALL_VAULTS_CATEGORIES}
        searchValue={search || ''}
        chains={chains}
        chainOptions={chainOptions}
        onChangeChains={onChangeChains}
        onChangeCategories={onChangeTypes}
        onSearch={onSearch}
      />

      <div className={'mt-4'} />
      <ListHead
        dataClassName={'grid-cols-10'}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
          onChangeSortBy(newSortBy as TPossibleSortBy)
          onChangeSortDirection(newSortDirection as TSortDirection)
        }}
        items={[
          {
            label: <IconChain />,
            value: 'chain',
            sortable: false,
            className: 'col-span-1',
          },
          { label: 'Token', value: 'name', sortable: false },
          {
            label: 'Est. APY',
            value: 'estAPY',
            sortable: true,
            className: 'col-span-2',
          },
          {
            label: 'Hist. APY',
            value: 'APY',
            sortable: true,
            className: 'col-span-2',
          },
          {
            label: 'Available',
            value: 'available',
            sortable: true,
            className: 'col-span-2',
          },
          {
            label: 'Holdings',
            value: 'deposited',
            sortable: true,
            className: 'col-span-2',
          },
          {
            label: 'Deposits',
            value: 'tvl',
            sortable: true,
            className: 'col-span-2',
          },
        ]}
      />

      <div className={'grid gap-0'}>{renderVaultList()}</div>

      <div className={'mt-4'}>
        <div className={'border-t border-neutral-200/60 p-4'}>
          <Pagination
            range={[0, totalVaults]}
            pageCount={totalVaults / pageSize}
            numberOfItems={totalVaults}
            currentPage={page}
            onPageChange={(newPage): void => setPage(newPage.selected)}
          />
        </div>
      </div>
    </div>
  )
}

function Index(): ReactElement {
  return (
    <div className={'mx-auto my-0 max-w-[1232px] pt-4 md:mb-0 md:mt-16 px-4'}>
      <section
        className={
          'mt-16 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'
        }
      >
        <HeaderUserPosition />
        <ListOfVaults />
      </section>
    </div>
  )
}

export default Index
