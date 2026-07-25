import { type Address, formatUnits, type Hex, isAddress, isAddressEqual, type PublicClient } from 'viem'
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
  claimed: string
  proofs: Hex[]
  token: {
    address: Address
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
  claimedReadTimeoutMs?: number
  endpoint?: string
  fetcher?: typeof fetch
}

const DEFAULT_CLAIMED_READ_TIMEOUT_MS = 10_000

function rewardUsdValue(amount: bigint, token: VaultWidgetRewardToken): number {
  return Number(formatUnits(amount, token.decimals)) * (token.priceUsd ?? 0)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Merkle claimed read timed out')), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function parseMerklAmount(value: string, field: 'amount' | 'claimed'): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`Merkl returned an invalid ${field}`)
  return BigInt(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function parseMerklReward(value: unknown): MerklReward {
  if (!isRecord(value)) throw new Error('Merkl returned an invalid reward')
  const token = value.token
  if (!isRecord(token)) throw new Error('Merkl returned an invalid reward token')
  if (typeof value.amount !== 'string') throw new Error('Merkl returned an invalid amount')
  if (typeof value.claimed !== 'string') throw new Error('Merkl returned an invalid claimed')
  parseMerklAmount(value.amount, 'amount')
  parseMerklAmount(value.claimed, 'claimed')
  if (
    typeof token.address !== 'string' ||
    !isAddress(token.address) ||
    typeof token.decimals !== 'number' ||
    !Number.isInteger(token.decimals) ||
    token.decimals < 0 ||
    token.decimals > 255 ||
    typeof token.symbol !== 'string' ||
    token.symbol.length === 0 ||
    (token.price !== undefined &&
      token.price !== null &&
      (typeof token.price !== 'number' || !Number.isFinite(token.price) || token.price < 0))
  ) {
    throw new Error('Merkl returned an invalid reward token')
  }
  if (
    !Array.isArray(value.proofs) ||
    !value.proofs.every((proof): proof is Hex => typeof proof === 'string' && /^0x[0-9a-fA-F]{64}$/.test(proof))
  ) {
    throw new Error('Merkl returned an invalid reward proof')
  }
  return {
    amount: value.amount,
    claimed: value.claimed,
    proofs: value.proofs,
    token: {
      address: token.address,
      decimals: token.decimals,
      price: typeof token.price === 'number' ? token.price : undefined,
      symbol: token.symbol
    }
  }
}

function parseMerklResponse(value: unknown): MerklResponse {
  if (!Array.isArray(value)) throw new Error('Merkl returned an invalid rewards response')
  return value.map((entry) => {
    if (!isRecord(entry) || !isRecord(entry.chain) || !Array.isArray(entry.rewards)) {
      throw new Error('Merkl returned an invalid chain reward entry')
    }
    const chainId = entry.chain.id
    if (typeof chainId !== 'number' || !Number.isSafeInteger(chainId) || chainId <= 0) {
      throw new Error('Merkl returned an invalid reward chain')
    }
    return {
      chain: { id: chainId },
      rewards: entry.rewards.map(parseMerklReward)
    }
  })
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

function getApiClaimedAmount(group: readonly MerklReward[]): bigint {
  return group.reduce((maximum, reward) => {
    const claimed = parseMerklAmount(reward.claimed, 'claimed')
    return claimed > maximum ? claimed : maximum
  }, 0n)
}

async function discoverMerkleRewards(params: {
  account: Address
  config: VaultWidgetConfig
  endpoint: string
  fetcher: typeof fetch
  publicClient: PublicClient
  claimedReadTimeoutMs: number
  signal?: AbortSignal
}): Promise<VaultWidgetDiscoveredReward[]> {
  const allowlist = params.config.rewards?.merkleTokenAllowlist ?? []
  if (allowlist.length === 0) return []
  const query = new URLSearchParams({
    chainId: String(params.config.chainId),
    userAddress: params.account
  })
  const fetcher = params.fetcher
  const response = await fetcher(`${params.endpoint}?${query}`, { signal: params.signal })
  if (!response.ok) throw new Error(`Unable to load Merkle rewards (${response.status})`)
  const payload = parseMerklResponse(await response.json())
  const rewards =
    payload
      .find(({ chain }) => chain.id === params.config.chainId)
      ?.rewards.filter(({ token }) => allowlist.some((address) => isAddressEqual(address, token.address))) ?? []

  const groups = await Promise.all(
    Object.values(groupMerklRewards(rewards)).map(async (group) => {
      const first = group[0]
      if (!first) throw new Error('Merkle reward group is empty')
      const address = first.token.address
      const claimed = await withTimeout(
        params.publicClient.readContract({
          address: MERKLE_DISTRIBUTOR_ADDRESS,
          abi: CLAIMED_ABI,
          functionName: 'claimed',
          args: [params.account, address]
        }),
        params.claimedReadTimeoutMs
      ).catch(() => getApiClaimedAmount(group))
      const claimable = group
        .map((reward) => ({ accumulated: parseMerklAmount(reward.amount, 'amount'), reward }))
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
            claimable: accumulated - claimed,
            proof: reward.proofs,
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
  if (rewards.stakingSource === 'Juiced' || rewards.stakingSource === 'OP Boost') {
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
    .filter(({ amount }) => amount > 0n)
  if (claimable.length === 0) return []
  return claimable.map(({ amount, token }) => ({
    amount,
    id: `staking:${rewards.stakingAddress}:${token.address}`,
    kind: 'staking',
    quote: createStakingClaimQuote({
      chainId: params.config.chainId,
      rewards: [{ amount, token }],
      stakingAddress: rewards.stakingAddress!
    }),
    token,
    usdValue: rewardUsdValue(amount, token)
  }))
}

export function createHttpRewardDiscoveryService(
  options: CreateHttpRewardDiscoveryServiceOptions = {}
): VaultWidgetRewardDiscoveryService {
  const claimedReadTimeoutMs = options.claimedReadTimeoutMs ?? DEFAULT_CLAIMED_READ_TIMEOUT_MS
  if (!Number.isFinite(claimedReadTimeoutMs) || claimedReadTimeoutMs <= 0) {
    throw new Error('Merkle claimed read timeout must be positive')
  }
  const endpoint = options.endpoint ?? '/api/merkl/rewards'
  const fetcher = options.fetcher ?? fetch
  return {
    async discover({ account, config, publicClient, signal }) {
      const [merkle, staking] = await Promise.all([
        discoverMerkleRewards({ account, claimedReadTimeoutMs, config, endpoint, fetcher, publicClient, signal }),
        discoverStakingRewards({ account, config, publicClient })
      ])
      return [...staking, ...merkle]
    }
  }
}
