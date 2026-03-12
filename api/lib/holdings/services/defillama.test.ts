import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DefiLlamaBatchResponse } from '../types'
import { fetchHistoricalPrices, getPriceAtTimestamp, parseDefiLlamaResponse } from './defillama'

function createBatchResponse(response: DefiLlamaBatchResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('parseDefiLlamaResponse', () => {
  it('uses returned timestamps instead of assuming the requested order is preserved', () => {
    const response: DefiLlamaBatchResponse = {
      coins: {
        'ethereum:0xf939e0a03fb07f59a73314e73794be0e57ac1b4e': {
          symbol: 'crvUSD',
          prices: [
            { timestamp: 1773260095, price: 0.9966185770862551, confidence: 0.99 },
            { timestamp: 1700000102, price: 0.999211, confidence: 0.99 }
          ]
        }
      }
    }

    const parsed = parseDefiLlamaResponse(response, [1700000000, 1773260546])
    const priceMap = parsed.get('ethereum:0xf939e0a03fb07f59a73314e73794be0e57ac1b4e')

    expect(priceMap?.get(1773260095)).toBe(0.9966185770862551)
    expect(priceMap?.get(1700000102)).toBe(0.999211)
    expect(getPriceAtTimestamp(priceMap ?? new Map(), 1773260546)).toBe(0.9966185770862551)
  })

  it('retries bun connection refused errors and returns fetched prices', async () => {
    const fetchStub = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Unable to connect'), { code: 'ConnectionRefused' }))
      .mockResolvedValue(
        createBatchResponse({
          coins: {
            'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
              symbol: 'USDC',
              prices: [{ timestamp: 1700000000, price: 1, confidence: 0.99 }]
            }
          }
        })
      )

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(
      [{ chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }],
      [1700000000]
    )

    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(prices.get('ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')?.get(1700000000)).toBe(1)
  })

  it('throws when every DefiLlama batch request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchStub = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Unable to connect'), { code: 'ConnectionRefused' }))

    vi.stubGlobal('fetch', fetchStub)

    await expect(
      fetchHistoricalPrices([{ chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }], [1700000000])
    ).rejects.toThrow('Failed to fetch token prices from DefiLlama')
  })
})
