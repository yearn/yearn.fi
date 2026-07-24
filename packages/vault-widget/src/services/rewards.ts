import { type Address, formatUnits, type Hex, isAddressEqual, type PublicClient } from 'viem'
import { createMerkleClaimQuote, createStakingClaimQuote, MERKLE_DISTRIBUTOR_ADDRESS } from '../headless/rewards'
import type { VaultWidgetConfig, VaultWidgetQuote, VaultWidgetRewardToken } from '../types'
import type { VaultWidgetRewardDiscoveryService } from './types'

const CLAIMED_ABI = [
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' }
    ],
    name: 'claimed',
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

const EARNED_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'earned',
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

const EARNED_MULTI_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'earnedMulti',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

const JUICED_EARNED_ABI = [
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'rewardToken', type: 'address' }
    ],
    name: 'earned',
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

type MerklReward = {
  amount: string
  proofs: string[]
  token: {
    address: string
    decimals: number
    price?: number
    symbol: string
  }
}

type MerklResponse = {
  chain: { id: number }
  rewards: MerklReward[]
}[]

export type VaultWidgetDiscoveredReward = {
  amount: bigint
  id: string
  kind: 'merkle' | 'staking'
  quote: VaultWidgetQuote
  token: VaultWidgetRewardToken
  usdValue: number
}

export type CreateHttpRewardDiscoveryServiceOptions = {
  endpoint?: string
  fetcher?: typeof fetch
}

function rewardUsdValue(amount: bigint, token: VaultWidgetRewardToken): number {
  return Number(formatUnits(amount, token.decimals)) * (token.priceUsd ?? 0)
}

function getConfiguredToken(
  config: VaultWidgetConfig,
  address: Address,
  fallback: Omit<VaultWidgetRewardToken, 'address' | 'chainId'>
): VaultWidgetRewardToken {
  return (
    config.rewards?.tokens.find((token) => isAddressEqual(token.address, address)) ?? {
      ...fallback,
      address,
      chainId: config.chainId
    }
  )
}

function groupMerklRewards(rewards: readonly MerklReward[]): Record<string, MerklReward[]> {
  const keys = [...new Set(rewards.map(({ token }) => token.address.toLowerCase()))]
  return Object.fromEntries(
    keys.map((key) => [key, rewards.filter(({ token }) => token.address.toLowerCase() === key)])
  )
}

async function discoverMerkleRewards(params: {
  account: Address
  config: VaultWidgetConfig
  endpoint: string
  fetcher: typeof fetch
  publicClient: PublicClient
  signal?: AbortSignal
}): Promise<VaultWidgetDiscoveredReward[]> {
  const allowlist = params.config.rewards?.merkleTokenAllowlist ?? []
  if (allowlist.length === 0) return []
  const query = new URLSearchParams({
    chainId: String(params.config.chainId),
    userAddress: params.account
  })
  const response = await params.fetcher(`${params.endpoint}?${query}`, { signal: params.signal })
  if (!response.ok) throw new Error(`Unable to load Merkle rewards (${response.status})`)
  const payload = (await response.json()) as MerklResponse
  const rewards =
    payload
      .find(({ chain }) => chain.id === params.config.chainId)
      ?.rewards.filter(({ token }) => allowlist.some((address) => isAddressEqual(address, token.address as Address))) ??
    []

  const groups = await Promise.all(
    Object.values(groupMerklRewards(rewards)).map(async (group) => {
      const first = group[0]
      if (!first) throw new Error('Merkle reward group is empty')
      const address = first.token.address as Address
      const claimed = await params.publicClient.readContract({
        address: MERKLE_DISTRIBUTOR_ADDRESS,
        abi: CLAIMED_ABI,
        functionName: 'claimed',
        args: [params.account, address]
      })
      const claimable = group
        .map((reward) => ({ accumulated: BigInt(reward.amount), reward }))
        .filter(({ accumulated }) => accumulated > claimed)
      if (claimable.length === 0) return undefined
      const amount = claimable.reduce((total, { accumulated }) => total + (accumulated - claimed), 0n)
      const token = getConfiguredToken(params.config, address, {
        decimals: first.token.decimals,
        priceUsd: first.token.price,
        symbol: first.token.symbol
      })
      return {
        amount,
        id: `merkle:${address.toLowerCase()}`,
        kind: 'merkle' as const,
        quote: createMerkleClaimQuote({
          account: params.account,
          chainId: params.config.chainId,
          rewards: claimable.map(({ accumulated, reward }) => ({
            accumulated,
            proof: reward.proofs as Hex[],
            token
          }))
        }),
        token,
        usdValue: rewardUsdValue(amount, token)
      }
    })
  )
  return groups.filter((group): group is NonNullable<typeof group> => group !== undefined)
}

async function readStakingAmounts(params: {
  account: Address
  config: VaultWidgetConfig
  publicClient: PublicClient
}): Promise<readonly bigint[]> {
  const rewards = params.config.rewards
  if (!rewards?.stakingAddress || rewards.tokens.length === 0) return []
  if (rewards.stakingSource === 'V3 Staking') {
    return params.publicClient.readContract({
      address: rewards.stakingAddress,
      abi: EARNED_MULTI_ABI,
      functionName: 'earnedMulti',
      args: [params.account]
    })
  }
  if (rewards.stakingSource === 'Juiced') {
    return Promise.all(
      rewards.tokens.map((token) =>
        params.publicClient.readContract({
          address: rewards.stakingAddress!,
          abi: JUICED_EARNED_ABI,
          functionName: 'earned',
          args: [params.account, token.address]
        })
      )
    )
  }
  const amount = await params.publicClient.readContract({
    address: rewards.stakingAddress,
    abi: EARNED_ABI,
    functionName: 'earned',
    args: [params.account]
  })
  return [amount]
}

async function discoverStakingRewards(params: {
  account: Address
  config: VaultWidgetConfig
  publicClient: PublicClient
}): Promise<VaultWidgetDiscoveredReward[]> {
  const rewards = params.config.rewards
  if (!rewards?.stakingAddress) return []
  const amounts = await readStakingAmounts(params)
  const claimable = rewards.tokens
    .map((token, index) => ({ amount: amounts[index] ?? 0n, token }))
    .filter(({ amount, token }) => amount > 0n && !token.isFinished)
  if (claimable.length === 0) return []
  const quote = createStakingClaimQuote({
    chainId: params.config.chainId,
    rewards: claimable,
    stakingAddress: rewards.stakingAddress
  })
  return claimable.map(({ amount, token }) => ({
    amount,
    id: `staking:${rewards.stakingAddress}:${token.address}`,
    kind: 'staking',
    quote,
    token,
    usdValue: rewardUsdValue(amount, token)
  }))
}

export function createHttpRewardDiscoveryService(
  options: CreateHttpRewardDiscoveryServiceOptions = {}
): VaultWidgetRewardDiscoveryService {
  const endpoint = options.endpoint ?? '/api/merkl/rewards'
  const fetcher = options.fetcher ?? fetch
  return {
    async discover({ account, config, publicClient, signal }) {
      const [merkle, staking] = await Promise.all([
        discoverMerkleRewards({ account, config, endpoint, fetcher, publicClient, signal }),
        discoverStakingRewards({ account, config, publicClient })
      ])
      return [...staking, ...merkle]
    }
  }
}
