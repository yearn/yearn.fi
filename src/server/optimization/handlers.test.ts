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
import vaultStateHandler, { OPTIONS as vaultStateOptions } from './vault-state'

function createGetRequest(path: string, query: Record<string, string> = {}): Request {
  return new Request(`https://yearn.fi${path}?${new URLSearchParams(query)}`)
}

function createPostRequest(path: string, body: unknown): Request {
  return new Request(`https://yearn.fi${path}`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

function expectPublicCdnCacheHeaders(response: Response, cdnCacheControl: string): void {
  expect(response.headers.get('Vercel-CDN-Cache-Control')).toBe(cdnCacheControl)
  expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
}

describe('optimization handlers', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns POST preflight headers for vault-state', async () => {
    const response = vaultStateOptions()

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
  })

  it('keeps CORS headers on vault-state POST responses', async () => {
    fetchVaultOnChainStateMock.mockResolvedValue({
      totalAssets: 1000n,
      strategyDebts: new Map([['0x2222222222222222222222222222222222222222', 400n]]),
      unallocatedBps: 6000
    })
    const response = await vaultStateHandler(
      createPostRequest('/api/optimization/vault-state', {
        chainId: 1,
        strategies: ['0x2222222222222222222222222222222222222222'],
        vault: '0x1111111111111111111111111111111111111111'
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expectPublicCdnCacheHeaders(response, 'public, s-maxage=60, stale-while-revalidate=30')
    await expect(response.json()).resolves.toEqual({
      totalAssets: '1000',
      strategyDebts: {
        '0x2222222222222222222222222222222222222222': '400'
      },
      unallocatedBps: 6000
    })
  })

  it('keeps CORS headers on change Redis authentication failures', async () => {
    readOptimizationsMock.mockRejectedValue(new MockRedisAuthenticationError('invalid token'))
    const response = await changeHandler(createGetRequest('/api/optimization/change'))

    expect(response.status).toBe(500)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    await expect(response.json()).resolves.toEqual({
      error:
        'Backend Redis authentication failed. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN credentials.'
    })
  })

  it('keeps CORS headers on alignment validation responses', async () => {
    const response = await alignmentHandler(createGetRequest('/api/optimization/alignment'))

    expect(response.status).toBe(400)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    await expect(response.json()).resolves.toEqual({ error: 'vault parameter required' })
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
    const response = await changeHandler(
      createGetRequest('/api/optimization/change', {
        vault: targetVault,
        history: '1'
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expectPublicCdnCacheHeaders(response, 'public, s-maxage=600, stale-while-revalidate=60')
    await expect(response.json()).resolves.toEqual(targetHistory)
    expect(findVaultOptimizationMock).not.toHaveBeenCalled()
  })

  it('keeps split CDN and browser cache headers on alignment responses', async () => {
    const targetVault = '0x1111111111111111111111111111111111111111'
    const optimization = {
      vault: targetVault,
      strategyDebtRatios: [{ strategy: '0x2222222222222222222222222222222222222222', targetDebtRatio: 5000 }],
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
    }
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.example/graphql')
    readOptimizationsMock.mockResolvedValue([optimization])
    findVaultOptimizationMock.mockReturnValue(optimization)
    getVaultDecimalsMock.mockReturnValue(18)
    fetchAlignedEventsMock.mockResolvedValue([{ blockNumber: 123 }])

    const response = await alignmentHandler(createGetRequest('/api/optimization/alignment', { vault: targetVault }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expectPublicCdnCacheHeaders(response, 'public, s-maxage=60, stale-while-revalidate=30')
    await expect(response.json()).resolves.toEqual([{ blockNumber: 123 }])
  })
})
