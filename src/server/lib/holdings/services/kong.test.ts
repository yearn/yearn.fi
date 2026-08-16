import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMultipleVaultsPPS, getPPS, getPpsFetchFailedVaults } from './kong'

function createResponse(points: Array<{ time: number; value: string }>): Response {
  return new Response(JSON.stringify(points.map((point) => ({ ...point, component: 'pps' }))), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function createDeferredResponse(): Readonly<{
  promise: Promise<Response>
  resolve: (response: Response) => void
}> {
  const controls = { resolve: (_response: Response) => undefined }
  const promise = new Promise<Response>((resolve) => {
    controls.resolve = resolve
  })
  return { promise, resolve: controls.resolve }
}

describe('getPPS', () => {
  it('returns null for an empty timeline instead of defaulting to 1', () => {
    expect(getPPS(new Map(), 123)).toBeNull()
  })

  it('indexes an unsorted timeline once and resolves repeated lookups with floor semantics', () => {
    const timeline = new Map([
      [300, 1.3],
      [100, 1.1],
      [200, 1.2]
    ])
    const keysSpy = vi.spyOn(timeline, 'keys')

    expect(getPPS(timeline, 200)).toBe(1.2)
    expect(getPPS(timeline, 50)).toBe(1.1)
    expect(getPPS(timeline, 250)).toBe(1.2)
    expect(getPPS(timeline, 275)).toBe(1.2)
    expect(getPPS(timeline, 350)).toBe(1.3)
    expect(keysSpy).toHaveBeenCalledTimes(1)
  })

  it('rebuilds its timestamp index when a timeline grows', () => {
    const timeline = new Map([
      [100, 1.1],
      [300, 1.3]
    ])

    expect(getPPS(timeline, 250)).toBe(1.1)
    timeline.set(200, 1.2)
    expect(getPPS(timeline, 250)).toBe(1.2)
  })
})

describe('fetchMultipleVaultsPPS', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deduplicates vault requests and retries transient socket resets', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('The socket connection was closed unexpectedly'), { code: 'ECONNRESET' })
      )
      .mockResolvedValue(createResponse([{ time: 100, value: '1.25' }])) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS(
      [
        { chainId: 1, vaultAddress: '0xABC' },
        { chainId: 1, vaultAddress: '0xabc' }
      ],
      {
        fetchFn,
        maxRetries: 1,
        retryDelayMs: 0,
        concurrency: 1
      }
    )

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(timelines.size).toBe(1)
    expect(timelines.get('1:0xabc')?.get(100)).toBe(1.25)
  })

  it('retries bun connection refused errors', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Unable to connect'), { code: 'ConnectionRefused' }))
      .mockResolvedValue(createResponse([{ time: 100, value: '1.1' }])) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress: '0xDEF' }], {
      fetchFn,
      maxRetries: 1,
      retryDelayMs: 0,
      concurrency: 1
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(timelines.get('1:0xdef')?.get(100)).toBe(1.1)
  })

  it('caps concurrent Kong requests', async () => {
    const activeRequests = { current: 0, max: 0 }
    const fetchFn = vi.fn(async () => {
      activeRequests.current += 1
      activeRequests.max = Math.max(activeRequests.max, activeRequests.current)
      await new Promise((resolve) => setTimeout(resolve, 10))
      activeRequests.current -= 1
      return createResponse([{ time: 100, value: '1.05' }])
    }) as typeof fetch

    await fetchMultipleVaultsPPS(
      [
        { chainId: 1, vaultAddress: '0x1' },
        { chainId: 1, vaultAddress: '0x2' },
        { chainId: 1, vaultAddress: '0x3' },
        { chainId: 1, vaultAddress: '0x4' },
        { chainId: 1, vaultAddress: '0x5' }
      ],
      {
        fetchFn,
        concurrency: 2,
        maxRetries: 0
      }
    )

    expect(activeRequests.max).toBe(2)
  })

  it('starts at most 12 concurrent Kong requests by default', async () => {
    const responses = Array.from({ length: 13 }, createDeferredResponse)
    const fetchFn = vi.fn(
      (_url: string | URL | Request) => responses[fetchFn.mock.calls.length - 1]!.promise
    ) as unknown as typeof fetch
    const request = fetchMultipleVaultsPPS(
      Array.from({ length: 13 }, (_value, index) => ({
        chainId: 1,
        vaultAddress: `0x${index + 1}`
      })),
      { fetchFn, maxRetries: 0 }
    )

    expect(fetchFn).toHaveBeenCalledTimes(12)
    responses[0]!.resolve(createResponse([{ time: 100, value: '1.1' }]))
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(13))
    responses.slice(1).forEach(({ resolve }, index) => {
      resolve(createResponse([{ time: 100, value: `${index + 2}` }]))
    })

    await request
  })

  it('starts the next queued request as soon as any worker becomes free', async () => {
    const responses = Array.from({ length: 4 }, createDeferredResponse)
    const fetchFn = vi.fn(
      (_url: string | URL | Request) => responses[fetchFn.mock.calls.length - 1]!.promise
    ) as unknown as typeof fetch
    const request = fetchMultipleVaultsPPS(
      [
        { chainId: 1, vaultAddress: '0x1' },
        { chainId: 1, vaultAddress: '0x2' },
        { chainId: 1, vaultAddress: '0x3' },
        { chainId: 1, vaultAddress: '0x4' }
      ],
      { fetchFn, concurrency: 2, maxRetries: 0 }
    )

    expect(fetchFn).toHaveBeenCalledTimes(2)
    responses[1]!.resolve(createResponse([{ time: 100, value: '1.2' }]))
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(3))

    responses[0]!.resolve(createResponse([{ time: 100, value: '1.1' }]))
    responses[2]!.resolve(createResponse([{ time: 100, value: '1.3' }]))
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(4))
    responses[3]!.resolve(createResponse([{ time: 100, value: '1.4' }]))

    const timelines = await request
    expect(Array.from(timelines.keys())).toEqual(['1:0x1', '1:0x2', '1:0x3', '1:0x4'])
  })

  it('reuses in-flight vault PPS fetches across concurrent callers', async () => {
    const fetchFn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return createResponse([{ time: 100, value: '1.2' }])
    }) as typeof fetch

    const [first, second] = await Promise.all([
      fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress: '0xABC' }], {
        fetchFn,
        concurrency: 1,
        maxRetries: 0
      }),
      fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress: '0xabc' }], {
        fetchFn,
        concurrency: 1,
        maxRetries: 0
      })
    ])

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(first.get('1:0xabc')?.get(100)).toBe(1.2)
    expect(second.get('1:0xabc')?.get(100)).toBe(1.2)
  })

  it('reports PPS requests that still fail after retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchFn = vi.fn().mockRejectedValue(new Error('permanent failure')) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress: '0xABC' }], {
      fetchFn,
      maxRetries: 0
    })

    expect(timelines.get('1:0xabc')).toEqual(new Map())
    expect(getPpsFetchFailedVaults(timelines)).toBe(1)
  })
})
