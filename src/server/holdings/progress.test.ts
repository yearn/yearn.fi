import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsProgressMock = vi.fn()

vi.mock('../lib/holdings/services/progress', () => ({
  getHoldingsProgress: getHoldingsProgressMock
}))

type TMockResponse = {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  setHeader: (name: string, value: string) => void
  status: (code: number) => TMockResponse
  json: (payload: unknown) => TMockResponse
  end: () => TMockResponse
}

function createMockResponse(): TMockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name: string, value: string) {
      this.headers[name] = value
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
    end() {
      return this
    }
  }
}

describe('holdings progress route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns no content when a progress record is not available', async () => {
    getHoldingsProgressMock.mockResolvedValue(null)

    const { default: handler } = await import('./progress')
    const req = {
      method: 'GET',
      query: {
        id: 'portfolio-history:usd:1y:test'
      }
    } as any
    const res = createMockResponse()

    await handler(req, res as any)

    expect(res.statusCode).toBe(204)
    expect(res.body).toBeNull()
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('returns the persisted progress record', async () => {
    const progress = {
      id: 'portfolio-history:usd:1y:test',
      route: 'history',
      addressHash: 'hash',
      status: 'running',
      progress: 40,
      message: 'Fetched prices',
      detail: null,
      startedAt: 1,
      updatedAt: 2,
      logs: []
    }
    getHoldingsProgressMock.mockResolvedValue(progress)

    const { default: handler } = await import('./progress')
    const req = {
      method: 'GET',
      query: {
        id: progress.id
      }
    } as any
    const res = createMockResponse()

    await handler(req, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(progress)
    expect(res.headers['Cache-Control']).toBe('no-store')
  })
})
