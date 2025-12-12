import Link from '@components/Link'
import { Button } from '@lib/components/Button'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import type { TSortDirection } from '@lib/types'
import { cl, toAddress } from '@lib/utils'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { VaultsV3ListHead } from '@vaults-v3/components/list/VaultsV3ListHead'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'
import { SuggestedVaultCard } from '@vaults-v3/components/SuggestedVaultCard'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'

const TIMEFRAMES = ['1H', '1D', '1W', '1M', '1Y', 'ALL'] as const

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function HoldingsEmptyState({ isActive, onConnect }: { isActive: boolean; onConnect: () => void }): ReactElement {
  return (
    <div className={'flex flex-col items-center justify-center gap-4 px-6 py-16 text-center'}>
      <p className={'text-lg font-semibold text-neutral-900'}>
        {isActive ? 'No vault positions yet' : 'Connect a wallet to get started'}
      </p>
      <p className={'max-w-md text-sm text-neutral-600'}>
        {isActive ? 'Deposit into a Yearn v3 vault to see it here.' : 'Link a wallet to load your Yearn balances.'}
      </p>
      {isActive ? (
        <Link to="/v3" className={'yearn--button'} data-variant={'filled'}>
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

function PortfolioPage(): ReactElement {
  const { cumulatedValueInV3Vaults } = useWallet()
  const { isActive, openLoginModal } = useWeb3()
  const { holdingsVaults, filteredVaults, vaultFlags, isLoading } = useV3VaultFilter(null, null, '', null)
  const [selectedRange, setSelectedRange] = useState<(typeof TIMEFRAMES)[number]>('1W')
  const [sortBy, setSortBy] = useState<TPossibleSortBy>('deposited')
  const [sortDirection, setSortDirection] = useState<TSortDirection>('desc')

  const sortedHoldings = useSortVaults(holdingsVaults, sortBy, sortDirection)
  const sortedCandidates = useSortVaults(filteredVaults, 'featuringScore', 'desc')

  const holdingsKeySet = useMemo(
    () => new Set(sortedHoldings.map((vault) => `${vault.chainID}_${toAddress(vault.address)}`)),
    [sortedHoldings]
  )

  const suggestedVaults = useMemo(
    () =>
      sortedCandidates
        .filter((vault) => !holdingsKeySet.has(`${vault.chainID}_${toAddress(vault.address)}`))
        .slice(0, 4),
    [sortedCandidates, holdingsKeySet]
  )

  const hasHoldings = sortedHoldings.length > 0

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-8'}>
      <div className={'mx-auto flex w-full max-w-[1232px] flex-col gap-10 bg-surface px-4 pb-16'}>
        <section className={'flex flex-col gap-4'}>
          <div className={'flex items-center gap-2 mt-2 text-sm text-neutral-500'}>
            <Link to={'/'} className={'transition-colors hover:text-neutral-900'}>
              {'Home'}
            </Link>
            <span>{'>'}</span>
            <span className={'font-medium text-neutral-900'}>{'Account Overview'}</span>
          </div>
          <div>
            <h1 className={'text-4xl font-black text-neutral-900'}>{'Account Overview'}</h1>
            <p className={'mt-2 text-base text-neutral-600'}>
              {'Monitor your balances, returns, and discover new vaults.'}
            </p>
          </div>
          <div className={'grid grid-cols-1 gap-4 md:grid-cols-3'}>
            <div className={'rounded-3xl border border-neutral-200 bg-neutral-0 p-6 md:col-span-2'}>
              <div className={'flex flex-wrap items-center justify-between gap-4'}>
                <div>
                  <p className={'text-sm font-semibold uppercase tracking-wide text-neutral-500'}>{'Total balance'}</p>
                  <p className={'mt-1 text-3xl font-black text-neutral-900'}>
                    {currencyFormatter.format(cumulatedValueInV3Vaults || 0)}
                  </p>
                </div>
                <div className={'flex flex-wrap gap-2'}>
                  {TIMEFRAMES.map((range) => (
                    <button
                      key={range}
                      type={'button'}
                      onClick={(): void => setSelectedRange(range)}
                      className={cl(
                        'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                        selectedRange === range
                          ? 'bg-neutral-900 text-neutral-0'
                          : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className={
                  'mt-6 flex h-48 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#DCE6FF] via-[#F2EBFF] to-[#FFE7F3] text-sm text-neutral-600'
                }
              >
                {'Performance chart coming soon'}
              </div>
            </div>
            <div className={'rounded-3xl border border-neutral-200 bg-neutral-0 p-6'}>
              <p className={'text-sm font-semibold uppercase tracking-wide text-neutral-500'}>{'Total return'}</p>
              <p className={'mt-3 text-3xl font-black text-neutral-900'}>{'—'}</p>
              <p className={'mt-2 text-sm text-neutral-600'}>
                {'Return insights will appear here once this data becomes available.'}
              </p>
            </div>
          </div>
        </section>

        <section className={'flex flex-col gap-4'}>
          <div className={'flex flex-wrap items-center justify-between gap-4'}>
            <div>
              <h2 className={'text-2xl font-semibold text-neutral-900'}>{'Your vaults'}</h2>
              <p className={'text-sm text-neutral-600'}>{'Track every v3 position you currently hold.'}</p>
            </div>
            {hasHoldings ? (
              <Link to="/v3" className={'yearn--button text-sm'} data-variant={'light'}>
                {'Browse more vaults'}
              </Link>
            ) : null}
          </div>
          <div className={'overflow-hidden rounded-3xl border border-neutral-200'}>
            <div className={'flex flex-col'}>
              <VaultsV3ListHead
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={(newSortBy, newDirection): void => {
                  setSortBy(newSortBy as TPossibleSortBy)
                  setSortDirection(newDirection)
                }}
                wrapperClassName={'rounded-t-3xl bg-neutral-100'}
                containerClassName={'rounded-t-3xl bg-neutral-100'}
                items={[
                  {
                    type: 'sort',
                    label: 'Vault / Featuring Score',
                    value: 'featuringScore',
                    sortable: true,
                    className: 'col-span-9'
                  },
                  {
                    type: 'sort',
                    label: 'Est. APY',
                    value: 'estAPY',
                    sortable: true,
                    className: 'col-span-3'
                  },
                  {
                    type: 'sort',
                    label: 'Hist. APY',
                    value: 'APY',
                    sortable: true,
                    className: 'col-span-3'
                  },
                  {
                    type: 'sort',
                    label: 'Risk Level',
                    value: 'score',
                    sortable: true,
                    className: 'col-span-3 whitespace-nowrap'
                  },
                  {
                    type: 'sort',
                    label: 'Your Deposit',
                    value: 'deposited',
                    sortable: true,
                    className: 'col-span-3'
                  },
                  {
                    type: 'sort',
                    label: 'TVL',
                    value: 'tvl',
                    sortable: true,
                    className: 'col-span-3 justify-end'
                  }
                ]}
              />
              {isLoading ? (
                <div className={'flex items-center justify-center px-6 py-16 text-sm text-neutral-600'}>
                  {'Loading your vaults...'}
                </div>
              ) : hasHoldings ? (
                <div className={'flex flex-col gap-px'}>
                  {sortedHoldings.map((vault) => {
                    const key = `${vault.chainID}_${toAddress(vault.address)}`
                    return <VaultsV3ListRow key={key} currentVault={vault} flags={vaultFlags[key]} />
                  })}
                </div>
              ) : (
                <HoldingsEmptyState isActive={isActive} onConnect={openLoginModal} />
              )}
            </div>
          </div>
        </section>

        {suggestedVaults.length > 0 ? (
          <section className={'flex flex-col gap-4'}>
            <div>
              <h2 className={'text-2xl font-semibold text-neutral-900'}>{'You might also like'}</h2>
              <p className={'text-sm text-neutral-600'}>
                {'Vaults picked for you based on performance and popularity.'}
              </p>
            </div>
            <div className={'grid gap-4 md:grid-cols-2 xl:grid-cols-4'}>
              {suggestedVaults.map((vault) => {
                const key = `${vault.chainID}_${toAddress(vault.address)}`
                return <SuggestedVaultCard key={key} vault={vault} />
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default PortfolioPage
