import type { TExternalToken } from '@pages/portfolio/constants/externalTokens'
import { buildVaultSuggestions } from '@pages/portfolio/hooks/buildVaultSuggestions'
import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'

const buildVault = ({
  address,
  assetSymbol,
  tvl,
  apr
}: {
  address: string
  assetSymbol: string
  tvl: number
  apr: number
}): TKongVault =>
  ({
    chainId: 1,
    address,
    name: `${assetSymbol} Vault`,
    symbol: `yv${assetSymbol}`,
    apiVersion: '3.0.0',
    decimals: 18,
    asset: {
      address:
        assetSymbol === 'USDC'
          ? '0x0000000000000000000000000000000000000010'
          : assetSymbol === 'DAI'
            ? '0x0000000000000000000000000000000000000011'
            : '0x0000000000000000000000000000000000000012',
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
    kind: 'Multi Strategy',
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

describe('buildVaultSuggestions', () => {
  it('dedupes repeated vault matches before applying the two-item cap', () => {
    const usdcVault = buildVault({
      address: '0x0000000000000000000000000000000000000001',
      assetSymbol: 'USDC',
      tvl: 2_000_000,
      apr: 0.06
    })
    const daiVault = buildVault({
      address: '0x0000000000000000000000000000000000000002',
      assetSymbol: 'DAI',
      tvl: 1_500_000,
      apr: 0.05
    })
    const wethVault = buildVault({
      address: '0x0000000000000000000000000000000000000003',
      assetSymbol: 'WETH',
      tvl: 1_250_000,
      apr: 0.05
    })

    const detectedTokens: TExternalToken[] = [
      {
        address: '0x0000000000000000000000000000000000000101',
        chainId: 1,
        protocol: 'Aave V3',
        underlyingSymbol: 'USDC',
        underlyingAddress: '0x0000000000000000000000000000000000000010'
      },
      {
        address: '0x0000000000000000000000000000000000000102',
        chainId: 1,
        protocol: 'Compound V3',
        underlyingSymbol: 'USDC',
        underlyingAddress: '0x0000000000000000000000000000000000000010'
      },
      {
        address: '0x0000000000000000000000000000000000000103',
        chainId: 1,
        protocol: 'Spark',
        underlyingSymbol: 'DAI',
        underlyingAddress: '0x0000000000000000000000000000000000000011'
      },
      {
        address: '0x0000000000000000000000000000000000000104',
        chainId: 1,
        protocol: 'Morpho',
        underlyingSymbol: 'WETH',
        underlyingAddress: '0x0000000000000000000000000000000000000012'
      }
    ]

    const suggestions = buildVaultSuggestions(
      detectedTokens,
      {
        [usdcVault.address]: usdcVault,
        [daiVault.address]: daiVault,
        [wethVault.address]: wethVault
      },
      new Set()
    )

    expect(suggestions).toHaveLength(2)
    expect(suggestions[0]?.vault).toBe(usdcVault)
    expect(suggestions[1]?.vault).toBe(daiVault)
  })
})
