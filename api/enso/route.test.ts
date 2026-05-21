import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './route'

const ORIGINAL_ENSO_API_KEY = process.env.ENSO_API_KEY

const validRoutePayload = {
  tx: {
    to: '0x0000000000000000000000000000000000000001',
    data: '0x1234',
    value: '0',
    from: '0x0000000000000000000000000000000000000002',
    chainId: 1
  },
  amountOut: '100',
  minAmountOut: '95',
  gas: '123456',
  route: []
}

type MockResponse = {
  body?: unknown
  json: (body: unknown) => MockResponse
  status: (statusCode: number) => MockResponse
  statusCode?: number
}

function createMockRequest(): VercelRequest {
  return {
    method: 'GET',
    query: {
      fromAddress: '0x0000000000000000000000000000000000000002',
      chainId: '1',
      tokenIn: '0x0000000000000000000000000000000000000003',
      tokenOut: '0x0000000000000000000000000000000000000004',
      amountIn: '100'
    }
  } as unknown as VercelRequest
}

function createMockResponse(): MockResponse {
  const response: MockResponse = {
    body: undefined,
    json: vi.fn((body: unknown): MockResponse => {
      response.body = body
      return response
    }),
    status: vi.fn((statusCode: number): MockResponse => {
      response.statusCode = statusCode
      return response
    }),
    statusCode: undefined
  }

  return response
}

describe('/api/enso/route', () => {
  beforeEach(() => {
    process.env.ENSO_API_KEY = 'test-key'
  })

  afterEach(() => {
    if (ORIGINAL_ENSO_API_KEY === undefined) {
      delete process.env.ENSO_API_KEY
    } else {
      process.env.ENSO_API_KEY = ORIGINAL_ENSO_API_KEY
    }

    vi.restoreAllMocks()
  })

  it('returns a non-2xx error instead of a route body for malformed successful quote fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ...validRoutePayload, amountOut: '1e3' }),
      ok: true,
      status: 200
    } as Response)

    const response = createMockResponse()

    await handler(createMockRequest(), response as unknown as VercelResponse)

    expect(response.statusCode).toBe(502)
    expect(response.body).toMatchObject({
      error: 'EnsoRouteError',
      message: 'Unable to find route',
      statusCode: 502
    })
    expect((response.body as { amountOut?: unknown }).amountOut).toBeUndefined()
  })
})
