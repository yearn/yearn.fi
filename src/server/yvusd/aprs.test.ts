import { afterEach, describe, expect, it, vi } from 'vitest'

import handler from './aprs'

describe('yvUSD APR route', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps split CDN and browser cache headers on successful responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apr: 0.042 }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await handler(new Request('https://yearn.fi/api/yvusd/aprs?vault=0x1234'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toBe('public, s-maxage=30, stale-while-revalidate=120')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
    expect(fetchMock).toHaveBeenCalledWith('https://yearn-yvusd-apr-service.vercel.app/api/aprs?vault=0x1234', {
      headers: {
        Accept: 'application/json'
      }
    })
    await expect(response.json()).resolves.toEqual({ apr: 0.042 })
  })
})
