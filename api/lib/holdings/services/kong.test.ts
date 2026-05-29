import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMultipleVaultsPPS, getPPS } from './kong'

function createResponse(points: Array<{ time: number; value: string }>): Response {
  return new Response(JSON.stringify(points.map((point) => ({ ...point, component: 'pps' }))), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

describe('getPPS', () => {
  it('returns null for an empty timeline instead of defaulting to 1', () => {
    expect(getPPS(new Map(), 123)).toBeNull()
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
})
