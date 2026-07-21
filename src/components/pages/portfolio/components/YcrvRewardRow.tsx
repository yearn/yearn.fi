import {
  YCRV_CHAIN_ID,
  YCRV_REWARDS_DISTRIBUTOR_ABI,
  YCRV_REWARDS_DISTRIBUTOR_ADDRESS
} from '@pages/portfolio/ycrv/constants'
import type { TYcrvReward } from '@pages/portfolio/ycrv/types'
import { RewardRow } from '@pages/vaults/components/widget/rewards/RewardRow'
import type { TransactionStep } from '@pages/vaults/components/widget/shared/TransactionOverlay'
import { useChainId, useReadContract, useSimulateContract } from '@shared/hooks/useAppWagmi'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import { useWriteContract } from 'wagmi'

type TYcrvRewardRowProps = {
  reward: TYcrvReward
  userAddress?: `0x${string}`
  onStartClaim: (step: TransactionStep) => void
  isFirst?: boolean
  isAllChainsView?: boolean
  onSwitchChain?: () => void
}

export function YcrvRewardRow({
  reward,
  userAddress,
  onStartClaim,
  isFirst,
  isAllChainsView,
  onSwitchChain
}: TYcrvRewardRowProps): ReactElement {
  const currentChainId = useChainId()
  const { isPending } = useWriteContract()
  const range = useReadContract({
    address: YCRV_REWARDS_DISTRIBUTOR_ADDRESS,
    abi: YCRV_REWARDS_DISTRIBUTOR_ABI,
    functionName: 'getSuggestedClaimRange',
    args: [userAddress!],
    chainId: YCRV_CHAIN_ID,
    query: { enabled: Boolean(userAddress && reward.amountRaw > 0n) }
  })
  const claimStartWeek = range.data?.[0] ?? 0n
  const claimEndWeek = range.data?.[1] ?? 0n
  const prepare = useSimulateContract({
    address: YCRV_REWARDS_DISTRIBUTOR_ADDRESS,
    abi: YCRV_REWARDS_DISTRIBUTOR_ABI,
    functionName: 'claimWithRange',
    args: [claimStartWeek, claimEndWeek],
    chainId: YCRV_CHAIN_ID,
    query: { enabled: Boolean(userAddress && reward.amountRaw > 0n && range.isSuccess) }
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
      chainId={YCRV_CHAIN_ID}
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
