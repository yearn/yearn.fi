import { Button } from '@lib/components/Button'
import { Counter } from '@lib/components/Counter'
import { ListHead } from '@lib/components/ListHead'
import { Pagination } from '@lib/components/Pagination'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useChainOptions } from '@lib/hooks/useChains'
import { useV2VaultFilter } from '@lib/hooks/useV2VaultFilter'
import { IconChain } from '@lib/icons/IconChain'
import type { TSortDirection } from '@lib/types'
import { toAddress } from '@lib/utils'
import { ListHero } from '@vaults-v2/components/ListHero'
import { VaultListOptions } from '@vaults-v2/components/list/VaultListOptions'
import { VaultsListEmpty } from '@vaults-v2/components/list/VaultsListEmpty'
import { VaultsListRow } from '@vaults-v2/components/list/VaultsListRow'
import { VaultsV2AuxiliaryList } from '@vaults-v2/components/list/VaultsV2AuxiliaryList'
import { ALL_VAULTS_CATEGORIES, DEFAULT_VAULTS_CATEGORIES_KEYS } from '@vaults-v2/constants'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-v2/hooks/useVaultsQueryArgs'
import type { ReactElement, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

function HeaderUserPosition(): ReactElement {
  const { cumulatedValueInV2Vaults } = useWallet()
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()

  if (!isActive) {
    return (
      <div className={'col-span-12 h-auto w-full md:col-span-8 md:h-[136px]'}>
        <p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Wallet not connected'}</p>
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
      <p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Deposited'}</p>
      <b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
        {'$'}
        <Counter value={Number(cumulatedValueInV2Vaults)} decimals={2} />
      </b>
    </div>
  )
}

const HOLDINGS_TOGGLE_VALUE = 'holdings'

function ListOfVaults(): ReactElement {
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
    onReset
  } = useQueryArguments({
    defaultTypes: DEFAULT_VAULTS_CATEGORIES_KEYS,
    defaultPathname: '/vaults'
  })
  const {
    filteredVaults,
    holdingsVaults,
    vaultFlags,
    isLoading: isLoadingVaultList
  } = useV2VaultFilter(types, chains, search || '')
  const [page, setPage] = useState(0)
  const chainOptions = useChainOptions(chains)
  const pageSize = 20

  const [activeToggleValues, setActiveToggleValues] = useState<string[]>([])
  const isHoldingsPinned = activeToggleValues.includes(HOLDINGS_TOGGLE_VALUE)

  useEffect(() => {
    if (holdingsVaults.length === 0 && isHoldingsPinned) {
      setActiveToggleValues((prev) => prev.filter((value) => value !== HOLDINGS_TOGGLE_VALUE))
    }
  }, [holdingsVaults.length, isHoldingsPinned])

  const sortedVaults = useSortVaults(filteredVaults, sortBy, sortDirection)
  const sortedHoldingsVaults = useSortVaults(holdingsVaults, sortBy, sortDirection)

  const pinnedHoldingsVaults = useMemo(
    () => (isHoldingsPinned ? sortedHoldingsVaults : []),
    [isHoldingsPinned, sortedHoldingsVaults]
  )

  const pinnedHoldingsKeys = useMemo(
    () => new Set(pinnedHoldingsVaults.map((vault) => `${vault.chainID}_${toAddress(vault.address)}`)),
    [pinnedHoldingsVaults]
  )

  const mainVaults = useMemo(() => {
    if (!isHoldingsPinned) {
      return sortedVaults
    }
    return sortedVaults.filter((vault) => !pinnedHoldingsKeys.has(`${vault.chainID}_${toAddress(vault.address)}`))
  }, [isHoldingsPinned, pinnedHoldingsKeys, sortedVaults])

  const totalMainVaults = mainVaults.length
  const paginatedVaults = useMemo(() => mainVaults.slice(page * pageSize, (page + 1) * pageSize), [mainVaults, page])

  const renderVaultList = (): ReactNode => {
    if (isLoadingVaultList) {
      return (
        <VaultsListEmpty
          isLoading={isLoadingVaultList}
          currentSearch={search || ''}
          currentCategories={types}
          currentChains={chains}
          onReset={onReset}
          defaultCategories={DEFAULT_VAULTS_CATEGORIES_KEYS}
        />
      )
    }

    if (pinnedHoldingsVaults.length === 0 && totalMainVaults === 0) {
      return (
        <VaultsListEmpty
          isLoading={false}
          currentSearch={search || ''}
          currentCategories={types}
          currentChains={chains}
          onReset={onReset}
          defaultCategories={DEFAULT_VAULTS_CATEGORIES_KEYS}
        />
      )
    }

    return (
      <div className={'flex flex-col gap-px'}>
        <VaultsV2AuxiliaryList vaults={pinnedHoldingsVaults} vaultFlags={vaultFlags} />
        {paginatedVaults.length > 0 ? (
          <div className={'grid gap-px'}>
            {paginatedVaults.map((vault) => {
              const key = `${vault.chainID}_${toAddress(vault.address)}`
              return <VaultsListRow key={key} currentVault={vault} flags={vaultFlags[key]} />
            })}
          </div>
        ) : null}
      </div>
    )
  }

  /* 🔵 - Yearn Finance **************************************************************************
   **	This effect ensures that the pagination resets properly when search results change,
   **	especially when a search returns fewer results than would fill the current page.
   **********************************************************************************************/
  useEffect(() => {
    const totalPages = Math.ceil(totalMainVaults / pageSize)

    // If current page is beyond available pages, reset to first page
    if (page >= totalPages && totalPages > 0) {
      setPage(0)
    }
  }, [page, totalMainVaults])

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
        onToggle={(value): void => {
          setActiveToggleValues((prev) => {
            if (prev.includes(value)) {
              return prev.filter((entry) => entry !== value)
            }
            return [...prev, value]
          })
        }}
        activeToggleValues={activeToggleValues}
        items={[
          {
            label: <IconChain />,
            value: 'chain',
            sortable: false,
            className: 'col-span-1'
          },
          {
            type: 'sort',
            label: 'Vault / Featuring Score',
            value: 'featuringScore',
            sortable: true
          },
          {
            type: 'sort',
            label: 'Est. APY',
            value: 'estAPY',
            sortable: true,
            className: 'col-span-2'
          },
          {
            type: 'sort',
            label: 'Hist. APY',
            value: 'APY',
            sortable: true,
            className: 'col-span-2'
          },
          {
            type: 'sort',
            label: 'Available',
            value: 'available',
            sortable: true,
            className: 'col-span-2'
          },
          {
            type: 'toggle',
            label: 'Holdings',
            value: HOLDINGS_TOGGLE_VALUE,
            className: 'col-span-2',
            disabled: holdingsVaults.length === 0
          },
          {
            type: 'sort',
            label: 'Deposits',
            value: 'tvl',
            sortable: true,
            className: 'col-span-2'
          }
        ]}
      />

      {renderVaultList()}

      {totalMainVaults > 0 ? (
        <div className={'mt-4'}>
          <div className={'border-t border-neutral-200/60 p-4'}>
            <Pagination
              range={[0, totalMainVaults]}
              pageCount={Math.ceil(totalMainVaults / pageSize)}
              numberOfItems={totalMainVaults}
              currentPage={page}
              onPageChange={(newPage): void => setPage(newPage.selected)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Index(): ReactElement {
  return (
    <div className={'mx-auto my-0 max-w-[1232px] pt-4 md:mb-0 md:mt-16 px-4'}>
      <section className={'mt-16 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>
        <HeaderUserPosition />
        <ListOfVaults />
      </section>
    </div>
  )
}

export default Index
