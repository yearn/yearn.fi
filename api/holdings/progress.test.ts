import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsProgressMock = vi.fn()

vi.mock('../lib/holdings/services/progress', () => ({
  getHoldingsProgress: getHoldingsProgressMock
}))

function createResponse() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn()
  } as unknown as VercelResponse & {
    status: ReturnType<typeof vi.fn>
    json: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
  }

  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  res.end.mockReturnValue(res)
  return res
}

describe('holdings progress route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects progress polling without id, address, and route', async () => {
    const { default: handler } = await import('./progress')
    const res = createResponse()

    await handler(
      {
        method: 'GET',
        query: { id: 'portfolio:test', address: '0x0000000000000000000000000000000000000001' }
      } as unknown as VercelRequest,
      res
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing required parameters: id, address, route' })
    expect(getHoldingsProgressMock).not.toHaveBeenCalled()
  })

  it('scopes progress polling by id, route, and address', async () => {
    getHoldingsProgressMock.mockResolvedValueOnce(null)
    const { default: handler } = await import('./progress')
    const res = createResponse()

    await handler(
      {
        method: 'GET',
        query: {
          id: 'portfolio:test',
          route: 'history',
          address: '0x0000000000000000000000000000000000000001'
        }
      } as unknown as VercelRequest,
      res
    )

    expect(getHoldingsProgressMock).toHaveBeenCalledWith({
      id: 'portfolio:test',
      route: 'history',
      address: '0x0000000000000000000000000000000000000001'
    })
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
