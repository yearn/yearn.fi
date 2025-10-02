import { Button } from '@lib/components/Button'
import { RenderAmount } from '@lib/components/RenderAmount'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { useVaultFilter } from '@lib/hooks/useFilteredVaults'
import { useSupportedChains } from '@lib/hooks/useSupportedChains'
import { IconChevron } from '@lib/icons/IconChevron'
import type { TSortDirection } from '@lib/types'
import { cl, formatAmount, isZero, toAddress } from '@lib/utils'
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
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import { V3Mask } from '@vaults-v3/Mark'
import type { ReactElement, ReactNode } from 'react'
import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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

function HoldingsPill({ vault }: { vault: TYDaemonVault }): ReactElement {
  const data = useVaultApyData(vault)
  const navigate = useNavigate()
  const href = `/v3/${vault.chainID}/${toAddress(vault.address)}`

  const isVeYfi = vault.staking.source === 'VeYFI'
  const boostedApr = data.baseForwardApr + data.rewardsAprSum
  const katanaApr = data.katanaTotalApr ?? data.baseForwardApr

  const apyContent: ReactNode = (() => {
    if (data.mode === 'katana' && data.katanaTotalApr !== undefined) {
      return (
        <>
          <span>{'⚔️ '}</span>
          <RenderAmount
            shouldHideTooltip
            value={katanaApr}
            symbol={'percent'}
            decimals={6}
          />
        </>
      )
    }

    if (data.mode === 'rewards') {
      if (isVeYfi && data.estAprRange) {
        return (
          <>
            <span>{'⚡️ '}</span>
            <RenderAmount
              shouldHideTooltip
              value={data.estAprRange[0]}
              symbol={'percent'}
              decimals={6}
            />
            <span>{' → '}</span>
            <RenderAmount
              shouldHideTooltip
              value={data.estAprRange[1]}
              symbol={'percent'}
              decimals={6}
            />
          </>
        )
      }

      return (
        <>
          <span>{'⚡️ '}</span>
          <RenderAmount
            shouldHideTooltip
            value={boostedApr}
            symbol={'percent'}
            decimals={6}
          />
        </>
      )
    }

    if (data.mode === 'boosted' && data.isBoosted) {
      return (
        <>
          <span>{'🚀 '}</span>
          <RenderAmount
            shouldHideTooltip
            value={vault.apr.forwardAPR.netAPR}
            symbol={'percent'}
            decimals={6}
          />
          {data.boost ? (
            <span
              className={
                'text-[0.65rem] uppercase tracking-wide text-neutral-100/70'
              }
            >
              {` • Boost ${formatAmount(data.boost, 2, 2)}x`}
            </span>
          ) : null}
        </>
      )
    }

    if (!isZero(data.baseForwardApr)) {
      return (
        <>
          <span>{'APY '}</span>
          <RenderAmount
            shouldHideTooltip
            value={data.baseForwardApr}
            symbol={'percent'}
            decimals={6}
          />
        </>
      )
    }

    return (
      <>
        <span>{'Hist. '}</span>
        <RenderAmount
          shouldHideTooltip
          value={data.netApr}
          symbol={'percent'}
          decimals={6}
        />
      </>
    )
  })()

  return (
    <button
      type={'button'}
      onClick={(): void => {
        void navigate(href)
      }}
      className={'relative rounded-full'}
    >
      <div
        className={
          'pointer-events-none absolute -inset-[3px] rounded-full bg-[radial-gradient(circle_at_top_left,rgba(210,17,98,.75),rgba(44,61,166,.75))] opacity-50 blur-md'
        }
      />
      <div
        className={
          'relative z-10 flex items-center gap-2 rounded-full border border-[#D21162]/50 bg-[#2a1956eb] hover:bg-[linear-gradient(80deg,#2C3DA6,#D21162)] px-3 py-2 text-xs text-neutral-50 backdrop-blur-lg transition-colors '
        }
      >
        <span
          className={
            'max-w-[168px] truncate text-sm font-semibold text-neutral-50'
          }
        >
          {vault.name}
        </span>
        <span
          className={
            'flex flex-wrap items-center gap-1 text-xs text-neutral-50'
          }
        >
          <span className={'text-neutral-50/60'}>{'|'}</span>
          {apyContent}
        </span>
      </div>
    </button>
  )
}

function PortfolioCard(): ReactElement {
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
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()
  const allChains = useSupportedChains().map((chain): number => chain.id)
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

  const sortedFilteredHoldings = useSortVaults(holdings, sortBy, sortDirection)
  const sortedNonHoldings = useSortVaults(all, sortBy, sortDirection)

  const allHoldingsList = useMemo((): TYDaemonVault[] => {
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
    for (const vault of holdings) {
      combined.set(`${vault.chainID}_${vault.address}`, vault)
    }
    return Array.from(combined.values())
  }, [allHoldingsVaults, allRetiredVaults, allMigratableVaults, holdings])

  const sortedAllHoldings = useSortVaults(
    allHoldingsList,
    sortBy,
    sortDirection
  )
  const walletHoldingsCount = sortedAllHoldings.length
  const potentialResultsCount = allFilteredVaults.length
  const currentResultsCount =
    (shouldShowHoldings ? sortedFilteredHoldings.length : 0) +
    sortedNonHoldings.length
  const hiddenByFiltersCount = potentialResultsCount - currentResultsCount
  const hasHiddenResults = Boolean(search) && hiddenByFiltersCount > 0

  const renderHiddenSearchAlert = (): ReactNode => {
    if (!hasHiddenResults) {
      return null
    }

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

    if (!shouldShowHoldings) {
      return null
    }

    if (walletConnected && walletHoldingsCount === 0) {
      return null
    }

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
          <div className={'relative z-10 rounded-3xl px-6 py-6'}>
            <div className={'flex justify-center'}>
              <button
                type={'button'}
                className={cl(
                  'rounded-lg overflow-hidden flex items-center justify-center text-center',
                  'px-6 py-3',
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
                <span
                  className={
                    'z-10 px-2 text-sm font-medium text-white md:text-base'
                  }
                >
                  {'Connect wallet to view your vault balances.'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className={'relative mb-2 rounded-3xl'}>
        <div
          className={cl(
            'pointer-events-none absolute -inset-[2px] z-1 rounded-3xl'
          )}
        />
        <div
          className={
            'pointer-events-none absolute -inset-[2px] z-0 rounded-3xl bg-[linear-gradient(80deg,#2C3DA6,#D21162)] opacity-20 '
          }
        />
        <div className={'relative z-10 rounded-3xl'}>
          <div
            className={
              'flex flex-wrap items-center justify-between gap-3 px-6 py-4'
            }
          >
            <div
              className={
                'flex min-w-0 min-h-10 flex-1 flex-wrap items-center gap-3'
              }
            >
              <button
                type={'button'}
                onClick={(): void => setIsHoldingsCollapsed((prev) => !prev)}
                className={
                  'flex items-center gap-2 text-sm font-semibold text-neutral-900'
                }
                aria-expanded={!isHoldingsCollapsed}
              >
                <IconChevron
                  direction={isHoldingsCollapsed ? 'right' : 'down'}
                  className={
                    'size-4 text-neutral-600 transition-all duration-200'
                  }
                />
                <span>{'Your Vault Holdings'}</span>
              </button>
              {isHoldingsCollapsed && walletHoldingsCount > 0 ? (
                <div className={'flex flex-wrap items-center gap-2'}>
                  {sortedAllHoldings.map((vault) => (
                    <HoldingsPill
                      key={`pill_${vault.chainID}_${vault.address}`}
                      vault={vault}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            {shouldShowHoldings ? (
              <span className={'text-xs text-neutral-500'}>
                {walletHoldingsCount} vault
                {walletHoldingsCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          {!isHoldingsCollapsed && walletHoldingsCount > 0 ? (
            <div className={'grid gap-4 pt-2'}>
              {sortedAllHoldings.map((vault) => (
                <VaultsV3ListRow
                  key={`${vault.chainID}_${vault.address}`}
                  currentVault={vault}
                />
              ))}
            </div>
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
          potentialResultsCount={potentialResultsCount}
        />
      )
    }
    return (
      <Fragment>
        <div className={'border-b-4 border-neutral-200 pb-2'}>
          {renderHoldingsCard()}
        </div>
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
            <PortfolioCard />
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
