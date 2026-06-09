import { describe, expect, it } from 'vitest'
import { filterVisiblePortfolioHoldings, isPortfolioDustValueVisible } from './portfolioVisibility'

function makeVault(address: string, isHidden: boolean) {
  return {
    chainID: 1,
    address,
    name: `Vault ${address.slice(-4)}`,
    symbol: 'yvTEST',
    version: '3.0.0',
    type: 'Standard',
    kind: 'Single Strategy',
    decimals: 18,
    token: {
      address,
      name: 'Vault Token',
      symbol: 'yvTEST',
      description: '',
      decimals: 18
    },
    tvl: {
      totalAssets: 0n,
      tvl: 0,
      price: 0
    },
    apr: {
      type: 'oracle',
      netAPR: 0,
      fees: {
        performance: 0,
        withdrawal: 0,
        management: 0
      },
      extra: {
        stakingRewardsAPR: 0,
        gammaRewardAPR: 0
      },
      points: {
        weekAgo: 0,
        monthAgo: 0,
        inception: 0
      },
      pricePerShare: {
        today: 1,
        weekAgo: 1,
        monthAgo: 1
      },
      forwardAPR: {
        type: 'oracle',
        netAPR: 0,
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
    },
    featuringScore: 0,
    strategies: [],
    staking: {
      address: null,
      available: false,
      source: '',
      rewards: []
    },
    migration: {
      available: false,
      address: '0x0000000000000000000000000000000000000000',
      contract: '0x0000000000000000000000000000000000000000'
    },
    info: {
      sourceURL: '',
      riskLevel: 1,
      riskScore: [],
      riskScoreComment: '',
      uiNotice: '',
      isRetired: false,
      isBoosted: false,
      isHighlighted: false,
      isHidden
    }
  } as any
}

describe('filterVisiblePortfolioHoldings', () => {
  it('hides hidden vaults when the persisted hidden-vault filter is off', () => {
    const visible = makeVault('0x1111111111111111111111111111111111111111', false)
    const hidden = makeVault('0x2222222222222222222222222222222222222222', true)

    expect(filterVisiblePortfolioHoldings([visible, hidden], false)).toEqual([visible])
  })

  it('keeps hidden vaults when the persisted hidden-vault filter is on', () => {
    const visible = makeVault('0x1111111111111111111111111111111111111111', false)
    const hidden = makeVault('0x2222222222222222222222222222222222222222', true)

    expect(filterVisiblePortfolioHoldings([visible, hidden], true)).toEqual([visible, hidden])
  })

  it('hides dust vault positions when the dust guard is enabled', () => {
    const dust = makeVault('0x1111111111111111111111111111111111111111', false)
    const visible = makeVault('0x2222222222222222222222222222222222222222', false)

    expect(
      filterVisiblePortfolioHoldings([dust, visible], false, {
        shouldHideDust: true,
        getVaultValue: (vault) => (vault === dust ? 0.009 : 0.01)
      })
    ).toEqual([visible])
  })

  it('keeps dust vault positions when the dust guard is disabled', () => {
    const dust = makeVault('0x1111111111111111111111111111111111111111', false)

    expect(
      filterVisiblePortfolioHoldings([dust], false, {
        shouldHideDust: false,
        getVaultValue: () => 0.009
      })
    ).toEqual([dust])
  })

  it('treats one cent as visible portfolio value', () => {
    expect(isPortfolioDustValueVisible(0.009, true)).toBe(false)
    expect(isPortfolioDustValueVisible(0.01, true)).toBe(true)
  })
})
