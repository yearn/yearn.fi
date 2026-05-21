import { YBOLD_STAKING_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { isClaimStakingRewardsEnabled } from './useClaimStakingRewards'
import { isStakingRewardsReadEnabled, type TRewardToken } from './useStakingRewards'

const USER: Address = '0x1111111111111111111111111111111111111111'
const UNREGISTERED_STAKING: Address = '0x2222222222222222222222222222222222222222'
const REWARD_TOKEN: TRewardToken = {
  address: '0x3333333333333333333333333333333333333333',
  symbol: 'RWD',
  decimals: 18,
  price: 1,
  isFinished: false
}

describe('staking rewards registry guards', () => {
  it('requires registered reward read selectors for staking reward reads', () => {
    expect(
      isStakingRewardsReadEnabled({
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'yBOLD',
        rewardTokens: [REWARD_TOKEN],
        userAddress: USER,
        chainId: 1
      })
    ).toBe(false)

    expect(
      isStakingRewardsReadEnabled({
        stakingAddress: UNREGISTERED_STAKING,
        stakingSource: 'yBOLD',
        rewardTokens: [REWARD_TOKEN],
        userAddress: USER,
        chainId: 1
      })
    ).toBe(false)
  })

  it('requires registered claim selectors for staking reward claims', () => {
    expect(
      isClaimStakingRewardsEnabled({
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'yBOLD',
        chainId: 1
      })
    ).toBe(false)

    expect(
      isClaimStakingRewardsEnabled({
        stakingAddress: YBOLD_STAKING_ADDRESS,
        stakingSource: 'Legacy',
        chainId: 1
      })
    ).toBe(false)
  })
})
