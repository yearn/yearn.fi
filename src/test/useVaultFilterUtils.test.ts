import { getVaultHoldingsUsdValue } from '@shared/hooks/useVaultFilterUtils'
import { describe, expect, it } from 'vitest'

const VAULT_ADDRESS = '0x8589462548984c5C0f2C0140FB276351B5a77fe1'
const ASSET_ADDRESS = '0x0000000000000000000000000000000000000002'

function makeStrategyVault() {
  return {
    chainId: 1,
    address: VAULT_ADDRESS,
    name: 'Strategy Vault',
    symbol: 'yvSTRAT',
    apiVersion: '3.0.0',
    decimals: 18,
    asset: {
      address: ASSET_ADDRESS,
      name: 'USD Asset',
      symbol: 'USDC',
      decimals: 6
    },
    tvl: 0,
    performance: {
      oracle: { apr: 0.04, apy: 0.04 },
      estimated: { apr: 0.04, apy: 0.04, type: 'oracle', components: {} },
      historical: { net: 0.03, weeklyNet: 0.03, monthlyNet: 0.02, inceptionNet: 0.01 }
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
    staking: {
      address: null,
      available: false,
      source: '',
      rewards: []
    },
    pricePerShare: '1050000'
  } as any
}

describe('getVaultHoldingsUsdValue', () => {
  it('values list-only holdings from list pricePerShare when share price is unavailable', () => {
    const vault = makeStrategyVault()
    const value = getVaultHoldingsUsdValue(
      vault,
      ({ address }) => ({ value: address.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? 0 : undefined }),
      ({ address }) => ({
        raw: address.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? 2n * 10n ** 18n : 0n,
        normalized: address.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? 2 : 0,
        display: address.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? '2' : '0',
        decimals: 18
      }),
      ({ address }) => ({
        normalized: address.toLowerCase() === ASSET_ADDRESS.toLowerCase() ? 1 : 0
      })
    )

    expect(value).toBeCloseTo(2.1, 8)
  })
})
