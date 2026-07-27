import {
  GOVERNANCE_CHAIN_ID,
  GOVERNANCE_REWARD_CLAIMER_ABI,
  GOVERNANCE_REWARD_CLAIMER_ADDRESS
} from '@pages/portfolio/governance/constants'
import type { TGovernanceReward } from '@pages/portfolio/governance/types'
import { RewardRow } from '@pages/vaults/components/widget/rewards/RewardRow'
import type { TransactionStep } from '@pages/vaults/components/widget/shared/TransactionOverlay'
import { useChainId, useSimulateContract } from '@shared/hooks/useAppWagmi'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import { useWriteContract } from 'wagmi'

type TGovernanceRewardRowProps = {
  reward: TGovernanceReward
  userAddress?: `0x${string}`
  onStartClaim: (step: TransactionStep) => void
  isFirst?: boolean
  isAllChainsView?: boolean
  onSwitchChain?: () => void
}

export function GovernanceRewardRow({
  reward,
  userAddress,
  onStartClaim,
  isFirst,
  isAllChainsView,
  onSwitchChain
}: TGovernanceRewardRowProps): ReactElement {
  const currentChainId = useChainId()
  const { isPending } = useWriteContract()
  const prepare = useSimulateContract({
    address: GOVERNANCE_REWARD_CLAIMER_ADDRESS,
    abi: GOVERNANCE_REWARD_CLAIMER_ABI,
    functionName: 'claim',
    args: [userAddress!],
    chainId: GOVERNANCE_CHAIN_ID,
    query: { enabled: Boolean(userAddress && reward.amountRaw > 0n) }
  })
  const formattedAmount = reward.amountNormalized.toFixed(4)
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
    if (step) {
      onStartClaim(step)
    }
  }, [onStartClaim, step])

  return (
    <RewardRow
      chainId={GOVERNANCE_CHAIN_ID}
      currentChainId={currentChainId}
      tokenAddress={reward.tokenAddress}
      symbol={reward.symbol}
      amount={reward.amountNormalized.toString()}
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
