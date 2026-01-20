import { useClaimMerkleRewards } from '@pages/vaults/hooks/rewards/useClaimMerkleRewards'
import { toNormalizedValue } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useChainId, useSwitchChain, useWriteContract } from 'wagmi'
import type { TransactionStep } from '../shared/TransactionOverlay'
import { RewardRow } from './RewardRow'
import type { TMerkleReward } from './types'

type TMerkleRewardRowProps = {
  reward: TMerkleReward
  userAddress: `0x${string}`
  chainId: number
  onStartClaim: (step: TransactionStep) => void
  isLast?: boolean
}

export function MerkleRewardRow(props: TMerkleRewardRowProps): ReactElement {
  const { reward, userAddress, chainId, onStartClaim, isLast } = props
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { isPending } = useWriteContract()

  const { prepare } = useClaimMerkleRewards({
    reward,
    userAddress,
    chainId,
    enabled: true
  })

  const normalizedAmount = toNormalizedValue(reward.unclaimed, reward.token.decimals)
  const formattedAmount = normalizedAmount.toFixed(4)

  const step = useMemo((): TransactionStep | undefined => {
    if (!prepare.isSuccess || !prepare.data?.request) {
      return undefined
    }
    return {
      prepare: prepare as unknown as UseSimulateContractReturnType,
      label: 'Claim',
      confirmMessage: `Claim ${formattedAmount} ${reward.token.symbol}`,
      successTitle: 'Rewards Claimed',
      successMessage: `You claimed ${formattedAmount} ${reward.token.symbol}`,
      showConfetti: true
    }
  }, [prepare, formattedAmount, reward.token.symbol])

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
      tokenAddress={reward.token.address}
      symbol={reward.token.symbol}
      amount={normalizedAmount.toString()}
      usdValue={reward.usdValue}
      onClaim={handleClaim}
      isClaimPending={isPending}
      isClaimReady={prepare.isSuccess}
      isLast={isLast}
    />
  )
}
