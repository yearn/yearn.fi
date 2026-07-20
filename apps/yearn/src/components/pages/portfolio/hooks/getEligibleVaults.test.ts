import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'
import { selectPreferredVault } from './getEligibleVaults'

const buildVault = ({
  address,
  assetSymbol,
  tvl,
  apr,
  version = '3.0.0'
}: {
  address: string
  assetSymbol: string
  tvl: number
  apr: number
  version?: string
}): TKongVault =>
  ({
    chainId: 1,
    address,
    name: `${assetSymbol} Vault`,
    symbol: `yv${assetSymbol}`,
    apiVersion: version,
    decimals: 18,
    asset: {
      address: '0x0000000000000000000000000000000000000010',
      name: assetSymbol,
      symbol: assetSymbol,
      decimals: 18
    },
    tvl,
    performance: {
      oracle: { apr, apy: apr },
      estimated: {
        apr,
        apy: apr,
        type: 'estimated',
        components: {}
      },
      historical: {
        net: apr,
        weeklyNet: apr,
        monthlyNet: apr,
        inceptionNet: apr
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
    isHighlighted: true,
    strategiesCount: 1,
    riskLevel: 1,
    staking: {
      address: null,
      available: false
    }
  }) as unknown as TKongVault

describe('selectPreferredVault', () => {
  it('prefers the highest-TVL qualifying vault', () => {
    const smaller = buildVault({
      address: '0x0000000000000000000000000000000000000001',
      assetSymbol: 'USDC',
      tvl: 900_000,
      apr: 0.06
    })
    const larger = buildVault({
      address: '0x0000000000000000000000000000000000000002',
      assetSymbol: 'USDC',
      tvl: 2_500_000,
      apr: 0.05
    })

    expect(selectPreferredVault([smaller, larger])).toBe(larger)
  })
})
