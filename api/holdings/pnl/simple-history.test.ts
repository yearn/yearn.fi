import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureSchemaInitializedMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getHoldingsProtocolReturnHistoryMock = vi.fn()

vi.mock('../../lib/holdings', () => ({
  ensureSchemaInitialized: ensureSchemaInitializedMock,
  checkRateLimit: checkRateLimitMock,
  getHoldingsProtocolReturnHistory: getHoldingsProtocolReturnHistoryMock
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

describe('holdings simple pnl history route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureSchemaInitializedMock.mockResolvedValue(undefined)
    checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 })
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('passes multi-vault filters through the simple history alias', async () => {
    getHoldingsProtocolReturnHistoryMock.mockResolvedValue({
      address: '0xa7b6f3d18db39f65c8056d0892af76c07d15fc5a',
      version: 'all',
      timeframe: '1y',
      generatedAt: '2026-04-28T00:00:00.000Z',
      summary: {
        totalVaults: 2,
        completeVaults: 2,
        partialVaults: 0,
        recommendedGrowthDisplay: 'index',
        recommendedGrowthDisplayReason: 'mixed',
        openBaselineCompositionUsd: {
          stable: 0,
          ethFamily: 0,
          other: 0
        },
        isComplete: true
      },
      dataPoints: [],
      familySeries: []
    })

    const { default: handler } = await import('./simple-history')
    const req = {
      method: 'GET',
      query: {
        address: '0xA7b6f3d18db39F65C8056d0892Af76c07d15Fc5a',
        vaults: '1:0x696d02Db93291651ED510704c9b286841d506987,1:0xAaaFEa48472f77563961Cdb53291DEDfB46F9040'
      },
      headers: {}
    } as any
    const res = createMockResponse()

    await handler(req, res as any)

    expect(res.statusCode).toBe(200)
    expect(getHoldingsProtocolReturnHistoryMock).toHaveBeenCalledWith(
      '0xA7b6f3d18db39F65C8056d0892Af76c07d15Fc5a',
      'all',
      'seq',
      'paged',
      '1y',
      [
        { chainId: 1, vaultAddress: '0x696d02Db93291651ED510704c9b286841d506987' },
        { chainId: 1, vaultAddress: '0xAaaFEa48472f77563961Cdb53291DEDfB46F9040' }
      ]
    )
  })
})
