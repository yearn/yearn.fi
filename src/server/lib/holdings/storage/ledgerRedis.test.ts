import { afterEach, describe, expect, it, vi } from 'vitest'

const redisConfigs: Array<Record<string, unknown>> = []

vi.mock('@upstash/redis', () => {
  class Redis {
    constructor(config: Record<string, unknown>) {
      redisConfigs.push(config)
    }
  }

  return { Redis }
})

describe('holdings ledger Redis adapter', () => {
  afterEach(() => {
    redisConfigs.length = 0
    vi.resetModules()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('keeps the isolated ledger client disabled when rollout mode is off', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'off')
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', 'test-token')

    const { getHoldingsLedgerRedisClient, isHoldingsLedgerStorageEnabled } = await import(
      '@/server/lib/holdings/storage/ledgerRedis'
    )

    expect(isHoldingsLedgerStorageEnabled()).toBe(false)
    expect(getHoldingsLedgerRedisClient()).toBeNull()
    expect(redisConfigs).toEqual([])
  })

  it('returns null without complete portfolio Redis credentials', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'shadow')
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', '')

    const { getHoldingsLedgerRedisClient, isHoldingsLedgerStorageEnabled } = await import(
      '@/server/lib/holdings/storage/ledgerRedis'
    )

    expect(isHoldingsLedgerStorageEnabled()).toBe(false)
    expect(getHoldingsLedgerRedisClient()).toBeNull()
    expect(redisConfigs).toEqual([])
  })

  it('creates an isolated raw-value client from the portfolio Redis credentials', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'shadow')
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', 'test-token')

    const { getHoldingsLedgerRedisClient, isHoldingsLedgerStorageEnabled } = await import(
      '@/server/lib/holdings/storage/ledgerRedis'
    )

    expect(isHoldingsLedgerStorageEnabled()).toBe(true)
    expect(getHoldingsLedgerRedisClient()).not.toBeNull()
    expect(redisConfigs).toEqual([
      {
        url: 'https://redis.example',
        token: 'test-token',
        automaticDeserialization: false,
        readYourWrites: true,
        retry: false
      }
    ])
  })

  it('fingerprints the non-secret ledger runtime scope', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'shadow')
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', 'token-one')
    vi.stubEnv('HOLDINGS_LEDGER_KEY_NAMESPACE', 'benchmark_one')
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1,10')

    const { getHoldingsLedgerRuntimeFingerprint } = await import('@/server/lib/holdings/storage/ledgerRedis')
    const first = getHoldingsLedgerRuntimeFingerprint()

    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', 'token-two')
    expect(getHoldingsLedgerRuntimeFingerprint()).not.toBe(first)

    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', 'token-one')
    vi.stubEnv('HOLDINGS_LEDGER_KEY_NAMESPACE', 'benchmark_two')
    expect(getHoldingsLedgerRuntimeFingerprint()).not.toBe(first)
  })

  it('redacts payload-bearing errors and keeps auth disablement isolated', async () => {
    const redisUrl = 'https://secret-redis.example'
    const redisToken = 'secret-token'
    const rawPayload = '{"wallet":"0x0000000000000000000000000000000000000001"}'
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'shadow')
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', redisUrl)
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', redisToken)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const ledgerRedis = await import('@/server/lib/holdings/storage/ledgerRedis')
    const legacyRedis = await import('@/server/lib/holdings/storage/redis')
    expect(ledgerRedis.getHoldingsLedgerRedisClient()).not.toBeNull()

    const payloadBearingError = Object.assign(
      new Error(`Unauthorized, command was: ["set","ledger-key",${rawPayload},"${redisUrl}","${redisToken}"]`),
      {
        name: 'UpstashError',
        status: 401,
        body: rawPayload,
        request: { url: redisUrl, token: redisToken }
      }
    )
    await expect(
      ledgerRedis.executeHoldingsLedgerRedisOperation('write', () => Promise.reject(payloadBearingError))
    ).rejects.toMatchObject({
      name: 'HoldingsLedgerRedisOperationError',
      message: 'Holdings ledger Redis write failed',
      operation: 'write'
    })

    expect(errorSpy).toHaveBeenCalledWith('[Holdings Ledger Redis] write failed', {
      errorClass: 'UpstashError',
      status: 401
    })
    const loggedOutput = errorSpy.mock.calls
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ')
    expect(loggedOutput).not.toContain(rawPayload)
    expect(loggedOutput).not.toContain(redisUrl)
    expect(loggedOutput).not.toContain(redisToken)
    expect(ledgerRedis.isHoldingsLedgerStorageEnabled()).toBe(false)
    expect(ledgerRedis.getHoldingsLedgerRedisClient()).toBeNull()
    expect(legacyRedis.isHoldingsStorageEnabled()).toBe(true)
  })
})
