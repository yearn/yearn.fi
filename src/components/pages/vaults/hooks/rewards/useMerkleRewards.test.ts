import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { describe, expect, it } from 'vitest'
import {
  buildMerkleRewardKey,
  buildMerkleRewards,
  filterYearnMerkleRewards,
  type MerklAPIResponse,
  type MerklV4Reward,
  shouldDeferMerkleRewardRendering
} from './useMerkleRewards'

const KAT_REWARD: MerklV4Reward = {
  root: '0x1111111111111111111111111111111111111111111111111111111111111111',
  amount: '2000000000000000000',
  claimed: '500000000000000000',
  pending: '0',
  proofs: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
  token: {
    address: '0x3ba1fbC4c3aEA775d335b31fb53778f46FD3a330',
    symbol: 'KAT',
    decimals: 18,
    price: 0.01
  }
}

const KAT_NATIVE_REWARD: MerklV4Reward = {
  root: '0x3333333333333333333333333333333333333333333333333333333333333333',
  amount: '3000000000000000000',
  claimed: '0',
  pending: '0',
  proofs: ['0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'],
  token: {
    address: '0x7F1f4b4b29f5058fA32CC7a97141b8D7e5ABDC2d',
    symbol: 'KAT',
    decimals: 18,
    price: 0.01
  }
}

const OTHER_REWARD: MerklV4Reward = {
  root: '0x2222222222222222222222222222222222222222222222222222222222222222',
  amount: '1000000',
  claimed: '0',
  pending: '0',
  proofs: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
  token: {
    address: '0x9999999999999999999999999999999999999999',
    symbol: 'OTHER',
    decimals: 6,
    price: 1
  }
}

const MERKL_RESPONSE: MerklAPIResponse = [
  {
    chain: { id: KATANA_CHAIN_ID },
    rewards: [KAT_REWARD, KAT_NATIVE_REWARD, OTHER_REWARD]
  }
]

describe('useMerkleRewards helpers', () => {
  it('filters Merkl rewards down to Yearn product reward tokens across KAT aliases', () => {
    expect(filterYearnMerkleRewards([KAT_REWARD, KAT_NATIVE_REWARD, OTHER_REWARD], KATANA_CHAIN_ID)).toEqual([
      KAT_REWARD,
      KAT_NATIVE_REWARD
    ])
  })

  it('returns no rewards for chains without an allowlisted Yearn token set', () => {
    expect(filterYearnMerkleRewards([KAT_REWARD], 1)).toEqual([])
  })

  it('hides only the claimed reward entries when multiple rewards share a root', () => {
    const sharedRoot = '0x4444444444444444444444444444444444444444444444444444444444444444'
    const sharedRootWrappedReward = { ...KAT_REWARD, root: sharedRoot }
    const sharedRootNativeReward = { ...KAT_NATIVE_REWARD, root: sharedRoot }
    const rewards = buildMerkleRewards(
      [
        {
          chain: { id: KATANA_CHAIN_ID },
          rewards: [sharedRootWrappedReward, sharedRootNativeReward]
        }
      ],
      KATANA_CHAIN_ID,
      [buildMerkleRewardKey(sharedRootWrappedReward.root, sharedRootWrappedReward.token.address)]
    )

    expect(rewards).toEqual([
      expect.objectContaining({
        root: sharedRootNativeReward.root,
        token: expect.objectContaining({
          address: sharedRootNativeReward.token.address
        }),
        unclaimed: 3000000000000000000n
      })
    ])
  })

  it('uses onchain claimed amounts when the Merkl API claimed field is stale', () => {
    const rewards = buildMerkleRewards(MERKL_RESPONSE, KATANA_CHAIN_ID, [], {
      '0x7f1f4b4b29f5058fa32cc7a97141b8d7e5abdc2d': 3000000000000000000n
    })

    expect(rewards).toHaveLength(1)
    expect(rewards[0]).toMatchObject({
      root: KAT_REWARD.root,
      unclaimed: 1500000000000000000n,
      token: {
        symbol: 'KAT'
      }
    })
  })

  it('defers rendering Merkle rewards until onchain claim status has loaded', () => {
    expect(shouldDeferMerkleRewardRendering(2, true)).toBe(true)
    expect(shouldDeferMerkleRewardRendering(0, true)).toBe(false)
    expect(shouldDeferMerkleRewardRendering(2, false)).toBe(false)
  })

  it('preserves the reward root and unclaimed amount for visible Yearn rewards', () => {
    const rewards = buildMerkleRewards(MERKL_RESPONSE, KATANA_CHAIN_ID)

    expect(rewards).toHaveLength(2)
    expect(rewards[0]).toMatchObject({
      root: KAT_REWARD.root,
      unclaimed: 1500000000000000000n,
      token: {
        symbol: 'KAT'
      }
    })
    expect(rewards[1]).toMatchObject({
      root: KAT_NATIVE_REWARD.root,
      unclaimed: 3000000000000000000n,
      token: {
        symbol: 'KAT'
      }
    })
  })
})
