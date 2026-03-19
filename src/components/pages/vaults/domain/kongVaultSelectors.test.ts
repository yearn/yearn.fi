import { describe, expect, it } from 'vitest'
import { getVaultAPR, getVaultStaking, getVaultStrategies } from './kongVaultSelectors'

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

describe('getVaultStrategies', () => {
  const vault = {
    chainId: 1,
    address: '0x1111111111111111111111111111111111111111'
  } as any

  it('prefers composition estimated apy over oracle apy', () => {
    const strategies = getVaultStrategies(vault, {
      totalAssets: '1000000',
      composition: [
        {
          address: '0x5555555555555555555555555555555555555555',
          name: 'Strategy A',
          status: 'active',
          totalDebt: '500000',
          currentDebt: '500000',
          performance: {
            estimated: {
              apr: 0.07,
              apy: 0.12,
              type: 'yvusd-estimated-apr',
              components: {}
            },
            oracle: {
              apr: 0.08,
              apy: 0.09
            }
          }
        }
      ]
    } as any)

    expect(strategies[0]?.estimatedAPY).toBe(0.12)
  })

  it('falls back to composition oracle apy when estimated apy is missing', () => {
    const strategies = getVaultStrategies(vault, {
      totalAssets: '1000000',
      composition: [
        {
          address: '0x6666666666666666666666666666666666666666',
          name: 'Strategy B',
          status: 'active',
          totalDebt: '500000',
          currentDebt: '500000',
          performance: {
            estimated: {
              apr: 0.11,
              type: 'yvusd-estimated-apr',
              components: {}
            },
            oracle: {
              apr: 0.08,
              apy: 0.09
            }
          }
        }
      ]
    } as any)

    expect(strategies[0]?.estimatedAPY).toBe(0.09)
  })

  it('leaves estimated apy unset when neither estimated nor oracle apy exists', () => {
    const strategies = getVaultStrategies(vault, {
      totalAssets: '1000000',
      composition: [
        {
          address: '0x7777777777777777777777777777777777777777',
          name: 'Strategy C',
          status: 'active',
          totalDebt: '500000',
          currentDebt: '500000',
          performance: {
            estimated: {
              apr: 0.11,
              type: 'yvusd-estimated-apr',
              components: {}
            },
            oracle: {
              apr: 0.08
            }
          }
        }
      ]
    } as any)

    expect(strategies[0]?.estimatedAPY).toBeUndefined()
  })

  it('uses oracle apy as base for katana strategies — estimated apr is KAT rewards only', () => {
    const strategies = getVaultStrategies(vault, {
      totalAssets: '1000000',
      composition: [
        {
          address: '0x8888888888888888888888888888888888888888',
          name: 'Morpho Strategy',
          status: 'active',
          totalDebt: '500000',
          currentDebt: '500000',
          performance: {
            estimated: {
              apr: 0.0028,
              type: 'katana-estimated-apr'
            },
            oracle: {
              apr: 0.03,
              apy: 0.04
            }
          }
        }
      ]
    } as any)

    // estimatedAPY should be oracle.apy (base yield), not estimated.apr (KAT rewards)
    expect(strategies[0]?.estimatedAPY).toBe(0.04)
    expect(strategies[0]?.katRewardsAPR).toBe(0.0028)
  })

  it('leaves estimatedAPY undefined for katana strategies when neither estimated.apy nor oracle.apy exists', () => {
    const strategies = getVaultStrategies(vault, {
      totalAssets: '1000000',
      composition: [
        {
          address: '0x8888888888888888888888888888888888888888',
          name: 'Morpho Strategy',
          status: 'active',
          totalDebt: '500000',
          currentDebt: '500000',
          performance: {
            estimated: {
              apr: 0.0028,
              type: 'katana-estimated-apr'
            }
          }
        }
      ]
    } as any)

    expect(strategies[0]?.estimatedAPY).toBeUndefined()
    expect(strategies[0]?.katRewardsAPR).toBe(0.0028)
  })

  it('does not set katRewardsAPR for non-katana strategies', () => {
    const strategies = getVaultStrategies(vault, {
      totalAssets: '1000000',
      composition: [
        {
          address: '0x9999999999999999999999999999999999999999',
          name: 'Regular Strategy',
          status: 'active',
          totalDebt: '500000',
          currentDebt: '500000',
          performance: {
            estimated: {
              apr: 0.05,
              apy: 0.06,
              type: 'yvusd-estimated-apr',
              components: {}
            }
          }
        }
      ]
    } as any)

    expect(strategies[0]?.estimatedAPY).toBe(0.06)
    expect(strategies[0]?.katRewardsAPR).toBeUndefined()
  })

  it('prefers estimated apy over estimated apr even for katana strategies', () => {
    const strategies = getVaultStrategies(vault, {
      totalAssets: '1000000',
      composition: [
        {
          address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Katana Strategy with APY',
          status: 'active',
          totalDebt: '500000',
          currentDebt: '500000',
          performance: {
            estimated: {
              apr: 0.003,
              apy: 0.05,
              type: 'katana-estimated-apr',
              components: {}
            }
          }
        }
      ]
    } as any)

    expect(strategies[0]?.estimatedAPY).toBe(0.05)
    expect(strategies[0]?.katRewardsAPR).toBe(0.003)
  })
})
