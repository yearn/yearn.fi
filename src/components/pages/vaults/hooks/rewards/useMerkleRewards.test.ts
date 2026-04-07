import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { describe, expect, it } from 'vitest'
import {
  buildMerkleRewards,
  filterYearnMerkleRewards,
  type MerklAPIResponse,
  type MerklV4Reward
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
    rewards: [KAT_REWARD, OTHER_REWARD]
  }
]

describe('useMerkleRewards helpers', () => {
  it('filters Merkl rewards down to Yearn product reward tokens', () => {
    expect(filterYearnMerkleRewards([KAT_REWARD, OTHER_REWARD], KATANA_CHAIN_ID)).toEqual([KAT_REWARD])
  })

  it('returns no rewards for chains without an allowlisted Yearn token set', () => {
    expect(filterYearnMerkleRewards([KAT_REWARD], 1)).toEqual([])
  })

  it('builds filtered Merkle rewards and hides claimed roots immediately', () => {
    const rewards = buildMerkleRewards(MERKL_RESPONSE, KATANA_CHAIN_ID, [KAT_REWARD.root as `0x${string}`])

    expect(rewards).toEqual([])
  })

  it('preserves the reward root and unclaimed amount for visible Yearn rewards', () => {
    const rewards = buildMerkleRewards(MERKL_RESPONSE, KATANA_CHAIN_ID)

    expect(rewards).toHaveLength(1)
    expect(rewards[0]).toMatchObject({
      root: KAT_REWARD.root,
      unclaimed: 1500000000000000000n,
      token: {
        symbol: 'KAT'
      }
    })
  })
})
