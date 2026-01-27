import { useMerkleRewards } from '@pages/vaults/hooks/rewards/useMerkleRewards'
import { type TRewardToken, useStakingRewards } from '@pages/vaults/hooks/rewards/useStakingRewards'
import { Button } from '@shared/components/Button'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconCross } from '@shared/icons/IconCross'
import { cl } from '@shared/utils'
import { formatUSD } from '@shared/utils/format'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { Spinner } from '../shared/TransactionStateIndicators'
import { MerkleRewardRow } from './MerkleRewardRow'
import { StakingRewardRow } from './StakingRewardRow'

type TWidgetRewardsProps = {
  stakingAddress?: `0x${string}`
  stakingSource?: string
  rewardTokens: TRewardToken[]
  chainId: number
  isPanelOpen?: boolean
  onOpenRewards?: () => void
}

export function WidgetRewards(props: TWidgetRewardsProps): ReactElement | null {
  const { stakingAddress, stakingSource, rewardTokens, chainId, isPanelOpen = false, onOpenRewards } = props
  const { address: userAddress, isActive } = useWeb3()

  const { rewards: stakingRewards, isLoading: isStakingLoading } = useStakingRewards({
    stakingAddress,
    stakingSource,
    rewardTokens,
    userAddress,
    chainId,
    enabled: isActive && !!stakingAddress
  })

  const { groupedRewards: merkleRewards, isLoading: isMerkleLoading } = useMerkleRewards({
    userAddress,
    chainId,
    enabled: isActive
  })

  const hasStakingRewards = stakingRewards.length > 0
  const hasMerkleRewards = merkleRewards.length > 0
  const hasAnyRewards = hasStakingRewards || hasMerkleRewards
  const isRewardsLoading = isStakingLoading || isMerkleLoading
  const [hasRequestedRewards, setHasRequestedRewards] = useState(false)

  const totalUsd = useMemo(() => {
    const stakingTotal = stakingRewards.reduce((acc, r) => acc + r.usdValue, 0)
    const merkleTotal = merkleRewards.reduce((acc, r) => acc + r.totalUsdValue, 0)
    return stakingTotal + merkleTotal
  }, [stakingRewards, merkleRewards])

  useEffect(() => {
    if (!hasRequestedRewards) {
      return
    }
    if (!isRewardsLoading) {
      setHasRequestedRewards(false)
    }
  }, [hasRequestedRewards, isRewardsLoading])

  const handleOpenRewards = useCallback(() => {
    if (!onOpenRewards) {
      return
    }
    setHasRequestedRewards(true)
    onOpenRewards()
  }, [onOpenRewards])

  if (!isActive || !hasAnyRewards) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-0 pt-4">
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-col gap-2 bg-surface p-6">
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Claimable Rewards</span>
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-bold text-text-primary">{formatUSD(totalUsd, 2, 2)}</span>
            <Button
              onClick={handleOpenRewards}
              variant={'filled'}
              isBusy={isPanelOpen || (hasRequestedRewards && isRewardsLoading)}
              isDisabled={!onOpenRewards || isPanelOpen}
              classNameOverride="yearn--button-nextgen min-h-[32px] px-3 rounded-xl text-md bg-primary text-white hover:bg-primary/90"
            >
              {'Claim rewards'}
            </Button>
          </div>
        </div>
        {isPanelOpen ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70 backdrop-blur-xs">
            <Spinner />
          </div>
        ) : null}
      </div>
    </div>
  )
}

type TWidgetRewardsPanelProps = {
  stakingAddress?: `0x${string}`
  stakingSource?: string
  rewardTokens: TRewardToken[]
  chainId: number
  isActive: boolean
  onClose: () => void
  onClaimSuccess?: () => void
}

export function WidgetRewardsPanel(props: TWidgetRewardsPanelProps): ReactElement {
  const { stakingAddress, stakingSource, rewardTokens, chainId, isActive, onClose, onClaimSuccess } = props
  const { address: userAddress, isActive: isWalletActive } = useWeb3()

  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<TransactionStep | undefined>()

  const isEnabled = isActive && isWalletActive
  const {
    rewards: stakingRewards,
    isLoading: isStakingLoading,
    refetch: refetchStaking
  } = useStakingRewards({
    stakingAddress,
    stakingSource,
    rewardTokens,
    userAddress,
    chainId,
    enabled: isEnabled && !!stakingAddress
  })

  const {
    groupedRewards: merkleRewards,
    isLoading: isMerkleLoading,
    refetch: refetchMerkle
  } = useMerkleRewards({
    userAddress,
    chainId,
    enabled: isEnabled
  })

  const hasStakingRewards = stakingRewards.length > 0
  const hasMerkleRewards = merkleRewards.length > 0
  const hasAnyRewards = hasStakingRewards || hasMerkleRewards
  const isLoading = isStakingLoading || isMerkleLoading
  const handleStartClaim = useCallback((step: TransactionStep) => {
    setActiveStep(step)
    setIsOverlayOpen(true)
  }, [])

  const handleClaimComplete = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    refetchStaking()
    refetchMerkle()
    onClaimSuccess?.()
  }, [refetchStaking, refetchMerkle, onClaimSuccess])

  const handleOverlayClose = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
  }, [])

  const handlePanelClose = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (isActive) {
      return
    }
    if (isOverlayOpen) {
      setIsOverlayOpen(false)
      setActiveStep(undefined)
    }
  }, [isActive, isOverlayOpen])

  return (
    <div
      className={cl(
        'bg-app rounded-b-lg overflow-hidden relative w-full min-w-0 flex-1',
        isActive ? 'flex flex-col' : 'hidden'
      )}
      aria-hidden={!isActive}
    >
      <div className="bg-surface border border-border rounded-lg flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Claim rewards</h3>
          <button
            type="button"
            onClick={handlePanelClose}
            aria-label="Close rewards panel"
            className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
          >
            <IconCross className="size-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-border border-t-text-secondary" />
              {'Loading rewards...'}
            </div>
          ) : !hasAnyRewards ? (
            <div className="text-sm text-text-secondary">{'No claimable rewards yet.'}</div>
          ) : (
            <div>
              {stakingRewards.map((reward, index) => (
                <StakingRewardRow
                  key={`${reward.tokenAddress}-${reward.amount}`}
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
          )}
        </div>
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
