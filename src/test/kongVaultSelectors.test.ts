import { getVaultAPR } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'

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
