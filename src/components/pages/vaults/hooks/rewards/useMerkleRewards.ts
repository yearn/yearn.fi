import type { TGroupedMerkleReward, TMerkleReward } from '@pages/vaults/components/widget/rewards/types'
import { toNormalizedValue } from '@shared/utils'
import { useMemo } from 'react'
import useSWR from 'swr'

type MerklV4Reward = {
  amount: string
  claimed: string
  pending: string
  proofs: string[]
  token: {
    address: string
    symbol: string
    decimals: number
    price: number
  }
}

type MerklV4ChainData = {
  chain: { id: number }
  rewards: MerklV4Reward[]
}

type MerklAPIResponse = MerklV4ChainData[]

type UseMerkleRewardsParams = {
  userAddress?: `0x${string}`
  chainId: number
  enabled?: boolean
}

type UseMerkleRewardsReturn = {
  rewards: TMerkleReward[]
  groupedRewards: TGroupedMerkleReward[]
  isLoading: boolean
  refetch: () => void
}

const fetcher = async (url: string): Promise<MerklAPIResponse> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch Merkl rewards')
  }
  return response.json()
}

export function useMerkleRewards(params: UseMerkleRewardsParams): UseMerkleRewardsReturn {
  const { userAddress, chainId, enabled = true } = params

  const isEnabled = enabled && !!userAddress

  const { data, isLoading, mutate } = useSWR<MerklAPIResponse>(
    isEnabled ? `https://api.merkl.xyz/v4/users/${userAddress}/rewards?chainId=${chainId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000
    }
  )

  const rewards = useMemo((): TMerkleReward[] => {
    if (!data || !Array.isArray(data)) return []

    const chainData = data.find((d) => d.chain.id === chainId)
    if (!chainData) return []

    return chainData.rewards
      .map((reward) => {
        const amount = BigInt(reward.amount)
        const claimed = BigInt(reward.claimed)
        const unclaimed = amount - claimed

        if (unclaimed === 0n) return null

        const normalized = toNormalizedValue(unclaimed, reward.token.decimals)
        const price = reward.token.price ?? 0

        return {
          token: {
            address: reward.token.address as `0x${string}`,
            symbol: reward.token.symbol,
            decimals: reward.token.decimals,
            price
          },
          accumulated: amount,
          unclaimed,
          usdValue: normalized * price,
          proofs: reward.proofs as `0x${string}`[]
        }
      })
      .filter((r): r is TMerkleReward => r !== null)
  }, [data, chainId])

  const groupedRewards = useMemo((): TGroupedMerkleReward[] => {
    const grouped = rewards.reduce(
      (acc, reward) => {
        const key = reward.token.address
        acc[key] = acc[key] ?? []
        acc[key].push(reward)
        return acc
      },
      {} as Record<string, TMerkleReward[]>
    )

    return Object.values(grouped).map((rewardList) => ({
      token: rewardList[0].token,
      totalUnclaimed: rewardList.reduce((sum, r) => sum + r.unclaimed, 0n),
      totalUsdValue: rewardList.reduce((sum, r) => sum + r.usdValue, 0),
      rewards: rewardList
    }))
  }, [rewards])

  return {
    rewards,
    groupedRewards,
    isLoading,
    refetch: mutate
  }
}
