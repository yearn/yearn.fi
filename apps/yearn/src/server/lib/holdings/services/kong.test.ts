import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMultipleVaultsPPS, getPPS, getPpsBatchFallbackVaults, getPpsFetchFailedVaults } from './kong'

function createResponse(points: Array<{ time: number; value: string }>): Response {
  return new Response(JSON.stringify(points.map((point) => ({ ...point, component: 'pps' }))), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

function createBatchResponse(addresses: string[]): Response {
  return new Response(
    JSON.stringify(Object.fromEntries(addresses.map((address) => [address, [{ time: 86_400, value: '1.25' }]]))),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
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
    delete process.env.KONG_PPS_REST_URL
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  })

  it('always uses public Kong PPS routes without a Vercel bypass secret', async () => {
    process.env.KONG_PPS_REST_URL = 'https://protected-preview.example.com/api/rest'
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 'deployment-secret'
    const vaultAddress = '0x0000000000000000000000000000000000000001'
    const address = `1:${vaultAddress}`
    const fetchFn = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('/v2') ? createBatchResponse([address]) : createResponse([{ time: 100, value: '1.25' }])
    ) as typeof fetch

    await fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress }], { fetchFn, maxRetries: 0 })
    await fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress }], {
      fetchFn,
      batch: true,
      range: { start: 0, finish: 86_400 },
      maxRetries: 0
    })

    expect(fetchFn.mock.calls[0]?.[0]).toBe(`https://kong.yearn.fi/api/rest/timeseries/pps/1/${vaultAddress}`)
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toBeUndefined()
    expect(fetchFn.mock.calls[1]?.[0]).toBe('https://kong.yearn.fi/api/rest/timeseries/pps/v2')
    expect(fetchFn.mock.calls[1]?.[1]?.headers).toEqual({ 'content-type': 'application/json' })
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

  it('fetches bounded PPS timelines in one batch request', async () => {
    const firstAddress = '0x0000000000000000000000000000000000000001'
    const secondAddress = '0x0000000000000000000000000000000000000002'
    const addresses = [`1:${firstAddress}`, `10:${secondAddress}`]
    const fetchFn = vi.fn(async () => createBatchResponse(addresses)) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS(
      [
        { chainId: 1, vaultAddress: firstAddress },
        { chainId: 10, vaultAddress: secondAddress }
      ],
      {
        fetchFn,
        batch: true,
        range: { start: 0, finish: 86_400 },
        maxRetries: 0
      }
    )

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://kong.yearn.fi/api/rest/timeseries/pps/v2')
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ start: 0, finish: 86_400, addresses })
    })
    expect(timelines.get(addresses[0])?.get(86_400)).toBe(1.25)
    expect(timelines.get(addresses[1])?.get(86_400)).toBe(1.25)
    expect(getPpsBatchFallbackVaults(timelines)).toBe(0)
    expect(getPpsFetchFailedVaults(timelines)).toBe(0)
  })

  it('splits a batch after a 413 response without falling back to legacy requests', async () => {
    const vaults = [1, 2].map((suffix) => ({
      chainId: 1,
      vaultAddress: `0x${String(suffix).padStart(40, '0')}`
    }))
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (fetchFn.mock.calls.length === 1) {
        return new Response(JSON.stringify({ error: 'too large' }), { status: 413 })
      }

      const body = JSON.parse(String(init?.body)) as { addresses: string[] }
      return createBatchResponse(body.addresses)
    }) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS(vaults, {
      fetchFn,
      batch: true,
      range: { start: 0, finish: 86_400 },
      maxRetries: 0
    })

    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(timelines.size).toBe(2)
    expect(getPpsBatchFallbackVaults(timelines)).toBe(0)
  })

  it('chunks more than 50 vaults across bounded batch requests', async () => {
    const vaults = Array.from({ length: 51 }, (_value, index) => ({
      chainId: 1,
      vaultAddress: `0x${String(index + 1).padStart(40, '0')}`
    }))
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { addresses: string[] }
      return createBatchResponse(body.addresses)
    }) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS(vaults, {
      fetchFn,
      batch: true,
      range: { start: 0, finish: 86_400 },
      maxRetries: 0
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(timelines.size).toBe(51)
  })

  it('falls back to legacy per-vault PPS after a batch failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const vaultAddress = '0x0000000000000000000000000000000000000001'
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'failed' }), { status: 500 }))
      .mockResolvedValueOnce(createResponse([{ time: 86_400, value: '1.5' }])) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress }], {
      fetchFn,
      batch: true,
      range: { start: 0, finish: 86_400 },
      maxRetries: 0
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(timelines.get(`1:${vaultAddress}`)?.get(86_400)).toBe(1.5)
    expect(getPpsBatchFallbackVaults(timelines)).toBe(1)
    expect(getPpsFetchFailedVaults(timelines)).toBe(0)
  })
})
