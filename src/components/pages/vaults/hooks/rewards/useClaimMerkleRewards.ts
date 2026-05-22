import type { TGroupedMerkleReward } from '@pages/vaults/components/widget/rewards/types'
import { MERKLE_DISTRIBUTOR_ABI } from '@shared/contracts/abi/merkleDistributor.abi'
import { useSimulateContract } from '@shared/hooks/useAppWagmi'
import { MERKLE_DISTRIBUTOR_ADDRESS } from '@shared/utils/constants'

type UseClaimMerkleRewardsParams = {
  groupedReward?: TGroupedMerkleReward
  groupedRewards?: TGroupedMerkleReward[]
  userAddress?: `0x${string}`
  chainId: number
  enabled?: boolean
}

export function useClaimMerkleRewards(params: UseClaimMerkleRewardsParams) {
  const { groupedReward, groupedRewards, userAddress, chainId, enabled = true } = params

  const rewardGroups = groupedRewards ?? (groupedReward ? [groupedReward] : [])
  const rewards = rewardGroups.flatMap((group) => group.rewards)
  const hasClaimableRewards = rewardGroups.some((group) => group.totalUnclaimed > 0n)
  const isEnabled = enabled && !!userAddress && hasClaimableRewards

  const prepare = useSimulateContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: 'claim',
    args: isEnabled
      ? [
          rewards.map(() => userAddress!),
          rewards.map((r) => r.token.address),
          rewards.map((r) => r.accumulated),
          rewards.map((r) => r.proofs)
        ]
      : undefined,
    chainId,
    query: { enabled: isEnabled }
  })

  return { prepare }
}
