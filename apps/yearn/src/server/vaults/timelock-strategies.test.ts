import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchPendingTimelockStrategiesMock = vi.fn()

vi.mock('../lib/timelockStrategies/rpc', () => ({
  fetchPendingTimelockStrategies: fetchPendingTimelockStrategiesMock
}))

function createRequest(search: string): Request {
  return new Request(`https://yearn.fi/api/vaults/timelock-strategies${search}`)
}

describe('vault timelock strategies route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPendingTimelockStrategiesMock.mockResolvedValue([])
  })

  it('validates chainId', async () => {
    const { GET } = await import('./timelock-strategies')
    const response = await GET(createRequest('?vault=0x696d02Db93291651ED510704c9b286841d506987'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'chainId parameter required' })
  })

  it('validates vault address', async () => {
    const { GET } = await import('./timelock-strategies')
    const response = await GET(createRequest('?chainId=1&vault=nope'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'valid vault parameter required' })
  })

  it('returns CORS headers for OPTIONS requests', async () => {
    const { OPTIONS } = await import('./timelock-strategies')
    const response = OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
  })

  it('returns empty items for unsupported chains', async () => {
    const { GET } = await import('./timelock-strategies')
    const response = await GET(createRequest('?chainId=250&vault=0x696d02Db93291651ED510704c9b286841d506987'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      chainId: 250,
      vaultAddress: '0x696d02Db93291651ED510704c9b286841d506987',
      items: []
    })
  })

  it('sets short cache headers on success', async () => {
    const { GET } = await import('./timelock-strategies')
    const response = await GET(createRequest('?chainId=1&vault=0x696d02Db93291651ED510704c9b286841d506987'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=30')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
  })
})
