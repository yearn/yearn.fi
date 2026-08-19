import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

function createSpotRequest(rawCoins: string): Request {
  return new Request(`https://ybold.example/api/prices/spot?coins=${encodeURIComponent(rawCoins)}`)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('yBOLD spot price proxy', () => {
  it('rejects invalid coins without calling Yearn', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(createSpotRequest('{"not":"an array"}'))

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ error: 'Coins payload must be an array' })
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('normalizes valid coins and caches successful responses', async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(createSpotRequest(JSON.stringify(['optimism:2', 'ethereum:1', 'ethereum:1'])))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=120, stale-while-revalidate=600')
    const [url] = fetchStub.mock.calls[0]
    expect(new URL(String(url)).searchParams.get('coins')).toBe('["ethereum:1","optimism:2"]')
  })

  it('does not cache upstream errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'temporary failure' }, { status: 503 })))

    const response = await GET(createSpotRequest(JSON.stringify(['ethereum:1'])))

    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
