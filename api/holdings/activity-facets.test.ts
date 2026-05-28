import { beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_ADDRESS = '0x2222222222222222222222222222222222222222'

const ensureHoldingsStorageInitializedMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getHoldingsActivityFacetResponseMock = vi.fn()

vi.mock('../lib/holdings', () => ({
  ensureHoldingsStorageInitialized: ensureHoldingsStorageInitializedMock,
  checkRateLimit: checkRateLimitMock,
  getHoldingsActivityFacetResponse: getHoldingsActivityFacetResponseMock
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

describe('holdings activity facets route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureHoldingsStorageInitializedMock.mockResolvedValue(undefined)
    checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 })
    getHoldingsActivityFacetResponseMock.mockResolvedValue({
      address: TEST_ADDRESS,
      version: 'all',
      facets: { chainIds: [1, 8453] }
    })
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('returns chain facets from cheap chain existence checks', async () => {
    const { default: handler } = await import('./activity-facets')
    const req = {
      method: 'GET',
      query: {
        address: TEST_ADDRESS,
        version: 'all'
      },
      headers: {}
    } as any
    const res = createMockResponse()

    await handler(req, res as any)

    expect(getHoldingsActivityFacetResponseMock).toHaveBeenCalledWith(TEST_ADDRESS, 'all')
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      address: TEST_ADDRESS,
      version: 'all',
      facets: { chainIds: [1, 8453] }
    })
  })
})
