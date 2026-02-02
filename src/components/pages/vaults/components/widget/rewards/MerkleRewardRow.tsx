import { useClaimMerkleRewards } from '@pages/vaults/hooks/rewards/useClaimMerkleRewards'
import { toNormalizedValue } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useChainId, useWriteContract } from 'wagmi'
import type { TransactionStep } from '../shared/TransactionOverlay'
import { RewardRow } from './RewardRow'
import type { TGroupedMerkleReward } from './types'

type TMerkleRewardRowProps = {
  groupedReward: TGroupedMerkleReward
  userAddress: `0x${string}`
  chainId: number
  onStartClaim: (step: TransactionStep) => void
  isFirst?: boolean
  isAllChainsView?: boolean
  onSwitchChain?: () => void
}

export function MerkleRewardRow(props: TMerkleRewardRowProps): ReactElement {
  const { groupedReward, userAddress, chainId, onStartClaim, isFirst, isAllChainsView, onSwitchChain } = props

  const currentChainId = useChainId()
  const { isPending } = useWriteContract()

  const { prepare } = useClaimMerkleRewards({
    groupedReward,
    userAddress,
    chainId
  })

  const normalizedAmount = toNormalizedValue(groupedReward.totalUnclaimed, groupedReward.token.decimals)
  const formattedAmount = normalizedAmount.toFixed(4)

  const step = useMemo((): TransactionStep | undefined => {
    if (!prepare.isSuccess || !prepare.data?.request) {
      return undefined
    }
    return {
      prepare: prepare as unknown as UseSimulateContractReturnType,
      label: 'Claim',
      confirmMessage: `Claim ${formattedAmount} ${groupedReward.token.symbol}`,
      successTitle: 'Rewards Claimed',
      successMessage: `You claimed ${formattedAmount} ${groupedReward.token.symbol}`,
      showConfetti: true
    }
  }, [prepare, formattedAmount, groupedReward.token.symbol])

  const handleClaim = useCallback(() => {
    if (!step) return
    onStartClaim(step)
  }, [step, onStartClaim])

  return (
    <RewardRow
      chainId={chainId}
      currentChainId={currentChainId}
      tokenAddress={groupedReward.token.address}
      symbol={groupedReward.token.symbol}
      amount={normalizedAmount.toString()}
      usdValue={groupedReward.totalUsdValue}
      onClaim={handleClaim}
      isClaimPending={isPending}
      isClaimReady={prepare.isSuccess}
      isFirst={isFirst}
      isAllChainsView={isAllChainsView}
      onSwitchChain={onSwitchChain}
    />
  )
}
