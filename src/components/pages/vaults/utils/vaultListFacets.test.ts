import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import { describe, expect, it } from 'vitest'

import { deriveListKind } from './vaultListFacets'

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

describe('deriveListKind', () => {
  it('treats yvBTC as an allocator vault so it appears in the default vault list', () => {
    expect(
      deriveListKind({
        ...STANDARD_V3_VAULT,
        address: YVBTC_UNLOCKED_ADDRESS,
        name: 'BTC yVault',
        symbol: 'yvBTC'
      })
    ).toBe('allocator')
  })

  it('keeps ordinary v3 vaults with no multi-strategy kind as strategies', () => {
    expect(deriveListKind(STANDARD_V3_VAULT)).toBe('strategy')
  })
})
