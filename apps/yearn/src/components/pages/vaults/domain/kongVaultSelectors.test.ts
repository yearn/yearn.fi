import { calculateVaultEstimatedAPY } from '@shared/utils/vaultApy'
import { describe, expect, it } from 'vitest'
import { getVaultAPR, getVaultStaking, getVaultStrategies, getVaultTVL } from './kongVaultSelectors'

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

const BASE_LIST_VAULT = {
  chainId: 747474,
  address: '0x80c34BD3A3569E126e7055831036aa7b212cB159',
  name: 'vbUSDC yVault',
  symbol: 'yvvbUSDC',
  decimals: 6,
  asset: {
    address: '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36',
    name: 'Vault Bridge USDC',
    symbol: 'vbUSDC',
    decimals: 6
  },
  tvl: 12_592_341.595237955,
  performance: null,
  fees: null,
  category: 'Stablecoin',
  type: 'Yearn Vault',
  kind: 'Multi Strategy',
  v3: true,
  yearn: true,
  isRetired: false,
  isHidden: false,
  isBoosted: false,
  isHighlighted: true,
  strategiesCount: 7,
  riskLevel: 1,
  staking: null,
  pricePerShare: '1020958'
}

describe('getVaultTVL', () => {
  it('prefers list TVL over stale snapshot tvl.close while keeping snapshot totalAssets', () => {
    const tvl = getVaultTVL(
      BASE_LIST_VAULT as any,
      {
        totalAssets: '12593094416700',
        tvl: {
          close: 13_340_384.672131458
        }
      } as any
    )

    expect(tvl.totalAssets).toBe(12_593_094_416_700n)
    expect(tvl.tvl).toBeCloseTo(12_592_341.595237955, 6)
    expect(tvl.price).toBeCloseTo(0.9999402195014876, 12)
  })

  it('falls back to snapshot tvl.close when list TVL is missing', () => {
    const tvl = getVaultTVL(
      {
        ...BASE_LIST_VAULT,
        tvl: null
      } as any,
      {
        totalAssets: '100000000',
        tvl: {
          close: 125
        }
      } as any
    )

    expect(tvl.tvl).toBe(125)
    expect(tvl.price).toBe(1.25)
  })

  it('still prefers list TVL when snapshot totalAssets is missing', () => {
    const tvl = getVaultTVL(
      BASE_LIST_VAULT as any,
      {
        tvl: {
          close: 500
        }
      } as any
    )

    expect(tvl.totalAssets).toBe(0n)
    expect(tvl.tvl).toBe(12_592_341.595237955)
    expect(tvl.price).toBe(0)
  })

  it('keeps list TVL when no snapshot is available', () => {
    const tvl = getVaultTVL(BASE_LIST_VAULT as any)

    expect(tvl.totalAssets).toBe(0n)
    expect(tvl.tvl).toBe(12_592_341.595237955)
    expect(tvl.price).toBe(0)
  })

  it('keeps an empty vault at zero when list TVL is zero', () => {
    const tvl = getVaultTVL(
      {
        ...BASE_LIST_VAULT,
        tvl: 0
      } as any,
      {
        totalAssets: '0',
        tvl: {
          close: 100
        }
      } as any
    )

    expect(tvl.totalAssets).toBe(0n)
    expect(tvl.tvl).toBe(0)
    expect(tvl.price).toBe(0)
  })
})

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

  it('prefers oracle.netAPY over oracle.apy for v3 vault forward APR values', () => {
    const apr = getVaultAPR({
      chainId: 1,
      address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
      name: 'Vault',
      symbol: 'yvUSDC',
      decimals: 18,
      asset: {
        address: '0x2222222222222222222222222222222222222222',
        name: 'USDC',
        symbol: 'USDC',
        decimals: 6
      },
      tvl: 1000,
      performance: {
        oracle: {
          apr: 0.0375,
          apy: 0.038197965598908645,
          netAPR: 0.03375,
          netAPY: 0.03431466938555827
        },
        estimated: null,
        historical: {
          net: 0.03393884843735706,
          weeklyNet: 0.041561734471399214,
          monthlyNet: 0.03393884843735706,
          inceptionNet: 0.04906557243862686
        }
      },
      fees: {
        managementFee: 0,
        performanceFee: 0.1
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
      pricePerShare: '1000000'
    } as any)

    expect(apr.forwardAPR.netAPR).toBe(0.03431466938555827)
  })

  it('prefers Katana estimated APY over oracle APY for vault forward APR values', () => {
    const apr = getVaultAPR({
      ...BASE_LIST_VAULT,
      performance: {
        estimated: {
          apr: 0.049,
          apy: 0.051,
          type: 'katana-estimated-apr',
          components: {}
        },
        oracle: {
          apr: 0.029,
          apy: 0.03,
          netAPR: 0.028,
          netAPY: 0.03
        },
        historical: {
          net: 0.01,
          weeklyNet: 0.01,
          monthlyNet: 0.01,
          inceptionNet: 0.01
        }
      }
    } as any)

    expect(apr.forwardAPR.netAPR).toBe(0.051)
  })

  it('uses Katana estimated APR before oracle values when estimated APY is absent', () => {
    const apr = getVaultAPR({
      ...BASE_LIST_VAULT,
      performance: {
        estimated: {
          apr: 0.05,
          type: 'katana-estimated-apr',
          components: {}
        },
        oracle: {
          apr: 0.029,
          apy: 0.03,
          netAPR: 0.028,
          netAPY: 0.03
        },
        historical: {
          net: 0.01,
          weeklyNet: 0.01,
          monthlyNet: 0.01,
          inceptionNet: 0.01
        }
      }
    } as any)

    expect(apr.forwardAPR.netAPR).toBe(0.05)
  })

  it('prefers snapshot Katana estimated values over list estimated values', () => {
    const apr = getVaultAPR(
      {
        ...BASE_LIST_VAULT,
        performance: {
          estimated: {
            apr: 0.04,
            apy: 0.045,
            type: 'katana-estimated-apr',
            components: {}
          },
          oracle: {
            apr: 0.03,
            apy: 0.031
          },
          historical: {
            net: 0.01,
            weeklyNet: 0.01,
            monthlyNet: 0.01,
            inceptionNet: 0.01
          }
        }
      } as any,
      {
        performance: {
          estimated: {
            apr: 0.06,
            apy: 0.07,
            type: 'katana-estimated-apr',
            components: {}
          },
          oracle: {
            apr: 0.035,
            apy: 0.036
          }
        }
      } as any
    )

    expect(apr.forwardAPR.type).toBe('estimated')
    expect(apr.forwardAPR.netAPR).toBe(0.07)
  })

  it('adds Katana app rewards on top of the selected estimated APY', () => {
    const apy = calculateVaultEstimatedAPY({
      ...BASE_LIST_VAULT,
      performance: {
        estimated: {
          apr: 0.049,
          apy: 0.051,
          type: 'katana-estimated-apr',
          components: {
            katanaAppRewardsAPR: 0.02
          }
        },
        oracle: {
          apr: 0.029,
          apy: 0.03,
          netAPR: 0.028,
          netAPY: 0.03
        },
        historical: {
          net: 0.01,
          weeklyNet: 0.01,
          monthlyNet: 0.01,
          inceptionNet: 0.01
        }
      }
    } as any)

    expect(apy).toBeCloseTo(0.071, 6)
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

  it('falls back to composition oracle net APY when estimated apy is missing', () => {
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
              apy: 0.09,
              netAPR: 0.07,
              netAPY: 0.075
            }
          }
        }
      ]
    } as any)

    expect(strategies[0]?.estimatedAPY).toBe(0.075)
  })

  it('leaves estimated apy unset when neither estimated nor oracle APY values exist', () => {
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

  it('uses oracle APY as base for katana strategies when netAPY is unavailable — estimated apr is KAT rewards only', () => {
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

    // estimatedAPY should use the oracle APY fallback (base yield), not estimated.apr (KAT rewards)
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

  it('reads katRewardsAPR from estimated components when apr is omitted', () => {
    const strategies = getVaultStrategies(vault, {
      totalAssets: '1000000',
      composition: [
        {
          address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Katana Strategy with Components',
          status: 'active',
          totalDebt: '500000',
          currentDebt: '500000',
          performance: {
            estimated: {
              type: 'katana-estimated-apr',
              components: {
                katRewardsAPR: 0.002978698024448475
              }
            },
            oracle: {
              apr: 0.013945609013431531,
              apy: 0.014041406702504533
            }
          }
        }
      ]
    } as any)

    expect(strategies[0]?.estimatedAPY).toBe(0.014041406702504533)
    expect(strategies[0]?.katRewardsAPR).toBe(0.002978698024448475)
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
