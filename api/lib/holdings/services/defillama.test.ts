import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DefiLlamaBatchResponse } from '../types'
import { getCachedPrices, saveCachedPrices } from './cache'
import { fetchHistoricalPrices, getPriceAtTimestamp, parseDefiLlamaResponse } from './defillama'

vi.mock('./cache', () => ({
  getCachedPrices: vi.fn(async () => new Map()),
  saveCachedPrices: vi.fn(async () => {})
}))

function createBatchResponse(response: DefiLlamaBatchResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.mocked(getCachedPrices).mockResolvedValue(new Map())
  vi.mocked(saveCachedPrices).mockResolvedValue()
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

  it('fetches only missing token-timestamp pairs instead of the union across missing tokens', async () => {
    const usdcKey = 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const daiKey = 'ethereum:0x6b175474e89094c44da98b954eedeac495271d0f'
    vi.mocked(getCachedPrices).mockResolvedValue(
      new Map([
        [usdcKey, new Map([[1700000000, 1]])],
        [daiKey, new Map([[1700003600, 1]])]
      ])
    )

    const fetchStub = vi.fn().mockResolvedValue(
      createBatchResponse({
        coins: {
          [usdcKey]: {
            symbol: 'USDC',
            prices: [{ timestamp: 1700003600, price: 1.001, confidence: 0.99 }]
          },
          [daiKey]: {
            symbol: 'DAI',
            prices: [{ timestamp: 1700000000, price: 0.999, confidence: 0.99 }]
          }
        }
      })
    )

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(
      [
        { chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
        { chainId: 1, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' }
      ],
      [1700000000, 1700003600]
    )

    expect(fetchStub).toHaveBeenCalledTimes(1)

    const requestUrl = new URL(fetchStub.mock.calls[0][0] as string)
    const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
      string,
      number[]
    >

    expect(coinsParam).toEqual({
      [usdcKey]: [1700003600],
      [daiKey]: [1700000000]
    })
    expect(prices.get(usdcKey)?.get(1700000000)).toBe(1)
    expect(prices.get(usdcKey)?.get(1700003600)).toBe(1.001)
    expect(prices.get(daiKey)?.get(1700000000)).toBe(0.999)
    expect(prices.get(daiKey)?.get(1700003600)).toBe(1)
  })

  it('merges multiple timestamp slices for the same token into a single batch request', async () => {
    const usdcKey = 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const timestamps = [
      1700000000, 1700000600, 1700001200, 1700001800, 1700002400, 1700003000, 1700003600, 1700004200, 1700004800,
      1700005400, 1700006000, 1700006600
    ]
    const fetchStub = vi.fn().mockResolvedValue(
      createBatchResponse({
        coins: {
          [usdcKey]: {
            symbol: 'USDC',
            prices: timestamps.map((timestamp, index) => ({
              timestamp,
              price: 1 + index / 1000,
              confidence: 0.99
            }))
          }
        }
      })
    )

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(
      [{ chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }],
      timestamps
    )

    expect(fetchStub).toHaveBeenCalledTimes(1)

    const requestUrl = new URL(fetchStub.mock.calls[0][0] as string)
    const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
      string,
      number[]
    >

    expect(coinsParam).toEqual({
      [usdcKey]: timestamps
    })
    timestamps.forEach((timestamp, index) => {
      expect(prices.get(usdcKey)?.get(timestamp)).toBe(1 + index / 1000)
    })
  })

  it('batches up to 50 token addresses into a single request', async () => {
    const tokens = Array.from({ length: 51 }, (_value, index) => ({
      chainId: 1,
      address: `0x${(index + 1).toString(16).padStart(40, '0')}`
    }))
    const timestamp = 1700000000
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const requestUrl = new URL(input.toString())
      const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
        string,
        number[]
      >

      return createBatchResponse({
        coins: Object.fromEntries(
          Object.entries(coinsParam).map(([coinKey, requestedTimestamps]) => [
            coinKey,
            {
              symbol: 'TKN',
              prices: requestedTimestamps.map((requestedTimestamp) => ({
                timestamp: requestedTimestamp,
                price: 1,
                confidence: 0.99
              }))
            }
          ])
        )
      })
    })

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(tokens, [timestamp])

    expect(fetchStub).toHaveBeenCalledTimes(2)

    const firstRequestUrl = new URL(fetchStub.mock.calls[0][0] as string)
    const secondRequestUrl = new URL(fetchStub.mock.calls[1][0] as string)
    const firstCoinsParam = JSON.parse(
      decodeURIComponent(firstRequestUrl.searchParams.get('coins') ?? 'null')
    ) as Record<string, number[]>
    const secondCoinsParam = JSON.parse(
      decodeURIComponent(secondRequestUrl.searchParams.get('coins') ?? 'null')
    ) as Record<string, number[]>

    expect(Object.keys(firstCoinsParam)).toHaveLength(50)
    expect(Object.keys(secondCoinsParam)).toHaveLength(1)
    expect(prices.size).toBe(51)
  })

  it('uses the paid DefiLlama pro API GET route with larger batches when DEFILLAMA_API_KEY is set', async () => {
    vi.stubEnv('DEFILLAMA_API_KEY', 'test-llama-key')

    const tokens = Array.from({ length: 90 }, (_value, index) => ({
      chainId: 1,
      address: `0x${(index + 1).toString(16).padStart(40, '0')}`
    }))
    const timestamp = 1700000000
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const requestUrl = new URL(input.toString())
      const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
        string,
        number[]
      >

      return createBatchResponse({
        coins: Object.fromEntries(
          Object.entries(coinsParam).map(([coinKey, requestedTimestamps]) => [
            coinKey,
            {
              symbol: 'TKN',
              prices: requestedTimestamps.map((requestedTimestamp) => ({
                timestamp: requestedTimestamp,
                price: 1,
                confidence: 0.99
              }))
            }
          ])
        )
      })
    })

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(tokens, [timestamp])

    expect(fetchStub.mock.calls.length).toBeGreaterThan(1)
    fetchStub.mock.calls.forEach(([requestInput, requestInit]) => {
      const requestUrl = new URL(String(requestInput))
      const requestCoinsParam = JSON.parse(
        decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')
      ) as Record<string, number[]>

      expect(requestUrl.origin).toBe('https://pro-api.llama.fi')
      expect(requestUrl.pathname).toBe('/test-llama-key/coins/batchHistorical')
      expect(requestUrl.toString().length).toBeLessThanOrEqual(3_500)
      expect(requestInit).toEqual({ signal: expect.any(AbortSignal) })
      expect(Object.keys(requestCoinsParam).length).toBeGreaterThan(0)
    })
    expect(prices.size).toBe(90)
  })

  it('falls back to the free GET route when the paid GET route fails', async () => {
    vi.stubEnv('DEFILLAMA_API_KEY', 'test-llama-key')

    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404
      } satisfies Partial<Response>)
      .mockResolvedValueOnce(
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
      [{ chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' }],
      [1700000000]
    )

    expect(fetchStub).toHaveBeenCalledTimes(2)

    const [firstRequestInput, firstRequestInit] = fetchStub.mock.calls[0] ?? []
    const [secondRequestInput, secondRequestInit] = fetchStub.mock.calls[1] ?? []
    const firstRequestUrl = new URL(String(firstRequestInput))
    const firstCoinsParam = JSON.parse(
      decodeURIComponent(firstRequestUrl.searchParams.get('coins') ?? 'null')
    ) as Record<string, number[]>

    expect(firstRequestUrl.origin).toBe('https://pro-api.llama.fi')
    expect(firstRequestUrl.pathname).toBe('/test-llama-key/coins/batchHistorical')
    expect(firstRequestInit).toEqual({ signal: expect.any(AbortSignal) })
    expect(firstCoinsParam).toEqual({
      'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': [1700000000]
    })
    expect(String(secondRequestInput)).toBe(
      'https://coins.llama.fi/batchHistorical?coins=%7B%22ethereum%3A0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48%22%3A%5B1700000000%5D%7D'
    )
    expect(secondRequestInit).toEqual({ signal: expect.any(AbortSignal) })
    expect(prices.get('ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')?.get(1700000000)).toBe(1)
  })

  it('splits paid GET batches before the request URL grows beyond the configured limit', async () => {
    vi.stubEnv('DEFILLAMA_API_KEY', 'test-llama-key')

    const tokens = Array.from({ length: 20 }, (_value, index) => ({
      chainId: 1,
      address: `0x${(index + 1).toString(16).padStart(40, '0')}`
    }))
    const timestamps = Array.from({ length: 50 }, (_value, index) => 1700000000 + index * 60)
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const requestUrl = new URL(input.toString())
      const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
        string,
        number[]
      >

      return createBatchResponse({
        coins: Object.fromEntries(
          Object.entries(coinsParam).map(([coinKey, requestedTimestamps]) => [
            coinKey,
            {
              symbol: 'TKN',
              prices: requestedTimestamps.map((requestedTimestamp) => ({
                timestamp: requestedTimestamp,
                price: 1,
                confidence: 0.99
              }))
            }
          ])
        )
      })
    })

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(tokens, timestamps)

    expect(fetchStub.mock.calls.length).toBeGreaterThan(1)
    fetchStub.mock.calls.forEach(([requestInput, requestInit]) => {
      const requestUrl = new URL(String(requestInput))

      expect(requestUrl.origin).toBe('https://pro-api.llama.fi')
      expect(requestUrl.pathname).toBe('/test-llama-key/coins/batchHistorical')
      expect(requestUrl.toString().length).toBeLessThanOrEqual(3_500)
      expect(requestInit).toEqual({ signal: expect.any(AbortSignal) })
    })
    expect(prices.size).toBe(20)
  })

  it('recursively splits oversized GET batches when the server rejects them', async () => {
    vi.stubEnv('DEFILLAMA_API_KEY', 'test-llama-key')

    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const requestUrl = new URL(input.toString())
      const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
        string,
        number[]
      >
      const requestedCoinCount = Object.keys(coinsParam).length

      if (requestedCoinCount > 1) {
        return new Response(null, { status: 431 })
      }

      return createBatchResponse({
        coins: Object.fromEntries(
          Object.entries(coinsParam).map(([coinKey, requestedTimestamps]) => [
            coinKey,
            {
              symbol: 'TKN',
              prices: requestedTimestamps.map((requestedTimestamp) => ({
                timestamp: requestedTimestamp,
                price: 1,
                confidence: 0.99
              }))
            }
          ])
        )
      })
    })

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(
      [
        { chainId: 1, address: '0x0000000000000000000000000000000000000001' },
        { chainId: 1, address: '0x0000000000000000000000000000000000000002' }
      ],
      [1700000000]
    )

    expect(fetchStub.mock.calls.length).toBeGreaterThan(1)
    expect(prices.get('ethereum:0x0000000000000000000000000000000000000001')?.get(1700000000)).toBe(1)
    expect(prices.get('ethereum:0x0000000000000000000000000000000000000002')?.get(1700000000)).toBe(1)
  })

  it('interleaves token timestamp slices so multi-token requests stay grouped together', async () => {
    const tokens = Array.from({ length: 6 }, (_value, index) => ({
      chainId: 1,
      address: `0x${(index + 1).toString(16).padStart(40, '0')}`
    }))
    const timestamps = [
      1700000000, 1700000600, 1700001200, 1700001800, 1700002400, 1700003000, 1700003600, 1700004200, 1700004800,
      1700005400, 1700006000, 1700006600
    ]
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const requestUrl = new URL(input.toString())
      const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
        string,
        number[]
      >

      return createBatchResponse({
        coins: Object.fromEntries(
          Object.entries(coinsParam).map(([coinKey, requestedTimestamps]) => [
            coinKey,
            {
              symbol: 'TKN',
              prices: requestedTimestamps.map((requestedTimestamp) => ({
                timestamp: requestedTimestamp,
                price: 1,
                confidence: 0.99
              }))
            }
          ])
        )
      })
    })

    vi.stubGlobal('fetch', fetchStub)

    await fetchHistoricalPrices(tokens, timestamps)

    expect(fetchStub).toHaveBeenCalledTimes(1)

    const requestUrl = new URL(fetchStub.mock.calls[0][0] as string)
    const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
      string,
      number[]
    >

    expect(Object.keys(coinsParam)).toHaveLength(6)
    Object.values(coinsParam).forEach((requestedTimestamps) => {
      expect(requestedTimestamps).toEqual(timestamps)
    })
  })

  it('caches prices under the requested timestamps even when DefiLlama returns shifted timestamps', async () => {
    const usdcKey = 'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const requestedTimestamps = [1700000000, 1700003600]
    const fetchStub = vi.fn().mockResolvedValue(
      createBatchResponse({
        coins: {
          [usdcKey]: {
            symbol: 'USDC',
            prices: [
              { timestamp: 1700000102, price: 1.001, confidence: 0.99 },
              { timestamp: 1700003520, price: 0.999, confidence: 0.99 }
            ]
          }
        }
      })
    )

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(
      [{ chainId: 1, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }],
      requestedTimestamps
    )

    expect(prices.get(usdcKey)?.get(1700000000)).toBe(1.001)
    expect(prices.get(usdcKey)?.get(1700003600)).toBe(0.999)
    expect(vi.mocked(saveCachedPrices)).toHaveBeenCalledWith([
      { tokenKey: usdcKey, timestamp: 1700000000, price: 1.001 },
      { tokenKey: usdcKey, timestamp: 1700003600, price: 0.999 }
    ])
  })
})
