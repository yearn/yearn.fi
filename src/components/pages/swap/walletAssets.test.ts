import { toNormalizedBN } from '@shared/utils'
import { describe, expect, it } from 'vitest'
import { getSwapWalletAssets } from './walletAssets'

const token = (address: `0x${string}`, symbol: string, value: number) => ({
  address,
  name: symbol,
  symbol,
  decimals: 18,
  chainID: 1,
  value,
  balance: toNormalizedBN(value > 0 ? 1n : 0n, 18)
})

describe('getSwapWalletAssets', () => {
  it('hides unverified balances by default and reveals them on request', () => {
    const verified = token('0x0000000000000000000000000000000000000001', 'USDC', 10)
    const unverified = token('0x0000000000000000000000000000000000000002', 'Claim', 100)
    const params = {
      tokens: [verified, unverified],
      knownAddresses: new Set([verified.address.toLowerCase()]),
      majorAddresses: new Set<string>(),
      yearnAddresses: new Set<string>(),
      excludedAddresses: new Set<string>()
    }

    expect(getSwapWalletAssets({ ...params, showUnverified: false }).map((asset) => asset.token.symbol)).toEqual([
      'USDC'
    ])
    expect(getSwapWalletAssets({ ...params, showUnverified: true }).map((asset) => asset.token.symbol)).toEqual([
      'USDC',
      'Claim'
    ])
  })

  it('prioritizes major assets, then Yearn vaults, then other verified assets', () => {
    const major = token('0x0000000000000000000000000000000000000001', 'USDC', 1)
    const vault = token('0x0000000000000000000000000000000000000002', 'yvUSDC', 20)
    const listed = token('0x0000000000000000000000000000000000000003', 'LIST', 100)

    expect(
      getSwapWalletAssets({
        tokens: [listed, vault, major],
        knownAddresses: new Set([listed.address.toLowerCase()]),
        majorAddresses: new Set([major.address.toLowerCase()]),
        yearnAddresses: new Set([vault.address.toLowerCase()]),
        excludedAddresses: new Set<string>(),
        showUnverified: false
      }).map((asset) => asset.token.symbol)
    ).toEqual(['USDC', 'yvUSDC', 'LIST'])
  })

  it('never exposes balances for excluded hidden vault addresses', () => {
    const hiddenVault = token('0x0000000000000000000000000000000000000004', 'yvHidden', 100)

    expect(
      getSwapWalletAssets({
        tokens: [hiddenVault],
        knownAddresses: new Set([hiddenVault.address.toLowerCase()]),
        majorAddresses: new Set<string>(),
        yearnAddresses: new Set<string>(),
        excludedAddresses: new Set([hiddenVault.address.toLowerCase()]),
        showUnverified: true
      })
    ).toEqual([])
  })
})
