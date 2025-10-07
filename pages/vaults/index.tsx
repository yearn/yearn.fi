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
import { ALL_VAULTS_CATEGORIES, DEFAULT_VAULTS_CATEGORIES_KEYS } from '@vaults-v2/constants'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-v2/hooks/useVaultsQueryArgs'
import type { ReactElement, ReactNode } from 'react'
import { useEffect, useState } from 'react'

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
  const { filteredVaults, vaultFlags, isLoading: isLoadingVaultList } = useV2VaultFilter(types, chains, search || '')
  const [page, setPage] = useState(0)
  const chainOptions = useChainOptions(chains)
  const pageSize = 20

  const sortedVaultsToDisplay = useSortVaults(filteredVaults, sortBy, sortDirection)
  const totalVaults = sortedVaultsToDisplay.length

  const renderVaultList = (): ReactNode => {
    if (isLoadingVaultList || totalVaults === 0) {
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

    const paginatedVaults = sortedVaultsToDisplay.slice(page * pageSize, (page + 1) * pageSize)

    return paginatedVaults.map((vault) => {
      const key = `${vault.chainID}_${toAddress(vault.address)}`
      return <VaultsListRow key={key} currentVault={vault} flags={vaultFlags[key]} />
    })
  }

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
            className: 'col-span-1'
          },
          {
            label: 'Vault / Featuring Score',
            value: 'featuringScore',
            sortable: true
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
            className: 'col-span-2'
          }
        ]}
      />

      <div className={'grid gap-0'}>{renderVaultList()}</div>

      <div className={'mt-4'}>
        <div className={'border-t border-neutral-200/60 p-4'}>
          <Pagination
            range={[0, totalVaults]}
            pageCount={Math.ceil(totalVaults / pageSize)}
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
      <section className={'mt-16 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>
        <HeaderUserPosition />
        <ListOfVaults />
      </section>
    </div>
  )
}

export default Index
