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
})
