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
  MAX_VAULT_STATE_STRATEGIES: 32,
  fetchVaultOnChainState: fetchVaultOnChainStateMock,
  getRpcConfig: (chainId: number) => (chainId === 1 ? { primary: 'https://rpc.example', fallbacks: [] } : undefined)
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
    expect(fetchVaultOnChainStateMock).toHaveBeenCalledWith(1, '0x1111111111111111111111111111111111111111', [
      '0x2222222222222222222222222222222222222222'
    ])
  })

  it('rejects invalid vault-state requests before RPC execution', async () => {
    const cases: Array<{ body: Record<string, unknown>; error: string }> = [
      {
        body: {
          chainId: 1,
          strategies: ['0x2222222222222222222222222222222222222222'],
          vault: 'not-an-address'
        },
        error: 'Invalid vault address'
      },
      {
        body: {
          chainId: 999999,
          strategies: ['0x2222222222222222222222222222222222222222'],
          vault: '0x1111111111111111111111111111111111111111'
        },
        error: 'Unsupported chainId'
      },
      {
        body: {
          chainId: 1,
          strategies: ['not-an-address'],
          vault: '0x1111111111111111111111111111111111111111'
        },
        error: 'Invalid strategy address'
      },
      {
        body: {
          chainId: 1,
          strategies: [123],
          vault: '0x1111111111111111111111111111111111111111'
        },
        error: 'Invalid strategy address'
      },
      {
        body: {
          chainId: 1,
          strategies: Array.from({ length: 33 }, () => '0x2222222222222222222222222222222222222222'),
          vault: '0x1111111111111111111111111111111111111111'
        },
        error: 'Too many strategy addresses: maximum 32'
      },
      {
        body: {
          chainId: 1,
          note: 'x'.repeat(10 * 1024),
          strategies: ['0x2222222222222222222222222222222222222222'],
          vault: '0x1111111111111111111111111111111111111111'
        },
        error: 'Request body too large'
      }
    ]

    await Promise.all(
      cases.map(async (testCase) => {
        const res = createMockResponse()

        await vaultStateHandler({ body: testCase.body, method: 'POST' } as VercelRequest, res)

        expect(res.statusCode).toBe(400)
        expect(res.body).toEqual({ error: testCase.error })
        expect(fetchVaultOnChainStateMock).not.toHaveBeenCalled()
      })
    )
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

  it('returns vault history when change history query is enabled', async () => {
    const targetVault = '0x1111111111111111111111111111111111111111'
    const targetHistory = [
      {
        vault: targetVault,
        strategyDebtRatios: [],
        currentApr: 250,
        proposedApr: 275,
        explain: 'latest explain',
        source: {
          key: 'doa:optimizations:1:latest',
          chainId: 1,
          revision: 'latest',
          isLatestAlias: true,
          timestampUtc: null,
          latestMatchedTimestampUtc: '2026-04-22 10:00:00 UTC'
        }
      },
      {
        vault: targetVault,
        strategyDebtRatios: [],
        currentApr: 200,
        proposedApr: 240,
        explain: 'older explain',
        source: {
          key: 'doa:optimizations:1:1713776400',
          chainId: 1,
          revision: '1713776400',
          isLatestAlias: false,
          timestampUtc: '2024-04-22 09:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }
    ]

    readOptimizationsMock.mockResolvedValue([
      ...targetHistory,
      {
        vault: '0x2222222222222222222222222222222222222222',
        strategyDebtRatios: [],
        currentApr: 100,
        proposedApr: 110,
        explain: 'other vault',
        source: {
          key: 'doa:optimizations:1:latest',
          chainId: 1,
          revision: 'latest',
          isLatestAlias: true,
          timestampUtc: null,
          latestMatchedTimestampUtc: '2026-04-22 10:00:00 UTC'
        }
      }
    ])
    const res = createMockResponse()

    await changeHandler(
      {
        method: 'GET',
        query: {
          vault: targetVault,
          history: '1'
        }
      } as VercelRequest,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.body).toEqual(targetHistory)
    expect(findVaultOptimizationMock).not.toHaveBeenCalled()
  })
})
