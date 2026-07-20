import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { describe, expect, it } from 'vitest'
import { getKnownVaultTokenLogoMetaByAddress } from './tokenLogo.utils'

const VAULT_ADDRESS = '0x0000000000000000000000000000000000000002' as const
const ASSET_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const GAUGE_ADDRESS = '0x0000000000000000000000000000000000000003' as const

describe('getKnownVaultTokenLogoMetaByAddress', () => {
  it('maps vault and gauge addresses to the vault asset logo token', () => {
    const meta = getKnownVaultTokenLogoMetaByAddress({
      chainId: 1,
      allVaults: {
        [VAULT_ADDRESS]: {
          chainID: 1,
          version: '3.0.0',
          address: VAULT_ADDRESS,
          token: {
            address: ASSET_ADDRESS,
            symbol: 'BASE',
            name: 'Base Token',
            description: '',
            decimals: 18
          },
          staking: {
            address: GAUGE_ADDRESS,
            available: true,
            source: '',
            rewards: null
          }
        } as unknown as TKongVaultInput
      }
    })

    expect(meta[VAULT_ADDRESS].tokenType).toBe('vault')
    expect(meta[VAULT_ADDRESS].logoToken.address).toBe(ASSET_ADDRESS)
    expect(meta[GAUGE_ADDRESS].tokenType).toBe('staking')
    expect(meta[GAUGE_ADDRESS].logoToken.address).toBe(ASSET_ADDRESS)
  })
})
