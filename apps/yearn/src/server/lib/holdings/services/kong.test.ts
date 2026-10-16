import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMultipleVaultsPPS, getPPS, getPpsFetchFailedVaults } from '@/server/lib/holdings/services/kong'

function createPpsResponse(value = '1.25'): Response {
  return new Response(JSON.stringify([{ time: 86_400, component: 'humanized', value }]), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getPPS', () => {
  it('returns null for an empty timeline', () => {
    expect(getPPS(new Map(), 123)).toBeNull()
  })

  it('uses floor semantics and refreshes its timestamp index when the timeline changes', () => {
    const timeline = new Map([
      [300, 1.3],
      [100, 1.1]
    ])
    const keysSpy = vi.spyOn(timeline, 'keys')

    expect(getPPS(timeline, 50)).toBe(1.1)
    expect(getPPS(timeline, 250)).toBe(1.1)
    expect(getPPS(timeline, 350)).toBe(1.3)
    expect(keysSpy).toHaveBeenCalledTimes(1)
    timeline.set(200, 1.2)
    expect(getPPS(timeline, 250)).toBe(1.2)
    expect(keysSpy).toHaveBeenCalledTimes(2)
  })
})

describe('fetchMultipleVaultsPPS', () => {
  it('uses only the deployed public Kong PPS route', async () => {
    const firstAddress = '0x0000000000000000000000000000000000000001'
    const secondAddress = '0x0000000000000000000000000000000000000002'
    const fetchFn = vi.fn(async () => createPpsResponse()) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS(
      [
        { chainId: 1, vaultAddress: firstAddress },
        { chainId: 10, vaultAddress: secondAddress }
      ],
      { fetchFn, maxRetries: 0 }
    )

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
      `https://kong.yearn.fi/api/rest/timeseries/pps/1/${firstAddress}`,
      `https://kong.yearn.fi/api/rest/timeseries/pps/10/${secondAddress}`
    ])
    expect(fetchFn.mock.calls[0]?.[1]).not.toHaveProperty('headers')
    expect(timelines.get(`1:${firstAddress}`)?.get(86_400)).toBe(1.25)
    expect(timelines.get(`10:${secondAddress}`)?.get(86_400)).toBe(1.25)
    expect(getPpsFetchFailedVaults(timelines)).toBe(0)
  })

  it('deduplicates vaults within and across concurrent callers', async () => {
    const vaultAddress = '0x0000000000000000000000000000000000000001'
    const fetchFn = vi.fn(async () => createPpsResponse()) as typeof fetch
    const vaults = [
      { chainId: 1, vaultAddress: vaultAddress.toUpperCase() },
      { chainId: 1, vaultAddress }
    ]

    const [first, second] = await Promise.all([
      fetchMultipleVaultsPPS(vaults, { fetchFn, maxRetries: 0 }),
      fetchMultipleVaultsPPS(vaults, { fetchFn, maxRetries: 0 })
    ])

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(first.size).toBe(1)
    expect(second.get(`1:${vaultAddress}`)?.get(86_400)).toBe(1.25)
  })

  it('retries transient failures', async () => {
    const vaultAddress = '0x0000000000000000000000000000000000000001'
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Unable to connect'), { code: 'ConnectionRefused' }))
      .mockResolvedValue(createPpsResponse()) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress }], {
      fetchFn,
      maxRetries: 1,
      retryDelayMs: 0
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(timelines.get(`1:${vaultAddress}`)?.get(86_400)).toBe(1.25)
    expect(getPpsFetchFailedVaults(timelines)).toBe(0)
  })

  it('cancels error response bodies before retrying their HTTP status', async () => {
    const vaultAddress = '0x0000000000000000000000000000000000000001'
    const cancel = vi.fn().mockRejectedValue(new Error('Stream already disconnected'))
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { status: 503 }))
      .mockResolvedValueOnce(createPpsResponse()) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress }], {
      fetchFn,
      maxRetries: 1,
      retryDelayMs: 0
    })

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(timelines.get(`1:${vaultAddress}`)?.get(86_400)).toBe(1.25)
    expect(getPpsFetchFailedVaults(timelines)).toBe(0)
  })

  it('marks failed PPS requests without returning fabricated values', async () => {
    const vaultAddress = '0x0000000000000000000000000000000000000001'
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 404 })) as typeof fetch

    const timelines = await fetchMultipleVaultsPPS([{ chainId: 1, vaultAddress }], {
      fetchFn,
      maxRetries: 0
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(timelines.get(`1:${vaultAddress}`)).toEqual(new Map())
    expect(getPpsFetchFailedVaults(timelines)).toBe(1)
  })

  it.each([0, 12])(
    'bounds body downloads across callers and releases slots after %i body failures',
    async (failures) => {
      const activity = { active: 0, peak: 0 }
      const fetchFn = vi.fn(async (input: string | URL | Request) => {
        const index = Number(new URL(String(input)).pathname.split('/').at(-1)) - 1
        activity.active += 1
        activity.peak = Math.max(activity.peak, activity.active)
        return new Response(
          new ReadableStream({
            start(controller) {
              setTimeout(() => {
                activity.active -= 1
                if (index < failures) {
                  controller.error(new Error('Response body interrupted'))
                } else {
                  controller.enqueue(new TextEncoder().encode(JSON.stringify([{ time: 86_400, value: '1.25' }])))
                  controller.close()
                }
              }, 10)
            }
          })
        )
      }) as typeof fetch
      const vaults = Array.from({ length: 26 }, (_value, index) => ({
        chainId: 1,
        vaultAddress: `0x${(index + 1).toString(16).padStart(40, '0')}`
      }))
      const results = await Promise.all([
        fetchMultipleVaultsPPS(vaults.slice(0, 13), { fetchFn, maxRetries: 0 }),
        fetchMultipleVaultsPPS(vaults.slice(13), { fetchFn, maxRetries: 0 })
      ])

      expect(fetchFn).toHaveBeenCalledTimes(26)
      expect(activity.peak).toBe(12)
      expect(activity.active).toBe(0)
      expect(results.reduce((sum, result) => sum + getPpsFetchFailedVaults(result), 0)).toBe(failures)
      expect(
        results.flatMap((result) => [...result.values()]).filter((timeline) => timeline.get(86_400) === 1.25)
      ).toHaveLength(26 - failures)
    }
  )
})
