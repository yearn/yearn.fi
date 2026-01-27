import Link from '@components/Link'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { Notification } from '@pages/vaults/components/notifications/Notification'
import { SuggestedVaultCard } from '@pages/vaults/components/SuggestedVaultCard'
import { MerkleRewardRow } from '@pages/vaults/components/widget/rewards/MerkleRewardRow'
import { StakingRewardRow } from '@pages/vaults/components/widget/rewards/StakingRewardRow'
import { TransactionOverlay, type TransactionStep } from '@pages/vaults/components/widget/shared/TransactionOverlay'
import { useMerkleRewards } from '@pages/vaults/hooks/rewards/useMerkleRewards'
import { useStakingRewards } from '@pages/vaults/hooks/rewards/useStakingRewards'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { Button } from '@shared/components/Button'
import { METRIC_VALUE_CLASS, MetricHeader, MetricsCard, type TMetricBlock } from '@shared/components/MetricsCard'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconSpinner } from '@shared/icons/IconSpinner'
import type { TSortDirection } from '@shared/types'
import { cl, SUPPORTED_NETWORKS } from '@shared/utils'
import { formatUSD } from '@shared/utils/format'
import { getVaultName } from '@shared/utils/helpers'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
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

const PORTFOLIO_TABS = [
  { key: 'positions', label: 'Positions' },
  { key: 'activity', label: 'Activity' },
  { key: 'claim-rewards', label: 'Claim Rewards' }
] as const

type TPortfolioTabKey = (typeof PORTFOLIO_TABS)[number]['key']

type TRewardCardStatus = {
  hasRewards: boolean
  isLoading: boolean
}

type TPortfolioHeaderProps = Pick<
  TPortfolioModel,
  'blendedMetrics' | 'isActive' | 'isHoldingsLoading' | 'isSearchingBalances' | 'totalPortfolioValue'
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

type TPortfolioActivityProps = Pick<TPortfolioModel, 'isActive' | 'openLoginModal'>

type TPortfolioClaimRewardsProps = Pick<TPortfolioModel, 'holdingsRows' | 'isActive' | 'openLoginModal'>

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
  totalPortfolioValue
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

function PortfolioTabSelector({
  activeTab,
  onSelectTab
}: {
  activeTab: TPortfolioTabKey
  onSelectTab: (tab: TPortfolioTabKey) => void
}): ReactElement {
  return (
    <div className={'flex flex-wrap gap-2 md:gap-3 w-full'}>
      <div
        className={
          'flex w-full flex-wrap justify-between gap-2 rounded-lg border border-border bg-surface-secondary p-1'
        }
      >
        {PORTFOLIO_TABS.map((tab) => (
          <button
            key={tab.key}
            type={'button'}
            onClick={() => onSelectTab(tab.key)}
            className={cl(
              'flex-1 min-w-[120px] rounded-md px-3 py-2 text-xs font-semibold transition-all md:min-w-0 md:flex-1 md:px-4 md:py-2.5',
              'border border-transparent focus-visible:outline-none focus-visible:ring-0',
              'min-h-[36px] active:scale-[0.98]',
              activeTab === tab.key
                ? 'bg-surface text-text-primary !border-border'
                : 'bg-transparent text-text-secondary hover:text-text-primary'
            )}
            aria-pressed={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PortfolioActivitySection({ isActive, openLoginModal }: TPortfolioActivityProps): ReactElement {
  const { cachedEntries, isLoading, error } = useNotifications()
  const hasEntries = cachedEntries.length > 0

  return (
    <section className={'flex flex-col gap-3 sm:gap-4'}>
      <div>
        <h2 className={'text-xl font-semibold text-text-primary sm:text-2xl'}>{'Activity'}</h2>
        <p className={'text-xs text-text-secondary sm:text-sm'}>{'Review your recent Yearn transactions.'}</p>
      </div>
      {!isActive ? (
        <div className={'rounded-lg border border-border bg-surface p-6 text-center'}>
          <p className={'text-sm font-semibold text-text-primary'}>{'Connect a wallet to view activity.'}</p>
          <p className={'mt-2 text-xs text-text-secondary'}>
            {'Track deposits, withdrawals, and claims in one place.'}
          </p>
          <Button onClick={openLoginModal} variant={'filled'} className={'mt-4 min-h-[40px] px-5 text-sm'}>
            {'Connect wallet'}
          </Button>
        </div>
      ) : (
        <div className={'rounded-lg border border-border bg-surface p-4'}>
          {isLoading ? (
            <div className={'flex flex-col items-center justify-center gap-2 py-6 text-sm text-text-secondary'}>
              <IconSpinner className={'size-5 animate-spin text-text-secondary'} />
              <span>{'Loading activity...'}</span>
            </div>
          ) : error ? (
            <div className={'py-6 text-center'}>
              <p className={'text-sm font-medium text-red-600'}>{'Error loading activity'}</p>
              <p className={'mt-2 text-xs text-text-secondary'}>{error}</p>
            </div>
          ) : !hasEntries ? (
            <div className={'py-6 text-center text-sm text-text-secondary'}>{'No transactions to show.'}</div>
          ) : (
            <div className={'flex flex-col'}>
              {cachedEntries.toReversed().map((entry) => (
                <Notification key={`notification-${entry.id}`} notification={entry} variant={'v3'} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function VaultStakingRewardsCard({
  vault,
  userAddress,
  isActive,
  onStatusChange
}: {
  vault: TYDaemonVault
  userAddress?: `0x${string}`
  isActive: boolean
  onStatusChange: (key: string, status: TRewardCardStatus) => void
}): ReactElement | null {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<TransactionStep | undefined>()

  const stakingAddress = vault.staking.available ? vault.staking.address : undefined
  const rewardTokens = useMemo(
    () =>
      (vault.staking.rewards ?? []).map((reward) => ({
        address: reward.address,
        symbol: reward.symbol,
        decimals: reward.decimals,
        price: reward.price,
        isFinished: reward.isFinished
      })),
    [vault.staking.rewards]
  )

  const isEnabled = isActive && !!stakingAddress && rewardTokens.length > 0
  const { rewards, isLoading, refetch } = useStakingRewards({
    stakingAddress,
    stakingSource: vault.staking.source,
    rewardTokens,
    userAddress,
    chainId: vault.chainID,
    enabled: isEnabled
  })

  const hasRewards = rewards.length > 0
  const totalUsd = useMemo(() => rewards.reduce((acc, reward) => acc + reward.usdValue, 0), [rewards])
  const cardKey = useMemo(() => `vault-${getVaultKey(vault)}`, [vault])

  useEffect(() => {
    onStatusChange(cardKey, { hasRewards, isLoading })
  }, [cardKey, hasRewards, isLoading, onStatusChange])

  const handleStartClaim = useCallback((step: TransactionStep) => {
    setActiveStep(step)
    setIsOverlayOpen(true)
  }, [])

  const handleClaimComplete = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    refetch()
  }, [refetch])

  const handleOverlayClose = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
  }, [])

  if (!isEnabled || !hasRewards) {
    return null
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-2 bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Claimable Rewards</span>
            <span className="text-sm font-semibold text-text-primary">{getVaultName(vault)}</span>
          </div>
          <span className="text-lg font-bold text-text-primary">{formatUSD(totalUsd, 2, 2)}</span>
        </div>
      </div>
      <div className="h-px w-full bg-border" />
      <div className="p-4">
        {rewards.map((reward, index) => (
          <StakingRewardRow
            key={`${reward.tokenAddress}-${reward.amount}`}
            reward={reward}
            stakingAddress={stakingAddress!}
            stakingSource={vault.staking.source ?? ''}
            chainId={vault.chainID}
            onStartClaim={handleStartClaim}
            isLast={index === rewards.length - 1}
          />
        ))}
      </div>
      <TransactionOverlay
        isOpen={isOverlayOpen}
        onClose={handleOverlayClose}
        step={activeStep}
        isLastStep={true}
        onAllComplete={handleClaimComplete}
        topOffset="0"
        contentAlign="center"
      />
    </div>
  )
}

function ChainMerkleRewardsCard({
  chainId,
  userAddress,
  isActive,
  onStatusChange
}: {
  chainId: number
  userAddress?: `0x${string}`
  isActive: boolean
  onStatusChange: (key: string, status: TRewardCardStatus) => void
}): ReactElement | null {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<TransactionStep | undefined>()

  const isEnabled = isActive && !!userAddress
  const { groupedRewards, isLoading, refetch } = useMerkleRewards({
    userAddress,
    chainId,
    enabled: isEnabled
  })

  const hasRewards = groupedRewards.length > 0
  const totalUsd = useMemo(
    () => groupedRewards.reduce((acc, reward) => acc + reward.totalUsdValue, 0),
    [groupedRewards]
  )
  const cardKey = useMemo(() => `merkle-${chainId}`, [chainId])
  const chainLabel = useMemo(
    () => SUPPORTED_NETWORKS.find((network) => network.id === chainId)?.name ?? `Chain ${chainId}`,
    [chainId]
  )

  useEffect(() => {
    onStatusChange(cardKey, { hasRewards, isLoading })
  }, [cardKey, hasRewards, isLoading, onStatusChange])

  const handleStartClaim = useCallback((step: TransactionStep) => {
    setActiveStep(step)
    setIsOverlayOpen(true)
  }, [])

  const handleClaimComplete = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    refetch()
  }, [refetch])

  const handleOverlayClose = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
  }, [])

  if (!isEnabled || !hasRewards) {
    return null
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-2 bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Claimable Rewards</span>
            <span className="text-sm font-semibold text-text-primary">{chainLabel}</span>
          </div>
          <span className="text-lg font-bold text-text-primary">{formatUSD(totalUsd, 2, 2)}</span>
        </div>
      </div>
      <div className="h-px w-full bg-border" />
      <div className="p-4">
        {groupedRewards.map((groupedReward, index) => (
          <MerkleRewardRow
            key={groupedReward.token.address}
            groupedReward={groupedReward}
            userAddress={userAddress!}
            chainId={chainId}
            onStartClaim={handleStartClaim}
            isLast={index === groupedRewards.length - 1}
          />
        ))}
      </div>
      <TransactionOverlay
        isOpen={isOverlayOpen}
        onClose={handleOverlayClose}
        step={activeStep}
        isLastStep={true}
        onAllComplete={handleClaimComplete}
        topOffset="0"
        contentAlign="center"
      />
    </div>
  )
}

function PortfolioClaimRewardsSection({
  holdingsRows,
  isActive,
  openLoginModal
}: TPortfolioClaimRewardsProps): ReactElement {
  const { address: userAddress } = useWeb3()
  const vaultsWithRewards = useMemo(
    () =>
      holdingsRows
        .map((row) => row.vault)
        .filter((vault) => vault.staking.available && (vault.staking.rewards?.length ?? 0) > 0),
    [holdingsRows]
  )
  const merkleChainIds = useMemo(
    () => Array.from(new Set(holdingsRows.map((row) => row.vault.chainID))),
    [holdingsRows]
  )

  const rewardKeys = useMemo(() => {
    const vaultKeys = vaultsWithRewards.map((vault) => `vault-${getVaultKey(vault)}`)
    const merkleKeys = merkleChainIds.map((chainId) => `merkle-${chainId}`)
    return [...vaultKeys, ...merkleKeys]
  }, [vaultsWithRewards, merkleChainIds])

  const [cardStatuses, setCardStatuses] = useState<Record<string, TRewardCardStatus>>({})

  useEffect(() => {
    setCardStatuses((previous) => {
      const next: Record<string, TRewardCardStatus> = {}
      rewardKeys.forEach((key) => {
        next[key] = previous[key] ?? { hasRewards: false, isLoading: true }
      })
      return next
    })
  }, [rewardKeys])

  const handleStatusChange = useCallback((key: string, status: TRewardCardStatus) => {
    setCardStatuses((previous) => {
      const previousStatus = previous[key]
      if (previousStatus?.hasRewards === status.hasRewards && previousStatus?.isLoading === status.isLoading) {
        return previous
      }
      return { ...previous, [key]: status }
    })
  }, [])

  const statusEntries = Object.values(cardStatuses)
  const hasSources = rewardKeys.length > 0
  const hasRewards = statusEntries.some((status) => status.hasRewards)
  const isLoading = hasSources && (statusEntries.length === 0 || statusEntries.some((status) => status.isLoading))
  const showNoSources = !hasSources && !isLoading
  const showNoRewards = hasSources && !isLoading && !hasRewards

  return (
    <section className={'flex flex-col gap-3 sm:gap-4'}>
      <div>
        <h2 className={'text-xl font-semibold text-text-primary sm:text-2xl'}>{'Claim rewards'}</h2>
        <p className={'text-xs text-text-secondary sm:text-sm'}>
          {'Claim all of your staking and Merkle rewards across Yearn.'}
        </p>
      </div>
      {!isActive ? (
        <div className={'rounded-lg border border-border bg-surface p-6 text-center'}>
          <p className={'text-sm font-semibold text-text-primary'}>{'Connect a wallet to claim rewards.'}</p>
          <p className={'mt-2 text-xs text-text-secondary'}>
            {'We will surface any claimable rewards once connected.'}
          </p>
          <Button onClick={openLoginModal} variant={'filled'} className={'mt-4 min-h-[40px] px-5 text-sm'}>
            {'Connect wallet'}
          </Button>
        </div>
      ) : (
        <div className={'flex flex-col gap-4'}>
          {vaultsWithRewards.map((vault) => (
            <VaultStakingRewardsCard
              key={getVaultKey(vault)}
              vault={vault}
              userAddress={userAddress}
              isActive={isActive}
              onStatusChange={handleStatusChange}
            />
          ))}
          {merkleChainIds.map((chainId) => (
            <ChainMerkleRewardsCard
              key={chainId}
              chainId={chainId}
              userAddress={userAddress}
              isActive={isActive}
              onStatusChange={handleStatusChange}
            />
          ))}
          {isLoading && !hasRewards ? (
            <div className={'rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-secondary'}>
              <div className={'flex flex-col items-center justify-center gap-2'}>
                <IconSpinner className={'size-5 animate-spin text-text-secondary'} />
                <span>{'Loading rewards...'}</span>
              </div>
            </div>
          ) : null}
          {showNoRewards ? (
            <div className={'rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-secondary'}>
              {'No claimable rewards yet.'}
            </div>
          ) : null}
          {showNoSources ? (
            <div className={'rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-secondary'}>
              {'No rewards sources available yet.'}
            </div>
          ) : null}
        </div>
      )}
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
                  showProductTypeChipOverride={true}
                  showHoldingsChipOverride={false}
                  mobileSecondaryMetric={'holdings'}
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
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = useMemo((): TPortfolioTabKey => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'activity' || tabParam === 'claim-rewards' || tabParam === 'positions') {
      return tabParam
    }
    return 'positions'
  }, [searchParams])

  const handleTabSelect = useCallback(
    (tab: TPortfolioTabKey) => {
      const nextParams = new URLSearchParams(searchParams)
      if (tab === 'positions') {
        nextParams.delete('tab')
      } else {
        nextParams.set('tab', tab)
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  return (
    <PortfolioPageLayout>
      {/** biome-ignore lint/complexity/noUselessFragments: <lint error without> */}
      <>
        <PortfolioHeaderSection
          blendedMetrics={model.blendedMetrics}
          isActive={model.isActive}
          isHoldingsLoading={model.isHoldingsLoading}
          isSearchingBalances={model.isSearchingBalances}
          totalPortfolioValue={model.totalPortfolioValue}
        />
        <PortfolioTabSelector activeTab={activeTab} onSelectTab={handleTabSelect} />
        {activeTab === 'positions' ? (
          <>
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
        ) : null}
        {activeTab === 'activity' ? (
          <PortfolioActivitySection isActive={model.isActive} openLoginModal={model.openLoginModal} />
        ) : null}
        {activeTab === 'claim-rewards' ? (
          <PortfolioClaimRewardsSection
            holdingsRows={model.holdingsRows}
            isActive={model.isActive}
            openLoginModal={model.openLoginModal}
          />
        ) : null}
      </>
    </PortfolioPageLayout>
  )
}

export default PortfolioPage
