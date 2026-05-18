import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { describe, expect, it } from 'vitest'
import { applyYieldSplitterFallbacks, getYieldSplitterFallbackSourceVaultAddress } from './yieldSplitterFallback'

function makeVault(overrides: Partial<TKongVaultListItem>): TKongVaultListItem {
  return {
    address: '0x1111111111111111111111111111111111111111',
    chainId: 747474,
    origin: 'yearn',
    inclusion: undefined,
    name: 'Vault',
    symbol: 'yvTEST',
    apiVersion: '3.0.4',
    decimals: 18,
    asset: {
      address: '0x2222222222222222222222222222222222222222',
      name: 'Vault Asset',
      symbol: 'AST',
      decimals: 18
    },
    tvl: 0,
    performance: null,
    fees: null,
    category: 'Volatile',
    type: 'Standard',
    kind: 'Single Strategy',
    v3: true,
    yearn: true,
    isRetired: false,
    isHidden: false,
    isBoosted: false,
    isHighlighted: false,
    strategiesCount: 0,
    riskLevel: 1,
    token: {
      address: '0x2222222222222222222222222222222222222222',
      name: 'Vault Asset',
      symbol: 'AST',
      decimals: 18
    },
    staking: undefined,
    metadata: {
      protocols: []
    },
    ...overrides
  } as TKongVaultListItem
}

describe('yield splitter fallback metadata', () => {
  it('enriches known Katana splitter vaults when Kong omits yieldSplitter metadata', () => {
    const sourceVault = makeVault({
      address: '0xE007CA01894c863d7898045ed5A3B4Abf0b18f37',
      name: 'vbETH yVault',
      symbol: 'yvvbETH',
      asset: {
        address: '0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62',
        name: 'Vault Bridge ETH',
        symbol: 'vbETH',
        decimals: 18
      }
    })
    const wantVault = makeVault({
      address: '0x80c34BD3A3569E126e7055831036aa7b212cB159',
      name: 'vbUSDC yVault',
      symbol: 'yvvbUSDC',
      asset: {
        address: '0x42bb40bF79730451B11f6De1CbA222F17b87Afd7',
        name: 'Vault Bridge USDC',
        symbol: 'vbUSDC',
        decimals: 6
      }
    })
    const splitterVault = makeVault({
      address: '0xA03e39CDeAC8c2823A6EDC80956207294807c20d',
      name: 'Yearn yvvbETH to yvvbUSDC Yield Splitter',
      symbol: 'ysvbETH',
      asset: {
        address: '0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62',
        name: 'Vault Bridge ETH',
        symbol: 'vbETH',
        decimals: 18
      }
    })

    const enrichedVaults = applyYieldSplitterFallbacks({
      [sourceVault.address.toLowerCase()]: sourceVault,
      [wantVault.address.toLowerCase()]: wantVault,
      [splitterVault.address.toLowerCase()]: splitterVault
    })

    expect(enrichedVaults[splitterVault.address.toLowerCase()]?.yieldSplitter).toMatchObject({
      enabled: true,
      sourceVaultAddress: sourceVault.address,
      wantVaultAddress: wantVault.address,
      depositAssetAddress: sourceVault.asset?.address,
      wantVaultSymbol: 'USD'
    })
  })

  it('resolves direct splitter vault addresses back to their source vault addresses', () => {
    expect(getYieldSplitterFallbackSourceVaultAddress('0xA03e39CDeAC8c2823A6EDC80956207294807c20d', 747474)).toBe(
      '0xE007CA01894c863d7898045ed5A3B4Abf0b18f37'
    )
  })
})
