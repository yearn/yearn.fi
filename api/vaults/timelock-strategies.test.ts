import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchPendingTimelockStrategiesMock = vi.fn()

vi.mock('../lib/timelockStrategies/rpc', () => ({
  fetchPendingTimelockStrategies: fetchPendingTimelockStrategiesMock
}))

type TMockResponse = VercelResponse & {
  body: unknown
  headers: Record<string, string>
  statusCode: number
}

function createMockResponse(): TMockResponse {
  const response = {
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    statusCode: 200,
    json(payload: unknown) {
      response.body = payload
      return response
    },
    setHeader(name: string, value: string) {
      response.headers[name] = value
      return response
    },
    status(code: number) {
      response.statusCode = code
      return response
    }
  }

  return response as unknown as TMockResponse
}

describe('vault timelock strategies route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPendingTimelockStrategiesMock.mockResolvedValue([])
  })

  it('validates chainId', async () => {
    const { default: handler } = await import('./timelock-strategies')
    const res = createMockResponse()

    await handler(
      { method: 'GET', query: { vault: '0x696d02Db93291651ED510704c9b286841d506987' } } as unknown as VercelRequest,
      res
    )

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'chainId parameter required' })
  })

  it('validates vault address', async () => {
    const { default: handler } = await import('./timelock-strategies')
    const res = createMockResponse()

    await handler({ method: 'GET', query: { chainId: '1', vault: 'nope' } } as unknown as VercelRequest, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ error: 'valid vault parameter required' })
  })

  it('returns method not allowed for non-GET requests', async () => {
    const { default: handler } = await import('./timelock-strategies')
    const res = createMockResponse()

    await handler({ method: 'POST', query: {} } as unknown as VercelRequest, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ error: 'Method not allowed' })
  })

  it('returns empty items for unsupported chains', async () => {
    const { default: handler } = await import('./timelock-strategies')
    const res = createMockResponse()

    await handler(
      {
        method: 'GET',
        query: {
          chainId: '250',
          vault: '0x696d02Db93291651ED510704c9b286841d506987'
        }
      } as unknown as VercelRequest,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      chainId: 250,
      vaultAddress: '0x696d02Db93291651ED510704c9b286841d506987',
      items: []
    })
  })

  it('sets short cache headers on success', async () => {
    const { default: handler } = await import('./timelock-strategies')
    const res = createMockResponse()

    await handler(
      {
        method: 'GET',
        query: {
          chainId: '1',
          vault: '0x696d02Db93291651ED510704c9b286841d506987'
        }
      } as unknown as VercelRequest,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.headers['Vercel-CDN-Cache-Control']).toBe('public, s-maxage=60, stale-while-revalidate=30')
    expect(res.headers['Cache-Control']).toBe('public, max-age=0, must-revalidate')
  })
})
