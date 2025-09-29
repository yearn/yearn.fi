import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { useVaultFilter } from '@lib/hooks/useFilteredVaults'
import type { TSortDirection } from '@lib/types'
import { cl, isZero, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultsListEmpty } from '@vaults-v2/components/list/VaultsListEmpty'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-v2/hooks/useVaultsQueryArgs'
import { Filters } from '@vaults-v3/components/Filters'
import { VaultsV3ListHead } from '@vaults-v3/components/list/VaultsV3ListHead'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'
import { ALL_VAULTSV3_CATEGORIES_KEYS, ALL_VAULTSV3_KINDS_KEYS } from '@vaults-v3/constants'
import { V3Mask } from '@vaults-v3/Mark'
import type { ReactElement, ReactNode } from 'react'
import { Children, Fragment, useMemo } from 'react'

function V3Card(): ReactElement {
  return (
    <div className={'col-span-12 w-full rounded-3xl bg-neutral-100 p-2 hidden md:block md:col-span-4'}>
      <div
        className={cl(
          'flex h-full w-full flex-col items-center justify-center',
          'gap-y-0 rounded-3xl bg-neutral-200 md:gap-y-6 p-2'
        )}
      >
        <V3Mask className={'size-[90%]'} />
      </div>
    </div>
  )
}

function ListOfVaults(): ReactElement {
  const { getBalance } = useWallet()
  const { getPrice, isLoadingVaultList } = useYearn()
  const {
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
    onReset
  } = useQueryArguments({
    defaultTypes: [ALL_VAULTSV3_KINDS_KEYS[0]],
    defaultCategories: ALL_VAULTSV3_CATEGORIES_KEYS,
    defaultPathname: '/v3'
  })
  const { activeVaults, retiredVaults, migratableVaults } = useVaultFilter(types, chains, true)

  /**********************************************************************************************
   **	Then, on the activeVaults list, we apply the search filter. The search filter is
   **	implemented as a simple string.includes() on the vault name.
   *********************************************************************************************/
  const searchedVaultsToDisplay = useMemo((): TYDaemonVault[] => {
    if (!search) {
      return activeVaults
    }

    /**********************************************************************************************
     * Create a regex pattern from the search term, escaping special regex characters to prevent
     * errors and enabling case-insensitive matching for better user experience
     *********************************************************************************************/
    let searchRegex: RegExp
    try {
      // Escape special regex characters but allow basic wildcard functionality
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      searchRegex = new RegExp(escapedSearch, 'i') // 'i' flag for case-insensitive
    } catch {
      // Fallback to simple case-insensitive search if regex creation fails
      const lowercaseSearch = search.toLowerCase()
      return activeVaults.filter((vault: TYDaemonVault): boolean => {
        const searchableText =
          `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`.toLowerCase()
        return searchableText.includes(lowercaseSearch)
      })
    }

    const filtered = activeVaults.filter((vault: TYDaemonVault): boolean => {
      const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`
      return searchRegex.test(searchableText)
    })
    return filtered
  }, [activeVaults, search])

  /**********************************************************************************************
   **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
   **	is done via a custom method that will sort the vaults based on the sortBy and
   **	sortDirection values.
   *********************************************************************************************/
  const sortedVaultsToDisplay = useSortVaults([...searchedVaultsToDisplay], sortBy, sortDirection)

  /**********************************************************************************************
   **	The VaultList component is memoized to prevent it from being re-created on every render.
   **	It contains either the list of vaults, is some are available, or a message to the user.
   *********************************************************************************************/
  const VaultList = useMemo((): [ReactNode, ReactNode, ReactNode, ReactNode] | ReactNode => {
    const filteredByChains = sortedVaultsToDisplay.filter(({ chainID }): boolean => chains?.includes(chainID) || false)
    const filteredByCategories = filteredByChains.filter(
      ({ category }): boolean => categories?.includes(category) || false
    )

    const holdings: ReactNode[] = []
    const multi: ReactNode[] = []
    const single: ReactNode[] = []
    const all: ReactNode[] = []
    const processedForHoldings = new Set<string>()

    // Add migratable vaults to holdings (guaranteed to have balance)
    for (const vault of migratableVaults) {
      const key = `${vault.chainID}_${vault.address}`
      const balance = getBalance({ address: vault.address, chainID: vault.chainID })
      const stakingBalance = getBalance({ address: vault.staking.address, chainID: vault.chainID })
      const hasBalance = balance.raw > 0n
      const hasStakingBalance = stakingBalance.raw > 0n
      if (hasBalance || hasStakingBalance) {
        holdings.push(<VaultsV3ListRow key={key} currentVault={vault} isHoldings={true} />)
        processedForHoldings.add(key)
      }
    }

    // Add retired vaults to holdings (guaranteed to have balance)
    for (const vault of retiredVaults) {
      const key = `${vault.chainID}_${vault.address}`
      if (!processedForHoldings.has(key)) {
        // Avoid duplicates
        const hasBalance = getBalance({ address: vault.address, chainID: vault.chainID }).raw > 0n
        const hasStakingBalance = getBalance({ address: vault.staking.address, chainID: vault.chainID }).raw > 0n
        if (hasBalance || hasStakingBalance) {
          holdings.push(<VaultsV3ListRow key={key} currentVault={vault} isHoldings={true} />)
          processedForHoldings.add(key)
        }
      }
    }

    for (const vault of filteredByCategories) {
      // Process active vaults
      const key = `${vault.chainID}_${vault.address}`

      if (processedForHoldings.has(key)) {
        // This vault was already added to holdings from migratable/retired lists.
        // Skip adding to multi, single, or all.
        continue
      }

      const balance = getBalance({ address: vault.address, chainID: vault.chainID })
      const stakingBalance = getBalance({ address: vault.staking.address, chainID: vault.chainID })
      const price = getPrice({ address: vault.address, chainID: vault.chainID })

      const holdingsValue =
        toNormalizedBN(balance.raw + stakingBalance.raw, vault.decimals).normalized * price.normalized

      if (holdingsValue > 0.5) {
        holdings.push(<VaultsV3ListRow key={key} currentVault={vault} isHoldings={true} />)
        // No need to add to processedForHoldings here again as `continue` prevents further processing for this vault.
        continue
      }

      // If not a holding, categorize into multi, single, and all
      if (vault.kind === 'Multi Strategy') {
        multi.push(<VaultsV3ListRow key={key} currentVault={vault} />)
      }
      if (vault.kind === 'Single Strategy') {
        single.push(<VaultsV3ListRow key={key} currentVault={vault} />)
      }
      all.push(
        // `all` contains active, non-holding vaults
        <VaultsV3ListRow key={key} currentVault={vault} />
      )
    }

    const shouldShowEmptyState =
      isLoadingVaultList || !chains || chains.length === 0 || (isZero(holdings.length) && isZero(all.length)) // Show empty if no holdings and no other active vaults

    if (shouldShowEmptyState) {
      return (
        <VaultsListEmpty
          isLoading={isLoadingVaultList}
          sortedVaultsToDisplay={filteredByCategories} // Represents the set of vaults filters were applied to
          currentSearch={search || ''}
          currentCategories={types}
          currentChains={chains}
          onReset={onReset}
          defaultCategories={ALL_VAULTSV3_KINDS_KEYS}
        />
      )
    }

    return [holdings, multi, single, all]
  }, [
    sortedVaultsToDisplay,
    isLoadingVaultList,
    chains,
    categories,
    migratableVaults,
    getBalance,
    retiredVaults,
    getPrice,
    search,
    types,
    onReset
  ])

  function renderVaultList(): ReactNode {
    if (Children.count(VaultList) === 1) {
      return VaultList as ReactNode
    }
    const possibleLists = VaultList as [ReactNode, ReactNode, ReactNode, ReactNode]
    const hasHoldings = Children.count(possibleLists[0]) > 0

    if (sortBy !== 'featuringScore' && possibleLists[3]) {
      return (
        <Fragment>
          {hasHoldings && (
            <div className={'relative grid h-fit gap-4'}>
              <p className={'absolute -left-20 top-1/2 -rotate-90 text-xs text-neutral-400'}>
                &nbsp;&nbsp;&nbsp;{'Your holdings'}&nbsp;&nbsp;&nbsp;
              </p>
              {possibleLists[0]}
            </div>
          )}
          {Children.count(possibleLists[0]) > 0 && Children.count(possibleLists[3]) > 0 ? (
            <div className={'my-2 h-1 rounded-lg bg-neutral-200'} />
          ) : null}
          {possibleLists[3]}
        </Fragment>
      )
    }
    return (
      <Fragment>
        {hasHoldings && (
          <div className={'relative grid h-fit gap-4'}>
            <p className={'absolute -left-20 top-1/2 -rotate-90 text-xs text-neutral-400'}>
              &nbsp;&nbsp;&nbsp;{'Your holdings'}&nbsp;&nbsp;&nbsp;
            </p>
            {possibleLists[0]}
          </div>
        )}
        {Children.count(possibleLists[0]) > 0 && Children.count(possibleLists[1]) > 0 ? (
          <div className={'my-2 h-1 rounded-lg bg-neutral-200'} />
        ) : null}
        {possibleLists[1]}
        {Children.count(possibleLists[1]) > 1 && Children.count(possibleLists[2]) > 0 ? (
          <div className={'my-2 h-1 rounded-lg bg-neutral-200'} />
        ) : null}
        {possibleLists[2]}
      </Fragment>
    )
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
            { label: 'Vault', value: 'name', sortable: true, className: 'col-span-4' },
            { label: 'Est. APY', value: 'estAPY', sortable: true, className: 'col-span-2' },
            { label: 'Hist. APY', value: 'APY', sortable: true, className: 'col-span-2' },
            {
              label: 'Risk Level',
              value: 'score',
              sortable: true,
              className: 'col-span-2 whitespace-nowrap'
            },
            { label: 'Available', value: 'available', sortable: true, className: 'col-span-2' },
            { label: 'Holdings', value: 'deposited', sortable: true, className: 'col-span-2' },
            { label: 'Deposits', value: 'tvl', sortable: true, className: 'col-span-2 justify-end' }
          ]}
        />
        <div className={'grid gap-3'}>{renderVaultList()}</div>
      </div>
    </Fragment>
  )
}

function Index(): ReactElement {
  return (
    <div
      className={
        'relative mx-auto z-50 w-full max-w-[1232px] grid grid-cols-12 gap-4 md:gap-6 bg-neutral-0 pt-20 px-4 pb-8'
      }
    >
      <V3Card />
      <ListOfVaults />
    </div>
  )
}

export default Index
