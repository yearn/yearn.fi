import { describe, expect, it } from 'vitest'
import { kongVaultListSchema } from './kongVaultListSchema'

describe('kongVaultListSchema', () => {
  it('retains oracle net APR and net APY fields', () => {
    const parsed = kongVaultListSchema.parse([
      {
        chainId: 1,
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
            net: 0.0339,
            weeklyNet: 0.0415,
            monthlyNet: 0.0339,
            inceptionNet: 0.049
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
        pricePerShare: '1000000000000000000'
      }
    ])

    expect(parsed[0]?.performance?.oracle?.apr).toBe(0.0375)
    expect(parsed[0]?.performance?.oracle?.apy).toBe(0.038197965598908645)
    expect(parsed[0]?.performance?.oracle?.netAPR).toBe(0.03375)
    expect(parsed[0]?.performance?.oracle?.netAPY).toBe(0.03431466938555827)
  })
})
