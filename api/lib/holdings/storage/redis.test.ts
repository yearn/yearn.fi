import { afterEach, describe, expect, it, vi } from 'vitest'
import { isHoldingsStorageConfigured } from './redis'

describe('Holdings Redis storage configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is unconfigured only when both Redis settings are absent', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', '')

    expect(isHoldingsStorageConfigured()).toBe(false)
  })

  it('treats a partial Redis configuration as configured', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', 'https://example.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', '')

    expect(isHoldingsStorageConfigured()).toBe(true)

    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', 'test-token')

    expect(isHoldingsStorageConfigured()).toBe(true)
  })
})
