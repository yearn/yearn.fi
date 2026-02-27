import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { getVaultAPR } from '@pages/vaults/domain/kongVaultSelectors'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { describe, expect, it } from 'vitest'

const buildVault = (chainId: number): TKongVault =>
  ({
    chainId,
    address: '0x0000000000000000000000000000000000000001',
    name: 'Test Vault',
    symbol: 'yvTEST',
    apiVersion: '3.0.0',
    decimals: 18,
    asset: {
      address: '0x0000000000000000000000000000000000000002',
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6
    },
    tvl: 1_000_000,
    performance: {
      oracle: { apr: 0.04, apy: 0.04 },
      estimated: {
        apr: 0.2,
        apy: 0.2,
        type: 'estimated',
        components: {}
      },
      historical: {
        net: 0.03,
        weeklyNet: 0.03,
        monthlyNet: 0.02,
        inceptionNet: 0.01
      }
    },
    fees: {
      managementFee: 0.0025,
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
    staking: {
      address: null,
      available: false
    }
  }) as TKongVault

const SNAPSHOT = {
  performance: {
    estimated: {
      apr: 0.15,
      apy: 0.15,
      type: 'estimated',
      components: {}
    },
    oracle: {
      apr: 0.07,
      apy: 0.07
    },
    historical: {
      net: 0.02,
      weeklyNet: 0.02,
      monthlyNet: 0.02,
      inceptionNet: 0.02
    }
  },
  apy: {
    net: 0.02,
    label: 'estimated',
    grossApr: 0.02,
    weeklyNet: 0.02,
    monthlyNet: 0.02,
    inceptionNet: 0.02,
    pricePerShare: '1000000000000000000',
    weeklyPricePerShare: '1000000000000000000',
    monthlyPricePerShare: '1000000000000000000'
  },
  fees: {
    managementFee: 0.0025,
    performanceFee: 0.1
  }
} as unknown as TKongVaultSnapshot

describe('getVaultAPR forward base selection', () => {
  it('prefers oracle APY for Katana vaults', () => {
    const apr = getVaultAPR(buildVault(747474), SNAPSHOT)
    expect(apr.forwardAPR.netAPR).toBeCloseTo(0.07, 8)
  })

  it('keeps estimated APY precedence for non-Katana vaults', () => {
    const apr = getVaultAPR(buildVault(1), SNAPSHOT)
    expect(apr.forwardAPR.netAPR).toBeCloseTo(0.15, 8)
  })
})

describe('getVaultAPR Katana component fallbacks', () => {
  it('falls back to list estimated components when snapshot components are missing', () => {
    const vault = buildVault(747474)
    if (vault.performance?.estimated) {
      vault.performance.estimated.components = {
        baseAPR: 0.11,
        katanaBonusAPY: 0.06,
        katanaAppRewardsAPR: 0.09,
        steerPointsPerDollar: 0.18,
        fixedRateKatanaRewards: 0.35
      }
    }

    const snapshotWithoutComponents = {
      ...SNAPSHOT,
      performance: {
        ...SNAPSHOT.performance,
        estimated: {
          apr: 0.15,
          apy: 0.15,
          type: 'estimated'
        }
      }
    } as unknown as TKongVaultSnapshot

    const apr = getVaultAPR(vault, snapshotWithoutComponents)

    expect(apr.forwardAPR.composite.baseAPR).toBeCloseTo(0.11, 8)
    expect(apr.extra.katanaBonusAPY).toBeCloseTo(0.06, 8)
    expect(apr.extra.katanaAppRewardsAPR).toBeCloseTo(0.09, 8)
    expect(apr.extra.steerPointsPerDollar).toBeCloseTo(0.18, 8)
    expect(apr.extra.fixedRateKatanaRewards).toBeCloseTo(0.35, 8)
  })
})
