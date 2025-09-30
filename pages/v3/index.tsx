import { Button } from '@lib/components/Button'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { useVaultFilter } from '@lib/hooks/useFilteredVaults'
import { useSupportedChains } from '@lib/hooks/useSupportedChains'
import type { TSortDirection } from '@lib/types'
import { cl, formatAmount, isZero } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
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
} from '@vaults-v3/constants'
import { V3Mask } from '@vaults-v3/Mark'
import type { ReactElement, ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

function Background(): ReactElement {
  return (
    <div
      className={cl(
        'absolute inset-0',
        'pointer-events-none',
        'bg-gradient-to-r from-[#D21162] to-[#2C3DA6]'
      )}
    />
  )
}
function BrandNewVaultCard(): ReactElement {
  return (
    <div
      className={cl(
        'h-full rounded-3xl relative overflow-hidden',
        'pr-2 pl-4 pb-4 pt-6 md:p-10',
        'col-span-75 md:col-span-46'
      )}
    >
      <div className={'relative z-10'}>
        <h1
          className={cl(
            'mb-2 md:mb-4 lg:mb-10 font-black text-neutral-900',
            'text-[48px] lg:text-[56px] lg:leading-[64px] leading-[48px]',
            'whitespace-break-spaces uppercase'
          )}
        >
          {'A brave new\nworld for Yield'}
        </h1>
        <p
          className={
            'mb-4 whitespace-break-spaces text-base text-[#F2B7D0] md:text-lg'
          }
        >
          {
            'Yearn v3 is a new yield paradigm offering better automation,\ncomposability and flexibility. Enjoy!'
          }
        </p>
      </div>
      <Background />
    </div>
  )
}
function V3Card(): ReactElement {
  return (
    <div
      className={
        'col-span-75 mb-4 mr-0 hidden md:col-span-29 md:mb-0 md:mr-6 md:block'
      }
    >
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

function PortfolioCard({
  categories,
  onChangeCategories,
}: {
  categories: string[]
  onChangeCategories: (categories: string[]) => void
}): ReactElement {
  const { cumulatedValueInV3Vaults, isLoading } = useWallet()
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()

  if (!isActive) {
    return (
      <div
        className={
          'col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-4'
        }
      >
        <strong
          className={
            'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'
          }
        >
          {'Portfolio'}
        </strong>
        <div className={'flex'}>
          <div>
            <p className={'pb-0 text-[#757CA6] md:pb-2'}>
              {
                'Looks like you need to connect your wallet. And call your mum. Always important.'
              }
            </p>
            <button
              className={cl(
                'rounded-lg overflow-hidden flex',
                'px-[42px] py-2 mt-16',
                'relative group',
                'border-none'
              )}
              onClick={(): void => {
                if (!isActive && address) {
                  onSwitchChain(1)
                } else {
                  openLoginModal()
                }
              }}
            >
              <div
                className={cl(
                  'absolute inset-0',
                  'opacity-80 transition-opacity group-hover:opacity-100 pointer-events-none',
                  'bg-[linear-gradient(80deg,#D21162,#2C3DA6)]'
                )}
              />
              <p className={'z-10 text-neutral-900'}>{'Connect Wallet'}</p>
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div
      className={
        'col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-4'
      }
    >
      <strong
        className={
          'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'
        }
      >
        {'Portfolio'}
      </strong>
      <div className={'flex flex-col gap-4'}>
        <div className={'flex flex-col gap-4 md:flex-row md:gap-32'}>
          <div>
            <p className={'pb-0 text-[#757CA6] md:pb-2'}>{'Deposited'}</p>
            {isLoading ? (
              <div
                className={
                  'h-[36.5px] w-32 animate-pulse rounded-sm bg-[#757CA6]'
                }
              />
            ) : (
              <b className={'font-number text-xl text-neutral-900 md:text-3xl'}>
                {'$'}
                <span suppressHydrationWarning>
                  {formatAmount(cumulatedValueInV3Vaults.toFixed(2), 2, 2)}
                </span>
              </b>
            )}
          </div>
        </div>
        <div className={'flex items-center gap-2 pt-2'}>
          <label
            className={
              'flex cursor-pointer items-center gap-2 text-sm text-neutral-900'
            }
          >
            <input
              type={'checkbox'}
              className={'rounded border-neutral-400'}
              checked={categories.includes('Your Holdings')}
              onChange={(e) => {
                if (e.target.checked) {
                  if (!categories.includes('Your Holdings')) {
                    onChangeCategories([...categories, 'Your Holdings'])
                  }
                } else {
                  onChangeCategories(
                    categories.filter((c) => c !== 'Your Holdings')
                  )
                }
              }}
            />
            <span>{'Show holdings'}</span>
          </label>
        </div>
      </div>
    </div>
  )
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
  onResetMultiSelect,
}: {
  search: string | null | undefined
  types: string[]
  chains: number[]
  categories: string[]
  sortDirection: TSortDirection
  sortBy: TPossibleSortBy
  onSearch: (value: string) => void
  onChangeTypes: (value: string[] | null) => void
  onChangeCategories: (value: string[] | null) => void
  onChangeChains: (value: number[] | null) => void
  onChangeSortDirection: (value: TSortDirection | '') => void
  onChangeSortBy: (value: TPossibleSortBy | '') => void
  onResetMultiSelect: () => void
}): ReactElement {
  const { isLoadingVaultList } = useYearn()
  const { isActive, address, openLoginModal } = useWeb3()
  const allChains = useSupportedChains().map((chain): number => chain.id)
  const [showHiddenHoldings, setShowHiddenHoldings] = useState(false)
  const [isHoldingsCollapsed, setIsHoldingsCollapsed] = useState(false)

  const {
    activeVaults,
    retiredVaults,
    migratableVaults,
    holdingsVaults,
    multiVaults,
    singleVaults,
  } = useVaultFilter(types, chains, true, search || '', categories)

  // Get potential results with all filters but keeping the search
  const { activeVaults: allFilteredVaults } = useVaultFilter(
    ALL_VAULTSV3_KINDS_KEYS,
    allChains,
    true,
    search || '',
    Object.values(ALL_VAULTSV3_CATEGORIES)
  )

  // Get all holdings
  const {
    holdingsVaults: allHoldingsVaults,
    retiredVaults: allRetiredVaults,
    migratableVaults: allMigratableVaults,
  } = useVaultFilter(
    ALL_VAULTSV3_KINDS_KEYS,
    allChains,
    true,
    '',
    Object.values(ALL_VAULTSV3_CATEGORIES)
  )

  /**********************************************************************************************
   **	Prepare vault lists for rendering. All filtering is now done in useVaultFilter.
   *********************************************************************************************/
  const vaultLists = useMemo((): {
    holdings: TYDaemonVault[]
    multi: TYDaemonVault[]
    single: TYDaemonVault[]
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
    const nonHoldingsVaults = activeVaults.filter(
      (vault) => !holdingsSet.has(`${vault.chainID}_${vault.address}`)
    )

    const shouldShowEmptyState =
      isLoadingVaultList ||
      !chains ||
      chains.length === 0 ||
      (isZero(holdingsArray.length) &&
        isZero(multiVaults.length) &&
        isZero(singleVaults.length))

    if (shouldShowEmptyState) {
      return null
    }

    return {
      holdings: holdingsArray,
      multi: multiVaults,
      single: singleVaults,
      all: nonHoldingsVaults,
    }
  }, [
    isLoadingVaultList,
    chains,
    activeVaults,
    migratableVaults,
    retiredVaults,
    holdingsVaults,
    multiVaults,
    singleVaults,
  ])

  const { holdings, all } = vaultLists || {
    holdings: [],
    all: [],
  }
  const shouldShowHoldings = categories.includes('Your Holdings')

  const sortedHoldings = useSortVaults(holdings, sortBy, sortDirection)
  const sortedNonHoldings = useSortVaults(all, sortBy, sortDirection)

  // Calculate potential hidden results due to filters
  const currentResultsCount =
    (shouldShowHoldings ? sortedHoldings.length : 0) + sortedNonHoldings.length
  const potentialResultsCount = allFilteredVaults.length
  const hiddenByFiltersCount = potentialResultsCount - currentResultsCount
  const hasHiddenResults = search && hiddenByFiltersCount > 0

  // Calculate hidden holdings due to filters (regardless of search)
  const hiddenHoldingsCount =
    allHoldingsVaults.length +
    allRetiredVaults.length +
    allMigratableVaults.length -
    (shouldShowHoldings ? holdings.length : 0)
  const hasHiddenHoldings = hiddenHoldingsCount > 0 && shouldShowHoldings
  const totalWalletHoldingsCount =
    allHoldingsVaults.length +
    allRetiredVaults.length +
    allMigratableVaults.length

  const hiddenHoldingsVaultsList = useMemo((): TYDaemonVault[] => {
    if (!hasHiddenHoldings) {
      return []
    }

    const visibleKeys = new Set(
      holdings.map((vault) => `${vault.chainID}_${vault.address}`)
    )
    const combined = new Map<string, TYDaemonVault>()

    for (const vault of allHoldingsVaults) {
      combined.set(`${vault.chainID}_${vault.address}`, vault)
    }
    for (const vault of allRetiredVaults) {
      combined.set(`${vault.chainID}_${vault.address}`, vault)
    }
    for (const vault of allMigratableVaults) {
      combined.set(`${vault.chainID}_${vault.address}`, vault)
    }

    return Array.from(combined.entries())
      .filter(([key]) => !visibleKeys.has(key))
      .map(([, vault]) => vault)
  }, [
    hasHiddenHoldings,
    holdings,
    allHoldingsVaults,
    allRetiredVaults,
    allMigratableVaults,
  ])

  const filtersSignature = useMemo(() => {
    return [
      search ?? '',
      (types || []).join('_'),
      (categories || []).join('_'),
      (chains || []).join('_'),
    ].join('|')
  }, [search, types, categories, chains])
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

  const renderHiddenSearchAlert = (): ReactNode => {
    if (!hasHiddenResults) return null

    return (
      <div
        className={
          'flex items-center gap-2 rounded-lg px-3 py-1 text-xs text-neutral-700'
        }
      >
        <span>
          {hiddenByFiltersCount}{' '}
          {`vault${hiddenByFiltersCount > 1 ? 's' : ''} hidden by filters`}
        </span>
        <Button
          onClick={onResetMultiSelect}
          className={
            'yearn--button-smaller h-6 rounded-md px-3 py-1 text-xs text-white hover:bg-neutral-800'
          }
        >
          {'Show all'}
        </Button>
      </div>
    )
  }

  const renderHoldingsCard = (): ReactNode => {
    const walletConnected = isActive && Boolean(address)
    const walletDisconnected = !walletConnected

    if (walletConnected && totalWalletHoldingsCount === 0) {
      return null
    }

    const shouldShowToggle =
      hasHiddenHoldings && hiddenHoldingsVaultsList.length > 0

    if (walletDisconnected) {
      return (
        <div className={'relative mb-2 rounded-3xl'}>
          <div
            className={
              'pointer-events-none absolute -inset-[2px] z-1 rounded-3xl border border-neutral-300'
            }
          />
          <div
            className={
              'pointer-events-none absolute -inset-[2px] z-0 rounded-3xl bg-[linear-gradient(80deg,#2C3DA6,#D21162)] opacity-25 blur-xl'
            }
          />
          <div className={'relative z-10 rounded-3xl px-6 py-5'}>
            <div
              className={'flex flex-wrap items-center justify-between gap-3'}
            >
              <div className={'flex flex-col gap-1'}>
                <p className={'text-sm font-semibold text-neutral-900'}>
                  {'Your holdings'}
                </p>
                <p className={'text-xs text-neutral-500'}>
                  {'Connect your wallet to view your vault deposits.'}
                </p>
              </div>
              <Button
                onClick={openLoginModal}
                className={
                  'yearn--button-smaller rounded-md bg-neutral-900 px-3 py-2 text-xs text-white hover:bg-neutral-800'
                }
              >
                {'Connect wallet'}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (!shouldShowHoldings && hiddenHoldingsCount === 0) {
      return null
    }

    const hasVisibleHoldingsRows =
      shouldShowHoldings && sortedHoldings.length > 0 && !isHoldingsCollapsed
    const shouldShowBorder = !hasVisibleHoldingsRows
    const canCollapseHoldings =
      totalWalletHoldingsCount > 0 && shouldShowHoldings

    return (
      <div className={'relative mb-2 rounded-3xl'}>
        {/* Border should be off when holdings are visible and add border when empty */}
        <div
          className={cl(
            'pointer-events-none absolute -inset-[2px] z-1 rounded-3xl',
            shouldShowBorder ? 'border border-neutral-300' : 'border-0'
          )}
        />
        <div
          className={
            'pointer-events-none absolute -inset-[2px] z-0 rounded-3xl bg-[linear-gradient(80deg,#2C3DA6,#D21162)] opacity-20 blur xl'
          }
        />
        <div className={'relative z-10 rounded-3xl'}>
          <div
            className={
              'flex flex-wrap items-center justify-between gap-3 px-6 py-4'
            }
          >
            <div className={'flex items-center gap-2'}>
              <p className={'text-sm font-semibold text-neutral-900'}>
                {'Your holdings'}
              </p>
              {shouldShowHoldings ? (
                <span className={'text-xs text-neutral-500'}>
                  {sortedHoldings.length} vault
                  {sortedHoldings.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            <div className={'flex flex-wrap items-center justify-end gap-2'}>
              {canCollapseHoldings ? (
                <Button
                  onClick={(): void => setIsHoldingsCollapsed((prev) => !prev)}
                  className={
                    'yearn--button-smaller rounded-md border border-neutral-200 px-3 py-1 text-xs text-neutral-900 hover:bg-neutral-100'
                  }
                >
                  {isHoldingsCollapsed ? 'Show holdings' : 'Hide holdings'}
                </Button>
              ) : null}
              {shouldShowToggle ? (
                <div
                  className={'flex items-center gap-2 text-xs text-neutral-600'}
                >
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
                    onClick={onResetMultiSelect}
                    className={
                      'yearn--button-smaller rounded-md border border-neutral-200 px-3 py-1 text-xs text-neutral-900'
                    }
                  >
                    {'Reset filters'}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          {hasVisibleHoldingsRows ? (
            <div className={'grid gap-4 py-2'}>
              {sortedHoldings.map((vault) => (
                <VaultsV3ListRow
                  key={`${vault.chainID}_${vault.address}`}
                  currentVault={vault}
                />
              ))}
            </div>
          ) : null}
          {!isHoldingsCollapsed &&
          showHiddenHoldings &&
          hiddenHoldingsVaultsList.length > 0 ? (
            <div className={'mt-4 grid gap-0 px-6 pb-6'}>
              <p
                className={
                  'pb-2 text-xs uppercase tracking-wide text-neutral-500'
                }
              >
                {'Filtered holdings'}
              </p>
              {hiddenHoldingsVaultsList.map((vault) => (
                <VaultsV3ListRow
                  key={`filtered_${vault.chainID}_${vault.address}`}
                  currentVault={vault}
                />
              ))}
            </div>
          ) : null}
          {!shouldShowHoldings &&
          shouldShowToggle &&
          !showHiddenHoldings &&
          !isHoldingsCollapsed ? (
            <p className={'mt-3 px-6 pb-6 text-xs text-neutral-500'}>
              {
                'Use the buttons above to review or reset your filtered holdings.'
              }
            </p>
          ) : null}
        </div>
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
          onReset={onResetMultiSelect}
          defaultCategories={Object.values(ALL_VAULTSV3_CATEGORIES)}
          potentialResultsCount={allFilteredVaults.length}
        />
      )
    }
    return (
      <Fragment>
        {renderHoldingsCard()}
        {sortedNonHoldings.map((vault) => (
          <VaultsV3ListRow
            key={`${vault.chainID}_${vault.address}`}
            currentVault={vault}
          />
        ))}
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
        searchAlertContent={renderHiddenSearchAlert()}
      />
      <div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
        <VaultsV3ListHead
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={(
            newSortBy: string,
            newSortDirection: TSortDirection
          ): void => {
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
              label: 'Vault',
              value: 'name',
              sortable: false,
              className: 'col-span-4',
            },
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
              label: 'Risk Level',
              value: 'score',
              sortable: true,
              className: 'col-span-2 whitespace-nowrap',
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
              className: 'col-span-2 justify-end',
            },
          ]}
        />
        <div className={'grid gap-4'}>{renderVaultList()}</div>
      </div>
    </Fragment>
  )
}

function Index(): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(true)
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
    onResetMultiSelect,
  } = useQueryArguments({
    defaultTypes: [ALL_VAULTSV3_KINDS_KEYS[0]],
    defaultCategories: Object.values(ALL_VAULTSV3_CATEGORIES),
    defaultPathname: '/v3',
  })

  function onClick(): void {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className={'z-50 w-full bg-neutral-100 pt-20'}>
      <div className={'relative mx-auto w-full max-w-[1232px]'}>
        <div className={'absolute inset-x-0 top-0 w-full px-4 pt-6 md:pt-16'}>
          <div className={'grid grid-cols-75'}>
            <V3Card />
            <BrandNewVaultCard />
          </div>
        </div>
      </div>

      <div
        className={cl(
          'relative pb-8 bg-neutral-0 z-50',
          'min-h-screen',
          'transition-transform duration-300',
          isCollapsed
            ? 'translate-y-[354px] md:translate-y-[464px]'
            : 'translate-y-[24px] md:translate-y-[40px]'
        )}
      >
        <div className={'mx-auto w-full max-w-[1232px] px-4'}>
          <div
            onClick={onClick}
            className={
              'absolute inset-x-0 top-0 flex w-full cursor-pointer items-center justify-center'
            }
          >
            <div className={'relative -mt-8 flex justify-center rounded-t-3xl'}>
              <svg
                xmlns={'http://www.w3.org/2000/svg'}
                width={'113'}
                height={'32'}
                viewBox={'0 0 113 32'}
                fill={'none'}
              >
                <path
                  d={
                    'M0 32C37.9861 32 20.9837 0 56 0C91.0057 0 74.388 32 113 32H0Z'
                  }
                  fill={'#000520'}
                />
              </svg>
              <div
                className={`absolute mt-2 flex justify-center transition-transform ${
                  isCollapsed ? '' : '-rotate-180'
                }`}
              >
                <svg
                  xmlns={'http://www.w3.org/2000/svg'}
                  width={'24'}
                  height={'24'}
                  viewBox={'0 0 24 24'}
                  fill={'none'}
                >
                  <path
                    fillRule={'evenodd'}
                    clipRule={'evenodd'}
                    d={
                      'M4.34151 16.7526C3.92587 16.3889 3.88375 15.7571 4.24744 15.3415L11.2474 7.34148C11.4373 7.12447 11.7117 6.99999 12 6.99999C12.2884 6.99999 12.5627 7.12447 12.7526 7.34148L19.7526 15.3415C20.1163 15.7571 20.0742 16.3889 19.6585 16.7526C19.2429 17.1162 18.6111 17.0741 18.2474 16.6585L12 9.51858L5.75259 16.6585C5.38891 17.0741 4.75715 17.1162 4.34151 16.7526Z'
                    }
                    fill={'white'}
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className={'grid grid-cols-12 gap-4 pt-6 md:gap-6'}>
            <PortfolioCard
              categories={categories || []}
              onChangeCategories={onChangeCategories}
            />
            <ListOfVaults
              search={search}
              types={types || []}
              chains={chains || []}
              categories={categories || []}
              sortDirection={sortDirection}
              sortBy={sortBy}
              onSearch={onSearch}
              onChangeTypes={onChangeTypes}
              onChangeCategories={onChangeCategories}
              onChangeChains={onChangeChains}
              onChangeSortDirection={onChangeSortDirection}
              onChangeSortBy={onChangeSortBy}
              onResetMultiSelect={onResetMultiSelect}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Index
