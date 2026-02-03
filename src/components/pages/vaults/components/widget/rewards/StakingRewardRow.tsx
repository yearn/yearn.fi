import { useClaimStakingRewards } from '@pages/vaults/hooks/rewards/useClaimStakingRewards'
import { toNormalizedValue } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useChainId, useWriteContract } from 'wagmi'
import type { TransactionStep } from '../shared/TransactionOverlay'
import { RewardRow } from './RewardRow'
import type { TStakingReward } from './types'

type TStakingRewardRowProps = {
  reward: TStakingReward
  stakingAddress: `0x${string}`
  stakingSource: string
  chainId: number
  onStartClaim: (step: TransactionStep) => void
  isFirst?: boolean
  isAllChainsView?: boolean
  onSwitchChain?: () => void
}

export function StakingRewardRow(props: TStakingRewardRowProps): ReactElement {
  const { reward, stakingAddress, stakingSource, chainId, onStartClaim, isFirst, isAllChainsView, onSwitchChain } =
    props

  const currentChainId = useChainId()
  const { isPending } = useWriteContract()

  const { prepare } = useClaimStakingRewards({
    stakingAddress,
    stakingSource,
    chainId,
    enabled: true
  })

  const normalizedAmount = toNormalizedValue(reward.amount, reward.decimals)
  const formattedAmount = normalizedAmount.toFixed(4)

  const step = useMemo((): TransactionStep | undefined => {
    if (!prepare.isSuccess || !prepare.data?.request) {
      return undefined
    }
    return {
      prepare: prepare as unknown as UseSimulateContractReturnType,
      label: 'Claim',
      confirmMessage: `Claim ${formattedAmount} ${reward.symbol}`,
      successTitle: 'Rewards Claimed',
      successMessage: `You claimed ${formattedAmount} ${reward.symbol}`,
      showConfetti: true
    }
  }, [prepare, formattedAmount, reward.symbol])

  const handleClaim = useCallback(() => {
    if (!step) return
    onStartClaim(step)
  }, [step, onStartClaim])

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
      isAllChainsView={isAllChainsView}
      onSwitchChain={onSwitchChain}
    />
  )
}
