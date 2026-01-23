import Link from '@components/Link'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { SuggestedVaultCard } from '@pages/vaults/components/SuggestedVaultCard'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { Button } from '@shared/components/Button'
import { METRIC_VALUE_CLASS, MetricHeader, MetricsCard, type TMetricBlock } from '@shared/components/MetricsCard'
import { IconSpinner } from '@shared/icons/IconSpinner'
import type { TSortDirection } from '@shared/types'
import type { ReactElement } from 'react'
import { type TPortfolioModel, usePortfolioModel } from './hooks/usePortfolioModel'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

type TPortfolioHeaderProps = Pick<
  TPortfolioModel,
  | 'blendedMetrics'
  | 'isActive'
  | 'isHoldingsLoading'
  | 'isSearchingBalances'
  | 'totalPortfolioValue'
  | 'hasKatanaHoldings'
>

type TPortfolioHoldingsProps = Pick<
  TPortfolioModel,
  | 'hasHoldings'
  | 'holdingsRows'
  | 'isActive'
  | 'isHoldingsLoading'
  | 'openLoginModal'
  | 'sortBy'
  | 'sortDirection'
  | 'setSortBy'
  | 'setSortDirection'
  | 'vaultFlags'
>

type TPortfolioSuggestedProps = Pick<TPortfolioModel, 'suggestedRows'>

function PortfolioPageLayout({ children }: { children: ReactElement }): ReactElement {
  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-8'}>
      <div className={'mx-auto flex w-full max-w-[1232px] flex-col gap-4 px-4 pb-16 sm:gap-5'}>{children}</div>
    </div>
  )
}

function HoldingsEmptyState({ isActive, onConnect }: { isActive: boolean; onConnect: () => void }): ReactElement {
  return (
    <div className={'flex flex-col items-center justify-center gap-4 px-4 py-12 text-center sm:px-6 sm:py-16'}>
      <p className={'text-base font-semibold text-text-primary sm:text-lg'}>
        {isActive ? 'No vault positions yet' : 'Connect a wallet to get started'}
      </p>
      <p className={'max-w-md text-sm text-text-secondary'}>
        {isActive ? 'Deposit into a Yearn vault to see it here.' : 'Link a wallet to load your Yearn balances.'}
      </p>
      {isActive ? (
        <Link to="/vaults" className={'yearn--button min-h-[44px] px-6'} data-variant={'filled'}>
          {'Browse vaults'}
        </Link>
      ) : (
        <Button onClick={onConnect} variant={'filled'} className={'min-h-[44px] px-6'}>
          {'Connect wallet'}
        </Button>
      )}
    </div>
  )
}

function PortfolioHeaderSection({
  blendedMetrics,
  isActive,
  isHoldingsLoading,
  isSearchingBalances,
  totalPortfolioValue,
  hasKatanaHoldings
}: TPortfolioHeaderProps): ReactElement {
  const metrics: TMetricBlock[] = [
    {
      key: 'total-balance',
      header: <MetricHeader label={'Total Balance'} tooltip={'Total USD value of all your vault deposits.'} />,
      value: (
        <span className={METRIC_VALUE_CLASS}>
          {isSearchingBalances ? (
            <span
              className={'inline-flex h-6 w-20 items-center justify-center rounded bg-surface-secondary animate-pulse'}
            >
              <IconSpinner className={'size-4 text-text-secondary'} />
            </span>
          ) : (
            currencyFormatter.format(totalPortfolioValue)
          )}
        </span>
      )
    },
    {
      key: 'current-apy',
      header: (
        <MetricHeader label={'Current APY'} tooltip={'Weighted by your total deposits across all Yearn vaults.'} />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS}>
          {isHoldingsLoading ? (
            <span className={'inline-flex h-6 w-14 items-center justify-center animate-spin'}>
              <IconSpinner className={'size-4 text-text-secondary'} />
            </span>
          ) : blendedMetrics.blendedCurrentAPY !== null ? (
            `${percentFormatter.format(blendedMetrics.blendedCurrentAPY)}%`
          ) : (
            '—'
          )}
        </span>
      )
    },
    {
      key: '30-day-apy',
      header: (
        <MetricHeader label={'30-day APY'} tooltip={'Blended 30-day performance using your current positions.'} />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS}>
          {isHoldingsLoading ? (
            <span className={'inline-flex h-6 w-14 items-center justify-center animate-spin'}>
              <IconSpinner className={'size-4 text-text-secondary'} />
            </span>
          ) : blendedMetrics.blendedHistoricalAPY !== null ? (
            `${percentFormatter.format(blendedMetrics.blendedHistoricalAPY)}%`
          ) : (
            '—'
          )}
        </span>
      )
    },
    {
      key: 'est-annual',
      header: (
        <MetricHeader label={'Est. Annual'} tooltip={'Projects potential returns based on your blended current APY.'} />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS}>
          {isHoldingsLoading ? (
            <span
              className={'inline-flex h-6 w-20 items-center justify-center rounded bg-surface-secondary animate-pulse'}
            >
              <IconSpinner className={'size-4 text-text-secondary'} />
            </span>
          ) : blendedMetrics.estimatedAnnualReturn !== null ? (
            currencyFormatter.format(blendedMetrics.estimatedAnnualReturn)
          ) : (
            '—'
          )}
        </span>
      )
    }
  ]

  return (
    <section className={'flex flex-col gap-3 sm:gap-4'}>
      <Breadcrumbs
        className={'px-1'}
        items={[
          { label: 'Home', href: '/' },
          { label: 'Account Overview', isCurrent: true }
        ]}
      />
      <div className={'px-1'}>
        <h1 className={'text-lg font-black text-text-primary md:text-3xl md:leading-10'}>{'Account Overview'}</h1>
        <p className={'mt-1.5 text-sm text-text-secondary'}>
          {'Monitor your balances, returns, and discover new vaults.'}
        </p>
      </div>
      {isActive ? <MetricsCard items={metrics} /> : null}
    </section>
  )
}

function PortfolioHoldingsSection({
  hasHoldings,
  holdingsRows,
  isActive,
  isHoldingsLoading,
  openLoginModal,
  sortBy,
  sortDirection,
  setSortBy,
  setSortDirection,
  vaultFlags
}: TPortfolioHoldingsProps): ReactElement {
  const handleSort = (newSortBy: string, newDirection: TSortDirection): void => {
    setSortBy(newSortBy as TPossibleSortBy)
    setSortDirection(newDirection)
  }

  return (
    <section className={'flex flex-col gap-3 sm:gap-4'}>
      <div className={'flex flex-wrap items-center justify-between gap-3 sm:gap-4'}>
        <div>
          <h2 className={'text-xl font-semibold text-text-primary sm:text-2xl'}>{'Your vaults'}</h2>
          <p className={'text-xs text-text-secondary sm:text-sm'}>{'Track every Yearn position you currently hold.'}</p>
        </div>
        {hasHoldings ? (
          <Link to="/vaults" className={'yearn--button min-h-[44px] px-4 text-sm'} data-variant={'light'}>
            {'Browse more vaults'}
          </Link>
        ) : null}
      </div>
      <div className={'overflow-hidden rounded-lg border border-border'}>
        <div className={'flex flex-col'}>
          <VaultsListHead
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
            wrapperClassName={'rounded-t-lg bg-surface-secondary'}
            containerClassName={'rounded-t-lg bg-surface-secondary'}
            items={[
              {
                type: 'sort',
                label: 'Vault Name',
                value: 'vault',
                sortable: false,
                className: 'col-span-12'
              },
              {
                type: 'sort',
                label: 'Est. APY',
                value: 'estAPY',
                sortable: true,
                className: 'col-span-4'
              },
              {
                type: 'sort',
                label: 'TVL',
                value: 'tvl',
                sortable: true,
                className: 'col-span-4'
              },
              {
                type: 'sort',
                label: 'Your Holdings',
                value: 'deposited',
                sortable: true,
                className: 'col-span-4 justify-end'
              }
            ]}
          />
          {isHoldingsLoading ? (
            <div
              className={
                'flex flex-col items-center justify-center gap-3 px-4 py-12 text-sm text-text-secondary sm:px-6 sm:py-16'
              }
            >
              <IconSpinner className={'size-5 text-text-secondary sm:size-6'} />
              <span>{'Searching for Yearn balances...'}</span>
            </div>
          ) : hasHoldings ? (
            <div className={'flex flex-col gap-px bg-border'}>
              {holdingsRows.map((row) => (
                <VaultsListRow
                  key={row.key}
                  currentVault={row.vault}
                  flags={vaultFlags[row.key]}
                  hrefOverride={row.hrefOverride}
                  showBoostDetails={false}
                  activeProductType={'all'}
                  showStrategies
                  showAllocatorChip={false}
                />
              ))}
            </div>
          ) : (
            <HoldingsEmptyState isActive={isActive} onConnect={openLoginModal} />
          )}
        </div>
      </div>
    </section>
  )
}

function PortfolioSuggestedSection({ suggestedRows }: TPortfolioSuggestedProps): ReactElement | null {
  if (suggestedRows.length === 0) {
    return null
  }

  return (
    <section className={'flex flex-col gap-3 sm:gap-4'}>
      <div>
        <h2 className={'text-xl font-semibold text-text-primary sm:text-2xl'}>{'You might like'}</h2>
        <p className={'text-xs text-text-secondary sm:text-sm'}>
          {'Vaults picked for you based on performance and popularity.'}
        </p>
      </div>
      <div className={'grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 xl:grid-cols-4'}>
        {suggestedRows.map((row) => (
          <SuggestedVaultCard key={row.key} vault={row.vault} />
        ))}
      </div>
    </section>
  )
}

function PortfolioPage(): ReactElement {
  const model = usePortfolioModel()

  return (
    <PortfolioPageLayout>
      {/** biome-ignore lint/complexity/noUselessFragments: <lint error without> */}
      <>
        <PortfolioHeaderSection
          blendedMetrics={model.blendedMetrics}
          isActive={model.isActive}
          isHoldingsLoading={model.isHoldingsLoading}
          isSearchingBalances={model.isSearchingBalances}
          hasKatanaHoldings={model.hasKatanaHoldings}
          totalPortfolioValue={model.totalPortfolioValue}
        />
        <PortfolioHoldingsSection
          hasHoldings={model.hasHoldings}
          holdingsRows={model.holdingsRows}
          isActive={model.isActive}
          isHoldingsLoading={model.isHoldingsLoading}
          openLoginModal={model.openLoginModal}
          sortBy={model.sortBy}
          sortDirection={model.sortDirection}
          setSortBy={model.setSortBy}
          setSortDirection={model.setSortDirection}
          vaultFlags={model.vaultFlags}
        />
        <PortfolioSuggestedSection suggestedRows={model.suggestedRows} />
      </>
    </PortfolioPageLayout>
  )
}

export default PortfolioPage
