import { GET } from '@wrapped/app/api/recap/route'
import { demo } from '@wrapped/lib/demo'
import { fetchRecap } from '@wrapped/server/recap'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

describe('Wrapped transport', () => {
  it('reports an unreachable holdings backend as retryable service unavailability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const response = await GET(new Request(`http://wrapped.test/api/recap?address=${demo.address}`))
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('5')
    expect(response.headers.get('Cache-Control')).toContain('private, no-store')
    expect(await response.json()).toEqual({ error: 'Yearn history is temporarily unavailable. Please try again.' })
  })
  it('reads the existing holdings surface without caching wallet responses publicly', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(demo))
    vi.stubGlobal('fetch', fetch)
    const response = await GET(new Request(`http://wrapped.test/api/recap?address=${demo.address}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('private, no-store')
    expect(fetch.mock.calls[0]![0].pathname).toBe('/api/holdings/wrapped')
  })
  it('rejects malformed addresses and unsupported years before fetching', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await GET(new Request('http://wrapped.test/api/recap?address=bad'))).status).toBe(400)
    expect((await GET(new Request(`http://wrapped.test/api/recap?address=${demo.address}&year=2025`))).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('preserves no-history and upstream failure without falling back to sample data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))
    const empty = await GET(new Request(`http://wrapped.test/api/recap?address=${demo.address}`))
    expect(empty.status).toBe(404)
    expect(await empty.json()).not.toHaveProperty('vaults')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 502 })))
    expect((await GET(new Request(`http://wrapped.test/api/recap?address=${demo.address}`))).status).toBe(502)
  })
  it('rejects cross-wallet responses and malformed financial payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...demo, address: '0x1111111111111111111111111111111111111111' }))
    )
    await expect(fetchRecap(demo.address)).rejects.toThrow('address did not match')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...demo, return: { ...demo.return, pct: 'made up' } }))
    )
    await expect(fetchRecap(demo.address)).rejects.toThrow()
  })
  it('does not accept a numeric headline when coverage is incomplete', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...demo, return: { ...demo.return, isComplete: false } }))
    )
    await expect(fetchRecap(demo.address)).rejects.toThrow()
  })
})
