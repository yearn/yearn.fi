import { YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { describe, expect, it } from 'vitest'
import { isCatalogYearnVault } from './useFetchYearnVaults'

function makeVault(overrides: Partial<TKongVaultListItem>): TKongVaultListItem {
  return {
    address: '0x1111111111111111111111111111111111111111',
    chainId: 1,
    origin: 'yearn',
    inclusion: undefined,
    token: {
      address: '0x2222222222222222222222222222222222222222',
      name: 'Token',
      symbol: 'TKN',
      decimals: 18
    },
    staking: undefined,
    metadata: {
      protocols: []
    },
    ...overrides
  } as TKongVaultListItem
}

describe('isCatalogYearnVault', () => {
  it('keeps yearn vaults in the public catalog by default', () => {
    expect(isCatalogYearnVault(makeVault({ origin: 'yearn' }))).toBe(true)
  })

  it('excludes explicitly non-yearn catalog entries', () => {
    expect(isCatalogYearnVault(makeVault({ origin: 'partner', inclusion: { isYearn: true } as never }))).toBe(false)
  })

  it('excludes yearn vaults that Kong marks as not included', () => {
    expect(isCatalogYearnVault(makeVault({ origin: 'yearn', inclusion: { isYearn: false } as never }))).toBe(false)
  })

  it('keeps yvBTC in the public catalog while Kong metadata is incomplete', () => {
    expect(
      isCatalogYearnVault(makeVault({ address: YVBTC_UNLOCKED_ADDRESS, origin: null, inclusion: {} as never }))
    ).toBe(true)
  })
})
