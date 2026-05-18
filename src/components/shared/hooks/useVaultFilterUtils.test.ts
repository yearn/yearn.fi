import { primeYieldSplitterHoldingsAliases } from '@pages/vaults/domain/normalizeVault'
import { afterEach, describe, expect, it } from 'vitest'
import { getVaultHoldingsUsdValue, isV3Vault, matchesSelectedChains } from './useVaultFilterUtils'

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

afterEach(() => {
  primeYieldSplitterHoldingsAliases({})
})

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

  it('rolls yield splitter share balances up into the canonical source vault value', () => {
    const sourceVault = makeStrategyVault()
    const splitterVault = {
      ...makeStrategyVault(),
      address: '0x9999999999999999999999999999999999999999',
      name: 'USDC vault earning ETH',
      symbol: 'ysUSDC',
      yieldSplitter: {
        enabled: true,
        sourceVaultAddress: sourceVault.address,
        sourceVaultName: sourceVault.name,
        sourceVaultSymbol: sourceVault.symbol,
        wantVaultAddress: '0x7777777777777777777777777777777777777777',
        wantVaultName: 'ETH Vault',
        wantVaultSymbol: 'yvETH',
        depositAssetAddress: ASSET_ADDRESS,
        depositAssetName: 'USD Asset',
        depositAssetSymbol: 'USDC',
        rewardTokenAddresses: []
      }
    } as any

    const allVaults = {
      [sourceVault.address.toLowerCase()]: sourceVault,
      [splitterVault.address.toLowerCase()]: splitterVault
    }

    primeYieldSplitterHoldingsAliases(allVaults as any)

    const value = getVaultHoldingsUsdValue(
      sourceVault,
      ({ address }) => ({ value: address.toLowerCase() === splitterVault.address.toLowerCase() ? 0 : undefined }),
      ({ address }) => ({
        raw: address.toLowerCase() === splitterVault.address.toLowerCase() ? 2n * 10n ** 18n : 0n,
        normalized: address.toLowerCase() === splitterVault.address.toLowerCase() ? 2 : 0,
        display: address.toLowerCase() === splitterVault.address.toLowerCase() ? '2' : '0',
        decimals: 18
      }),
      ({ address }) => ({
        normalized: address.toLowerCase() === ASSET_ADDRESS.toLowerCase() ? 1 : 0
      }),
      { allVaults: allVaults as any }
    )

    expect(value).toBeCloseTo(2.1, 8)
  })
})

describe('matchesSelectedChains', () => {
  it('treats null or empty selections as all chains', () => {
    expect(matchesSelectedChains(1, null)).toBe(true)
    expect(matchesSelectedChains(1, [])).toBe(true)
  })

  it('only matches vaults from the selected chains', () => {
    expect(matchesSelectedChains(1, [1])).toBe(true)
    expect(matchesSelectedChains(10, [1])).toBe(false)
  })
})

describe('isV3Vault', () => {
  it('treats yield splitters as V3 candidates even when apiVersion metadata is missing', () => {
    const splitterVault = {
      chainId: 1,
      address: VAULT_ADDRESS,
      name: 'Yield Splitter',
      symbol: 'ysUSDC',
      decimals: 18,
      asset: {
        address: ASSET_ADDRESS,
        name: 'USD Asset',
        symbol: 'USDC',
        decimals: 6
      },
      kind: 'Single Strategy',
      type: 'Standard',
      yieldSplitter: {
        enabled: true,
        sourceVaultAddress: '0x3333333333333333333333333333333333333333',
        sourceVaultName: 'Source Vault',
        sourceVaultSymbol: 'yvSRC',
        wantVaultAddress: '0x4444444444444444444444444444444444444444',
        wantVaultName: 'Want Vault',
        wantVaultSymbol: 'yvWANT',
        depositAssetAddress: ASSET_ADDRESS,
        depositAssetName: 'USD Asset',
        depositAssetSymbol: 'USDC',
        rewardTokenAddresses: []
      }
    } as any

    expect(isV3Vault(splitterVault, false)).toBe(true)
  })
})
