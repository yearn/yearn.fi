import { describe, expect, it, vi } from 'vitest'
import type { VaultWidgetConfig } from '../types'
import { createEnsoVaultConfigResolver, createHttpTokenCatalog, createHttpTokenPriceService } from './tokens'
import type { VaultWidgetConfigResolver } from './types'

const vaultAddress = '0x1111111111111111111111111111111111111111'
const assetAddress = '0x2222222222222222222222222222222222222222'
const routeAddress = '0x3333333333333333333333333333333333333333'

function config(id = '1:test'): VaultWidgetConfig {
  const asset = { address: assetAddress, chainId: 1, decimals: 6, symbol: 'USDC' } as const
  return {
    adapters: [],
    chainId: 1,
    depositTokens: [asset],
    id,
    name: 'Test vault',
    positionToken: { address: vaultAddress, chainId: 1, decimals: 18, symbol: 'yvUSDC' },
    vaultAddress,
    withdrawTokens: [asset]
  }
}

describe('createHttpTokenCatalog', () => {
  it('normalizes valid token-list entries and caches the result', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        tokens: [
          {
            address: routeAddress,
            chainId: 10,
            decimals: 18,
            logoURI: 'https://example.com/logo.png',
            name: 'Wrapped Ether',
            symbol: 'WETH'
          },
          { address: 'invalid', chainId: 10, decimals: 18, symbol: 'BAD' }
        ]
      })
    )
    const catalog = createHttpTokenCatalog({ fetcher, urls: ['https://example.com/tokens.json'] })

    await expect(catalog.list()).resolves.toEqual([
      {
        address: routeAddress,
        chainId: 10,
        decimals: 18,
        logoURI: 'https://example.com/logo.png',
        name: 'Wrapped Ether',
        symbol: 'WETH'
      }
    ])
    await catalog.list()
    expect(fetcher).toHaveBeenCalledOnce()
  })
})

describe('createHttpTokenPriceService', () => {
  it('hydrates positive Yearn spot prices without dropping unpriced tokens', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        coins: {
          [`ethereum:${assetAddress.toLowerCase()}`]: {
            prices: [{ price: 1.001 }]
          }
        }
      })
    )
    const service = createHttpTokenPriceService({ fetcher })
    const tokens = [
      { address: assetAddress, chainId: 1, decimals: 6, symbol: 'USDC' },
      { address: routeAddress, chainId: 10, decimals: 18, symbol: 'WETH' }
    ] as const

    await expect(service.hydrate(tokens)).resolves.toEqual([{ ...tokens[0], priceUsd: 1.001 }, tokens[1]])
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/prices/spot?coins='),
      expect.objectContaining({ signal: undefined })
    )
  })
})

describe('createEnsoVaultConfigResolver', () => {
  it('decorates generic Kong configs with catalog-backed Enso routes', async () => {
    const baseResolver: VaultWidgetConfigResolver = {
      resolve: vi.fn().mockResolvedValue(config())
    }
    const resolver = createEnsoVaultConfigResolver({
      baseResolver,
      enso: { getRoute: vi.fn() },
      priceService: false,
      tokenCatalog: {
        list: vi.fn().mockResolvedValue([{ address: routeAddress, chainId: 10, decimals: 18, symbol: 'WETH' }])
      }
    })

    const resolved = await resolver.resolve(1, vaultAddress)

    expect(resolved.depositTokens.map(({ address }) => address)).toContain(routeAddress)
    expect(resolved.solvers).toContain('enso')
  })

  it('does not decorate product presets that own their route behavior', async () => {
    const baseResolver: VaultWidgetConfigResolver = {
      resolve: vi.fn().mockResolvedValue(config('ybold-mainnet'))
    }
    const list = vi.fn()
    const resolver = createEnsoVaultConfigResolver({
      baseResolver,
      priceService: false,
      tokenCatalog: { list }
    })

    await expect(resolver.resolve(1, vaultAddress)).resolves.toMatchObject({ id: 'ybold-mainnet' })
    expect(list).not.toHaveBeenCalled()
  })
})
