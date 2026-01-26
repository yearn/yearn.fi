import { useMerkleRewards } from '@pages/vaults/hooks/rewards/useMerkleRewards'
import { type TRewardToken, useStakingRewards } from '@pages/vaults/hooks/rewards/useStakingRewards'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { formatUSD } from '@shared/utils/format'
import type { ReactElement } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { MerkleRewardRow } from './MerkleRewardRow'
import { StakingRewardRow } from './StakingRewardRow'

type TWidgetRewardsProps = {
  stakingAddress?: `0x${string}`
  stakingSource?: string
  rewardTokens: TRewardToken[]
  chainId: number
  onClaimSuccess: () => void
}

export function WidgetRewards(props: TWidgetRewardsProps): ReactElement | null {
  const { stakingAddress, stakingSource, rewardTokens, chainId, onClaimSuccess } = props
  const { address: userAddress, isActive } = useWeb3()

  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<TransactionStep | undefined>()

  const { rewards: stakingRewards, refetch: refetchStaking } = useStakingRewards({
    stakingAddress,
    stakingSource,
    rewardTokens,
    userAddress,
    chainId,
    enabled: isActive && !!stakingAddress
  })

  const { groupedRewards: merkleRewards, refetch: refetchMerkle } = useMerkleRewards({
    userAddress,
    chainId,
    enabled: isActive
  })

  const hasStakingRewards = stakingRewards.length > 0
  const hasMerkleRewards = merkleRewards.length > 0
  const hasAnyRewards = hasStakingRewards || hasMerkleRewards

  const totalUsd = useMemo(() => {
    const stakingTotal = stakingRewards.reduce((acc, r) => acc + r.usdValue, 0)
    const merkleTotal = merkleRewards.reduce((acc, r) => acc + r.totalUsdValue, 0)
    return stakingTotal + merkleTotal
  }, [stakingRewards, merkleRewards])

  const handleStartClaim = useCallback((step: TransactionStep) => {
    setActiveStep(step)
    setIsOverlayOpen(true)
  }, [])

  const handleClaimComplete = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    refetchStaking()
    refetchMerkle()
    onClaimSuccess()
  }, [refetchStaking, refetchMerkle, onClaimSuccess])

  const handleOverlayClose = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
  }, [])

  if (!isActive || !hasAnyRewards) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-0">
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-col gap-1 bg-surface-secondary p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Claimable Rewards</span>
          <span className="text-2xl font-bold text-text-primary">{formatUSD(totalUsd, 2, 2)}</span>
        </div>
        <div className="h-px w-full bg-border" />
        <div className="p-4">
          {stakingRewards.map((reward, index) => (
            <StakingRewardRow
              key={reward.tokenAddress}
              reward={reward}
              stakingAddress={stakingAddress!}
              stakingSource={stakingSource ?? ''}
              chainId={chainId}
              onStartClaim={handleStartClaim}
              isLast={!hasMerkleRewards && index === stakingRewards.length - 1}
            />
          ))}
          {merkleRewards.map((groupedReward, index) => (
            <MerkleRewardRow
              key={groupedReward.token.address}
              groupedReward={groupedReward}
              userAddress={userAddress!}
              chainId={chainId}
              onStartClaim={handleStartClaim}
              isLast={index === merkleRewards.length - 1}
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
    </div>
  )
}
