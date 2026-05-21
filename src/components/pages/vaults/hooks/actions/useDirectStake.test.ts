import { YBOLD_STAKING_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { describe, expect, it } from 'vitest'
import { getDirectStakeApprovalArgs } from './useDirectStake'

describe('getDirectStakeApprovalArgs', () => {
  it('returns approval args for a registered staking contract', () => {
    expect(
      getDirectStakeApprovalArgs({
        chainId: 1,
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'yBOLD',
        amount: 100n
      })
    ).toEqual([YBOLD_STAKING_ADDRESS, 100n])
  })

  it('does not return approval args for unregistered staking metadata', () => {
    expect(
      getDirectStakeApprovalArgs({
        chainId: 1,
        stakingAddress: '0x2222222222222222222222222222222222222222',
        stakingSource: 'yBOLD',
        amount: 100n
      })
    ).toBeUndefined()
  })

  it('does not return approval args for source mismatches', () => {
    expect(
      getDirectStakeApprovalArgs({
        chainId: 1,
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'Legacy',
        amount: 100n
      })
    ).toBeUndefined()
  })
})
