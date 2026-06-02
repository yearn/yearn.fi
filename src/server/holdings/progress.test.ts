import { beforeEach, describe, expect, it, vi } from 'vitest'

const getHoldingsProgressMock = vi.fn()

vi.mock('../lib/holdings/services/progress', () => ({
  getHoldingsProgress: getHoldingsProgressMock
}))

function createRequest(id: string): Request {
  return new Request(`https://yearn.fi/api/holdings/progress?id=${encodeURIComponent(id)}`)
}

describe('holdings progress route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns no content when a progress record is not available', async () => {
    getHoldingsProgressMock.mockResolvedValue(null)

    const { default: handler } = await import('./progress')
    const response = await handler(createRequest('portfolio-history:usd:1y:test'))

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
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
    const response = await handler(createRequest(progress.id))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(progress)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
