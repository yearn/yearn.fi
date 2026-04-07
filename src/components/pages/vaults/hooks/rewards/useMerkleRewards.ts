import type { TGroupedMerkleReward, TMerkleReward } from '@pages/vaults/components/widget/rewards/types'
import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { toNormalizedValue } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export type MerklV4Reward = {
  root: string
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

export type MerklAPIResponse = MerklV4ChainData[]

type UseMerkleRewardsParams = {
  userAddress?: `0x${string}`
  chainId: number
  enabled?: boolean
  hiddenRewardRoots?: `0x${string}`[]
}

type UseMerkleRewardsReturn = {
  rewards: TMerkleReward[]
  groupedRewards: TGroupedMerkleReward[]
  isLoading: boolean
  refetch: () => Promise<unknown>
}

const MERKL_REWARD_TOKEN_ALLOWLIST_BY_CHAIN: Record<number, `0x${string}`[]> = {
  [KATANA_CHAIN_ID]: ['0x3ba1fbc4c3aea775d335b31fb53778f46fd3a330']
}

const fetcher = async (url: string): Promise<MerklAPIResponse> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch Merkl rewards')
  }
  return response.json()
}

export function filterYearnMerkleRewards(rewards: MerklV4Reward[], chainId: number): MerklV4Reward[] {
  const allowedTokenAddresses = MERKL_REWARD_TOKEN_ALLOWLIST_BY_CHAIN[chainId] ?? []
  if (allowedTokenAddresses.length === 0) {
    return []
  }

  return rewards.filter((reward) => allowedTokenAddresses.includes(reward.token.address.toLowerCase() as `0x${string}`))
}

export function buildMerkleRewards(
  data: MerklAPIResponse | undefined,
  chainId: number,
  hiddenRewardRoots: `0x${string}`[] = []
): TMerkleReward[] {
  if (!data || !Array.isArray(data)) return []

  const hiddenRoots = new Set(hiddenRewardRoots)
  const chainData = data.find((entry) => entry.chain.id === chainId)
  if (!chainData) return []

  return filterYearnMerkleRewards(chainData.rewards, chainId)
    .map((reward) => {
      const root = reward.root as `0x${string}`
      if (hiddenRoots.has(root)) return null

      const amount = BigInt(reward.amount)
      const claimed = BigInt(reward.claimed)
      const unclaimed = amount - claimed

      if (unclaimed === 0n) return null

      const normalized = toNormalizedValue(unclaimed, reward.token.decimals)
      const price = reward.token.price ?? 0

      return {
        root,
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
    .filter((reward): reward is TMerkleReward => reward !== null)
}

export function useMerkleRewards(params: UseMerkleRewardsParams): UseMerkleRewardsReturn {
  const { userAddress, chainId, enabled = true, hiddenRewardRoots = [] } = params

  const isEnabled = enabled && !!userAddress
  const endpoint = isEnabled ? `https://api.merkl.xyz/v4/users/${userAddress}/rewards?chainId=${chainId}` : null

  const { data, isLoading, refetch } = useQuery<MerklAPIResponse>({
    queryKey: ['merkl-rewards', userAddress, chainId],
    enabled: Boolean(endpoint),
    queryFn: () => fetcher(endpoint as string),
    staleTime: 30000,
    refetchOnWindowFocus: false
  })

  const rewards = useMemo(
    (): TMerkleReward[] => buildMerkleRewards(data, chainId, hiddenRewardRoots),
    [data, chainId, hiddenRewardRoots]
  )

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
      totalUnclaimed: rewardList.reduce((sum, reward) => sum + reward.unclaimed, 0n),
      totalUsdValue: rewardList.reduce((sum, reward) => sum + reward.usdValue, 0),
      rewards: rewardList
    }))
  }, [rewards])

  return {
    rewards,
    groupedRewards,
    isLoading,
    refetch
  }
}
