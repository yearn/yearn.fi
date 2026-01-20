import type { TMerkleReward } from '@pages/vaults/components/widget/rewards/types'
import { MERKLE_DISTRIBUTOR_ABI } from '@shared/contracts/abi/merkleDistributor.abi'
import { MERKLE_DISTRIBUTOR_ADDRESS } from '@shared/utils/constants'
import { useSimulateContract } from 'wagmi'

type UseClaimMerkleRewardsParams = {
  reward?: TMerkleReward
  userAddress?: `0x${string}`
  chainId: number
  enabled?: boolean
}

export function useClaimMerkleRewards(params: UseClaimMerkleRewardsParams) {
  const { reward, userAddress, chainId, enabled = true } = params

  const isEnabled = enabled && !!userAddress && !!reward && reward.unclaimed > 0n

  const prepare = useSimulateContract({
    address: MERKLE_DISTRIBUTOR_ADDRESS,
    abi: MERKLE_DISTRIBUTOR_ABI,
    functionName: 'claim',
    args:
      isEnabled && reward ? [[userAddress!], [reward.token.address], [reward.accumulated], [reward.proofs]] : undefined,
    chainId,
    query: { enabled: isEnabled }
  })

  return { prepare }
}
