import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './spot'

function createSpotRequest(coins: string[]): Request {
  return new Request(`https://yearn.fi/api/prices/spot?coins=${encodeURIComponent(JSON.stringify(coins))}`)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('prices spot route', () => {
  it('proxies spot requests to yearn-prices with server-side auth', async () => {
    vi.stubEnv('YEARN_PRICES_BASE_URL', 'https://prices.example')
    vi.stubEnv('YEARN_PRICES_API_KEY', 'test-yearn-prices-key')

    const body = {
      coins: {
        'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          prices: [{ timestamp: 1719878399, price: 1.01, confidence: 0.99 }]
        }
      }
    }
    const fetchStub = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'cache-control': 'public, max-age=120' }
      })
    )

    vi.stubGlobal('fetch', fetchStub)

    const response = await GET(createSpotRequest(['ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(body)
    expect(fetchStub).toHaveBeenCalledTimes(1)

    const [url, init] = fetchStub.mock.calls[0]
    expect(new URL(String(url)).origin).toBe('https://prices.example')
    expect(new URL(String(url)).pathname).toBe('/api/prices/spot')
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-yearn-prices-key',
      Accept: 'application/json'
    })
  })

  it('requires a server-side yearn-prices key', async () => {
    vi.stubEnv('YEARN_PRICES_API_KEY', '')
    vi.stubEnv('API_KEY_PORTFOLIO', '')

    const response = await GET(createSpotRequest(['ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'YEARN_PRICES_API_KEY or API_KEY_PORTFOLIO is not configured'
    })
  })
})
