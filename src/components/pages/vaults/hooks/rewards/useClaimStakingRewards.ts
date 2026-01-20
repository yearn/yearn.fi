import { JUICED_STAKING_REWARDS_ABI } from '@shared/contracts/abi/juicedStakingRewards.abi'
import { STAKING_REWARDS_ABI } from '@shared/contracts/abi/stakingRewards.abi'
import { V3_STAKING_REWARDS_ABI } from '@shared/contracts/abi/V3StakingRewards.abi'
import { VEYFI_GAUGE_ABI } from '@shared/contracts/abi/veYFIGauge.abi'
import { useSimulateContract } from 'wagmi'

type UseClaimStakingRewardsParams = {
  stakingAddress?: `0x${string}`
  stakingSource?: string
  chainId: number
  enabled?: boolean
}

export function useClaimStakingRewards(params: UseClaimStakingRewardsParams) {
  const { stakingAddress, stakingSource, chainId, enabled = true } = params

  const isEnabled = enabled && !!stakingAddress
  const isV3Staking = stakingSource === 'V3 Staking'
  const isVeYFIGauge = stakingSource === 'VeYFI'
  const isJuiced = stakingSource === 'Juiced' || stakingSource === 'OP Boost'

  // V3 Staking getReward
  const prepareV3 = useSimulateContract({
    address: stakingAddress,
    abi: V3_STAKING_REWARDS_ABI,
    functionName: 'getReward',
    chainId,
    query: { enabled: isEnabled && isV3Staking }
  })

  // veYFI gauge getReward
  const prepareVeYFI = useSimulateContract({
    address: stakingAddress,
    abi: VEYFI_GAUGE_ABI,
    functionName: 'getReward',
    chainId,
    query: { enabled: isEnabled && isVeYFIGauge }
  })

  // Juiced/OP Boost getReward
  const prepareJuiced = useSimulateContract({
    address: stakingAddress,
    abi: JUICED_STAKING_REWARDS_ABI,
    functionName: 'getReward',
    chainId,
    query: { enabled: isEnabled && isJuiced }
  })

  // Legacy staking getReward
  const prepareLegacy = useSimulateContract({
    address: stakingAddress,
    abi: STAKING_REWARDS_ABI,
    functionName: 'getReward',
    chainId,
    query: { enabled: isEnabled && !isV3Staking && !isVeYFIGauge && !isJuiced }
  })

  // Return the appropriate prepare based on staking source
  if (isV3Staking) return { prepare: prepareV3 }
  if (isVeYFIGauge) return { prepare: prepareVeYFI }
  if (isJuiced) return { prepare: prepareJuiced }
  return { prepare: prepareLegacy }
}
