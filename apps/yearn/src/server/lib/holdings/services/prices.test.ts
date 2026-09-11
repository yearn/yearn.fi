import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoricalPriceBatchResponse } from '../types'
import {
  fetchHistoricalPrices,
  fetchHistoricalPricesForTokenTimestamps,
  getChainPrefix,
  getHistoricalPriceFetchFailedBatches,
  getPriceAtTimestamp
} from './prices'

function createBatchResponse(response: HistoricalPriceBatchResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

type TDeferred<T> = Readonly<{
  promise: Promise<T>
  resolve: (value: T) => void
}>

function createDeferred<T>(): TDeferred<T> {
  const controls: { resolve: (value: T) => void } = { resolve: () => undefined }
  const promise = new Promise<T>((resolve) => {
    controls.resolve = resolve
  })
  return { promise, resolve: (value) => controls.resolve(value) }
}

function useYearnPrices(): void {
  vi.stubEnv('YEARN_PRICES_BASE_URL', 'https://prices.example')
  vi.stubEnv('YEARN_PRICES_API_KEY', 'test-key')
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Yearn Prices holdings history', () => {
  it('maps supported chain IDs to Yearn Prices prefixes', () => {
    expect(getChainPrefix(1)).toBe('ethereum')
    expect(getChainPrefix(747474)).toBe('katana')
  })

  it('requests batch history and maps UTC day prices back to requested timestamps', async () => {
    useYearnPrices()
    const tokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const tokenKey = `ethereum:${tokenAddress}`
    const requestedTimestamp = 1_700_000_000
    const normalizedTimestamp = 1_700_006_399
    const fetchStub = vi.fn().mockResolvedValue(
      createBatchResponse({
        coins: {
          [tokenKey]: {
            symbol: 'USDC',
            prices: [{ timestamp: normalizedTimestamp, price: 1.002, confidence: 0.99 }]
          }
        }
      })
    )
    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPricesForTokenTimestamps([
      { chainId: 1, address: tokenAddress, timestamps: [requestedTimestamp] }
    ])
    const [requestInput, requestInit] = fetchStub.mock.calls[0] ?? []
    const requestUrl = new URL(String(requestInput))
    const coins = JSON.parse(decodeURIComponent(requestUrl.searchParams.get('coins') ?? 'null')) as Record<
      string,
      number[]
    >

    expect(requestUrl.origin).toBe('https://prices.example')
    expect(requestUrl.pathname).toBe('/api/prices/batchHistorical')
    expect(coins).toEqual({ [tokenKey]: [normalizedTimestamp] })
    expect(requestInit).toEqual({
      headers: { Authorization: 'Bearer test-key' },
      signal: expect.any(AbortSignal)
    })
    expect(prices.get(tokenKey)?.get(requestedTimestamp)).toBe(1.002)
  })

  it('uses range history for shared contiguous daily timestamps', async () => {
    useYearnPrices()
    const firstToken = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const secondToken = '0xc2d3d421e23149b78d1843d0d59530dc0bd5add4'
    const timestamps = [1_704_153_599, 1_704_239_999]
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString())
      const coins = JSON.parse(decodeURIComponent(url.searchParams.get('coins') ?? 'null')) as Record<
        string,
        [number, number]
      >
      return createBatchResponse({
        coins: Object.fromEntries(
          Object.keys(coins).map((coinKey) => [
            coinKey,
            {
              symbol: 'TKN',
              prices: timestamps.map((timestamp, index) => ({ timestamp, price: index + 1, confidence: 0.99 }))
            }
          ])
        )
      })
    })
    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPricesForTokenTimestamps([
      { chainId: 1, address: firstToken, timestamps },
      { chainId: 1, address: secondToken, timestamps }
    ])
    const requestUrl = new URL(String(fetchStub.mock.calls[0]?.[0]))

    expect(requestUrl.pathname).toBe('/api/prices/rangeHistorical')
    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(prices.get(`ethereum:${firstToken}`)?.get(timestamps[1]!)).toBe(2)
    expect(prices.get(`ethereum:${secondToken}`)?.get(timestamps[0]!)).toBe(1)
  })

  it('keeps requests under the configured token-timestamp cap', async () => {
    useYearnPrices()
    const tokens = Array.from({ length: 4 }, (_value, index) => ({
      chainId: 1,
      address: `0x${(index + 1).toString(16).padStart(40, '0')}`,
      timestamps: Array.from({ length: 50 }, (_unused, timestampIndex) => 1_704_153_599 + timestampIndex * 2 * 86_400)
    }))
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString())
      const coins = JSON.parse(decodeURIComponent(url.searchParams.get('coins') ?? 'null')) as Record<string, number[]>
      return createBatchResponse({
        coins: Object.fromEntries(
          Object.entries(coins).map(([coinKey, requestedTimestamps]) => [
            coinKey,
            {
              symbol: 'TKN',
              prices: requestedTimestamps.map((timestamp) => ({ timestamp, price: 1, confidence: 0.99 }))
            }
          ])
        )
      })
    })
    vi.stubGlobal('fetch', fetchStub)

    await fetchHistoricalPricesForTokenTimestamps(tokens)

    expect(fetchStub.mock.calls.length).toBeGreaterThan(1)
    fetchStub.mock.calls.forEach(([requestInput]) => {
      const url = new URL(String(requestInput))
      const coins = JSON.parse(decodeURIComponent(url.searchParams.get('coins') ?? 'null')) as Record<string, number[]>
      expect(Object.values(coins).reduce((total, values) => total + values.length, 0)).toBeLessThanOrEqual(150)
      expect(Object.values(coins).every((values) => values.length <= 45)).toBe(true)
    })
  })

  it('caps requests across concurrent callers at twelve', async () => {
    useYearnPrices()
    const timestamps = Array.from({ length: 45 }, (_value, index) => 1_704_153_599 + index * 2 * 86_400)
    const buildRequests = (offset: number) =>
      Array.from({ length: 37 }, (_value, index) => ({
        chainId: 1,
        address: `0x${(offset + index + 1).toString(16).padStart(40, '0')}`,
        timestamps
      }))
    const deferredResponses = Array.from({ length: 26 }, () => createDeferred<Response>())
    const cursor = { value: 0 }
    const activity = { active: 0, peak: 0 }
    const fetchStub = vi.fn(() => {
      const deferred = deferredResponses[cursor.value]!
      cursor.value += 1
      activity.active += 1
      activity.peak = Math.max(activity.peak, activity.active)
      return deferred.promise.finally(() => {
        activity.active -= 1
      })
    })
    vi.stubGlobal('fetch', fetchStub)

    const request = Promise.all([
      fetchHistoricalPricesForTokenTimestamps(buildRequests(0)),
      fetchHistoricalPricesForTokenTimestamps(buildRequests(100))
    ])
    await vi.waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(12))
    deferredResponses.forEach((deferred) => {
      deferred.resolve(createBatchResponse({ coins: {} }))
    })
    await request

    expect(activity.peak).toBe(12)
    expect(fetchStub).toHaveBeenCalledTimes(26)
  })

  it('splits a timed-out batch and returns both token prices', async () => {
    useYearnPrices()
    const timestamp = 1_704_153_599
    const tokenAddresses = ['0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002']
    const fetchStub = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString())
      const coins = JSON.parse(decodeURIComponent(url.searchParams.get('coins') ?? 'null')) as Record<string, number[]>
      if (Object.keys(coins).length > 1) {
        const error = new Error('The operation timed out.')
        error.name = 'TimeoutError'
        throw error
      }
      return createBatchResponse({
        coins: Object.fromEntries(
          Object.entries(coins).map(([coinKey, requestedTimestamps]) => [
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

    const prices = await fetchHistoricalPricesForTokenTimestamps(
      tokenAddresses.map((address) => ({ chainId: 1, address, timestamps: [timestamp] }))
    )

    expect(fetchStub).toHaveBeenCalledTimes(3)
    expect(tokenAddresses.every((address) => prices.get(`ethereum:${address}`)?.get(timestamp) === 1)).toBe(true)
  })

  it('marks failed batches while preserving successful batches', async () => {
    useYearnPrices()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const tokens = Array.from({ length: 51 }, (_value, index) => ({
      chainId: 1,
      address: `0x${(index + 1).toString(16).padStart(40, '0')}`
    }))
    const successfulTokenKey = 'ethereum:0x0000000000000000000000000000000000000033'
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(
        createBatchResponse({
          coins: {
            [successfulTokenKey]: {
              symbol: 'TKN',
              prices: [{ timestamp: 1_700_006_399, price: 1, confidence: 0.99 }]
            }
          }
        })
      )
    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices(tokens, [1_700_000_000])

    expect(getHistoricalPriceFetchFailedBatches(prices)).toBe(1)
    expect(prices.get(successfulTokenKey)?.get(1_700_000_000)).toBe(1)
  })

  it('retries transient connection errors', async () => {
    useYearnPrices()
    const tokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const fetchStub = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Unable to connect'), { code: 'ConnectionRefused' }))
      .mockResolvedValue(
        createBatchResponse({
          coins: {
            [`ethereum:${tokenAddress}`]: {
              symbol: 'USDC',
              prices: [{ timestamp: 1_700_006_399, price: 1, confidence: 0.99 }]
            }
          }
        })
      )
    vi.stubGlobal('fetch', fetchStub)

    const prices = await fetchHistoricalPrices([{ chainId: 1, address: tokenAddress }], [1_700_000_000])

    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(prices.get(`ethereum:${tokenAddress}`)?.get(1_700_000_000)).toBe(1)
  })

  it('requires Yearn Prices credentials', async () => {
    vi.stubEnv('YEARN_PRICES_API_KEY', '')
    vi.stubEnv('API_KEY_PORTFOLIO', '')
    await expect(fetchHistoricalPrices([], [])).rejects.toThrow('Yearn Prices requires')
  })

  it('finds the closest prior historical price and refreshes its timestamp index', () => {
    const priceMap = new Map([
      [300, 1.3],
      [100, 1.1],
      [200, 1.2]
    ])
    const keysSpy = vi.spyOn(priceMap, 'keys')

    expect(getPriceAtTimestamp(priceMap, 50)).toBe(0)
    expect(getPriceAtTimestamp(priceMap, 250)).toBe(1.2)
    expect(getPriceAtTimestamp(priceMap, 350)).toBe(1.3)
    expect(keysSpy).toHaveBeenCalledTimes(1)
    priceMap.set(225, 1.225)
    expect(getPriceAtTimestamp(priceMap, 250)).toBe(1.225)
    expect(keysSpy).toHaveBeenCalledTimes(2)
  })
})
