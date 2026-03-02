import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'
import { computeKatanaTotalApr, resolveKatanaExtras } from './useVaultApyData'

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
}

const DETAIL_VAULT_WITHOUT_COMPONENTS = {
  ...DETAIL_VAULT_WITH_COMPONENTS,
  apr: {
    ...DETAIL_VAULT_WITH_COMPONENTS.apr,
    extra: {
      stakingRewardsAPR: 0,
      gammaRewardAPR: 0
    },
    forwardAPR: {
      ...DETAIL_VAULT_WITH_COMPONENTS.apr.forwardAPR,
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
}

describe('useVaultApyData helpers', () => {
  it('resolves Katana extras from snapshot-backed vault extra fields', () => {
    const katanaExtras = resolveKatanaExtras(DETAIL_VAULT_WITH_COMPONENTS as unknown as TKongVaultInput)

    expect(katanaExtras).toEqual({
      katanaAppRewardsAPR: 0.0916,
      fixedRateKatanaRewards: 0.35,
      katanaBonusAPY: 0.068,
      steerPointsPerDollar: 0.1883
    })
  })

  it('computes the full Katana estimate using base + fixed + app rewards', () => {
    const katanaExtras = resolveKatanaExtras(DETAIL_VAULT_WITH_COMPONENTS as unknown as TKongVaultInput)
    const total = computeKatanaTotalApr(katanaExtras, DETAIL_VAULT_WITH_COMPONENTS.apr.forwardAPR.netAPR)

    expect(total).toBeCloseTo(0.5096, 6)
  })

  it('returns no Katana extras when APR extra has no Katana fields', () => {
    const katanaExtras = resolveKatanaExtras(DETAIL_VAULT_WITHOUT_COMPONENTS as unknown as TKongVaultInput)
    expect(katanaExtras).toBeUndefined()
  })
})
