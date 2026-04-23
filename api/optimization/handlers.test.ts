import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  MockRedisAuthenticationError,
  MockRedisConnectivityError,
  fetchArchiveAllocationHistoryMock,
  fetchAlignedEventsMock,
  fetchVaultOnChainStateMock,
  findVaultOptimizationMock,
  getVaultDecimalsMock,
  parseExplainMetadataMock,
  readLocalArchiveAllocationHistoryArtifactMock,
  readLocalSankeyMockupPanelsMock,
  readOptimizationsMock
} = vi.hoisted(() => {
  class MockRedisAuthenticationError extends Error {}
  class MockRedisConnectivityError extends Error {}

  return {
    MockRedisAuthenticationError,
    MockRedisConnectivityError,
    fetchArchiveAllocationHistoryMock: vi.fn(),
    fetchAlignedEventsMock: vi.fn(),
    fetchVaultOnChainStateMock: vi.fn(),
    findVaultOptimizationMock: vi.fn(),
    getVaultDecimalsMock: vi.fn(),
    parseExplainMetadataMock: vi.fn(),
    readLocalArchiveAllocationHistoryArtifactMock: vi.fn().mockResolvedValue(null),
    readLocalSankeyMockupPanelsMock: vi.fn().mockResolvedValue(null),
    readOptimizationsMock: vi.fn()
  }
})

vi.mock('./_lib/assetLogos', () => ({
  getVaultDecimals: getVaultDecimalsMock
}))

vi.mock('./_lib/envio', () => ({
  fetchAlignedEvents: fetchAlignedEventsMock
}))

vi.mock('./_lib/archiveHistory', () => ({
  fetchArchiveAllocationHistory: fetchArchiveAllocationHistoryMock
}))

vi.mock('./_lib/localArchiveHistory', () => ({
  readLocalArchiveAllocationHistoryArtifact: readLocalArchiveAllocationHistoryArtifactMock
}))

vi.mock('./_lib/localSankeyMockup', () => ({
  readLocalSankeyMockupPanels: readLocalSankeyMockupPanelsMock
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
import archiveHistoryHandler from './archive-history'
import changeHandler from './change'
import sankeyFeedHandler from './sankey-feed'
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
    readLocalArchiveAllocationHistoryArtifactMock.mockResolvedValue(null)
    readLocalSankeyMockupPanelsMock.mockResolvedValue(null)
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

  it('validates archive-history requests', async () => {
    const res = createMockResponse()

    await archiveHistoryHandler({ method: 'GET', query: {} } as VercelRequest, res)

    expect(res.statusCode).toBe(400)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.body).toEqual({ error: 'Invalid vault address' })
  })

  it('returns local sankey feed panels when available', async () => {
    readLocalSankeyMockupPanelsMock.mockResolvedValue([
      {
        id: 'historical:one->two',
        beforeState: {
          id: 'one',
          timestampUtc: '2026-04-18T00:00:00.000Z',
          origin: 'archive',
          strategies: []
        },
        afterState: {
          id: 'two',
          timestampUtc: '2026-04-18T01:00:00.000Z',
          origin: 'archive',
          strategies: []
        },
        beforeTimestampUtc: '2026-04-18T00:00:00.000Z',
        afterTimestampUtc: '2026-04-18T01:00:00.000Z',
        annotation: 'Selector 0x6a761202',
        annotationTone: 'selector',
        reallocationType: 'manual',
        inputSelector: '0x6a761202',
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        createdBy: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        kind: 'historical'
      }
    ])
    const res = createMockResponse()

    await sankeyFeedHandler(
      {
        method: 'GET',
        query: {
          chainId: '1',
          vault: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'
        }
      } as VercelRequest,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.body).toEqual([
      expect.objectContaining({
        annotation: 'Selector 0x6a761202',
        annotationTone: 'selector',
        reallocationType: 'manual'
      })
    ])
  })

  it('returns archive-backed history for supported vaults', async () => {
    fetchArchiveAllocationHistoryMock.mockResolvedValue([
      {
        id: 'archive:1',
        timestampUtc: '2026-04-21T12:00:00.000Z',
        blockNumber: 123,
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        inputSelector: '0x6a761202',
        strategies: [
          {
            strategyAddress: '0x2222222222222222222222222222222222222222',
            allocationPct: 55
          }
        ]
      }
    ])
    const res = createMockResponse()

    await archiveHistoryHandler(
      {
        method: 'GET',
        query: {
          chainId: '1',
          fromTimestamp: '2026-04-18 23:19:40 UTC',
          strategies: '0x2222222222222222222222222222222222222222',
          vault: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'
        }
      } as VercelRequest,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.body).toEqual([
      {
        id: 'archive:1',
        timestampUtc: '2026-04-21T12:00:00.000Z',
        blockNumber: 123,
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        inputSelector: '0x6a761202',
        strategies: [
          {
            strategyAddress: '0x2222222222222222222222222222222222222222',
            allocationPct: 55
          }
        ]
      }
    ])
    expect(fetchArchiveAllocationHistoryMock).toHaveBeenCalledWith({
      chainId: 1,
      vaultAddress: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
      strategyAddresses: ['0x2222222222222222222222222222222222222222'],
      fromTimestampUtc: '2026-04-18 23:19:40 UTC'
    })
  })

  it('prefers a saved local archive artifact when present', async () => {
    readLocalArchiveAllocationHistoryArtifactMock.mockResolvedValue({
      chainId: 1,
      vaultAddress: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204',
      generatedAt: '2026-04-23T17:00:00.000Z',
      fromTimestampUtc: '2026-04-18 23:19:40 UTC',
      strategyAddresses: ['0x2222222222222222222222222222222222222222'],
      records: [
        {
          id: 'archive:local-1',
          timestampUtc: '2026-04-21T12:00:00.000Z',
          blockNumber: 123,
          txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          inputSelector: '0x6a761202',
          strategies: [
            {
              strategyAddress: '0x2222222222222222222222222222222222222222',
              allocationPct: 55
            }
          ]
        }
      ]
    })
    const res = createMockResponse()

    await archiveHistoryHandler(
      {
        method: 'GET',
        query: {
          chainId: '1',
          fromTimestamp: '2026-04-18 23:19:40 UTC',
          strategies: '0x2222222222222222222222222222222222222222',
          vault: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'
        }
      } as VercelRequest,
      res
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([
      {
        id: 'archive:local-1',
        timestampUtc: '2026-04-21T12:00:00.000Z',
        blockNumber: 123,
        txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        inputSelector: '0x6a761202',
        strategies: [
          {
            strategyAddress: '0x2222222222222222222222222222222222222222',
            allocationPct: 55
          }
        ]
      }
    ])
    expect(fetchArchiveAllocationHistoryMock).not.toHaveBeenCalled()
  })
})
