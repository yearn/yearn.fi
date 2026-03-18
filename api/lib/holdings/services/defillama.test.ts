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

  it('packs many current-price misses into a single batch request', async () => {
    const timestamp = 1700000000
    const tokenKeys = Array.from({ length: 6 }, (_value, index) => {
      const address = `0x${String(index + 1).padStart(40, '0')}`
      return {
        key: `ethereum:${address.toLowerCase()}`,
        address
      }
    })
    const fetchStub = vi.fn().mockResolvedValue(
      createBatchResponse({
        coins: tokenKeys.reduce<DefiLlamaBatchResponse['coins']>((coins, token, index) => {
          coins[token.key] = {
            symbol: `T${index}`,
            prices: [{ timestamp, price: index + 1, confidence: 0.99 }]
          }
          return coins
        }, {})
      })
    )

    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(
      tokenKeys.map((token) => ({ chainId: 1, address: token.address })),
      [timestamp]
    )

    expect(fetchStub).toHaveBeenCalledTimes(1)

    const requestUrl = new URL(fetchStub.mock.calls[0][0] as string)
    const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
      string,
      number[]
    >

    expect(Object.keys(coinsParam)).toHaveLength(6)
    tokenKeys.forEach((token, index) => {
      expect(coinsParam[token.key]).toEqual([timestamp])
      expect(prices.get(token.key)?.get(timestamp)).toBe(index + 1)
    })
  })

  it('packs large historical fills into fewer larger requests', async () => {
    const timestamps = Array.from({ length: 254 }, (_value, index) => 1700000000 + index)
    const tokenKeys = Array.from({ length: 6 }, (_value, index) => {
      const address = `0x${String(index + 1).padStart(40, '0')}`
      return {
        key: `ethereum:${address.toLowerCase()}`,
        address
      }
    })
    const fetchStub = vi.fn().mockImplementation((input: string | URL | Request) => {
      const requestUrl = new URL(input instanceof Request ? input.url : input.toString())
      const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
        string,
        number[]
      >

      return Promise.resolve(
        createBatchResponse({
          coins: Object.entries(coinsParam).reduce<DefiLlamaBatchResponse['coins']>(
            (coins, [coinKey, requestedTimestamps]) => {
              coins[coinKey] = {
                symbol: coinKey,
                prices: requestedTimestamps.map((timestamp) => ({
                  timestamp,
                  price: 1,
                  confidence: 0.99
                }))
              }
              return coins
            },
            {}
          )
        })
      )
    })

    vi.stubGlobal('fetch', fetchStub)

    await fetchHistoricalPrices(
      tokenKeys.map((token) => ({ chainId: 1, address: token.address })),
      timestamps
    )

    expect(fetchStub).toHaveBeenCalledTimes(2)

    const requestedTokenCounts = fetchStub.mock.calls.map((call) => {
      const requestUrl = new URL(call[0] as string)
      const coinsParam = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
        string,
        number[]
      >

      return Object.keys(coinsParam).length
    })

    expect(requestedTokenCounts).toEqual([3, 3])
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
