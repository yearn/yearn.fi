import { zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { YBOLD_STAKING_ADDRESS } from './normalizeVault'
import { getRegisteredStakingContract, isRegisteredStakingContract } from './stakingRegistry'

describe('stakingRegistry', () => {
  it('matches a registered chain, address, and source', () => {
    expect(
      isRegisteredStakingContract({
        chainId: 1,
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'yBOLD'
      })
    ).toBe(true)
  })

  it('rejects the right address on the wrong chain', () => {
    expect(
      isRegisteredStakingContract({
        chainId: 10,
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'yBOLD'
      })
    ).toBe(false)
  })

  it('rejects unregistered addresses', () => {
    expect(
      isRegisteredStakingContract({
        chainId: 1,
        stakingAddress: '0x2222222222222222222222222222222222222222',
        stakingSource: 'yBOLD'
      })
    ).toBe(false)
  })

  it('rejects source mismatches', () => {
    expect(
      isRegisteredStakingContract({
        chainId: 1,
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'Legacy'
      })
    ).toBe(false)
  })

  it('rejects the zero address', () => {
    expect(
      isRegisteredStakingContract({
        chainId: 1,
        stakingAddress: zeroAddress,
        stakingSource: 'yBOLD'
      })
    ).toBe(false)
  })

  it('normalizes mixed-case metadata addresses', () => {
    const entry = getRegisteredStakingContract({
      chainId: 1,
      stakingAddress: YBOLD_STAKING_ADDRESS.toLowerCase(),
      stakingSource: 'yBOLD'
    })

    expect(entry?.address).toBe(YBOLD_STAKING_ADDRESS)
    expect(entry?.adapter).toBe('tokenizedStrategy')
  })
})
