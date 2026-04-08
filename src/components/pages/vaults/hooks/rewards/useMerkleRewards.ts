import type { TGroupedMerkleReward, TMerkleReward } from '@pages/vaults/components/widget/rewards/types'
import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { MERKLE_DISTRIBUTOR_ABI } from '@shared/contracts/abi/merkleDistributor.abi'
import { toNormalizedValue } from '@shared/utils'
import { MERKLE_DISTRIBUTOR_ADDRESS } from '@shared/utils/constants'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { resolveExecutionChainId } from '@/config/tenderly'

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
  hiddenRewardKeys?: string[]
}

type UseMerkleRewardsReturn = {
  rewards: TMerkleReward[]
  groupedRewards: TGroupedMerkleReward[]
  isLoading: boolean
  refetch: () => Promise<unknown>
}

type TClaimedByTokenAddress = Record<`0x${string}`, bigint>

const normalizeAddress = (address: string): `0x${string}` => address.toLowerCase() as `0x${string}`
const normalizeHash = (hash: string): `0x${string}` => hash.toLowerCase() as `0x${string}`

const MERKL_REWARD_TOKEN_ALLOWLIST_BY_CHAIN: Record<number, `0x${string}`[]> = {
  [KATANA_CHAIN_ID]: [
    '0x6E9C1F88a960fE63387eb4b71BC525a9313d8461', // v2WrappedKat
    '0x3ba1fbC4c3aEA775d335b31fb53778f46FD3a330', // v1WrappedKat
    '0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d', // KAT
    '0x0161A31702d6CF715aaa912d64c6A190FD0093aa' // legacy KAT
  ].map(normalizeAddress)
}

const fetcher = async (url: string): Promise<MerklAPIResponse> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch Merkl rewards')
  }
  return response.json()
}

const getFilteredChainRewards = (data: MerklAPIResponse | undefined, chainId: number): MerklV4Reward[] => {
  if (!data || !Array.isArray(data)) {
    return []
  }

  const chainData = data.find((entry) => entry.chain.id === chainId)
  if (!chainData) {
    return []
  }

  return filterYearnMerkleRewards(chainData.rewards, chainId)
}

const getEffectiveClaimedAmount = (reward: MerklV4Reward, claimedByTokenAddress: TClaimedByTokenAddress): bigint => {
  return claimedByTokenAddress[normalizeAddress(reward.token.address)] ?? BigInt(reward.claimed)
}

export const buildMerkleRewardKey = (root: string, tokenAddress: string): string => {
  return `${normalizeHash(root)}:${normalizeAddress(tokenAddress)}`
}

export function filterYearnMerkleRewards(rewards: MerklV4Reward[], chainId: number): MerklV4Reward[] {
  const allowedTokenAddresses = MERKL_REWARD_TOKEN_ALLOWLIST_BY_CHAIN[chainId] ?? []
  if (allowedTokenAddresses.length === 0) {
    return []
  }

  return rewards.filter((reward) => allowedTokenAddresses.includes(normalizeAddress(reward.token.address)))
}

export function buildMerkleRewards(
  data: MerklAPIResponse | undefined,
  chainId: number,
  hiddenRewardKeys: string[] = [],
  claimedByTokenAddress: TClaimedByTokenAddress = {}
): TMerkleReward[] {
  const hiddenRewardKeySet = new Set(hiddenRewardKeys)

  return getFilteredChainRewards(data, chainId)
    .map((reward) => {
      const rewardKey = buildMerkleRewardKey(reward.root, reward.token.address)
      if (hiddenRewardKeySet.has(rewardKey)) {
        return null
      }

      const amount = BigInt(reward.amount)
      const claimed = getEffectiveClaimedAmount(reward, claimedByTokenAddress)
      const unclaimed = amount > claimed ? amount - claimed : 0n

      if (unclaimed === 0n) {
        return null
      }

      const normalized = toNormalizedValue(unclaimed, reward.token.decimals)
      const price = reward.token.price ?? 0

      return {
        root: reward.root as `0x${string}`,
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
  const { userAddress, chainId, enabled = true, hiddenRewardKeys = [] } = params
  const executionChainId = resolveExecutionChainId(chainId)

  const isEnabled = enabled && !!userAddress
  const endpoint = isEnabled ? `https://api.merkl.xyz/v4/users/${userAddress}/rewards?chainId=${chainId}` : null

  const {
    data,
    isLoading: isLoadingApi,
    refetch: refetchApi
  } = useQuery<MerklAPIResponse>({
    queryKey: ['merkl-rewards', userAddress, chainId],
    enabled: Boolean(endpoint),
    queryFn: () => fetcher(endpoint as string),
    staleTime: 30000,
    refetchOnWindowFocus: false
  })

  const filteredChainRewards = useMemo(() => getFilteredChainRewards(data, chainId), [data, chainId])

  const tokenAddresses = useMemo(
    () => [...new Set(filteredChainRewards.map((reward) => normalizeAddress(reward.token.address)))],
    [filteredChainRewards]
  )

  const claimStatusContracts = useMemo(() => {
    if (!isEnabled || !userAddress || !executionChainId || tokenAddresses.length === 0) {
      return []
    }

    return tokenAddresses.map((tokenAddress) => ({
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: 'claimed' as const,
      args: [userAddress, tokenAddress] as const,
      chainId: executionChainId
    }))
  }, [executionChainId, isEnabled, tokenAddresses, userAddress])

  const {
    data: claimStatuses,
    isLoading: isLoadingClaimStatuses,
    refetch: refetchClaimStatuses
  } = useReadContracts({
    contracts: claimStatusContracts,
    query: {
      enabled: isEnabled && !!executionChainId && claimStatusContracts.length > 0
    }
  })

  const claimedByTokenAddress = useMemo(
    () =>
      tokenAddresses.reduce((acc, tokenAddress, index) => {
        const claimStatus = claimStatuses?.[index]
        if (claimStatus?.status !== 'success') {
          return acc
        }

        acc[tokenAddress] = claimStatus.result as bigint
        return acc
      }, {} as TClaimedByTokenAddress),
    [claimStatuses, tokenAddresses]
  )

  const rewards = useMemo(
    (): TMerkleReward[] => buildMerkleRewards(data, chainId, hiddenRewardKeys, claimedByTokenAddress),
    [claimedByTokenAddress, data, chainId, hiddenRewardKeys]
  )

  const groupedRewards = useMemo((): TGroupedMerkleReward[] => {
    const grouped = rewards.reduce(
      (acc, reward) => {
        const key = normalizeAddress(reward.token.address)
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

  const isLoading = isLoadingApi || (claimStatusContracts.length > 0 && isLoadingClaimStatuses)

  const refetch = useCallback(async (): Promise<unknown> => {
    return await Promise.all([
      refetchApi(),
      claimStatusContracts.length > 0 ? refetchClaimStatuses() : Promise.resolve(undefined)
    ])
  }, [claimStatusContracts.length, refetchApi, refetchClaimStatuses])

  return {
    rewards,
    groupedRewards,
    isLoading,
    refetch
  }
}
