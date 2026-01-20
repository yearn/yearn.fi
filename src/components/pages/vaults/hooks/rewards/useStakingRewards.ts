import type { TStakingReward } from '@pages/vaults/components/widget/rewards/types'
import { JUICED_STAKING_REWARDS_ABI } from '@shared/contracts/abi/juicedStakingRewards.abi'
import { STAKING_REWARDS_ABI } from '@shared/contracts/abi/stakingRewards.abi'
import { V3_STAKING_REWARDS_ABI } from '@shared/contracts/abi/V3StakingRewards.abi'
import { VEYFI_GAUGE_ABI } from '@shared/contracts/abi/veYFIGauge.abi'
import { toNormalizedValue } from '@shared/utils'
import { useMemo } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'

export type TRewardToken = {
  address: `0x${string}`
  symbol: string
  decimals: number
  price: number
  isFinished: boolean
}

type UseStakingRewardsParams = {
  stakingAddress?: `0x${string}`
  stakingSource?: string
  rewardTokens: TRewardToken[]
  userAddress?: `0x${string}`
  chainId: number
  enabled?: boolean
}

type UseStakingRewardsReturn = {
  rewards: TStakingReward[]
  isLoading: boolean
  refetch: () => void
}

export function useStakingRewards(params: UseStakingRewardsParams): UseStakingRewardsReturn {
  const { stakingAddress, stakingSource, rewardTokens, userAddress, chainId, enabled = true } = params

  const activeRewardTokens = useMemo(() => rewardTokens.filter((token) => !token.isFinished), [rewardTokens])

  const isEnabled = enabled && !!stakingAddress && !!userAddress && activeRewardTokens.length > 0

  // V3 staking uses earnedMulti to get all rewards in one call
  const isV3Staking = stakingSource === 'V3 Staking'
  const {
    data: v3EarnedMulti,
    isLoading: isLoadingV3,
    refetch: refetchV3
  } = useReadContract({
    address: stakingAddress,
    abi: V3_STAKING_REWARDS_ABI,
    functionName: 'earnedMulti',
    args: [userAddress!],
    chainId,
    query: { enabled: isEnabled && isV3Staking }
  })

  // veYFI gauge uses earned(account) for single dYFI reward
  const isVeYFIGauge = stakingSource === 'VeYFI'
  const {
    data: veYFIEarned,
    isLoading: isLoadingVeYFI,
    refetch: refetchVeYFI
  } = useReadContract({
    address: stakingAddress,
    abi: VEYFI_GAUGE_ABI,
    functionName: 'earned',
    args: [userAddress!],
    chainId,
    query: { enabled: isEnabled && isVeYFIGauge }
  })

  // Juiced/OP Boost uses earned(account, rewardsToken) for each token
  const isJuiced = stakingSource === 'Juiced' || stakingSource === 'OP Boost'
  const juicedContracts = useMemo(() => {
    if (!isJuiced || !stakingAddress || !userAddress) return []
    return activeRewardTokens.map((token) => ({
      address: stakingAddress,
      abi: JUICED_STAKING_REWARDS_ABI,
      functionName: 'earned' as const,
      args: [userAddress, token.address] as const,
      chainId
    }))
  }, [isJuiced, stakingAddress, userAddress, activeRewardTokens, chainId])

  const {
    data: juicedEarned,
    isLoading: isLoadingJuiced,
    refetch: refetchJuiced
  } = useReadContracts({
    contracts: juicedContracts,
    query: { enabled: isEnabled && isJuiced && juicedContracts.length > 0 }
  })

  // Legacy staking uses earned(account) for single reward token
  const isLegacy = stakingSource === 'Legacy' || (!isV3Staking && !isVeYFIGauge && !isJuiced)
  const {
    data: legacyEarned,
    isLoading: isLoadingLegacy,
    refetch: refetchLegacy
  } = useReadContract({
    address: stakingAddress,
    abi: STAKING_REWARDS_ABI,
    functionName: 'earned',
    args: [userAddress!],
    chainId,
    query: { enabled: isEnabled && isLegacy && activeRewardTokens.length === 1 }
  })

  const rewards = useMemo((): TStakingReward[] => {
    if (!isEnabled) return []

    if (isV3Staking && v3EarnedMulti) {
      return activeRewardTokens
        .map((token, index) => {
          const amount = v3EarnedMulti[index] ?? 0n
          const normalized = toNormalizedValue(amount, token.decimals)
          return {
            tokenAddress: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            amount,
            price: token.price,
            usdValue: normalized * token.price
          }
        })
        .filter((r) => r.amount > 0n)
    }

    if (isVeYFIGauge && veYFIEarned !== undefined && activeRewardTokens.length > 0) {
      const token = activeRewardTokens[0]
      const amount = veYFIEarned
      const normalized = toNormalizedValue(amount, token.decimals)
      if (amount > 0n) {
        return [
          {
            tokenAddress: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            amount,
            price: token.price,
            usdValue: normalized * token.price
          }
        ]
      }
      return []
    }

    if (isJuiced && juicedEarned) {
      return activeRewardTokens
        .map((token, index) => {
          const result = juicedEarned[index]
          const amount = result?.status === 'success' ? (result.result as bigint) : 0n
          const normalized = toNormalizedValue(amount, token.decimals)
          return {
            tokenAddress: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            amount,
            price: token.price,
            usdValue: normalized * token.price
          }
        })
        .filter((r) => r.amount > 0n)
    }

    if (isLegacy && legacyEarned !== undefined && activeRewardTokens.length > 0) {
      const token = activeRewardTokens[0]
      const amount = legacyEarned
      const normalized = toNormalizedValue(amount, token.decimals)
      if (amount > 0n) {
        return [
          {
            tokenAddress: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            amount,
            price: token.price,
            usdValue: normalized * token.price
          }
        ]
      }
      return []
    }

    return []
  }, [
    isEnabled,
    isV3Staking,
    isVeYFIGauge,
    isJuiced,
    isLegacy,
    v3EarnedMulti,
    veYFIEarned,
    juicedEarned,
    legacyEarned,
    activeRewardTokens
  ])

  const isLoading = isLoadingV3 || isLoadingVeYFI || isLoadingJuiced || isLoadingLegacy

  const refetch = () => {
    if (isV3Staking) refetchV3()
    if (isVeYFIGauge) refetchVeYFI()
    if (isJuiced) refetchJuiced()
    if (isLegacy) refetchLegacy()
  }

  return { rewards, isLoading, refetch }
}
