import { Button } from '@lib/components/Button'
import { RenderAmount } from '@lib/components/RenderAmount'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
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
import { ALL_VAULTSV3_CATEGORIES, ALL_VAULTSV3_KINDS_KEYS } from '@vaults-v3/constants'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import { V3Mask } from '@vaults-v3/Mark'
import type { ReactElement, ReactNode } from 'react'
import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function V3Card(): ReactElement {
  return (
    <div className={'col-span-12 hidden w-full rounded-3xl bg-neutral-100 p-2 md:col-span-4 md:block'}>
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
          <RenderAmount shouldHideTooltip value={katanaApr} symbol={'percent'} decimals={6} />
        </>
      )
    }

    if (data.mode === 'rewards') {
      if (isVeYfi && data.estAprRange) {
        return (
          <>
            <span>{'⚡️ '}</span>
            <RenderAmount shouldHideTooltip value={data.estAprRange[0]} symbol={'percent'} decimals={6} />
            <span>{' → '}</span>
            <RenderAmount shouldHideTooltip value={data.estAprRange[1]} symbol={'percent'} decimals={6} />
          </>
        )
      }

      return (
        <>
          <span>{'⚡️ '}</span>
          <RenderAmount shouldHideTooltip value={boostedApr} symbol={'percent'} decimals={6} />
        </>
      )
    }

    if (data.mode === 'boosted' && data.isBoosted) {
      return (
        <>
          <span>{'🚀 '}</span>
          <RenderAmount shouldHideTooltip value={vault.apr.forwardAPR.netAPR} symbol={'percent'} decimals={6} />
          {data.boost ? (
            <span className={'text-[0.65rem] uppercase tracking-wide text-neutral-100/70'}>
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
          <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
        </>
      )
    }

    return (
      <>
        <span>{'Hist. '}</span>
        <RenderAmount shouldHideTooltip value={data.netApr} symbol={'percent'} decimals={6} />
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
          'relative z-10 flex items-center gap-2 rounded-full border border-[#D21162]/50 bg-[#2a1956eb] px-3 py-2 text-xs text-neutral-50 backdrop-blur-lg transition-colors hover:bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
        }
      >
        <span className={'max-w-[168px] truncate text-sm font-semibold text-neutral-50'}>{vault.name}</span>
        <span className={'flex flex-wrap items-center gap-1 text-xs text-neutral-50'}>
          <span className={'text-neutral-50/60'}>{'|'}</span>
          {apyContent}
        </span>
      </div>
    </button>
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
  // Single optimized hook call that returns all needed data
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()
  const {
    activeVaults,
    retiredVaults,
    migratableVaults,
    holdingsVaults,
    multiVaults,
    singleVaults,
    totalPotentialVaults,
    totalHoldingsVaults,
    totalMigratableVaults,
    totalRetiredVaults,
    isLoading: isLoadingVaultList
  } = useV3VaultFilter(types, chains, search || '', categories)
  const [isHoldingsCollapsed, setIsHoldingsCollapsed] = useState(true)
  const normalizedCategories = categories ?? []

  const vaultLists = useMemo((): {
    holdings: TYDaemonVault[]
    multi: TYDaemonVault[]
    single: TYDaemonVault[]
    all: TYDaemonVault[]
  } | null => {
    const combinedHoldings = new Map<string, TYDaemonVault>()

    for (const vault of holdingsVaults) {
      combinedHoldings.set(`${vault.chainID}_${vault.address}`, vault)
    }

    for (const vault of migratableVaults) {
      combinedHoldings.set(`${vault.chainID}_${vault.address}`, vault)
    }

    for (const vault of retiredVaults) {
      combinedHoldings.set(`${vault.chainID}_${vault.address}`, vault)
    }

    const holdingsArray = Array.from(combinedHoldings.values())
    const holdingsSet = new Set(combinedHoldings.keys())
    const nonHoldingsVaults = activeVaults.filter((vault) => !holdingsSet.has(`${vault.chainID}_${vault.address}`))

    const shouldShowEmptyState =
      isLoadingVaultList || (isZero(holdingsArray.length) && isZero(multiVaults.length) && isZero(singleVaults.length))

    if (shouldShowEmptyState) {
      return null
    }

    return {
      holdings: holdingsArray,
      multi: multiVaults,
      single: singleVaults,
      all: nonHoldingsVaults
    }
  }, [isLoadingVaultList, activeVaults, migratableVaults, retiredVaults, holdingsVaults, multiVaults, singleVaults])

  const { holdings, all } = vaultLists || {
    holdings: [],
    all: []
  }
  const shouldShowHoldings = normalizedCategories.includes('Your Holdings')

  const sortedHoldings = useSortVaults(holdings, sortBy, sortDirection)
  const sortedNonHoldings = useSortVaults(all, sortBy, sortDirection)
  const walletHoldingsCount = sortedHoldings.length
  const sortedAllHoldings = sortedHoldings

  // Calculate potential hidden results due to filters
  const currentResultsCount = (shouldShowHoldings ? sortedHoldings.length : 0) + sortedNonHoldings.length
  const hiddenByFiltersCount = totalPotentialVaults - currentResultsCount
  const hasHiddenResults = search && hiddenByFiltersCount > 0

  // Calculate hidden holdings due to filters (regardless of search)
  const hiddenHoldingsCount =
    totalHoldingsVaults + totalRetiredVaults + totalMigratableVaults - (shouldShowHoldings ? holdings.length : 0)
  const hasHiddenHoldings = hiddenHoldingsCount > 0 && shouldShowHoldings

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
    if (!hasHiddenResults && !hasHiddenHoldings) {
      return null
    }

    return (
      <div className={'flex flex-wrap items-center gap-2 text-xs text-neutral-600'}>
        {renderHiddenBadge()}
        {hasHiddenHoldings ? (
          <span>
            {hiddenHoldingsCount} {`holding${hiddenHoldingsCount > 1 ? 's' : ''} hidden by filters`}
          </span>
        ) : null}
      </div>
    )
  }

  const renderHoldingsCard = (): ReactNode => {
    const walletConnected = isActive && Boolean(address)
    if (!shouldShowHoldings) {
      return null
    }

    if (walletConnected && walletHoldingsCount === 0) {
      return null
    }

    if (!walletConnected) {
      return (
        <div className={'relative mb-2 rounded-3xl'}>
          <div className={'pointer-events-none absolute -inset-[2px] z-1 rounded-3xl border border-neutral-300'} />
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
                  'relative flex items-center justify-center overflow-hidden rounded-lg border-none px-6 py-3 text-center',
                  'group'
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
                    'pointer-events-none opacity-80 transition-opacity group-hover:opacity-100',
                    'bg-[linear-gradient(80deg,#D21162,#2C3DA6)]'
                  )}
                />
                <span className={'z-10 px-2 text-sm font-medium text-white md:text-base'}>
                  {'Connect wallet to view your vault balances.'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (walletHoldingsCount === 0) {
      return null
    }

    return (
      <div className={'relative mb-2 rounded-3xl'}>
        <div className={'pointer-events-none absolute -inset-[2px] z-1 rounded-3xl'} />
        <div
          className={
            'pointer-events-none absolute -inset-[2px] z-0 rounded-3xl bg-[linear-gradient(80deg,#2C3DA6,#D21162)] opacity-20'
          }
        />
        <div className={'relative z-10 rounded-3xl'}>
          <div className={'flex flex-wrap items-center justify-between gap-3 px-6 py-4'}>
            <div className={'flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-3'}>
              <button
                type={'button'}
                onClick={(): void => setIsHoldingsCollapsed((prev) => !prev)}
                className={'flex items-center gap-2 text-sm font-semibold text-neutral-900'}
                aria-expanded={!isHoldingsCollapsed}
              >
                <IconChevron
                  direction={isHoldingsCollapsed ? 'right' : 'down'}
                  className={'size-4 text-neutral-600 transition-all duration-200'}
                />
                <span>{'Your Vault Holdings'}</span>
              </button>
              {isHoldingsCollapsed && walletHoldingsCount > 0 ? (
                <div className={'flex flex-wrap items-center gap-2'}>
                  {sortedAllHoldings.map((vault) => (
                    <HoldingsPill key={`pill_${vault.chainID}_${vault.address}`} vault={vault} />
                  ))}
                </div>
              ) : null}
            </div>
            {shouldShowHoldings ? (
              <span className={'text-xs text-neutral-500'}>
                {walletHoldingsCount} vault{walletHoldingsCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          {!isHoldingsCollapsed && walletHoldingsCount > 0 ? (
            <div className={'grid gap-4 pt-2'}>
              {sortedAllHoldings.map((vault) => (
                <VaultsV3ListRow key={`${vault.chainID}_${vault.address}`} currentVault={vault} />
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
          potentialResultsCount={totalPotentialVaults}
        />
      )
    }

    return (
      <Fragment>
        <div className={'border-b-4 border-neutral-200 pb-2'}>{renderHoldingsCard()}</div>
        {sortedNonHoldings.map((vault) => (
          <VaultsV3ListRow key={`${vault.chainID}_${vault.address}`} currentVault={vault} />
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
              label: 'Vault',
              value: 'name',
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
    defaultCategories: Object.values(ALL_VAULTSV3_CATEGORIES),
    defaultPathname: '/v3'
  })

  return (
    <div
      className={
        'relative z-50 mx-auto grid w-full max-w-[1232px] grid-cols-12 gap-4 bg-neutral-0 px-4 pb-8 pt-20 md:gap-6'
      }
    >
      <V3Card />
      <ListOfVaults {...queryArgs} />
    </div>
  )
}

export default Index
