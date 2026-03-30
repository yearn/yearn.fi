import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'
import { getVaultPrimaryLogoSrc } from './vaultLogo'
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

  it('returns the standard token asset logo for non-yvUSD vaults', () => {
    expect(getVaultPrimaryLogoSrc(STANDARD_VAULT as unknown as TKongVaultInput)).toContain('logo-128.png')
  })
})
