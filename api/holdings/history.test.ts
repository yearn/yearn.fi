import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureSchemaInitializedMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getHistoricalHoldingsChartMock = vi.fn()
const TEST_WALLET_ADDRESS = process.env.HOLDINGS_TEST_WALLET_ADDRESS ?? '0x1111111111111111111111111111111111111111'

vi.mock('../lib/holdings', () => ({
  ensureSchemaInitialized: ensureSchemaInitializedMock,
  checkRateLimit: checkRateLimitMock,
  getHistoricalHoldingsChart: getHistoricalHoldingsChartMock
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

describe('holdings history route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureSchemaInitializedMock.mockResolvedValue(undefined)
    checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 })
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('returns zero-filled settled history for wallets that only have same-day activity', async () => {
    getHistoricalHoldingsChartMock.mockResolvedValue({
      address: 'TEST_WALLET_ADDRESS',
      periodDays: 365,
      timeframe: '1y',
      denomination: 'usd',
      hasActivity: true,
      dataPoints: [
        { date: '2026-04-20', timestamp: 1776729599, value: 0 },
        { date: '2026-04-21', timestamp: 1776815999, value: 0 }
      ]
    })

    const { default: handler } = await import('./history')
    const req = {
      method: 'GET',
      query: {
        address: 'TEST_WALLET_ADDRESS'
      },
      headers: {}
    } as any
    const res = createMockResponse()

    await handler(req, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      address: 'TEST_WALLET_ADDRESS',
      version: 'all',
      denomination: 'usd',
      timeframe: '1y',
      dataPoints: [
        { date: '2026-04-20', value: 0 },
        { date: '2026-04-21', value: 0 }
      ]
    })
  })
})
