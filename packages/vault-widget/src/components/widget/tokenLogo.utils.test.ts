import { getKnownVaultTokenLogoMetaByAddress } from '@yearn/vault-widget/internal/components/widget/tokenLogo.utils'
import type { VaultWidgetCatalogVault } from '@yearn/vault-widget/runtime'
import { describe, expect, it } from 'vitest'

const VAULT_ADDRESS = '0x0000000000000000000000000000000000000002' as const
const ASSET_ADDRESS = '0x0000000000000000000000000000000000000001' as const
const GAUGE_ADDRESS = '0x0000000000000000000000000000000000000003' as const

describe('getKnownVaultTokenLogoMetaByAddress', () => {
  it('maps vault and gauge addresses to the vault asset logo token', () => {
    const vault: VaultWidgetCatalogVault = {
      address: VAULT_ADDRESS,
      assetAddress: ASSET_ADDRESS,
      chainId: 1,
      stakingAddress: GAUGE_ADDRESS
    }
    const meta = getKnownVaultTokenLogoMetaByAddress({
      chainId: 1,
      allVaults: [vault]
    })

    expect(meta[VAULT_ADDRESS].tokenType).toBe('vault')
    expect(meta[VAULT_ADDRESS].logoToken.address).toBe(ASSET_ADDRESS)
    expect(meta[GAUGE_ADDRESS].tokenType).toBe('staking')
    expect(meta[GAUGE_ADDRESS].logoToken.address).toBe(ASSET_ADDRESS)
  })
})
