import {
  buildVaultWidgetSpotPriceKey,
  buildVaultWidgetSpotPriceKeys,
  buildVaultWidgetSpotPriceRequestUrl,
  fetchVaultWidgetSpotPrices,
  parseVaultWidgetSpotPriceResponse,
  resolveVaultWidgetSpotPrice
} from '@yearn/vault-widget/internal/hooks/useVaultWidgetSpotPrices'
import {
  ARB_WETH_TOKEN_ADDRESS,
  BASE_WETH_TOKEN_ADDRESS,
  ETH_TOKEN_ADDRESS,
  OPT_WETH_TOKEN_ADDRESS,
  WETH_TOKEN_ADDRESS,
  WFTM_TOKEN_ADDRESS
} from '@yearn/vault-widget/internal/utils/constants'
import { zeroAddress } from 'viem'
import { describe, expect, it, vi } from 'vitest'

const TOKEN_A = '0x0000000000000000000000000000000000000001' as const
const TOKEN_B = '0x0000000000000000000000000000000000000002' as const

describe('vault widget spot prices', () => {
  it('builds deterministic Yearn price keys and resolves native ETH to WETH', () => {
    expect(buildVaultWidgetSpotPriceKey({ address: ETH_TOKEN_ADDRESS, chainId: 1 })).toBe(
      `ethereum:${WETH_TOKEN_ADDRESS.toLowerCase()}`
    )
    expect(
      buildVaultWidgetSpotPriceKeys([
        { address: TOKEN_B, chainId: 1 },
        { address: TOKEN_A, chainId: 1 },
        { address: TOKEN_B, chainId: 1 },
        undefined
      ])
    ).toEqual([`ethereum:${TOKEN_A}`, `ethereum:${TOKEN_B}`])
  })

  it.each([
    [10, 'optimism', OPT_WETH_TOKEN_ADDRESS],
    [250, 'fantom', WFTM_TOKEN_ADDRESS],
    [8453, 'base', BASE_WETH_TOKEN_ADDRESS],
    [42161, 'arbitrum', ARB_WETH_TOKEN_ADDRESS]
  ] as const)('resolves the native sentinel on chain %s to its wrapped price token', (chainId, chainName, wrapper) => {
    expect(buildVaultWidgetSpotPriceKey({ address: ETH_TOKEN_ADDRESS, chainId })).toBe(
      `${chainName}:${wrapper.toLowerCase()}`
    )
  })

  it('retains the native sentinel on supported chains without a configured wrapper', () => {
    expect(buildVaultWidgetSpotPriceKey({ address: ETH_TOKEN_ADDRESS, chainId: 137 })).toBe(
      `polygon:${ETH_TOKEN_ADDRESS.toLowerCase()}`
    )
  })

  it('omits unsupported chains and the zero address', () => {
    expect(buildVaultWidgetSpotPriceKey({ address: TOKEN_A, chainId: 999_999 })).toBeNull()
    expect(buildVaultWidgetSpotPriceKey({ address: zeroAddress, chainId: 1 })).toBeNull()
    expect(buildVaultWidgetSpotPriceKey({ address: 'not-an-address' as `0x${string}`, chainId: 1 })).toBeNull()
  })

  it('appends the encoded coin list without discarding existing endpoint parameters', () => {
    const url = buildVaultWidgetSpotPriceRequestUrl('/api/prices/spot?source=widget', [`ethereum:${TOKEN_A}`])
    const parsed = new URL(url, 'https://example.com')

    expect(parsed.searchParams.get('source')).toBe('widget')
    expect(JSON.parse(parsed.searchParams.get('coins') || '[]')).toEqual([`ethereum:${TOKEN_A}`])
  })

  it('parses positive prices defensively and normalizes response keys', () => {
    expect(
      parseVaultWidgetSpotPriceResponse({
        coins: {
          [`Ethereum:${TOKEN_A.toUpperCase()}`]: {
            prices: [{ price: -1 }, { price: 1.25 }]
          },
          [`ethereum:${TOKEN_B}`]: { prices: [{ price: Number.NaN }] },
          'ethereum:not-an-address': { prices: [{ price: 12 }] },
          malformed: { prices: [{ price: 10 }] }
        }
      })
    ).toEqual({ [`ethereum:${TOKEN_A}`]: 1.25 })
  })

  it('prefers fetched prices and retains the synchronous runtime fallback', () => {
    const token = { address: TOKEN_A, chainId: 1 }

    expect(
      resolveVaultWidgetSpotPrice({
        fetchedPrices: { [`ethereum:${TOKEN_A}`]: 2 },
        runtimePrice: 1,
        token
      })
    ).toBe(2)
    expect(resolveVaultWidgetSpotPrice({ fetchedPrices: {}, runtimePrice: 1, token })).toBe(1)
    expect(resolveVaultWidgetSpotPrice({ fetchedPrices: {}, runtimePrice: Number.NaN, token })).toBe(0)
  })

  it('batches endpoint requests at the server limit and merges their prices', async () => {
    const priceKeys = Array.from(
      { length: 51 },
      (_, index) => `ethereum:0x${(index + 1).toString(16).padStart(40, '0')}`
    )
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://example.com')
      const batch = JSON.parse(url.searchParams.get('coins') || '[]') as string[]
      return Response.json({
        coins: Object.fromEntries(batch.map((key, index) => [key, { prices: [{ price: index + 1 }] }]))
      })
    })

    const prices = await fetchVaultWidgetSpotPrices({
      endpoint: '/api/prices/spot',
      fetcher,
      priceKeys
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(Object.keys(prices)).toHaveLength(51)
    expect(prices[priceKeys[0]]).toBe(1)
    expect(prices[priceKeys[50]]).toBe(1)
  })
})
