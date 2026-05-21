import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleClustersName } from './clusters'

describe('handleClustersName', () => {
  const originalEnv = process.env
  const originalFetch = globalThis.fetch

  afterEach(() => {
    process.env = originalEnv
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('forwards valid address lookups with the server-only API key', async () => {
    process.env = { ...originalEnv, CLUSTERS_API_KEY: 'server-secret', CLUSTERS_API_URL: 'https://clusters.test/v1' }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clusterName: 'yearn' })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const response = await handleClustersName(
      new Request('http://localhost/api/clusters/name?address=0x0000000000000000000000000000000000000001')
    )

    await expect(response.json()).resolves.toEqual({ clusterName: 'yearn' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://clusters.test/v1/names/address/0x0000000000000000000000000000000000000001',
      {
        headers: {
          Accept: 'application/json',
          'X-API-KEY': 'server-secret'
        }
      }
    )
  })

  it('rejects invalid addresses without calling upstream', async () => {
    process.env = { ...originalEnv, CLUSTERS_API_KEY: 'server-secret' }
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const response = await handleClustersName(new Request('http://localhost/api/clusters/name?address=not-an-address'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid address' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
