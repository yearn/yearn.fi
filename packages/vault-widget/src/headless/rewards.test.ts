import { decodeFunctionData } from 'viem'
import { describe, expect, it } from 'vitest'
import type { VaultWidgetToken } from '../types'
import {
  createMerkleClaimQuote,
  createStakingClaimQuote,
  MERKLE_DISTRIBUTOR_ABI,
  MERKLE_DISTRIBUTOR_ADDRESS,
  STAKING_CLAIM_ABI
} from './rewards'
import { buildTransactionPlan } from './transactionPlan'

const account = '0x1111111111111111111111111111111111111111'
const stakingAddress = '0x2222222222222222222222222222222222222222'
const token: VaultWidgetToken = {
  address: '0x3333333333333333333333333333333333333333',
  chainId: 1,
  decimals: 18,
  symbol: 'YFI'
}

describe('reward plans', () => {
  it('batches Merkle claims using accumulated amounts and proofs', () => {
    const proof = `0x${'11'.repeat(32)}` as const
    const quote = createMerkleClaimQuote({
      account,
      chainId: 1,
      rewards: [{ accumulated: 15n, proof: [proof], token }]
    })
    const decoded = decodeFunctionData({ abi: MERKLE_DISTRIBUTOR_ABI, data: quote.transaction.data })

    expect(quote.transaction.to).toBe(MERKLE_DISTRIBUTOR_ADDRESS)
    expect(quote.activityType).toBe('claim')
    expect(decoded).toEqual({
      functionName: 'claim',
      args: [[account], [token.address], [15n], [[proof]]]
    })
  })

  it('builds a source-compatible staking getReward plan', () => {
    const quote = createStakingClaimQuote({
      chainId: 1,
      rewards: [{ amount: 9n, token }],
      stakingAddress
    })
    const plan = buildTransactionPlan({ allowance: 0n, mode: 'rewards', quote })

    expect(decodeFunctionData({ abi: STAKING_CLAIM_ABI, data: quote.transaction.data })).toEqual({
      functionName: 'getReward'
    })
    expect(plan.mode).toBe('rewards')
    expect(plan.steps.find(({ id }) => id === 'rewards')?.label).toBe('Claim rewards')
  })
})
