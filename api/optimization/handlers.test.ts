import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  MockRedisAuthenticationError,
  MockRedisConnectivityError,
  fetchAlignedEventsMock,
  fetchVaultOnChainStateMock,
  findVaultOptimizationMock,
  getVaultDecimalsMock,
  parseExplainMetadataMock,
  readOptimizationsMock
} = vi.hoisted(() => {
  class MockRedisAuthenticationError extends Error {}
  class MockRedisConnectivityError extends Error {}

  return {
    MockRedisAuthenticationError,
    MockRedisConnectivityError,
    fetchAlignedEventsMock: vi.fn(),
    fetchVaultOnChainStateMock: vi.fn(),
    findVaultOptimizationMock: vi.fn(),
    getVaultDecimalsMock: vi.fn(),
    parseExplainMetadataMock: vi.fn(),
    readOptimizationsMock: vi.fn()
  }
})

vi.mock('./_lib/assetLogos', () => ({
  getVaultDecimals: getVaultDecimalsMock
}))

vi.mock('./_lib/envio', () => ({
  fetchAlignedEvents: fetchAlignedEventsMock
}))

vi.mock('./_lib/explain-parse', () => ({
  parseExplainMetadata: parseExplainMetadataMock
}))

vi.mock('./_lib/redis', () => ({
  REDIS_AUTHENTICATION_ERROR_MESSAGE:
    'Backend Redis authentication failed. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN credentials.',
  REDIS_CONNECTIVITY_ERROR_MESSAGE: 'Backend connectivity unavailable. Unable to access Redis.',
  findVaultOptimization: findVaultOptimizationMock,
  isRedisAuthenticationError: (error: unknown) => error instanceof MockRedisAuthenticationError,
  isRedisConnectivityError: (error: unknown) => error instanceof MockRedisConnectivityError,
  readOptimizations: readOptimizationsMock
}))

vi.mock('./_lib/rpc', () => ({
  fetchVaultOnChainState: fetchVaultOnChainStateMock
}))

import alignmentHandler from './alignment'
import changeHandler from './change'
import vaultStateHandler from './vault-state'

type TMockVercelResponse = VercelResponse & {
  body: unknown
  headers: Record<string, string>
  statusCode: number
}

function createMockResponse(): TMockVercelResponse {
  const response: {
    body: unknown
    headers: Record<string, string>
    json: (payload: unknown) => unknown
    send: (payload: unknown) => unknown
    setHeader: (name: string, value: string) => unknown
    status: (code: number) => unknown
    statusCode: number
  } = {
    body: undefined,
    headers: {},
    statusCode: 200,
    json(payload: unknown) {
      response.body = payload
      return response
    },
    send(payload: unknown) {
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

  return response as unknown as TMockVercelResponse
}

describe('optimization handlers', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns POST preflight headers for vault-state', async () => {
    const res = createMockResponse()

    await vaultStateHandler({ method: 'OPTIONS' } as VercelRequest, res)

    expect(res.statusCode).toBe(204)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS')
    expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type')
  })

  it('keeps CORS headers on vault-state POST responses', async () => {
    fetchVaultOnChainStateMock.mockResolvedValue({
      totalAssets: 1000n,
      strategyDebts: new Map([['0x2222222222222222222222222222222222222222', 400n]]),
      unallocatedBps: 6000
    })
    const res = createMockResponse()

    await vaultStateHandler(
      {
        body: {
          chainId: 1,
          strategies: ['0x2222222222222222222222222222222222222222'],
          vault: '0x1111111111111111111111111111111111111111'
        },
        method: 'POST'
      } as VercelRequest,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.body).toEqual({
      totalAssets: '1000',
      strategyDebts: {
        '0x2222222222222222222222222222222222222222': '400'
      },
      unallocatedBps: 6000
    })
  })

  it('keeps CORS headers on change Redis authentication failures', async () => {
    readOptimizationsMock.mockRejectedValue(new MockRedisAuthenticationError('invalid token'))
    const res = createMockResponse()

    await changeHandler({ method: 'GET', query: {} } as VercelRequest, res)

    expect(res.statusCode).toBe(500)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.body).toEqual({
      error:
        'Backend Redis authentication failed. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN credentials.'
    })
  })

  it('keeps CORS headers on alignment validation responses', async () => {
    const res = createMockResponse()

    await alignmentHandler({ method: 'GET', query: {} } as VercelRequest, res)

    expect(res.statusCode).toBe(400)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.body).toEqual({ error: 'vault parameter required' })
  })
})
