import { describe, expect, it, vi } from 'vitest'
import { YBOLD_VAULT_ADDRESS } from '../presets/yBold'
import { createKongVaultConfigResolver } from './config'

const vaultAddress = '0x1111111111111111111111111111111111111111'
const assetAddress = '0x2222222222222222222222222222222222222222'

describe('createKongVaultConfigResolver', () => {
  it('creates a direct ERC-4626 configuration from Kong metadata', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        address: vaultAddress,
        apiVersion: '3.0.4',
        asset: {
          address: assetAddress,
          decimals: 6,
          name: 'USD Coin',
          symbol: 'USDC'
        },
        chainId: 1,
        decimals: 18,
        name: 'Yearn USDC',
        symbol: 'yvUSDC'
      })
    )

    const config = await createKongVaultConfigResolver({ fetcher }).resolve(1, vaultAddress)

    expect(config.vaultAddress).toBe(vaultAddress)
    expect(config.depositTokens[0]?.symbol).toBe('USDC')
    expect(config.adapters[0]?.id).toBe('erc4626')
  })

  it('resolves the package-owned yBOLD preset without a metadata request', async () => {
    const fetcher = vi.fn()

    const config = await createKongVaultConfigResolver({ fetcher }).resolve(1, YBOLD_VAULT_ADDRESS)

    expect(config.id).toBe('ybold-mainnet')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
