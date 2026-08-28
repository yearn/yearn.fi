import { YCRV_APP_URL, YCRV_TOKEN_ADDRESS, YVCRVUSD_REWARD_ADDRESS } from '@pages/portfolio/ycrv/constants'
import { deriveYcrvPosition, deriveYcrvReward } from '@pages/portfolio/ycrv/deriveYcrvPosition'
import type { TYcrvRawAccount } from '@pages/portfolio/ycrv/types'
import { describe, expect, it } from 'vitest'

const ONE = 10n ** 18n

const buildRawAccount = (overrides: Partial<TYcrvRawAccount> = {}): TYcrvRawAccount => ({
  balanceRaw: 100n * ONE,
  totalSupplyRaw: 1_000n * ONE,
  userActiveAprRaw: 8n * 10n ** 16n,
  userActiveBoostRaw: 2n * ONE,
  claimableRewardRaw: 5n * ONE,
  ...overrides
})

describe('deriveYcrvPosition', () => {
  it('derives the boosted staker position from yCRV units and WAD metrics', () => {
    const position = deriveYcrvPosition(buildRawAccount(), 0.25)

    expect(position).toMatchObject({
      id: 'ycrv-boosted-staker',
      kind: 'ycrv-staker',
      name: 'Staked yCRV',
      symbol: 'yCRV',
      href: YCRV_APP_URL,
      tokenAddress: YCRV_TOKEN_ADDRESS,
      amountNormalized: 100,
      valueUsd: 25,
      tvlUsd: 250,
      apy: 0.08,
      boostMultiplier: 2
    })
  })

  it('hides accounts without a staked balance', () => {
    expect(deriveYcrvPosition(buildRawAccount({ balanceRaw: 0n }), 0.25)).toBeNull()
  })

  it('keeps the position visible when its price is temporarily unavailable', () => {
    expect(deriveYcrvPosition(buildRawAccount(), 0)).toMatchObject({ valueUsd: 0, tvlUsd: 0 })
  })

  it('uses unavailable APY when the utility returns zero', () => {
    expect(deriveYcrvPosition(buildRawAccount({ userActiveAprRaw: 0n }), 0.25)?.apy).toBeNull()
  })
})

describe('deriveYcrvReward', () => {
  it('derives yvcrvUSD rewards independently of the current staked balance', () => {
    const reward = deriveYcrvReward(buildRawAccount({ balanceRaw: 0n }), 1.1)

    expect(reward).toEqual({
      tokenAddress: YVCRVUSD_REWARD_ADDRESS,
      symbol: 'yvcrvUSD-2',
      amountRaw: 5n * ONE,
      amountNormalized: 5,
      usdValue: 5.5
    })
  })

  it('hides empty rewards', () => {
    expect(deriveYcrvReward(buildRawAccount({ claimableRewardRaw: 0n }), 1.1)).toBeNull()
  })
})
