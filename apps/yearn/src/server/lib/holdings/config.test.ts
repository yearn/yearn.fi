import { afterEach, describe, expect, it } from 'vitest'
import { holdingsConfig } from '@/server/lib/holdings/config'

const REDIS_ENV_NAMES = [
  'UPSTASH_REDIS_REST_URL_PORTFOLIO_DEV',
  'UPSTASH_REDIS_REST_TOKEN_PORTFOLIO_DEV',
  'UPSTASH_REDIS_REST_URL_PORTFOLIO',
  'UPSTASH_REDIS_REST_TOKEN_PORTFOLIO'
] as const
const KONG_ENV_NAMES = ['KONG_REST_URL', 'NEXT_PUBLIC_KONG_REST_URL'] as const

const originalRedisEnv = Object.fromEntries(REDIS_ENV_NAMES.map((name) => [name, process.env[name]]))
const originalKongEnv = Object.fromEntries(KONG_ENV_NAMES.map((name) => [name, process.env[name]]))

afterEach(() => {
  REDIS_ENV_NAMES.forEach((name) => {
    const value = originalRedisEnv[name]
    if (value === undefined) {
      delete process.env[name]
      return
    }

    process.env[name] = value
  })
  KONG_ENV_NAMES.forEach((name) => {
    const value = originalKongEnv[name]
    if (value === undefined) {
      delete process.env[name]
      return
    }

    process.env[name] = value
  })
})

describe('holdings Kong configuration', () => {
  it('uses the server override and normalizes its REST suffix', () => {
    process.env.KONG_REST_URL = 'https://kong-preview.example/api/rest/'

    expect(holdingsConfig.kongBaseUrl).toBe('https://kong-preview.example')
  })
})

describe('holdings Redis configuration', () => {
  it('prefers the complete development credential pair', () => {
    process.env.UPSTASH_REDIS_REST_URL_PORTFOLIO_DEV = 'https://development.example'
    process.env.UPSTASH_REDIS_REST_TOKEN_PORTFOLIO_DEV = 'development-token'
    process.env.UPSTASH_REDIS_REST_URL_PORTFOLIO = 'https://production.example'
    process.env.UPSTASH_REDIS_REST_TOKEN_PORTFOLIO = 'production-token'

    expect(holdingsConfig.redisUrl).toBe('https://development.example')
    expect(holdingsConfig.redisToken).toBe('development-token')
  })

  it('falls back to the standard pair when development credentials are incomplete', () => {
    process.env.UPSTASH_REDIS_REST_URL_PORTFOLIO_DEV = 'https://development.example'
    delete process.env.UPSTASH_REDIS_REST_TOKEN_PORTFOLIO_DEV
    process.env.UPSTASH_REDIS_REST_URL_PORTFOLIO = 'https://production.example'
    process.env.UPSTASH_REDIS_REST_TOKEN_PORTFOLIO = 'production-token'

    expect(holdingsConfig.redisUrl).toBe('https://production.example')
    expect(holdingsConfig.redisToken).toBe('production-token')
  })
})
