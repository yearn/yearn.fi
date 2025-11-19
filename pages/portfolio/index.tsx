import Link from '@components/Link'
import { Button } from '@lib/components/Button'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import type { TSortDirection } from '@lib/types'
import { cl, isZero, toAddress } from '@lib/utils'
import { formatPercent } from '@lib/utils/format'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { VaultsV3ListHead } from '@vaults-v3/components/list/VaultsV3ListHead'
import { VaultsV3ListRow } from '@vaults-v3/components/list/VaultsV3ListRow'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'

const TIMEFRAMES = ['1H', '1D', '1W', '1M', '1Y', 'ALL'] as const

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

type TAprDisplay =
  | {
      type: 'value'
      prefix?: string
      value: number
    }
  | {
      type: 'range'
      prefix?: string
      range: [number, number]
    }

function SuggestedVaultCard({ vault }: { vault: TYDaemonVault }): ReactElement {
  const apyData = useVaultApyData(vault)
  const aprDisplay = useMemo<TAprDisplay>(() => {
    const isVeYfi = vault.staking.source === 'VeYFI'
    const boostedApr = apyData.baseForwardApr + apyData.rewardsAprSum
    if (apyData.mode === 'katana' && apyData.katanaTotalApr !== undefined) {
      return { type: 'value', prefix: '⚔️', value: apyData.katanaTotalApr }
    }
    if (apyData.mode === 'rewards') {
      if (isVeYfi && apyData.estAprRange) {
        return { type: 'range', prefix: '⚡️', range: apyData.estAprRange }
      }
      return { type: 'value', prefix: '⚡️', value: boostedApr }
    }
    if (apyData.mode === 'boosted' && apyData.isBoosted) {
      return { type: 'value', prefix: '🚀', value: apyData.baseForwardApr }
    }
    if (!isZero(apyData.baseForwardApr)) {
      return { type: 'value', value: apyData.baseForwardApr }
    }
    return { type: 'value', prefix: 'Hist.', value: apyData.netApr }
  }, [apyData, vault])

  const chain = getNetwork(vault.chainID)
  const tokenIcon = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${toAddress(
    vault.token.address
  ).toLowerCase()}/logo-128.png`

  const renderAprValue = (): string => {
    if (aprDisplay.type === 'range') {
      return `${formatPercent(aprDisplay.range[0] * 100, 2, 2)} – ${formatPercent(aprDisplay.range[1] * 100, 2, 2)}`
    }
    return formatPercent(aprDisplay.value * 100, 2, 2)
  }

  return (
    <Link
      to={`/vaults-beta/${vault.chainID}/${toAddress(vault.address)}`}
      className={
        'group flex h-full flex-col rounded-2xl border border-neutral-200 bg-neutral-0 p-5 shadow-[0_12px_32px_rgba(4,8,32,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(4,8,32,0.12)]'
      }
    >
      <div className={'flex items-center gap-3'}>
        <div className={'size-12 rounded-full bg-neutral-100 p-2'}>
          <ImageWithFallback src={tokenIcon} alt={vault.token.symbol || ''} width={40} height={40} />
        </div>
        <div className={'flex flex-col'}>
          <p className={'text-base font-semibold text-neutral-900'}>{vault.name}</p>
          <p className={'text-xs text-neutral-600'}>
            {chain.name} • {vault.category}
          </p>
        </div>
      </div>
      <div className={'mt-6 flex items-end justify-between gap-4'}>
        <div>
          <p className={'text-xs font-semibold uppercase tracking-wide text-neutral-500'}>{'Est. APY'}</p>
          <p className={'mt-1 text-2xl font-bold text-neutral-900'}>
            {aprDisplay.prefix ? `${aprDisplay.prefix} ` : ''}
            {renderAprValue()}
          </p>
        </div>
        <div className={'text-right'}>
          <p className={'text-xs font-semibold uppercase tracking-wide text-neutral-500'}>{'TVL'}</p>
          <p className={'mt-1 text-lg font-semibold text-neutral-900'}>
            <RenderAmount
              value={vault.tvl?.tvl || 0}
              symbol={'USD'}
              decimals={0}
              options={{ shouldCompactValue: true, maximumFractionDigits: 2, minimumFractionDigits: 0 }}
            />
          </p>
        </div>
      </div>
      <div
        className={
          'mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0657F9] transition-colors group-hover:text-[#0543c0]'
        }
      >
        <span>{'View vault'}</span>
        <span aria-hidden>{'→'}</span>
      </div>
    </Link>
  )
}

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
    <div className={'mx-auto flex w-full max-w-[1232px] flex-col gap-10 bg-neutral-0 px-4 pb-16 pt-20'}>
      <section className={'flex flex-col gap-6'}>
        <div className={'flex items-center gap-2 text-sm text-neutral-500'}>
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
            <p className={'text-sm text-neutral-600'}>{'Vaults picked for you based on performance and popularity.'}</p>
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
  )
}

export default PortfolioPage
