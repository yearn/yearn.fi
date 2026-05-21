import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchClusterName } from './clusters'

describe('fetchClusterName', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('calls the same-origin Clusters API route without a client API key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clusterName: 'Yearn', walletName: 'Treasury' })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(fetchClusterName('0x0000000000000000000000000000000000000001')).resolves.toBe('yearn/treasury')

    expect(fetchMock).toHaveBeenCalledWith('/api/clusters/name?address=0x0000000000000000000000000000000000000001', {
      headers: { Accept: 'application/json' }
    })
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('X-API-KEY')
  })
})
