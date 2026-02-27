import type { TKongVault, TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'
import {
  calculateKatanaThirtyDayAPY,
  calculateVaultEstimatedAPY,
  calculateVaultHistoricalAPY,
  getKatanaAprData
} from './vaultApy'

const BASE_VAULT: TKongVault = {
  chainId: 747474,
  address: '0x0000000000000000000000000000000000000001',
  name: 'Test Katana Vault',
  symbol: 'ykTEST',
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
      apr: 0.4687,
      apy: 0.068,
      type: 'katana-estimated-apr',
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
}

const withComponents = (vault: TKongVault): TKongVault => ({
  ...vault,
  performance: {
    ...vault.performance,
    estimated: {
      apy: vault.performance?.estimated?.apy ?? 0,
      apr: vault.performance?.estimated?.apr ?? 0,
      type: vault.performance?.estimated?.type ?? 'katana-estimated-apr',
      components: {
        katanaBonusAPY: 0.068,
        katanaAppRewardsAPR: 0.0916,
        steerPointsPerDollar: 0.1883,
        fixedRateKatanaRewards: 0.35
      }
    }
  }
})

const DETAIL_VAULT_WITH_COMPONENTS = {
  version: '3.0.0',
  chainID: 747474,
  address: '0x0000000000000000000000000000000000000001',
  apr: {
    type: 'katana-estimated-apr',
    netAPR: 0.03,
    extra: {
      stakingRewardsAPR: 0,
      gammaRewardAPR: 0,
      katanaBonusAPY: 0.068,
      katanaAppRewardsAPR: 0.0916,
      steerPointsPerDollar: 0.1883,
      fixedRateKatanaRewards: 0.35
    },
    points: {
      weekAgo: 0.03,
      monthAgo: 0.02,
      inception: 0.01
    },
    forwardAPR: {
      type: 'estimated',
      netAPR: 0.068,
      composite: {
        boost: 0,
        poolAPY: 0,
        boostedAPR: 0,
        baseAPR: 0,
        cvxAPR: 0,
        rewardsAPR: 0,
        v3OracleCurrentAPR: 0,
        v3OracleStratRatioAPR: 0,
        keepCRV: 0,
        keepVELO: 0,
        cvxKeepCRV: 0
      }
    }
  }
} as unknown as TKongVaultInput

describe('vaultApy Katana calculations', () => {
  it('derives katana extras from Kong estimated components', () => {
    const katanaData = getKatanaAprData(withComponents(BASE_VAULT))

    expect(katanaData).toEqual({
      katanaAppRewardsAPR: 0.0916,
      fixedRateKatanaRewards: 0.35,
      katanaBonusAPY: 0.068,
      steerPointsPerDollar: 0.1883
    })
  })

  it('calculates Katana estimated APY from list data using available Kong components', () => {
    const apy = calculateVaultEstimatedAPY(withComponents(BASE_VAULT))
    expect(apy).toBeCloseTo(0.4816, 6)
  })

  it('calculates full Katana estimate on snapshot-backed vault details', () => {
    const apy = calculateVaultEstimatedAPY(DETAIL_VAULT_WITH_COMPONENTS)
    expect(apy).toBeCloseTo(0.5096, 6)
  })

  it('falls back to Kong forward APY when list-level Katana components are absent', () => {
    const apy = calculateVaultEstimatedAPY(BASE_VAULT)
    expect(apy).toBeCloseTo(0.04, 6)
  })

  it('calculates Katana 30 day APY from historical base + fixed + app rewards', () => {
    const apy = calculateKatanaThirtyDayAPY(withComponents(BASE_VAULT))
    expect(apy).toBeCloseTo(0.4616, 6)
  })

  it('falls back to monthly historical APY for Katana vaults when components are absent', () => {
    const apy = calculateVaultHistoricalAPY(BASE_VAULT)
    expect(apy).toBeCloseTo(0.02, 6)
  })
})
