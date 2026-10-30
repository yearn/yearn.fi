import { getTranchedVaultRowsByKind } from '@pages/vaults/constants/tranchedProducts'
import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'
import { getVaultPrimaryLogoSrc } from './vaultLogo'
import { YVBTC_UNLOCKED_ADDRESS } from './yvBtc'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from './yvUsd'

const STANDARD_VAULT = {
  version: '3.0.0',
  chainID: 1,
  address: '0x0000000000000000000000000000000000000001',
  token: {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'TKN',
    decimals: 18
  }
}

describe('getVaultPrimaryLogoSrc', () => {
  it.each([...getTranchedVaultRowsByKind('senior'), ...getTranchedVaultRowsByKind('junior')])(
    'uses the product asset logo for $product.name',
    ({ product, vault, logoSrc }) => {
      if (product.asset === 'USD') {
        expect(logoSrc).toMatch(/ytranche-logo\.png$/)
      } else {
        expect(logoSrc).toContain(`/tokens/1/${vault.token.address.toLowerCase()}/logo-128.png`)
      }
      expect(getVaultPrimaryLogoSrc(vault)).toBe(logoSrc)
    }
  )

  it('returns the yvUSD primary logo for the unlocked vault', () => {
    expect(
      getVaultPrimaryLogoSrc({
        ...STANDARD_VAULT,
        address: YVUSD_UNLOCKED_ADDRESS
      } as unknown as TKongVaultInput)
    ).toMatch(/yvusd-128\.png$/)
  })

  it('returns the yvUSD primary logo for the locked vault', () => {
    expect(
      getVaultPrimaryLogoSrc({
        ...STANDARD_VAULT,
        address: YVUSD_LOCKED_ADDRESS
      } as unknown as TKongVaultInput)
    ).toMatch(/yvusd-128\.png$/)
  })

  it('returns the yvBTC custom logo for the unlocked vault', () => {
    expect(
      getVaultPrimaryLogoSrc({
        ...STANDARD_VAULT,
        address: YVBTC_UNLOCKED_ADDRESS
      } as unknown as TKongVaultInput)
    ).toMatch(/yvBTC-1\.svg$/)
  })

  it('returns the standard token asset logo for non-product vaults', () => {
    expect(getVaultPrimaryLogoSrc(STANDARD_VAULT as unknown as TKongVaultInput)).toContain('logo-128.png')
  })
})
