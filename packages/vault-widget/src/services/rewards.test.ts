import { decodeFunctionData, type PublicClient } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { MERKLE_DISTRIBUTOR_ABI, MERKLE_DISTRIBUTOR_ADDRESS } from '../headless/rewards'
import type { VaultWidgetConfig, VaultWidgetRewardToken } from '../types'
import { createHttpRewardDiscoveryService } from './rewards'

const account = '0x1111111111111111111111111111111111111111'
const vaultAddress = '0x2222222222222222222222222222222222222222'
const assetAddress = '0x3333333333333333333333333333333333333333'
const rewardAddress = '0x4444444444444444444444444444444444444444'
const otherRewardAddress = '0x5555555555555555555555555555555555555555'
const stakingAddress = '0x6666666666666666666666666666666666666666'

function rewardToken(
  address: `0x${string}` = rewardAddress,
  overrides: Partial<VaultWidgetRewardToken> = {}
): VaultWidgetRewardToken {
  return {
    address,
    chainId: 1,
    decimals: 6,
    priceUsd: 2,
    symbol: 'RWD',
    ...overrides
  }
}

function config(rewards: VaultWidgetConfig['rewards']): VaultWidgetConfig {
  return {
    adapters: [],
    chainId: 1,
    depositTokens: [],
    id: `1:${vaultAddress}`,
    name: 'Test vault',
    positionToken: {
      address: vaultAddress,
      chainId: 1,
      decimals: 18,
      symbol: 'yvTEST'
    },
    rewards,
    vaultAddress,
    withdrawTokens: [
      {
        address: assetAddress,
        chainId: 1,
        decimals: 6,
        symbol: 'TEST'
      }
    ]
  }
}

describe('createHttpRewardDiscoveryService', () => {
  it('filters Merkl rewards, subtracts claimed amounts, and preserves accumulated claim calldata', async () => {
    const fetcher = vi.fn(async () =>
      Response.json([
        {
          chain: { id: 1 },
          rewards: [
            {
              amount: '100000000',
              proofs: [`0x${'11'.repeat(32)}`],
              token: {
                address: rewardAddress,
                decimals: 6,
                price: 2,
                symbol: 'RWD'
              }
            },
            {
              amount: '50000000',
              proofs: [`0x${'22'.repeat(32)}`],
              token: {
                address: otherRewardAddress,
                decimals: 6,
                price: 1,
                symbol: 'OTHER'
              }
            }
          ]
        }
      ])
    )
    const readContract = vi.fn(async () => 25_000_000n)
    const publicClient = { readContract } as unknown as PublicClient
    const rewards = await createHttpRewardDiscoveryService({ fetcher }).discover({
      account,
      config: config({
        merkleTokenAllowlist: [rewardAddress],
        tokens: [rewardToken()]
      }),
      publicClient
    })

    expect(fetcher).toHaveBeenCalledWith(
      `/api/merkl/rewards?chainId=1&userAddress=${account}`,
      expect.objectContaining({ signal: undefined })
    )
    expect(rewards).toHaveLength(1)
    expect(rewards[0]).toMatchObject({
      amount: 75_000_000n,
      id: `merkle:${rewardAddress}`,
      kind: 'merkle',
      quote: {
        activityAmount: '75',
        expectedOut: 75_000_000n,
        minExpectedOut: 75_000_000n
      },
      usdValue: 150
    })
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MERKLE_DISTRIBUTOR_ADDRESS,
        functionName: 'claimed',
        args: [account, rewardAddress]
      })
    )
    expect(
      decodeFunctionData({
        abi: MERKLE_DISTRIBUTOR_ABI,
        data: rewards[0]!.quote.transaction.data
      }).args?.[2]
    ).toEqual([100_000_000n])
  })

  it('discovers V3 multi-token staking rewards and creates one getReward transaction', async () => {
    const first = rewardToken()
    const second = rewardToken(otherRewardAddress, { symbol: 'RWD2' })
    const fetcher = vi.fn()
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'earnedMulti') return [2_000_000n, 0n]
      throw new Error(`Unexpected read: ${functionName}`)
    })
    const publicClient = { readContract } as unknown as PublicClient
    const rewards = await createHttpRewardDiscoveryService({ fetcher }).discover({
      account,
      config: config({
        stakingAddress,
        stakingSource: 'V3 Staking',
        tokens: [first, second]
      }),
      publicClient
    })

    expect(fetcher).not.toHaveBeenCalled()
    expect(rewards).toHaveLength(1)
    expect(rewards[0]).toMatchObject({
      amount: 2_000_000n,
      kind: 'staking',
      token: first,
      usdValue: 4
    })
    expect(rewards[0]!.quote).toMatchObject({
      adapterId: 'staking-rewards',
      transaction: { chainId: 1, to: stakingAddress }
    })
  })

  it('reads OP Boost rewards with the same per-token contract interface as Juiced staking', async () => {
    const first = rewardToken()
    const second = rewardToken(otherRewardAddress, { symbol: 'RWD2' })
    const readContract = vi.fn().mockResolvedValueOnce(2_000_000n).mockResolvedValueOnce(3_000_000n)
    const rewards = await createHttpRewardDiscoveryService({ fetcher: vi.fn() }).discover({
      account,
      config: config({
        stakingAddress,
        stakingSource: 'OP Boost',
        tokens: [first, second]
      }),
      publicClient: { readContract } as unknown as PublicClient
    })

    expect(readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: 'earned', args: [account, first.address] })
    )
    expect(readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: 'earned', args: [account, second.address] })
    )
    expect(rewards.map(({ amount }) => amount)).toEqual([2_000_000n, 3_000_000n])
    expect(rewards.map(({ quote }) => quote.activityAmount)).toEqual(['2', '3'])
    expect(rewards.map(({ quote }) => quote.expectedOut)).toEqual([2_000_000n, 3_000_000n])
  })
})
