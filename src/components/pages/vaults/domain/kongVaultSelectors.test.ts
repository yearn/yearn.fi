import { describe, expect, it } from 'vitest'
import { getVaultAPR, getVaultStaking } from './kongVaultSelectors'

const LIST_REWARD = {
  address: '0x3333333333333333333333333333333333333333',
  name: 'List Reward',
  symbol: 'LR',
  decimals: 18,
  price: 1,
  isFinished: false,
  finishedAt: 0,
  apr: 0.5,
  perWeek: 10
}

const SNAPSHOT_REWARD = {
  address: '0x4444444444444444444444444444444444444444',
  name: 'Snapshot Reward',
  symbol: 'SR',
  decimals: 6,
  price: 2,
  isFinished: true,
  finishedAt: 123,
  apr: 1.5,
  perWeek: 20
}

describe('getVaultStaking', () => {
  it('preserves list staking source and rewards when snapshot metadata is missing', () => {
    const vault = {
      staking: {
        address: '0x2222222222222222222222222222222222222222',
        available: false,
        source: 'yBOLD',
        rewards: [LIST_REWARD]
      }
    } as any

    const staking = getVaultStaking(vault, {
      staking: {
        address: '0x2222222222222222222222222222222222222222',
        available: true
      }
    } as any)

    expect(staking.source).toBe('yBOLD')
    expect(staking.rewards ?? []).toHaveLength(1)
    expect(staking.rewards?.[0].symbol).toBe('LR')
  })

  it('prefers snapshot staking source and rewards when they are present', () => {
    const vault = {
      staking: {
        address: '0x2222222222222222222222222222222222222222',
        available: false,
        source: 'legacy',
        rewards: [LIST_REWARD]
      }
    } as any

    const staking = getVaultStaking(vault, {
      staking: {
        address: '0x2222222222222222222222222222222222222222',
        available: true,
        source: 'VeYFI',
        rewards: [SNAPSHOT_REWARD]
      }
    } as any)

    expect(staking.source).toBe('VeYFI')
    expect(staking.rewards ?? []).toHaveLength(1)
    expect(staking.rewards?.[0].symbol).toBe('SR')
  })
})

describe('getVaultAPR', () => {
  it('uses list pricePerShare when snapshot pricePerShare is missing', () => {
    const apr = getVaultAPR({
      chainId: 1,
      address: '0x1111111111111111111111111111111111111111',
      name: 'Vault',
      symbol: 'yvTEST',
      decimals: 18,
      asset: {
        address: '0x2222222222222222222222222222222222222222',
        name: 'USDC',
        symbol: 'USDC',
        decimals: 6
      },
      tvl: 1000,
      performance: {
        oracle: { apr: 0.02, apy: 0.02 },
        estimated: { apr: 0.02, apy: 0.02, type: 'oracle', components: {} },
        historical: { net: 0.01, weeklyNet: 0.01, monthlyNet: 0.01, inceptionNet: 0.01 }
      },
      fees: {
        managementFee: 0,
        performanceFee: 0
      },
      category: 'Stablecoin',
      type: 'Standard',
      kind: 'Single Strategy',
      v3: true,
      yearn: true,
      isRetired: false,
      isHidden: false,
      isBoosted: false,
      isHighlighted: false,
      strategiesCount: 1,
      riskLevel: 1,
      staking: null,
      pricePerShare: '1050000'
    } as any)

    expect(apr.pricePerShare.today).toBeCloseTo(1.05, 8)
  })
})
