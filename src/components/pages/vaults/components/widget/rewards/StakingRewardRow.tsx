import { useClaimStakingRewards } from '@pages/vaults/hooks/rewards/useClaimStakingRewards'
import { toNormalizedValue } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useChainId, useSwitchChain, useWriteContract } from 'wagmi'
import type { TransactionStep } from '../shared/TransactionOverlay'
import { RewardRow } from './RewardRow'
import type { TStakingReward } from './types'

type TStakingRewardRowProps = {
  reward: TStakingReward
  stakingAddress: `0x${string}`
  stakingSource: string
  chainId: number
  onStartClaim: (step: TransactionStep) => void
  isLast?: boolean
}

export function StakingRewardRow(props: TStakingRewardRowProps): ReactElement {
  const { reward, stakingAddress, stakingSource, chainId, onStartClaim, isLast } = props
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
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

  const handleClaim = useCallback(async () => {
    if (currentChainId !== chainId) {
      try {
        await switchChainAsync({ chainId })
      } catch {
        return
      }
    }
    if (step) {
      onStartClaim(step)
    }
  }, [currentChainId, chainId, switchChainAsync, step, onStartClaim])

  return (
    <RewardRow
      chainId={chainId}
      tokenAddress={reward.tokenAddress}
      symbol={reward.symbol}
      amount={normalizedAmount.toString()}
      usdValue={reward.usdValue}
      onClaim={handleClaim}
      isClaimPending={isPending}
      isClaimReady={prepare.isSuccess}
      isLast={isLast}
    />
  )
}
