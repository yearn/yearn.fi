import {
  GOVERNANCE_CHAIN_ID,
  GOVERNANCE_REWARD_CLAIMER_ABI,
  GOVERNANCE_REWARD_CLAIMER_ADDRESS
} from '@pages/portfolio/governance/constants'
import type { TGovernanceReward } from '@pages/portfolio/governance/types'
import { RewardRow } from '@pages/vaults/components/widget/rewards/RewardRow'
import { useChainId, useSimulateContract } from '@shared/hooks/useAppWagmi'
import type { TransactionStep } from '@yearn/vault-widget/advanced'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'

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
      id: 'claim-governance-reward',
      prepare,
      label: 'Claim',
      confirmMessage: `Claim ${formattedAmount} ${reward.symbol}`,
      successTitle: 'Rewards Claimed',
      successMessage: `You claimed ${formattedAmount} ${reward.symbol}`,
      notification: {
        type: 'claim',
        amount: formattedAmount,
        fromChainId: GOVERNANCE_CHAIN_ID,
        fromAddress: reward.tokenAddress,
        fromSymbol: reward.symbol
      },
      showConfetti: true
    }
  }, [formattedAmount, prepare, reward.symbol, reward.tokenAddress, GOVERNANCE_CHAIN_ID])
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
      isClaimReady={prepare.isSuccess}
      isFirst={isFirst}
      isAllChainsView={isAllChainsView}
      onSwitchChain={onSwitchChain}
    />
  )
}
