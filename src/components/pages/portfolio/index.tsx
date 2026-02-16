import { usePlausible } from '@hooks/usePlausible'
import { EmptySectionCard } from '@pages/portfolio/components/EmptySectionCard'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { Notification } from '@pages/vaults/components/notifications/Notification'
import { SuggestedVaultCard } from '@pages/vaults/components/SuggestedVaultCard'
import { MerkleRewardRow } from '@pages/vaults/components/widget/rewards/MerkleRewardRow'
import { StakingRewardRow } from '@pages/vaults/components/widget/rewards/StakingRewardRow'
import type { TGroupedMerkleReward, TStakingReward } from '@pages/vaults/components/widget/rewards/types'
import { TransactionOverlay, type TransactionStep } from '@pages/vaults/components/widget/shared/TransactionOverlay'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultStaking,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { useMerkleRewards } from '@pages/vaults/hooks/rewards/useMerkleRewards'
import { useStakingRewards } from '@pages/vaults/hooks/rewards/useStakingRewards'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { METRIC_VALUE_CLASS, MetricHeader, MetricsCard, type TMetricBlock } from '@shared/components/MetricsCard'
import { SwitchChainPrompt } from '@shared/components/SwitchChainPrompt'
import { Tooltip } from '@shared/components/Tooltip'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconSpinner } from '@shared/icons/IconSpinner'
import type { TSortDirection } from '@shared/types'
import { cl, formatPercent, SUPPORTED_NETWORKS } from '@shared/utils'
import { formatUSD } from '@shared/utils/format'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useChainId, useSwitchChain } from 'wagmi'
import { type TPortfolioModel, usePortfolioModel } from './hooks/usePortfolioModel'
import { useVaultWithStakingRewards } from './hooks/useVaultWithStakingRewards'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const headingTooltipClassName =
  'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary'
const PORTFOLIO_TABS = [
  { key: 'positions', label: 'Your Vaults' },
  { key: 'activity', label: 'Activity' },
  { key: 'claim-rewards', label: 'Claim Rewards' }
] as const

type TPortfolioTabKey = (typeof PORTFOLIO_TABS)[number]['key']

type TPortfolioHeaderProps = Pick<
  TPortfolioModel,
  | 'blendedMetrics'
  | 'hasKatanaHoldings'
  | 'isActive'
  | 'isHoldingsLoading'
  | 'isSearchingBalances'
  | 'totalPortfolioValue'
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

type TPortfolioClaimRewardsProps = Pick<TPortfolioModel, 'isActive' | 'openLoginModal'>

function PortfolioPageLayout({ children }: { children: ReactElement }): ReactElement {
  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-8'}>
      <div className={'mx-auto flex w-full max-w-[1232px] flex-col gap-4 px-4 pb-16'}>{children}</div>
    </div>
  )
}

function PortfolioHeaderSection({
  blendedMetrics,
  hasKatanaHoldings,
  isActive,
  isHoldingsLoading,
  isSearchingBalances,
  totalPortfolioValue
}: TPortfolioHeaderProps): ReactElement {
  const katanaTooltipContent = (
    <div className={headingTooltipClassName}>
      <p>{'*One or more vaults are receiving extra incentives.'}</p>
      <p>{'*There may be conditions to earn this rate.'}</p>
    </div>
  )

  const metricSpinner = (
    <span className="inline-flex h-6 w-20 animate-spin items-center justify-center">
      <IconSpinner className="size-4 text-text-secondary" />
    </span>
  )

  function renderApyValue(value: string, shouldShowAsterisk: boolean): ReactElement {
    if (!shouldShowAsterisk) {
      return <span>{value}</span>
    }
    return (
      <span className="relative inline-flex items-center">
        {value}
        <Tooltip
          className="ml-1 cursor-default !h-auto !w-auto !gap-0 !justify-start"
          openDelayMs={150}
          side="top"
          tooltip={katanaTooltipContent}
        >
          <span className="text-md text-text-secondary transition-colors hover:text-accent-500">{'*'}</span>
        </Tooltip>
      </span>
    )
  }

  function renderApyMetric(apyValue: number | null): ReactElement {
    if (isHoldingsLoading) return metricSpinner
    if (apyValue === null) return <span>{'—'}</span>
    return renderApyValue(formatPercent(apyValue, 2, 2), hasKatanaHoldings)
  }

  function renderCurrencyMetric(value: number | null): ReactElement {
    if (isHoldingsLoading) return metricSpinner
    if (value === null) return <span>{'—'}</span>
    return <span>{currencyFormatter.format(value)}</span>
  }

  const metrics: TMetricBlock[] = [
    {
      key: 'total-balance',
      header: <MetricHeader label="Total Balance" tooltip="Total USD value of all your vault deposits." />,
      value: (
        <span className={METRIC_VALUE_CLASS}>
          {isSearchingBalances ? metricSpinner : currencyFormatter.format(totalPortfolioValue)}
        </span>
      )
    },
    {
      key: 'est-annual',
      header: (
        <MetricHeader
          label="Est. Annual Return"
          tooltip="Projects potential returns based on your blended current APY."
        />
      ),
      value: <span className={METRIC_VALUE_CLASS}>{renderCurrencyMetric(blendedMetrics.estimatedAnnualReturn)}</span>
    },
    {
      key: 'current-apy',
      header: <MetricHeader label="Current APY" tooltip="Weighted by your total deposits across all Yearn vaults." />,
      value: <span className={METRIC_VALUE_CLASS}>{renderApyMetric(blendedMetrics.blendedCurrentAPY)}</span>
    },
    {
      key: '30-day-apy',
      header: <MetricHeader label="30-day APY" tooltip="Blended 30-day performance using your current positions." />,
      value: <span className={METRIC_VALUE_CLASS}>{renderApyMetric(blendedMetrics.blendedHistoricalAPY)}</span>
    }
  ]

  return (
    <section className={'flex flex-col gap-2'}>
      <Breadcrumbs
        className="px-1"
        items={[
          { label: 'Home', href: '/' },
          { label: 'Vaults', href: '/vaults' },
          { label: 'Portfolio', isCurrent: true }
        ]}
      />
      <div className="px-1">
        <Tooltip
          className="h-auto justify-start gap-0"
          openDelayMs={150}
          side="top"
          tooltip={
            <div className={headingTooltipClassName}>{'Monitor your balances, returns, and discover new vaults.'}</div>
          }
        >
          <h1 className="text-lg font-black text-text-primary md:text-3xl md:leading-10">{'Account Overview'}</h1>
        </Tooltip>
      </div>
      {isActive && (
        <MetricsCard items={metrics} className="rounded-t-lg rounded-b-none border border-border" mobileLayout="grid" />
      )}
    </section>
  )
}

function PortfolioTabSelector({
  activeTab,
  onSelectTab,
  mergeWithHeader
}: {
  activeTab: TPortfolioTabKey
  onSelectTab: (tab: TPortfolioTabKey) => void
  mergeWithHeader?: boolean
}): ReactElement {
  return (
    <div className={'flex gap-2 md:gap-3 w-full'}>
      <div
        className={cl(
          'flex w-full justify-between gap-1 bg-surface-secondary p-1',
          mergeWithHeader ? 'rounded-b-lg border-x border-b border-border' : 'rounded-lg border border-border'
        )}
      >
        {PORTFOLIO_TABS.map((tab) => (
          <button
            key={tab.key}
            type={'button'}
            onClick={() => onSelectTab(tab.key)}
            className={cl(
              'flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-all md:px-4 md:py-2.5',
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

  function renderActivityContent(): ReactElement {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <IconSpinner className="size-5 animate-spin text-text-secondary" />
          <span>{'Loading activity...'}</span>
        </div>
      )
    }
    if (error) {
      return (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-red-600">{'Error loading activity'}</p>
          <p className="mt-2 text-xs text-text-secondary">{error}</p>
        </div>
      )
    }
    if (!hasEntries) {
      return <div className="py-6 text-center text-sm text-text-secondary">{'No transactions to show.'}</div>
    }
    return (
      <div className="flex flex-col">
        {cachedEntries.toReversed().map((entry) => (
          <Notification key={`notification-${entry.id}`} notification={entry} variant="v3" />
        ))}
      </div>
    )
  }

  return (
    <section className={'flex flex-col gap-2'}>
      <div>
        <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Activity</h2>
        <p className="text-xs text-text-secondary sm:text-sm">Review your recent Yearn transactions.</p>
      </div>
      {!isActive ? (
        <EmptySectionCard
          title="Connect a wallet to view activity"
          description="Track deposits, withdrawals, and claims in one place."
          ctaLabel="Connect wallet"
          onClick={openLoginModal}
        />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4">{renderActivityContent()}</div>
      )}
    </section>
  )
}

type TChainRewardData = {
  chainId: number
  chainName: string
  rewardCount: number
  totalUsd: number
  isLoading: boolean
  stakingRewards: Array<{
    vault: TKongVault
    stakingAddress: `0x${string}`
    stakingSource: string
    rewards: TStakingReward[]
  }>
  merkleRewards: TGroupedMerkleReward[]
  refetchStaking: () => void
  refetchMerkle: () => void
}

function rewardsArrayEqual(a: TStakingReward[], b: TStakingReward[]): boolean {
  if (a.length !== b.length) return false
  return a.every((r, i) => r.tokenAddress === b[i]?.tokenAddress && r.amount === b[i]?.amount)
}

function merkleRewardsEqual(a: TGroupedMerkleReward[], b: TGroupedMerkleReward[]): boolean {
  if (a.length !== b.length) return false
  return a.every((r, i) => r.token.address === b[i]?.token.address && r.totalUnclaimed === b[i]?.totalUnclaimed)
}

function ChainStakingRewardsFetcher({
  vault: originalVault,
  userAddress,
  isActive,
  onRewards
}: {
  vault: TKongVault
  userAddress?: `0x${string}`
  isActive: boolean
  onRewards: (
    vault: TKongVault,
    stakingAddress: `0x${string}`,
    stakingSource: string,
    rewards: TChainRewardData['stakingRewards'][number]['rewards'],
    refetch: () => void,
    isLoading: boolean
  ) => void
}): null {
  const { vault, staking, isLoading: isLoadingVault } = useVaultWithStakingRewards(originalVault, isActive)

  const stakingAddress = staking.available ? staking.address : undefined
  const rewardTokens = useMemo(
    () =>
      (staking.rewards ?? []).map((reward) => ({
        address: reward.address,
        symbol: reward.symbol,
        decimals: reward.decimals,
        price: reward.price,
        isFinished: reward.isFinished
      })),
    [staking.rewards]
  )

  const isEnabled = isActive && !!stakingAddress && rewardTokens.length > 0
  const {
    rewards,
    isLoading: isLoadingRewards,
    refetch
  } = useStakingRewards({
    stakingAddress,
    stakingSource: staking.source,
    rewardTokens,
    userAddress,
    chainId: getVaultChainID(vault),
    enabled: isEnabled
  })

  const isLoading = isLoadingVault || isLoadingRewards

  // Stable refs to avoid recreating the effect callback
  const latestRef = useRef({ onRewards, refetch, vault, rewards })
  latestRef.current = { onRewards, refetch, vault, rewards }

  // Primitive keys to detect actual data changes without object reference instability
  const rewardsKey = rewards.map((r) => `${r.tokenAddress}:${r.amount}`).join(',')

  useEffect(() => {
    if (!stakingAddress) return
    const { onRewards, refetch, vault, rewards } = latestRef.current
    onRewards(vault, stakingAddress, staking.source ?? '', rewards, refetch, isLoading)
  }, [vault, stakingAddress, rewardsKey, isLoading, staking.source])

  return null
}

function ChainMerkleRewardsFetcher({
  chainId,
  userAddress,
  isActive,
  onRewards
}: {
  chainId: number
  userAddress?: `0x${string}`
  isActive: boolean
  onRewards: (chainId: number, rewards: TGroupedMerkleReward[], isLoading: boolean, refetch: () => void) => void
}): null {
  const isEnabled = isActive && !!userAddress
  const { groupedRewards, isLoading, refetch } = useMerkleRewards({
    userAddress,
    chainId,
    enabled: isEnabled
  })

  // Stable refs to avoid recreating the effect callback
  const latestRef = useRef({ onRewards, refetch, groupedRewards })
  latestRef.current = { onRewards, refetch, groupedRewards }

  // Primitive key to detect actual data changes without object reference instability
  const rewardsKey = groupedRewards.map((r) => `${r.token.address}:${r.totalUnclaimed}`).join(',')

  useEffect(() => {
    const { onRewards, refetch, groupedRewards } = latestRef.current
    onRewards(chainId, groupedRewards, isLoading, refetch)
  }, [chainId, rewardsKey, isLoading])

  return null
}

function PortfolioClaimRewardsSection({ isActive, openLoginModal }: TPortfolioClaimRewardsProps): ReactElement {
  const { address: userAddress } = useWeb3()
  const { vaults } = useYearn()
  const trackEvent = usePlausible()
  const stakingVaults = useMemo(
    () => Object.values(vaults).filter((vault) => getVaultStaking(vault).available),
    [vaults]
  )
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<TransactionStep | undefined>()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()

  const chainIds = useMemo(() => SUPPORTED_NETWORKS.map((network) => network.id), [])

  const [chainStakingData, setChainStakingData] = useState<
    Record<number, { rewards: TChainRewardData['stakingRewards']; isLoading: boolean; refetch: () => void }>
  >({})

  const [chainMerkleData, setChainMerkleData] = useState<
    Record<number, { rewards: TGroupedMerkleReward[]; isLoading: boolean; refetch: () => void }>
  >({})

  const handleStakingRewards = useCallback(
    (
      vault: TKongVault,
      stakingAddress: `0x${string}`,
      stakingSource: string,
      rewards: TChainRewardData['stakingRewards'][number]['rewards'],
      refetch: () => void,
      isLoading: boolean
    ) => {
      const chainId = getVaultChainID(vault)
      setChainStakingData((prev) => {
        const existing = prev[chainId]
        const existingVaultData = existing?.rewards.find((r) => getVaultAddress(r.vault) === getVaultAddress(vault))

        // Bail out if nothing changed
        if (existing?.isLoading === isLoading) {
          if (existingVaultData && rewardsArrayEqual(existingVaultData.rewards, rewards)) return prev
          if (!existingVaultData && rewards.length === 0) return prev
        }

        const filteredRewards = (existing?.rewards ?? []).filter(
          (r) => getVaultAddress(r.vault) !== getVaultAddress(vault)
        )
        const newRewards =
          rewards.length > 0 ? [...filteredRewards, { vault, stakingAddress, stakingSource, rewards }] : filteredRewards

        return { ...prev, [chainId]: { rewards: newRewards, isLoading, refetch } }
      })
    },
    []
  )

  const handleMerkleRewards = useCallback(
    (chainId: number, rewards: TGroupedMerkleReward[], isLoading: boolean, refetch: () => void) => {
      setChainMerkleData((prev) => {
        const existing = prev[chainId]

        // Bail out if nothing changed
        if (existing?.isLoading === isLoading && merkleRewardsEqual(existing.rewards, rewards)) return prev
        if (!existing && rewards.length === 0 && isLoading) return prev

        return { ...prev, [chainId]: { rewards, isLoading, refetch } }
      })
    },
    []
  )

  const chainRewardsData = useMemo((): TChainRewardData[] => {
    return chainIds.map((chainId) => {
      const network = SUPPORTED_NETWORKS.find((n) => n.id === chainId)
      const chainName = network?.name ?? `Chain ${chainId}`
      const merkle = chainMerkleData[chainId]
      const staking = chainStakingData[chainId]

      const stakingRewardCount = staking?.rewards.reduce((sum, r) => sum + r.rewards.length, 0) ?? 0
      const merkleRewardCount = merkle?.rewards.length ?? 0
      const stakingUsd =
        staking?.rewards.reduce((sum, r) => sum + r.rewards.reduce((s, rw) => s + rw.usdValue, 0), 0) ?? 0
      const merkleUsd = merkle?.rewards.reduce((sum, r) => sum + r.totalUsdValue, 0) ?? 0

      const hasStakingVaultsOnChain = stakingVaults.some((v) => getVaultChainID(v) === chainId)
      const stakingIsLoading = hasStakingVaultsOnChain ? (staking?.isLoading ?? false) : false
      const merkleIsLoading = merkle?.isLoading ?? false

      return {
        chainId,
        chainName,
        rewardCount: stakingRewardCount + merkleRewardCount,
        totalUsd: stakingUsd + merkleUsd,
        isLoading: stakingIsLoading || merkleIsLoading,
        stakingRewards: staking?.rewards ?? [],
        merkleRewards: merkle?.rewards ?? [],
        refetchStaking: staking?.refetch ?? (() => {}),
        refetchMerkle: merkle?.refetch ?? (() => {})
      }
    })
  }, [chainIds, chainMerkleData, chainStakingData, stakingVaults])

  const totalRewardCount = useMemo(
    () => chainRewardsData.reduce((sum, c) => sum + c.rewardCount, 0),
    [chainRewardsData]
  )
  const totalUsd = useMemo(() => chainRewardsData.reduce((sum, c) => sum + c.totalUsd, 0), [chainRewardsData])
  const isLoading = chainRewardsData.some((c) => c.isLoading)

  const selectedChainData = useMemo(() => {
    if (selectedChainId === null) return null
    return chainRewardsData.find((c) => c.chainId === selectedChainId) ?? null
  }, [selectedChainId, chainRewardsData])

  const displayedRewards = useMemo(() => {
    if (selectedChainId === null) {
      return chainRewardsData.filter((c) => c.rewardCount > 0)
    }
    return selectedChainData && selectedChainData.rewardCount > 0 ? [selectedChainData] : []
  }, [selectedChainId, chainRewardsData, selectedChainData])

  const handleStartClaim = useCallback((step: TransactionStep) => {
    setActiveStep(step)
    setIsOverlayOpen(true)
  }, [])

  const handleClaimComplete = useCallback(() => {
    trackEvent(PLAUSIBLE_EVENTS.CLAIM, {
      props: {
        chainID: String(selectedChainId ?? 0),
        valueUsd: String(selectedChainId === null ? totalUsd : (selectedChainData?.totalUsd ?? 0)),
        source: 'portfolio'
      }
    })
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    chainRewardsData.forEach((c) => {
      c.refetchStaking()
      c.refetchMerkle()
    })
  }, [trackEvent, selectedChainId, totalUsd, selectedChainData?.totalUsd, chainRewardsData])

  const handleOverlayClose = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
  }, [])

  function getChainLogoUrl(chainId: number): string {
    return `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${chainId}/logo.svg`
  }

  function renderRewardsContent(): ReactElement {
    if (isLoading && totalRewardCount === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-secondary">
          <IconSpinner className="size-5 animate-spin" />
          <span className="text-sm">Loading rewards...</span>
        </div>
      )
    }
    if (displayedRewards.length === 0) {
      return <p className="py-8 text-center text-sm text-text-secondary">No rewards found!</p>
    }
    const isAllChainsView = selectedChainId === null
    const showChainHeader = isAllChainsView && displayedRewards.length > 1
    const needsSwitchChain = (chainData: TChainRewardData): boolean =>
      !isAllChainsView && currentChainId !== chainData.chainId && chainData.rewardCount > 0

    return (
      <div className="flex flex-col gap-4">
        {displayedRewards.map((chainData) => (
          <div key={chainData.chainId}>
            {showChainHeader && (
              <div className="mb-2 flex items-center gap-2">
                <img
                  src={getChainLogoUrl(chainData.chainId)}
                  alt={chainData.chainName}
                  className="size-5 rounded-full"
                />
                <span className="text-sm font-semibold text-text-primary">{chainData.chainName}</span>
              </div>
            )}
            {chainData.stakingRewards.flatMap((sr, srIdx) =>
              sr.rewards.map((reward, rewardIdx) => (
                <StakingRewardRow
                  key={`${getVaultAddress(sr.vault)}-${reward.tokenAddress}`}
                  reward={reward}
                  stakingAddress={sr.stakingAddress}
                  stakingSource={sr.stakingSource}
                  chainId={chainData.chainId}
                  onStartClaim={handleStartClaim}
                  isFirst={srIdx === 0 && rewardIdx === 0}
                  isAllChainsView={isAllChainsView}
                  onSwitchChain={() => switchChainAsync({ chainId: chainData.chainId })}
                />
              ))
            )}
            {chainData.merkleRewards.map((groupedReward, idx) => (
              <MerkleRewardRow
                key={groupedReward.token.address}
                groupedReward={groupedReward}
                userAddress={userAddress!}
                chainId={chainData.chainId}
                onStartClaim={handleStartClaim}
                isFirst={idx === 0 && chainData.stakingRewards.length === 0}
                isAllChainsView={isAllChainsView}
                onSwitchChain={() => switchChainAsync({ chainId: chainData.chainId })}
              />
            ))}
            {needsSwitchChain(chainData) && (
              <SwitchChainPrompt
                chainId={chainData.chainId}
                onSwitchChain={() => switchChainAsync({ chainId: chainData.chainId })}
                isSwitching={isSwitchingChain}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  if (!isActive) {
    return (
      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Claim rewards</h2>
          <p className="text-xs text-text-secondary sm:text-sm">
            Claim all of your staking and Merkle rewards across Yearn.
          </p>
        </div>
        <EmptySectionCard
          title="Connect a wallet to claim rewards"
          description="We will surface any claimable rewards once connected."
          ctaLabel="Connect wallet"
          onClick={openLoginModal}
        />
      </section>
    )
  }

  return (
    <section className="relative flex flex-col gap-2 sm:gap-2">
      {stakingVaults.map((vault) => (
        <ChainStakingRewardsFetcher
          key={getVaultKey(vault)}
          vault={vault}
          userAddress={userAddress}
          isActive={isActive}
          onRewards={handleStakingRewards}
        />
      ))}
      {chainIds.map((chainId) => (
        <ChainMerkleRewardsFetcher
          key={`merkle-${chainId}`}
          chainId={chainId}
          userAddress={userAddress}
          isActive={isActive}
          onRewards={handleMerkleRewards}
        />
      ))}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-col md:flex-row">
          {/* Left sidebar - Chain selector (hidden on mobile, defaults to All Chains view) */}
          <div className="hidden bg-surface-secondary md:block md:w-64 md:shrink-0 md:border-r md:border-border">
            {/* All chains option */}
            <div className="border-b border-border">
              <button
                type="button"
                onClick={() => setSelectedChainId(null)}
                className={cl(
                  'flex w-full items-center justify-between px-4 py-4 transition-colors',
                  selectedChainId === null
                    ? 'bg-surface text-text-primary'
                    : 'text-text-secondary hover:bg-surface/50 hover:text-text-primary'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-surface-secondary">
                    <span className="text-sm font-bold text-text-primary">All</span>
                  </div>
                  <span className="font-medium">All Chains</span>
                  {selectedChainId === null && <span className="size-2 rounded-full bg-green-500" />}
                </div>
                <span className="text-sm font-medium">{totalRewardCount || '-'}</span>
              </button>
            </div>

            {/* Chain list */}
            {[...chainRewardsData]
              .sort((a, b) => b.rewardCount - a.rewardCount)
              .map((chainData, index) => {
                const chainId = chainData.chainId
                const isSelected = selectedChainId === chainId
                return (
                  <button
                    key={chainId}
                    type="button"
                    onClick={() => setSelectedChainId(chainId)}
                    className={cl(
                      'flex w-full items-center justify-between px-4 py-3 transition-colors',
                      index > 0 ? 'border-t border-border' : '',
                      isSelected
                        ? 'bg-surface text-text-primary'
                        : 'text-text-secondary hover:bg-surface/50 hover:text-text-primary'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <img src={getChainLogoUrl(chainId)} alt={chainData.chainName} className="size-8 rounded-full" />
                      <span className="font-medium">{chainData.chainName}</span>
                      {isSelected && <span className="size-2 rounded-full bg-green-500" />}
                    </div>
                    <span className="text-sm font-medium">{chainData.rewardCount || '-'}</span>
                  </button>
                )
              })}
          </div>

          {/* Right content - Rewards panel */}
          <div className="flex-1">
            {/* Header - stacked on mobile for prominent total display */}
            <div className="flex min-h-[64px] flex-col items-center justify-center gap-1 border-b border-border px-6 py-4 md:flex-row md:justify-between md:gap-0 md:py-0">
              <h3 className="text-lg font-semibold text-text-primary">Claimable Rewards</h3>
              <span className="text-2xl font-bold text-text-primary md:text-xl">
                {formatUSD(selectedChainId === null ? totalUsd : (selectedChainData?.totalUsd ?? 0), 2, 2)}
              </span>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 pt-2">{renderRewardsContent()}</div>
          </div>
        </div>
      </div>

      {isOverlayOpen && (
        <TransactionOverlay
          isOpen={isOverlayOpen}
          onClose={handleOverlayClose}
          step={activeStep}
          isLastStep={true}
          onAllComplete={handleClaimComplete}
          topOffset="0"
          contentAlign="center"
        />
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
  function handleSort(newSortBy: string, newDirection: TSortDirection): void {
    setSortBy(newSortBy as TPossibleSortBy)
    setSortDirection(newDirection)
  }

  function renderHoldingsContent(): ReactElement {
    if (isHoldingsLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-sm text-text-secondary sm:px-6 sm:py-16">
          <IconSpinner className="size-5 text-text-secondary sm:size-6" />
          <span>{'Searching for Yearn balances...'}</span>
        </div>
      )
    }
    if (!hasHoldings) {
      return (
        <EmptySectionCard
          title="No vault positions yet"
          description="Deposit into a Yearn vault to see it here."
          ctaLabel="Browse vaults"
          href="/vaults"
        />
      )
    }
    return (
      <div className="flex flex-col gap-px bg-border">
        {holdingsRows.map((row) => (
          <VaultsListRow
            key={row.key}
            currentVault={row.vault}
            flags={vaultFlags[row.key]}
            hrefOverride={row.hrefOverride}
            showBoostDetails={false}
            activeProductType="all"
            showStrategies
            showAllocatorChip={false}
            showProductTypeChipOverride={true}
            showHoldingsChipOverride={false}
            mobileSecondaryMetric="holdings"
          />
        ))}
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">{'Your Vaults'}</h2>
        <p className="text-xs text-text-secondary sm:text-sm">{'Track every Yearn position you currently hold.'}</p>
      </div>
      {!isActive ? (
        <EmptySectionCard
          title="Connect a wallet to view your vaults"
          description="See all your Yearn deposits in one place."
          ctaLabel="Connect wallet"
          onClick={openLoginModal}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex flex-col">
            <VaultsListHead
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={handleSort}
              wrapperClassName="rounded-t-lg bg-surface-secondary"
              containerClassName="rounded-t-lg bg-surface-secondary"
              items={[
                { type: 'sort', label: 'Vault Name', value: 'vault', sortable: false, className: 'col-span-12' },
                { type: 'sort', label: 'Est. APY', value: 'estAPY', sortable: true, className: 'col-span-4' },
                { type: 'sort', label: 'TVL', value: 'tvl', sortable: true, className: 'col-span-4' },
                {
                  type: 'sort',
                  label: 'Your Holdings',
                  value: 'deposited',
                  sortable: true,
                  className: 'col-span-4 justify-end'
                }
              ]}
            />
            {renderHoldingsContent()}
          </div>
        </div>
      )}
    </section>
  )
}

function PortfolioSuggestedSection({ suggestedRows }: TPortfolioSuggestedProps): ReactElement | null {
  if (suggestedRows.length === 0) {
    return null
  }

  const hasPersonalized = suggestedRows.some((r) => r.type === 'personalized' || r.type === 'external')
  const tooltipText = hasPersonalized
    ? 'Suggestions based on tokens in your wallet and vault performance.'
    : 'Vaults picked for you based on performance and popularity.'

  return (
    <section className="flex flex-col gap-2">
      <Tooltip
        className="h-auto justify-start gap-0"
        openDelayMs={150}
        side="top"
        tooltip={<div className={headingTooltipClassName}>{tooltipText}</div>}
      >
        <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">{'You might like'}</h2>
      </Tooltip>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {suggestedRows.map((row) => {
          if (row.type === 'external') {
            return (
              <SuggestedVaultCard
                key={row.key}
                vault={row.vault}
                matchedSymbol={row.underlyingSymbol}
                externalProtocol={row.externalProtocol}
              />
            )
          }
          if (row.type === 'personalized') {
            return <SuggestedVaultCard key={row.key} vault={row.vault} matchedSymbol={row.matchedSymbol} />
          }
          return <SuggestedVaultCard key={row.key} vault={row.vault} />
        })}
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

  function renderTabContent(): ReactElement | null {
    switch (activeTab) {
      case 'positions':
        return (
          <div className="flex flex-col gap-6 sm:gap-8">
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
          </div>
        )
      case 'activity':
        return <PortfolioActivitySection isActive={model.isActive} openLoginModal={model.openLoginModal} />
      case 'claim-rewards':
        return <PortfolioClaimRewardsSection isActive={model.isActive} openLoginModal={model.openLoginModal} />
      default:
        return null
    }
  }

  return (
    <PortfolioPageLayout>
      {/** biome-ignore lint/complexity/noUselessFragments: <lint error without> */}
      <>
        <div className={cl('flex flex-col', model.isActive ? 'gap-0' : 'gap-4 sm:gap-8')}>
          <PortfolioHeaderSection
            blendedMetrics={model.blendedMetrics}
            isActive={model.isActive}
            isHoldingsLoading={model.isHoldingsLoading}
            isSearchingBalances={model.isSearchingBalances}
            hasKatanaHoldings={model.hasKatanaHoldings}
            totalPortfolioValue={model.totalPortfolioValue}
          />
          <PortfolioTabSelector activeTab={activeTab} onSelectTab={handleTabSelect} mergeWithHeader={model.isActive} />
        </div>
        <div key={activeTab}>{renderTabContent()}</div>
      </>
    </PortfolioPageLayout>
  )
}

export default PortfolioPage
