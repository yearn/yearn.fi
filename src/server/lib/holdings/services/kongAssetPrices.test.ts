import { describe, expect, it, vi } from 'vitest'
import {
  createKongAssetPricePrefetcher,
  fetchMissingHistoricalAssetPricesFromKong
} from '@/server/lib/holdings/services/kongAssetPrices'

const VAULT_A = '0x00000000000000000000000000000000000000aa'
const VAULT_B = '0x00000000000000000000000000000000000000ab'
const ASSET_ADDRESS = '0x00000000000000000000000000000000000000bb'
const PRICE_KEY = `optimism:${ASSET_ADDRESS}`
const DAY_ONE_START = 1_755_043_200
const DAY_TWO_START = 1_755_129_600
const DAY_ONE_END = DAY_ONE_START + 86_399
const DAY_TWO_END = DAY_TWO_START + 86_399

function requirement(vaultAddress = VAULT_A, timestamps = [DAY_ONE_END, DAY_TWO_END]) {
  return { chainId: 10, vaultAddress, assetAddress: ASSET_ADDRESS, timestamps }
}

function response(points: unknown[], status = 200): Response {
  return new Response(JSON.stringify(points), { status })
}

function deferredResponse(): Readonly<{ promise: Promise<Response>; resolve: (value: Response) => void }> {
  const controls = { resolve: (_value: Response) => undefined }
  const promise = new Promise<Response>((resolve) => {
    controls.resolve = resolve
  })
  return { promise, resolve: (value) => controls.resolve(value) }
}

describe('fetchMissingHistoricalAssetPricesFromKong', () => {
  it('returns only exact UTC-day averages', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      response([
        { time: DAY_ONE_START, component: 'priceUsd', value: '100' },
        { time: DAY_TWO_START, component: 'priceUsd', value: '200' },
        { time: DAY_TWO_START, component: 'tvl', value: '3000' }
      ])
    ) as typeof fetch
    const result = await fetchMissingHistoricalAssetPricesFromKong({
      requirements: [requirement()],
      fetchFn
    })

    expect(result.get(PRICE_KEY)).toEqual(
      new Map([
        [DAY_ONE_END, 100],
        [DAY_TWO_END, 200]
      ])
    )
  })

  it('does not call Kong when there are no missing requirements', async () => {
    const fetchFn = vi.fn() as typeof fetch

    await expect(fetchMissingHistoricalAssetPricesFromKong({ requirements: [], fetchFn })).resolves.toEqual(new Map())
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('uses canonical shared-asset candidates to fill gaps without overwriting earlier values', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response([{ time: DAY_ONE_START, component: 'priceUsd', value: '100' }]))
      .mockResolvedValueOnce(
        response([
          { time: DAY_ONE_START, component: 'priceUsd', value: '999' },
          { time: DAY_TWO_START, component: 'priceUsd', value: '200' }
        ])
      ) as typeof fetch

    const result = await fetchMissingHistoricalAssetPricesFromKong({
      requirements: [requirement(VAULT_B), requirement(VAULT_A)],
      fetchFn
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain(`/10/${VAULT_A}?`)
    expect(String(fetchFn.mock.calls[1]?.[0])).toContain(`/10/${VAULT_B}?`)
    expect(result.get(PRICE_KEY)).toEqual(
      new Map([
        [DAY_ONE_END, 100],
        [DAY_TWO_END, 200]
      ])
    )
  })

  it('retries transient failures but advances immediately after a nonretryable response', async () => {
    vi.useFakeTimers()
    try {
      const retryFetch = vi
        .fn()
        .mockResolvedValueOnce(response([], 503))
        .mockResolvedValueOnce(response([{ time: DAY_ONE_START, component: 'priceUsd', value: '100' }])) as typeof fetch
      const retryPromise = fetchMissingHistoricalAssetPricesFromKong({
        requirements: [requirement(VAULT_A, [DAY_ONE_END])],
        fetchFn: retryFetch
      })
      await vi.advanceTimersByTimeAsync(200)
      await expect(retryPromise).resolves.toMatchObject(new Map([[PRICE_KEY, new Map([[DAY_ONE_END, 100]])]]))
      expect(retryFetch).toHaveBeenCalledTimes(2)

      const fallbackFetch = vi
        .fn()
        .mockResolvedValueOnce(response([], 404))
        .mockResolvedValueOnce(response([{ time: DAY_ONE_START, component: 'priceUsd', value: '200' }])) as typeof fetch
      await expect(
        fetchMissingHistoricalAssetPricesFromKong({
          requirements: [requirement(VAULT_A, [DAY_ONE_END]), requirement(VAULT_B, [DAY_ONE_END])],
          fetchFn: fallbackFetch
        })
      ).resolves.toMatchObject(new Map([[PRICE_KEY, new Map([[DAY_ONE_END, 200]])]]))
      expect(fallbackFetch).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects zero, adjacent-day, malformed, and conflicting duplicate values', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      response([
        { time: DAY_ONE_START, component: 'priceUsd', value: '100' },
        { time: DAY_ONE_START, component: 'priceUsd', value: '101' },
        { time: DAY_TWO_START, component: 'priceUsd', value: '0' },
        { time: DAY_TWO_START + 1, component: 'priceUsd', value: '200' },
        { component: 'priceUsd', value: '300' }
      ])
    ) as typeof fetch

    const result = await fetchMissingHistoricalAssetPricesFromKong({
      requirements: [requirement()],
      fetchFn
    })

    expect(result.get(PRICE_KEY)).toEqual(new Map())
  })

  it('bounds concurrent asset-group requests', async () => {
    const active = { count: 0, peak: 0 }
    const controls = Array.from({ length: 9 }, deferredResponse)
    const fetchFn = vi.fn().mockImplementation(() => {
      const control = controls[fetchFn.mock.calls.length - 1]
      active.count += 1
      active.peak = Math.max(active.peak, active.count)
      return control.promise.finally(() => {
        active.count -= 1
      })
    }) as typeof fetch
    const requirements = Array.from({ length: 9 }, (_value, index) => ({
      chainId: 10,
      vaultAddress: `${VAULT_A.slice(0, -1)}${index}`,
      assetAddress: `${ASSET_ADDRESS.slice(0, -1)}${index}`,
      timestamps: [DAY_ONE_END]
    }))
    const promise = fetchMissingHistoricalAssetPricesFromKong({ requirements, fetchFn })

    await Promise.resolve()
    await Promise.resolve()
    expect(fetchFn).toHaveBeenCalledTimes(8)
    controls[0]?.resolve(response([]))
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(9))
    expect(fetchFn).toHaveBeenCalledTimes(9)
    controls.slice(1, 8).forEach((control) => {
      control.resolve(response([]))
    })
    controls[8]?.resolve(response([]))
    await promise
    expect(active.peak).toBe(8)
  })
})

describe('createKongAssetPricePrefetcher', () => {
  it('starts an actually missing asset before final requirements are resolved and returns the same exact-day result', async () => {
    const control = deferredResponse()
    const fetchFn = vi.fn().mockReturnValue(control.promise) as typeof fetch
    const prefetcher = createKongAssetPricePrefetcher({
      potentialRequirements: [requirement()],
      fetchFn
    })

    prefetcher.prefetch([{ chainId: 10, assetAddress: ASSET_ADDRESS }])

    await Promise.resolve()
    await Promise.resolve()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const resultPromise = prefetcher.resolve([requirement(VAULT_A, [DAY_TWO_END])])
    control.resolve(
      response([
        { time: DAY_ONE_START, component: 'priceUsd', value: '100' },
        { time: DAY_TWO_START, component: 'priceUsd', value: '200' }
      ])
    )

    await expect(resultPromise).resolves.toEqual(new Map([[PRICE_KEY, new Map([[DAY_TWO_END, 200]])]]))
  })

  it('deduplicates repeated missing-price notifications and preserves candidate precedence', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(response([{ time: DAY_ONE_START, component: 'priceUsd', value: '100' }]))
      .mockResolvedValueOnce(
        response([
          { time: DAY_ONE_START, component: 'priceUsd', value: '999' },
          { time: DAY_TWO_START, component: 'priceUsd', value: '200' }
        ])
      ) as typeof fetch
    const requirements = [requirement(VAULT_B), requirement(VAULT_A)]
    const prefetcher = createKongAssetPricePrefetcher({ potentialRequirements: requirements, fetchFn })

    prefetcher.prefetch([
      { chainId: 10, assetAddress: ASSET_ADDRESS },
      { chainId: 10, assetAddress: ASSET_ADDRESS.toUpperCase() }
    ])
    const result = await prefetcher.resolve(requirements)

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain(`/10/${VAULT_A}?`)
    expect(String(fetchFn.mock.calls[1]?.[0])).toContain(`/10/${VAULT_B}?`)
    expect(result.get(PRICE_KEY)).toEqual(
      new Map([
        [DAY_ONE_END, 100],
        [DAY_TWO_END, 200]
      ])
    )
  })

  it('keeps fallback failures non-fatal', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response([], 404)) as typeof fetch
    const prefetcher = createKongAssetPricePrefetcher({
      potentialRequirements: [requirement(VAULT_A, [DAY_ONE_END])],
      fetchFn
    })

    prefetcher.prefetch([{ chainId: 10, assetAddress: ASSET_ADDRESS }])

    await expect(prefetcher.resolve([requirement(VAULT_A, [DAY_ONE_END])])).resolves.toEqual(
      new Map([[PRICE_KEY, new Map()]])
    )
  })
})
