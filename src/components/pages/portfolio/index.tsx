import Link from '@components/Link'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { SuggestedVaultCard } from '@pages/vaults/components/SuggestedVaultCard'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { Button } from '@shared/components/Button'
import { Tooltip } from '@shared/components/Tooltip'
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
      <div className={'mx-auto flex w-full max-w-[1232px] flex-col gap-5 px-4 pb-16'}>{children}</div>
    </div>
  )
}

function HoldingsEmptyState({ isActive, onConnect }: { isActive: boolean; onConnect: () => void }): ReactElement {
  return (
    <div className={'flex flex-col items-center justify-center gap-4 px-6 py-16 text-center'}>
      <p className={'text-lg font-semibold text-text-primary'}>
        {isActive ? 'No vault positions yet' : 'Connect a wallet to get started'}
      </p>
      <p className={'max-w-md text-sm text-text-secondary'}>
        {isActive ? 'Deposit into a Yearn vault to see it here.' : 'Link a wallet to load your Yearn balances.'}
      </p>
      {isActive ? (
        <Link to="/vaults" className={'yearn--button'} data-variant={'filled'}>
          {'Browse vaults'}
        </Link>
      ) : (
        <Button onClick={onConnect} variant={'filled'}>
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
  const tooltipContent = (
    <div className={'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary'}>
      <p>{'*One or more vaults are receiving extra incentives.'}</p>
      <p>{'*There may be conditions to earn this rate.'}</p>
    </div>
  )
  const renderApyValue = (value: string, shouldShowAsterisk: boolean): ReactElement => {
    if (!shouldShowAsterisk) {
      return <span>{value}</span>
    }
    return (
      <span className={'relative inline-flex items-center'}>
        {value}
        <Tooltip
          className={
            '!absolute cursor-default left-full -top-2 ml-px !h-auto !w-auto !gap-0 !justify-start md:!justify-start'
          }
          openDelayMs={150}
          side={'right'}
          tooltip={tooltipContent}
        >
          <span className={'text-md text-text-secondary hover:text-accent-500'}>{'*'}</span>
        </Tooltip>
      </span>
    )
  }

  const renderTitleWithTooltip = (label: string, tooltip: string | null): ReactElement => {
    const labelClasses =
      'text-sm font-semibold uppercase tracking-wide text-text-secondary cursor-pointer underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:decoration-neutral-600'
    if (!tooltip) {
      return <span className={'text-sm font-semibold uppercase tracking-wide text-text-secondary'}>{label}</span>
    }
    return (
      <Tooltip
        className={'gap-0 h-auto justify-start md:justify-start'}
        openDelayMs={150}
        side={'top'}
        tooltip={
          <div className={'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary'}>
            {tooltip}
          </div>
        }
      >
        <span className={labelClasses}>{label}</span>
      </Tooltip>
    )
  }

  return (
    <section className={'flex flex-col gap-4'}>
      <Breadcrumbs
        className={'mt-2'}
        items={[
          { label: 'Home', href: '/' },
          { label: 'Account Overview', isCurrent: true }
        ]}
      />
      <div>
        <h1 className={'text-4xl font-black text-text-primary'}>{'Account Overview'}</h1>
        <p className={'mt-2 text-base text-text-secondary'}>
          {'Monitor your balances, returns, and discover new vaults.'}
        </p>
      </div>
      {isActive ? (
        <div>
          <div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
            <div className={'rounded-3xl border border-border bg-surface p-6'}>
              <p className={'text-sm font-semibold uppercase tracking-wide text-text-secondary'}>{'Total balance'}</p>
              <p className={'mt-3 text-3xl font-black text-text-primary'}>
                {isSearchingBalances ? (
                  <span
                    className={
                      'inline-flex h-9 w-40 items-center justify-center rounded-xl bg-surface-secondary animate-pulse'
                    }
                  >
                    <IconSpinner className={'h-4 w-4 text-text-secondary'} />
                  </span>
                ) : (
                  currencyFormatter.format(totalPortfolioValue)
                )}
              </p>
            </div>

            <div className={'rounded-3xl border border-border bg-surface p-6'}>
              <div>
                {renderTitleWithTooltip(
                  'Blended Current APY',
                  'Weighted by your total deposits across all Yearn vaults.'
                )}
              </div>
              <div className={'mt-3 text-3xl font-black text-text-primary'}>
                {isHoldingsLoading ? (
                  <span className={'inline-flex h-9 w-20 items-center justify-center animate-spin'}>
                    <IconSpinner className={'h-5 w-5 text-text-secondary'} />
                  </span>
                ) : blendedMetrics.blendedCurrentAPY !== null ? (
                  renderApyValue(`${percentFormatter.format(blendedMetrics.blendedCurrentAPY)}%`, hasKatanaHoldings)
                ) : (
                  '—'
                )}
              </div>
            </div>

            <div className={'rounded-3xl border border-border bg-surface p-6'}>
              <div>
                {renderTitleWithTooltip(
                  'Blended 30-day APY',
                  'Blended 30-day performance using your current positions.'
                )}
              </div>
              <div className={'mt-3 text-3xl font-black text-text-primary'}>
                {isHoldingsLoading ? (
                  <span className={'inline-flex h-9 w-20 items-center justify-center animate-spin'}>
                    <IconSpinner className={'h-5 w-5 text-text-secondary'} />
                  </span>
                ) : blendedMetrics.blendedHistoricalAPY !== null ? (
                  renderApyValue(`${percentFormatter.format(blendedMetrics.blendedHistoricalAPY)}%`, hasKatanaHoldings)
                ) : (
                  '—'
                )}
              </div>
            </div>

            <div className={'rounded-3xl border border-border bg-surface p-6'}>
              <div>
                {renderTitleWithTooltip(
                  'Estimated Annual Return',
                  'Projects potential returns based on your blended current APY.'
                )}
              </div>
              <div className={'mt-3 text-3xl font-black text-text-primary'}>
                {isHoldingsLoading ? (
                  <span
                    className={
                      'inline-flex h-9 w-40 items-center justify-center rounded-xl bg-surface-secondary animate-pulse'
                    }
                  >
                    <IconSpinner className={'h-4 w-4 text-text-secondary'} />
                  </span>
                ) : blendedMetrics.estimatedAnnualReturn !== null ? (
                  currencyFormatter.format(blendedMetrics.estimatedAnnualReturn)
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
    <section className={'flex flex-col gap-4'}>
      <div className={'flex flex-wrap items-center justify-between gap-4'}>
        <div>
          <h2 className={'text-2xl font-semibold text-text-primary'}>{'Your vaults'}</h2>
          <p className={'text-sm text-text-secondary'}>{'Track every Yearn position you currently hold.'}</p>
        </div>
        {hasHoldings ? (
          <Link to="/vaults" className={'yearn--button text-sm'} data-variant={'light'}>
            {'Browse more vaults'}
          </Link>
        ) : null}
      </div>
      <div className={'overflow-hidden rounded-3xl border border-border'}>
        <div className={'flex flex-col'}>
          <VaultsListHead
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
            wrapperClassName={'rounded-t-3xl bg-surface-secondary'}
            containerClassName={'rounded-t-3xl bg-surface-secondary'}
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
            <div className={'flex flex-col items-center justify-center gap-3 px-6 py-16 text-sm text-text-secondary'}>
              <IconSpinner className={'h-6 w-6 text-text-secondary'} />
              <span>{'Searching for Yearn balances...'}</span>
            </div>
          ) : hasHoldings ? (
            <div className={'flex flex-col gap-px'}>
              {holdingsRows.map((row) => (
                <VaultsListRow
                  key={row.key}
                  currentVault={row.vault}
                  flags={vaultFlags[row.key]}
                  hrefOverride={row.hrefOverride}
                  showBoostDetails={false}
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
    <section className={'flex flex-col gap-4'}>
      <div>
        <h2 className={'text-2xl font-semibold text-text-primary'}>{'You might like'}</h2>
        <p className={'text-sm text-text-secondary'}>{'Vaults picked for you based on performance and popularity.'}</p>
      </div>
      <div className={'grid gap-4 md:grid-cols-2 xl:grid-cols-4'}>
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
