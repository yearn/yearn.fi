import { type Address, encodeFunctionData, type Hex } from 'viem'
import type { VaultWidgetQuote, VaultWidgetToken } from '../types'

export const MERKLE_DISTRIBUTOR_ADDRESS = '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae' as Address

export const MERKLE_DISTRIBUTOR_ABI = [
  {
    inputs: [
      { name: 'users', type: 'address[]' },
      { name: 'tokens', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'proofs', type: 'bytes32[][]' }
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

export const STAKING_CLAIM_ABI = [
  {
    inputs: [],
    name: 'getReward',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

export type VaultWidgetMerkleReward = {
  accumulated: bigint
  proof: readonly Hex[]
  token: VaultWidgetToken
}

export function createMerkleClaimQuote(params: {
  account: Address
  chainId: number
  rewards: readonly VaultWidgetMerkleReward[]
}): VaultWidgetQuote {
  if (params.rewards.length === 0) throw new Error('No Merkle rewards are claimable')
  const amount = params.rewards.reduce((total, reward) => total + reward.accumulated, 0n)
  return {
    actionLabel: 'Claim',
    activityAmount: amount.toString(),
    activityType: 'claim',
    adapterId: 'merkle-rewards',
    amountIn: 0n,
    expectedOut: amount,
    minExpectedOut: amount,
    positionAmount: 0n,
    transaction: {
      chainId: params.chainId,
      to: MERKLE_DISTRIBUTOR_ADDRESS,
      data: encodeFunctionData({
        abi: MERKLE_DISTRIBUTOR_ABI,
        functionName: 'claim',
        args: [
          params.rewards.map(() => params.account),
          params.rewards.map(({ token }) => token.address),
          params.rewards.map(({ accumulated }) => accumulated),
          params.rewards.map(({ proof }) => [...proof])
        ]
      })
    }
  }
}

export function createStakingClaimQuote(params: {
  chainId: number
  stakingAddress: Address
  rewards: readonly { amount: bigint; token: VaultWidgetToken }[]
}): VaultWidgetQuote {
  if (params.rewards.length === 0) throw new Error('No staking rewards are claimable')
  const amount = params.rewards.reduce((total, reward) => total + reward.amount, 0n)
  return {
    actionLabel: 'Claim',
    activityAmount: amount.toString(),
    activityType: 'claim',
    adapterId: 'staking-rewards',
    amountIn: 0n,
    expectedOut: amount,
    minExpectedOut: amount,
    positionAmount: 0n,
    transaction: {
      chainId: params.chainId,
      to: params.stakingAddress,
      data: encodeFunctionData({
        abi: STAKING_CLAIM_ABI,
        functionName: 'getReward'
      })
    }
  }
}
