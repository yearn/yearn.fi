import { usePlausible } from '@hooks/usePlausible'
import { isSplitterVault, KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { useMerkleRewards } from '@pages/vaults/hooks/rewards/useMerkleRewards'
import { type TRewardToken, useStakingRewards } from '@pages/vaults/hooks/rewards/useStakingRewards'
import { useSplitterPositions } from '@pages/vaults/hooks/splitter/useSplitterPositions'
import { Button } from '@shared/components/Button'
import { SwitchChainPrompt } from '@shared/components/SwitchChainPrompt'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { IconCross } from '@shared/icons/IconCross'
import { cl, toAddress } from '@shared/utils'
import { formatUSDWithThreshold } from '@shared/utils/format'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { MerkleRewardRow } from './MerkleRewardRow'
import { SplitterRewardRow } from './SplitterRewardRow'
import { StakingRewardRow } from './StakingRewardRow'

type TWidgetRewardsProps = {
  vaultAddress?: `0x${string}`
  stakingAddress?: `0x${string}`
  stakingSource?: string
  rewardTokens: TRewardToken[]
  chainId: number
  isPanelOpen?: boolean
  onOpenRewards?: () => void
  onCloseRewards?: () => void
  onClaimSuccess?: () => void
}

export function WidgetRewards(props: TWidgetRewardsProps): ReactElement | null {
  const {
    vaultAddress,
    stakingAddress,
    stakingSource,
    rewardTokens,
    chainId,
    isPanelOpen = false,
    onOpenRewards,
    onCloseRewards,
    onClaimSuccess
  } = props
  const { address: userAddress, isActive } = useWeb3()
  const { getPrice } = useYearn()
  const trackEvent = usePlausible()
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<TransactionStep | undefined>()
  const [isComplete, setIsComplete] = useState(false)
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()

  const isOnCorrectChain = currentChainId === chainId

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
    enabled: isActive && !!stakingAddress
  })

  const {
    groupedRewards: merkleRewards,
    isLoading: isMerkleLoading,
    refetch: refetchMerkle
  } = useMerkleRewards({
    userAddress,
    chainId,
    enabled: isActive
  })

  const hasSplitter = Boolean(vaultAddress) && isSplitterVault(vaultAddress ?? '')
  const { positions: allSplitterPositions, isLoading: isSplitterLoading } = useSplitterPositions()
  const splitterRewards = useMemo(() => {
    if (!hasSplitter || !vaultAddress) return []
    return Object.values(allSplitterPositions).filter(
      (p) => p.vaultAddress.toLowerCase() === vaultAddress.toLowerCase() && p.earned > 0n
    )
  }, [hasSplitter, vaultAddress, allSplitterPositions])

  const hasStakingRewards = stakingRewards.length > 0
  const hasMerkleRewards = merkleRewards.length > 0
  const hasSplitterRewards = splitterRewards.length > 0
  const hasAnyRewards = hasStakingRewards || hasMerkleRewards || hasSplitterRewards
  const isRewardsLoading = isStakingLoading || isMerkleLoading || (hasSplitter && isSplitterLoading)

  const totalUsd = useMemo(() => {
    const stakingTotal = stakingRewards.reduce((acc, r) => acc + r.usdValue, 0)
    const merkleTotal = merkleRewards.reduce((acc, r) => acc + r.totalUsdValue, 0)
    const splitterTotal = splitterRewards.reduce((acc, p) => {
      const price = getPrice({ address: p.wantToken.address as `0x${string}`, chainID: KATANA_CHAIN_ID }).normalized
      return acc + (Number(p.earned) / 10 ** p.wantToken.decimals) * price
    }, 0)
    return stakingTotal + merkleTotal + splitterTotal
  }, [stakingRewards, merkleRewards, splitterRewards, getPrice])

  const handleOpenRewards = useCallback(() => {
    if (!onOpenRewards || isPanelOpen) {
      return
    }
    onOpenRewards()
  }, [onOpenRewards, isPanelOpen])

  const handleCloseRewards = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    setIsComplete(false)
    onCloseRewards?.()
  }, [onCloseRewards])

  const handleStartClaim = useCallback((step: TransactionStep) => {
    setActiveStep(step)
    setIsOverlayOpen(true)
  }, [])

  const handleClaimComplete = useCallback(() => {
    trackEvent(PLAUSIBLE_EVENTS.CLAIM, {
      props: {
        chainID: String(chainId),
        stakingAddress: stakingAddress ? toAddress(stakingAddress) : '',
        valueUsd: String(totalUsd),
        source: 'vault'
      }
    })
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    setIsComplete(true)
    refetchStaking()
    refetchMerkle()
    onClaimSuccess?.()
  }, [trackEvent, chainId, stakingAddress, totalUsd, refetchStaking, refetchMerkle, onClaimSuccess])

  const handleOverlayClose = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
  }, [])

  useEffect(() => {
    if (isPanelOpen) {
      return
    }
    if (isOverlayOpen) {
      setIsOverlayOpen(false)
      setActiveStep(undefined)
    }
    if (isComplete) {
      setIsComplete(false)
    }
  }, [isPanelOpen, isOverlayOpen, isComplete])

  const shouldRender = isActive && (hasAnyRewards || isPanelOpen || isComplete)

  if (!shouldRender) {
    return null
  }

  return (
    <div className={cl('flex w-full flex-col pt-4', isPanelOpen ? 'flex-1 min-h-0' : '')}>
      <div
        className={cl(
          'relative overflow-hidden rounded-lg border border-border bg-surface',
          isPanelOpen ? 'flex flex-col min-h-0 flex-1' : ''
        )}
      >
        <div className="flex items-center justify-between gap-3 bg-surface p-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Claimable Rewards</span>
            <span className="text-2xl font-bold text-text-primary">{formatUSDWithThreshold(totalUsd, 2, 2)}</span>
          </div>
          {isPanelOpen ? (
            <button
              type="button"
              onClick={handleCloseRewards}
              aria-label="Close rewards"
              className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
            >
              <IconCross className="size-3.5" />
            </button>
          ) : (
            <Button
              onClick={handleOpenRewards}
              variant={'filled'}
              isDisabled={!onOpenRewards}
              classNameOverride="yearn--button-nextgen min-h-[44px] px-3 rounded-xl text-md bg-primary text-white hover:bg-primary/90"
            >
              {'View rewards'}
            </Button>
          )}
        </div>
        {isPanelOpen ? (
          <div className="flex-1 min-h-0 border-t border-border px-6 py-4 overflow-y-auto">
            {isComplete ? (
              <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                <div className="text-base font-semibold text-text-primary">Rewards claimed</div>
                <p className="text-sm text-text-secondary">
                  Your claim is complete. You can return to your vault actions.
                </p>
                <Button
                  onClick={handleCloseRewards}
                  variant="filled"
                  classNameOverride="yearn--button--nextgen min-h-[36px] px-4"
                >
                  Done
                </Button>
              </div>
            ) : isRewardsLoading ? (
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
                    isFirst={index === 0}
                  />
                ))}
                {splitterRewards.map((position, index) => (
                  <SplitterRewardRow
                    key={position.strategyAddress}
                    position={position}
                    chainId={chainId}
                    onStartClaim={handleStartClaim}
                    isFirst={index === 0 && !hasStakingRewards}
                  />
                ))}
                {merkleRewards.map((groupedReward, index) => (
                  <MerkleRewardRow
                    key={groupedReward.token.address}
                    groupedReward={groupedReward}
                    userAddress={userAddress!}
                    chainId={chainId}
                    onStartClaim={handleStartClaim}
                    isFirst={index === 0 && !hasStakingRewards && !hasSplitterRewards}
                  />
                ))}
                {!isOnCorrectChain && (
                  <SwitchChainPrompt
                    chainId={chainId}
                    onSwitchChain={() => switchChainAsync({ chainId })}
                    isSwitching={isSwitchingChain}
                  />
                )}
              </div>
            )}
          </div>
        ) : null}
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
