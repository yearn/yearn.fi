import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { describe, expect, it } from 'vitest'

import { deriveAssetCategory, deriveListKind } from './vaultListFacets'

const STANDARD_V3_VAULT = {
  version: '3.0.4',
  chainID: 1,
  address: '0x0000000000000000000000000000000000000001',
  name: 'Standard Vault',
  symbol: 'yvTEST',
  kind: null,
  token: {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'TEST',
    decimals: 18
  },
  info: {
    riskLevel: 2
  }
} as unknown as TKongVaultInput

const DUSD_FRXUSD_CURVE_VAULT = {
  version: '0.4.6',
  chainID: 1,
  name: 'Curve frxUSDDUSD Factory yVault',
  symbol: 'yvCurve-frxUSDDUSD-f',
  category: 'Curve',
  token: {
    name: 'Curve DUSD-frxUSD LP',
    symbol: 'frxUSDDUSD-f'
  }
} as unknown as TKongVaultInput

describe('deriveAssetCategory', () => {
  it('classifies the DUSD-frxUSD Curve LP as a stablecoin vault', () => {
    expect(DUSD_FRXUSD_CURVE_VAULT.category).toBe('Curve')
    expect(deriveAssetCategory(DUSD_FRXUSD_CURVE_VAULT)).toBe('Stablecoin')
  })
})

describe('deriveListKind', () => {
  it('keeps yvBTC as a strategy before launch so it is not pinned with allocator vaults', () => {
    expect(
      deriveListKind({
        ...STANDARD_V3_VAULT,
        address: YVBTC_UNLOCKED_ADDRESS,
        name: 'BTC yVault',
        symbol: 'yvBTC'
      })
    ).toBe('strategy')
  })

  it('keeps ordinary v3 vaults with no multi-strategy kind as strategies', () => {
    expect(deriveListKind(STANDARD_V3_VAULT)).toBe('strategy')
  })
})
