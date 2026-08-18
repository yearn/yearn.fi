import { afterEach, describe, expect, it, vi } from 'vitest'

const redisConfigs: Array<{ url: string | undefined; token: string | undefined }> = []

vi.mock('@upstash/redis', () => {
  class Redis {
    constructor(config: { url: string | undefined; token: string | undefined }) {
      redisConfigs.push(config)
    }

    async scan() {
      return ['0', []] as const
    }

    async get() {
      return null
    }
  }

  return { Redis }
})

describe('readOptimizations', () => {
  afterEach(() => {
    redisConfigs.length = 0
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('accepts the standard Upstash URL and token credentials without a username', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')

    const { readOptimizations } = await import('./redis')

    await expect(readOptimizations()).resolves.toBeNull()
    expect(redisConfigs).toEqual([{ url: 'https://example.upstash.io', token: 'test-token' }])
  })

  it('rejects requests when the URL or token is missing', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')

    const { REDIS_MISSING_CONFIGURATION_MESSAGE, readOptimizations } = await import('./redis')

    await expect(readOptimizations()).rejects.toThrow(REDIS_MISSING_CONFIGURATION_MESSAGE)
  })

  it('attaches individual coverage and freshness metadata to history records', async () => {
    const { attachOptimizationMetadata } = await import('./redis')
    const vault = '0x1111111111111111111111111111111111111111'
    const strategy = '0x2222222222222222222222222222222222222222'
    const records = attachOptimizationMetadata([
      {
        vault,
        strategyDebtRatios: [{ strategy, currentRatio: 4157, targetRatio: 4157 }],
        currentApr: 250,
        proposedApr: 275,
        explain: 'latest explain',
        source: {
          key: 'doa:optimizations:1:latest',
          chainId: 1,
          revision: 'latest',
          isLatestAlias: true,
          timestampUtc: null,
          latestMatchedTimestampUtc: '2026-07-25 00:15:29 UTC'
        }
      },
      {
        vault,
        strategyDebtRatios: [{ strategy, currentRatio: 10000, targetRatio: 10000 }],
        currentApr: 200,
        proposedApr: 240,
        explain: 'older explain',
        source: {
          key: 'doa:optimizations:1:1753315200',
          chainId: 1,
          revision: '1753315200',
          isLatestAlias: false,
          timestampUtc: '2025-07-24 00:00:00 UTC',
          latestMatchedTimestampUtc: null
        }
      }
    ])

    expect(records[0]).toMatchObject({
      currentApr: 250,
      proposedApr: 275,
      explain: 'latest explain',
      allocationCoverage: {
        currentIncludedBps: 4157,
        targetIncludedBps: 4157,
        currentResidualBps: 5843,
        targetResidualBps: 5843,
        classification: 'partial-optimizer-scope',
        unallocatedBps: null
      },
      freshness: {
        optimizationTimestampUtc: '2026-07-25 00:15:29 UTC',
        latestAvailableTimestampUtc: '2026-07-25 00:15:29 UTC'
      }
    })
    expect(records[1]).toMatchObject({
      currentApr: 200,
      proposedApr: 240,
      explain: 'older explain',
      allocationCoverage: {
        currentIncludedBps: 10000,
        targetIncludedBps: 10000,
        classification: 'complete'
      },
      freshness: {
        optimizationTimestampUtc: '2025-07-24 00:00:00 UTC',
        latestAvailableTimestampUtc: '2026-07-25 00:15:29 UTC'
      }
    })
    expect(records[0].strategyDebtRatios).toEqual([{ strategy, currentRatio: 4157, targetRatio: 4157 }])
    expect(records[0].source.key).toBe('doa:optimizations:1:latest')
  })
})
