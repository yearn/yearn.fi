import { useClaimYieldSplitterRewards } from '@pages/vaults/hooks/rewards/useClaimYieldSplitterRewards'
import { useChainId } from '@shared/hooks/useAppWagmi'
import { toNormalizedValue } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import { useWriteContract } from 'wagmi'
import type { TransactionStep } from '../shared/TransactionOverlay'
import { RewardRow } from './RewardRow'
import type { TStakingReward } from './types'

type TYieldSplitterRewardRowProps = {
  reward: TStakingReward
  splitterAddress: `0x${string}`
  chainId: number
  onStartClaim: (step: TransactionStep) => void
  isFirst?: boolean
}

export function YieldSplitterRewardRow(props: TYieldSplitterRewardRowProps): ReactElement {
  const { reward, splitterAddress, chainId, onStartClaim, isFirst } = props
  const currentChainId = useChainId()
  const { isPending } = useWriteContract()

  const { prepare } = useClaimYieldSplitterRewards({
    splitterAddress,
    chainId,
    enabled: reward.amount > 0n
  })

  const normalizedAmount = toNormalizedValue(reward.amount, reward.decimals)
  const formattedAmount = normalizedAmount.toFixed(4)

  const step = useMemo((): TransactionStep | undefined => {
    if (!prepare.isSuccess || !prepare.data?.request) {
      return undefined
    }

    return {
      prepare,
      label: 'Claim',
      confirmMessage: `Claim ${formattedAmount} ${reward.symbol}`,
      successTitle: 'Rewards Claimed',
      successMessage: `You claimed ${formattedAmount} ${reward.symbol}`,
      showConfetti: true
    }
  }, [formattedAmount, prepare, reward.symbol])

  const handleClaim = useCallback(() => {
    if (!step) {
      return
    }
    onStartClaim(step)
  }, [onStartClaim, step])

  return (
    <RewardRow
      chainId={chainId}
      currentChainId={currentChainId}
      tokenAddress={reward.tokenAddress}
      symbol={reward.symbol}
      amount={normalizedAmount.toString()}
      usdValue={reward.usdValue}
      onClaim={handleClaim}
      isClaimPending={isPending}
      isClaimReady={prepare.isSuccess}
      isFirst={isFirst}
    />
  )
}
