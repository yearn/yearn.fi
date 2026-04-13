import type { TDict } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  getCanonicalSourceVaultAddressForRoute,
  getHeldYieldSplitterModeSummary,
  getSourceVaultYieldModeOptions
} from './yieldSplitterModes'

const SOURCE_VAULT_ADDRESS = '0x1111111111111111111111111111111111111111'
const SPLITTER_ETH_ADDRESS = '0x2222222222222222222222222222222222222222'
const SPLITTER_BTC_ADDRESS = '0x3333333333333333333333333333333333333333'
const ASSET_ADDRESS = '0x4444444444444444444444444444444444444444'

function makeVault(overrides: Record<string, unknown>) {
  return {
    chainId: 1,
    address: SOURCE_VAULT_ADDRESS,
    name: 'USDC Vault',
    symbol: 'yvUSDC',
    apiVersion: '3.0.0',
    decimals: 18,
    asset: {
      address: ASSET_ADDRESS,
      name: 'USD Coin',
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
    ...overrides
  } as any
}

describe('yield splitter source vault modes', () => {
  const sourceVault = makeVault({})
  const ethRouteVault = makeVault({
    address: SPLITTER_ETH_ADDRESS,
    name: 'USDC Vault earning ETH',
    symbol: 'ysUSDC-ETH',
    yieldSplitter: {
      enabled: true,
      sourceVaultAddress: SOURCE_VAULT_ADDRESS,
      sourceVaultName: 'USDC Vault',
      sourceVaultSymbol: 'yvUSDC',
      wantVaultAddress: '0x5555555555555555555555555555555555555555',
      wantVaultName: 'ETH Vault',
      wantVaultSymbol: 'ETH',
      depositAssetAddress: ASSET_ADDRESS,
      depositAssetName: 'USD Coin',
      depositAssetSymbol: 'USDC',
      rewardTokenAddresses: [],
      uiDescription: 'Deposit USDC and earn ETH.'
    }
  })
  const btcRouteVault = makeVault({
    address: SPLITTER_BTC_ADDRESS,
    name: 'USDC Vault earning BTC',
    symbol: 'ysUSDC-BTC',
    yieldSplitter: {
      enabled: true,
      sourceVaultAddress: SOURCE_VAULT_ADDRESS,
      sourceVaultName: 'USDC Vault',
      sourceVaultSymbol: 'yvUSDC',
      wantVaultAddress: '0x6666666666666666666666666666666666666666',
      wantVaultName: 'BTC Vault',
      wantVaultSymbol: 'BTC',
      depositAssetAddress: ASSET_ADDRESS,
      depositAssetName: 'USD Coin',
      depositAssetSymbol: 'USDC',
      rewardTokenAddresses: [],
      uiDescription: 'Deposit USDC and earn BTC.'
    }
  })

  const allVaults = {
    [SOURCE_VAULT_ADDRESS.toLowerCase()]: sourceVault,
    [SPLITTER_ETH_ADDRESS.toLowerCase()]: ethRouteVault,
    [SPLITTER_BTC_ADDRESS.toLowerCase()]: btcRouteVault
  } as TDict<any>

  it('builds a native mode plus one option per splitter route', () => {
    const modes = getSourceVaultYieldModeOptions(sourceVault, allVaults)

    expect(modes).toHaveLength(3)
    expect(modes[0]).toMatchObject({
      id: 'native',
      label: 'Compound USDC',
      isNative: true
    })
    expect(modes.slice(1).map((mode) => mode.label)).toEqual(['Earn BTC', 'Earn ETH'])
  })

  it('summarizes held splitter positions for portfolio and list rows', () => {
    const summary = getHeldYieldSplitterModeSummary(sourceVault, allVaults, ({ address }) => ({
      raw: address.toLowerCase() === SPLITTER_ETH_ADDRESS.toLowerCase() ? 1n : 0n,
      normalized: address.toLowerCase() === SPLITTER_ETH_ADDRESS.toLowerCase() ? 1 : 0,
      display: address.toLowerCase() === SPLITTER_ETH_ADDRESS.toLowerCase() ? '1' : '0',
      decimals: 18
    }))

    expect(summary).toEqual({
      label: 'Earning ETH',
      tooltip: 'This position routes yield into ETH.',
      preferredVaultAddress: SPLITTER_ETH_ADDRESS
    })
  })

  it('canonicalizes direct splitter routes back to their source vault page', () => {
    expect(getCanonicalSourceVaultAddressForRoute(SPLITTER_ETH_ADDRESS, allVaults)).toBe(SOURCE_VAULT_ADDRESS)
    expect(getCanonicalSourceVaultAddressForRoute(SOURCE_VAULT_ADDRESS, allVaults)).toBeUndefined()
  })
})
