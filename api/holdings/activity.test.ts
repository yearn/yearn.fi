import { beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_ADDRESS = '0x2222222222222222222222222222222222222222'

const ensureSchemaInitializedMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getHoldingsActivityMock = vi.fn()

vi.mock('../lib/holdings', () => ({
  ensureSchemaInitialized: ensureSchemaInitializedMock,
  checkRateLimit: checkRateLimitMock,
  getHoldingsActivity: getHoldingsActivityMock
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

describe('holdings activity route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureSchemaInitializedMock.mockResolvedValue(undefined)
    checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 })
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('returns indexed activity entries for a wallet', async () => {
    getHoldingsActivityMock.mockResolvedValue({
      address: TEST_ADDRESS,
      version: 'all',
      limit: 10,
      offset: 0,
      pageInfo: {
        hasMore: true,
        nextOffset: 10
      },
      entries: [
        {
          chainId: 1,
          txHash: '0xabc',
          timestamp: 1776902400,
          action: 'deposit',
          vaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          familyVaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          assetSymbol: 'USDC',
          assetAmount: '1000000',
          assetAmountFormatted: 1,
          shareAmount: '1000000000000000000',
          shareAmountFormatted: 1,
          status: 'ok'
        }
      ]
    })

    const { default: handler } = await import('./activity')
    const req = {
      method: 'GET',
      query: {
        address: TEST_ADDRESS,
        limit: '10',
        offset: '0'
      },
      headers: {}
    } as any
    const res = createMockResponse()

    await handler(req, res as any)

    expect(getHoldingsActivityMock).toHaveBeenCalledWith(TEST_ADDRESS, 'all', 10, 0)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      address: TEST_ADDRESS,
      version: 'all',
      limit: 10,
      offset: 0,
      pageInfo: {
        hasMore: true,
        nextOffset: 10
      },
      entries: [
        {
          chainId: 1,
          txHash: '0xabc',
          timestamp: 1776902400,
          action: 'deposit',
          vaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          familyVaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          assetSymbol: 'USDC',
          assetAmount: '1000000',
          assetAmountFormatted: 1,
          shareAmount: '1000000000000000000',
          shareAmountFormatted: 1,
          status: 'ok'
        }
      ]
    })
  })

  it('returns an empty collection when no indexed activity exists', async () => {
    getHoldingsActivityMock.mockResolvedValue({
      address: TEST_ADDRESS,
      version: 'all',
      limit: 10,
      offset: 0,
      pageInfo: {
        hasMore: false,
        nextOffset: null
      },
      entries: []
    })

    const { default: handler } = await import('./activity')
    const req = {
      method: 'GET',
      query: {
        address: TEST_ADDRESS
      },
      headers: {}
    } as any
    const res = createMockResponse()

    await handler(req, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      address: TEST_ADDRESS,
      version: 'all',
      limit: 10,
      offset: 0,
      pageInfo: {
        hasMore: false,
        nextOffset: null
      },
      entries: []
    })
  })
})
