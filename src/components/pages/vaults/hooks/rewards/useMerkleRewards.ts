import type { TMerkleReward } from '@pages/vaults/components/widget/rewards/types'
import { toNormalizedValue } from '@shared/utils'
import { useMemo } from 'react'
import useSWR from 'swr'

type MerklAPIReward = {
  accumulated: string
  unclaimed: string
  decimals: number
  symbol: string
  proofs: string[]
  token: string
}

type MerklAPIResponse = {
  [chainId: string]: {
    [tokenAddress: string]: MerklAPIReward
  }
}

type UseMerkleRewardsParams = {
  userAddress?: `0x${string}`
  chainId: number
  enabled?: boolean
}

type UseMerkleRewardsReturn = {
  rewards: TMerkleReward[]
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
    if (!data) return []

    const chainData = data[String(chainId)]
    if (!chainData) return []

    return Object.entries(chainData)
      .map(([tokenAddress, reward]) => {
        const unclaimed = BigInt(reward.unclaimed)
        if (unclaimed === 0n) return null

        const normalized = toNormalizedValue(unclaimed, reward.decimals)
        // Merkl API doesn't provide price, we'll need to fetch it separately or use 0
        const price = 0 // TODO: fetch prices for Merkl reward tokens
        return {
          token: {
            address: tokenAddress as `0x${string}`,
            symbol: reward.symbol,
            decimals: reward.decimals,
            price
          },
          accumulated: BigInt(reward.accumulated),
          unclaimed,
          usdValue: normalized * price,
          proofs: reward.proofs as `0x${string}`[]
        }
      })
      .filter((r): r is TMerkleReward => r !== null)
  }, [data, chainId])

  return {
    rewards,
    isLoading,
    refetch: mutate
  }
}
