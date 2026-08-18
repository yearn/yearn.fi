import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoldingsDebugContext, withHoldingsDebugContext } from '@/server/lib/holdings/services/debug'
import type { THoldingsCachedTotal } from '@/server/lib/holdings/services/eventSource'
import { encodeWalletLedgerPayload } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  commitStoredWalletLedger,
  getWalletLedgerKey,
  getWalletLedgerLockKey
} from '@/server/lib/holdings/services/ledger/walletStore'
import {
  createWalletLedgerDailyUsdCacheCommitTransitions,
  createWalletLedgerDailyUsdTotalsCache,
  getWalletLedgerDailyUsdCacheIdentity,
  getWalletLedgerDailyUsdDateRange,
  getWalletLedgerDailyUsdTotalsKey,
  resetWalletLedgerDailyUsdTotalsCacheForTests,
  type TWalletLedgerDailyUsdCacheIdentity,
  transitionWalletLedgerDailyUsdTotalsCache
} from '@/server/lib/holdings/services/ledger/walletTotalsCache'
import {
  type TWalletLedgerPayloadV3,
  WALLET_LEDGER_CODEC,
  WALLET_LEDGER_SCHEMA_VERSION
} from '@/server/lib/holdings/services/ledger/walletTypes'
import { createDeferred } from '@/server/lib/holdings/test-utils/deferred'

const WALLET_HASH = 'a'.repeat(64)
const PREVIOUS_LEDGER_REVISION = 'b'.repeat(64)
const CURRENT_LEDGER_REVISION = 'c'.repeat(64)
const PREVIOUS_EVENT_REVISION = 'd'.repeat(64)
const CURRENT_EVENT_REVISION = 'e'.repeat(64)

const mocks = vi.hoisted(() => ({
  adoptSyncToken: vi.fn(),
  getTimedRedis: vi.fn(),
  redis: null as FakeDailyUsdRedis | null
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  adoptHoldingsLedgerRedisReadYourWritesSyncToken: mocks.adoptSyncToken,
  executeHoldingsLedgerRedisOperation: async (_operation: string, action: () => Promise<unknown>) => action(),
  getHoldingsLedgerRedisClient: () => mocks.redis,
  getHoldingsLedgerRedisClientWithTimeout: mocks.getTimedRedis
}))

class FakeDailyUsdRedis {
  readonly readYourWritesSyncToken = 'daily-usd-sync-token'
  readonly values = new Map<string, string>()
  readonly hashes = new Map<string, Map<string, string>>()
  readonly ttlSeconds = new Map<string, number>()
  readonly hmgetCalls: { readonly key: string; readonly fields: readonly string[] }[] = []
  dailyUsdWriteCalls = 0
  hmgetError: Error | null = null
  dailyUsdWriteGate: Promise<void> | null = null
  onDailyUsdWriteStarted: (() => void) | null = null

  hmget(key: string, ...fields: string[]): Promise<unknown> {
    this.hmgetCalls.push({ key, fields })
    if (this.hmgetError) {
      return Promise.reject(this.hmgetError)
    }
    const hash = this.hashes.get(key)
    return Promise.resolve(fields.map((field) => hash?.get(field) ?? null))
  }

  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData> {
    if (script.includes('holdings-wallet-ledger-daily-usd-write-v2') && this.dailyUsdWriteGate) {
      const gate = this.dailyUsdWriteGate
      this.dailyUsdWriteGate = null
      this.onDailyUsdWriteStarted?.()
      return gate.then(() => this.eval<TArgs, TData>(script, keys, args))
    }
    const walletKey = keys[0] ?? ''
    const totalsKey = keys[1] ?? ''
    const values = args.map(String)
    const matchesLedger = this.values.get(walletKey)?.startsWith(values[0] ?? '') ?? false
    const result = (() => {
      if (!matchesLedger) {
        return 0
      }
      if (script.includes('holdings-wallet-ledger-commit-v5')) {
        const cacheKeys = keys.slice(2, -1)
        cacheKeys.forEach((cacheKey) => {
          this.values.delete(cacheKey)
        })
        this.values.set(keys[1] ?? '', values[1] ?? '')
        this.values.set(keys.at(-1) ?? '', values.at(-1) ?? '')
        cacheKeys.forEach((cacheKey, index) => {
          const argumentIndex = 3 + index * 5
          const previousMeta = values[argumentIndex] ?? ''
          const currentMeta = values[argumentIndex + 1] ?? ''
          const dirtyFromDate = values[argumentIndex + 2] ?? ''
          const reset = values[argumentIndex + 3] === '1'
          const existing = this.hashes.get(cacheKey)
          if (!existing) {
            return
          }
          if (existing.get('__meta') === currentMeta) {
            return
          }
          const hash = reset || existing.get('__meta') !== previousMeta ? new Map<string, string>() : existing
          if (hash === existing && dirtyFromDate !== '') {
            Array.from(hash.keys())
              .filter((field) => /^\d{4}-\d{2}-\d{2}$/.test(field) && field >= dirtyFromDate)
              .forEach((field) => {
                hash.delete(field)
              })
          }
          hash.set('__meta', currentMeta)
          this.hashes.set(cacheKey, hash)
        })
        return 1
      }
      if (script.includes('holdings-wallet-ledger-daily-usd-write-v2')) {
        this.dailyUsdWriteCalls += 1
        this.values.delete(totalsKey)
        const expectedMeta = values[1] ?? ''
        const existing = this.hashes.get(totalsKey)
        const hash = existing?.get('__meta') === expectedMeta ? existing : new Map([['__meta', expectedMeta]])
        values.slice(3).reduce<string | null>((pendingField, value) => {
          if (pendingField === null) {
            return value
          }
          const existingValue = hash.get(pendingField)
          const existingComplete = existingValue?.includes('"isComplete":true') === true
          const incomingComplete = value.includes('"isComplete":true')
          if (!existingComplete || incomingComplete) {
            hash.set(pendingField, value)
          }
          return null
        }, null)
        this.hashes.set(totalsKey, hash)
        this.ttlSeconds.set(totalsKey, Number(values[2]))
        return 1
      }
      if (script.includes('holdings-wallet-ledger-daily-usd-transition-v2')) {
        this.values.delete(totalsKey)
        const previousMeta = values[1] ?? ''
        const currentMeta = values[2] ?? ''
        const dirtyFromDate = values[3] ?? ''
        const reset = values[4] === '1'
        const existing = this.hashes.get(totalsKey)
        if (!existing) {
          return 1
        }
        if (reset) {
          this.hashes.set(totalsKey, new Map([['__meta', currentMeta]]))
          this.ttlSeconds.set(totalsKey, Number(values[5]))
          return 1
        }
        if (existing?.get('__meta') === currentMeta) {
          this.ttlSeconds.set(totalsKey, Number(values[5]))
          return 1
        }
        const hash = previousMeta === '' || existing?.get('__meta') !== previousMeta ? new Map() : existing
        if (hash === existing && dirtyFromDate !== '') {
          Array.from(hash.keys())
            .filter((field) => /^\d{4}-\d{2}-\d{2}$/.test(field) && field >= dirtyFromDate)
            .forEach((field) => {
              hash.delete(field)
            })
        }
        hash.set('__meta', currentMeta)
        this.hashes.set(totalsKey, hash)
        this.ttlSeconds.set(totalsKey, Number(values[5]))
        return 1
      }
      return -1
    })()
    return Promise.resolve(result as TData)
  }
}

function identity(overrides: Partial<TWalletLedgerDailyUsdCacheIdentity> = {}): TWalletLedgerDailyUsdCacheIdentity {
  return {
    walletHash: WALLET_HASH,
    version: 'all',
    ledgerRevision: PREVIOUS_LEDGER_REVISION,
    ledgerCalculationVersion: 'calculation-v1',
    sourceGeneration: 1,
    eventRevision: PREVIOUS_EVENT_REVISION,
    appliedInvalidationSequence: 4,
    ...overrides
  }
}

function storeWalletRevision(redis: FakeDailyUsdRedis, ledgerRevision: string): void {
  redis.values.set(
    getWalletLedgerKey(WALLET_HASH),
    `holdings-wallet-ledger:opaque:v${WALLET_LEDGER_SCHEMA_VERSION}:${WALLET_LEDGER_CODEC}:${ledgerRevision}:payload`
  )
}

function walletPayload(args: {
  readonly updatedAtMs: number
  readonly appliedInvalidationSequence: number
  readonly withDeposit: boolean
}): TWalletLedgerPayloadV3 {
  return {
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: 'calculation-v1',
    walletHash: WALLET_HASH,
    sourceFingerprint: 'f'.repeat(64),
    sourceGeneration: 1,
    appliedInvalidationSequence: args.appliedInvalidationSequence,
    coverage: [{ chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 100 }],
    streams: {
      v3Deposits: args.withDeposit
        ? [
            {
              id: 'deposit-1',
              vaultAddress: '0x1111111111111111111111111111111111111111',
              chainId: 1,
              blockNumber: 50,
              blockTimestamp: Date.parse('2026-08-02T12:00:00.000Z') / 1000,
              logIndex: 1,
              transactionHash: `0x${'2'.repeat(64)}`,
              transactionFrom: '0x3333333333333333333333333333333333333333',
              owner: '0x3333333333333333333333333333333333333333',
              sender: '0x3333333333333333333333333333333333333333',
              assets: '100',
              shares: '90'
            }
          ]
        : [],
      v3Withdrawals: [],
      v2Deposits: [],
      v2Withdrawals: [],
      transfersIn: [],
      transfersOut: []
    },
    createdAtMs: 1,
    updatedAtMs: args.updatedAtMs,
    reconciledAtMs: 1
  }
}

describe('wallet ledger daily USD totals cache', () => {
  beforeEach(() => {
    resetWalletLedgerDailyUsdTotalsCacheForTests()
    vi.clearAllMocks()
    mocks.redis = new FakeDailyUsdRedis()
    mocks.getTimedRedis.mockReturnValue(mocks.redis)
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.HOLDINGS_LEDGER_KEY_NAMESPACE
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('derives the exact one-year and all-history cache ranges used by holdings charts', () => {
    const latestSettledDayTimestamp = Date.parse('2026-08-07T00:00:00.000Z') / 1000

    const oneYear = getWalletLedgerDailyUsdDateRange({ latestSettledDayTimestamp, timeframe: '1y' })
    const all = getWalletLedgerDailyUsdDateRange({ latestSettledDayTimestamp, timeframe: 'all' })

    expect(oneYear).toMatchObject({ startDate: '2025-08-08', endDate: '2026-08-07' })
    expect(oneYear.dates).toHaveLength(365)
    expect(all).toMatchObject({ startDate: '2024-01-01', endDate: '2026-08-07' })
    expect(all.dates.at(0)).toBe('2024-01-01')
    expect(all.dates.at(-1)).toBe('2026-08-07')
  })

  it('keeps vault versions separate in the wallet hash slot and honors the ledger namespace', () => {
    expect(getWalletLedgerDailyUsdTotalsKey(WALLET_HASH, 'all')).toBe(
      `holdings:wallet-ledger:v${WALLET_LEDGER_SCHEMA_VERSION}:{${WALLET_HASH}}:daily-usd:v1:all`
    )
    expect(getWalletLedgerDailyUsdTotalsKey(WALLET_HASH, 'v2')).toContain(`{${WALLET_HASH}}`)
    process.env.HOLDINGS_LEDGER_KEY_NAMESPACE = 'test_1'
    expect(getWalletLedgerDailyUsdTotalsKey(WALLET_HASH, 'v3')).toBe(
      `holdings:wallet-ledger:v${WALLET_LEDGER_SCHEMA_VERSION}:{${WALLET_HASH}}:namespace:test_1:daily-usd:v1:v3`
    )
  })

  it('stores USD date fields once and reads only the requested range when metadata matches', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    vi.spyOn(Date, 'now').mockReturnValue(1_234)
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    await expect(
      cache.write([
        { date: '2026-08-01', usdValue: 10 },
        { date: '2026-08-02', usdValue: 20 },
        { date: '2026-08-03', usdValue: 30 }
      ])
    ).resolves.toBe(true)
    await expect(cache.read('2026-08-02', '2026-08-03')).resolves.toEqual({
      totals: [
        { date: '2026-08-02', usdValue: 20 },
        { date: '2026-08-03', usdValue: 30 }
      ],
      oldestUpdatedAt: new Date(1_234)
    })
    const key = getWalletLedgerDailyUsdTotalsKey(WALLET_HASH, 'all')
    expect(redis.hashes.get(key)?.has('__meta')).toBe(true)
    expect(redis.hashes.get(key)?.size).toBe(4)
    expect(redis.ttlSeconds.get(key)).toBe(30 * 24 * 60 * 60)
    expect(redis.hmgetCalls).toEqual([
      {
        key,
        fields: ['__meta', '2026-08-02', '2026-08-03']
      }
    ])
    expect(mocks.getTimedRedis).toHaveBeenCalledWith(3_000)
    expect(mocks.adoptSyncToken).toHaveBeenCalledWith(redis)
  })

  it('waits for the same in-flight write before reading an immediate hot request', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const writeGate = createDeferred<void>()
    const writeStarted = createDeferred<void>()
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    redis.dailyUsdWriteGate = writeGate.promise
    redis.onDailyUsdWriteStarted = writeStarted.resolve
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    const write = cache.write([{ date: '2026-08-01', usdValue: 10 }])
    await writeStarted.promise
    const read = cache.read('2026-08-01', '2026-08-01')
    await Promise.resolve()

    expect(redis.hmgetCalls).toEqual([])
    writeGate.resolve()
    await expect(write).resolves.toBe(true)
    await expect(read).resolves.toMatchObject({
      totals: [{ date: '2026-08-01', usdValue: 10 }]
    })
    expect(redis.hmgetCalls).toHaveLength(1)
  })

  it('bypasses a stalled in-process write after a bounded wait', async () => {
    vi.useFakeTimers()
    const redis = mocks.redis as FakeDailyUsdRedis
    const writeGate = createDeferred<void>()
    const writeStarted = createDeferred<void>()
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    redis.dailyUsdWriteGate = writeGate.promise
    redis.onDailyUsdWriteStarted = writeStarted.resolve
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    const write = cache.write([{ date: '2026-08-01', usdValue: 10 }])
    await writeStarted.promise
    const read = cache.read('2026-08-01', '2026-08-01')
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(read).resolves.toEqual({ totals: [], oldestUpdatedAt: null })
    expect(redis.hmgetCalls).toHaveLength(1)

    writeGate.resolve()
    await expect(write).resolves.toBe(true)
  })

  it('coalesces a burst behind one write and keeps the complete candidate for each date', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const writeGate = createDeferred<void>()
    const writeStarted = createDeferred<void>()
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    redis.dailyUsdWriteGate = writeGate.promise
    redis.onDailyUsdWriteStarted = writeStarted.resolve
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    const first = cache.write([{ date: '2026-08-01', usdValue: 1, isComplete: false }])
    await writeStarted.promise
    const burst = Array.from({ length: 50 }, (_, index) =>
      cache.write([
        {
          date: '2026-08-01',
          usdValue: index === 25 ? 999 : index + 2,
          isComplete: index === 25
        }
      ])
    )

    writeGate.resolve()
    await expect(Promise.all([first, ...burst])).resolves.toEqual(Array.from({ length: 51 }, () => true))
    expect(redis.dailyUsdWriteCalls).toBe(2)
    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toMatchObject({
      totals: [{ date: '2026-08-01', usdValue: 999 }]
    })
  })

  it('never downgrades a complete Redis date to a provisional result', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    await expect(cache.write([{ date: '2026-08-01', usdValue: 10 }])).resolves.toBe(true)
    await expect(cache.write([{ date: '2026-08-01', usdValue: 20, isComplete: false }])).resolves.toBe(true)

    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toMatchObject({
      totals: [{ date: '2026-08-01', usdValue: 10 }]
    })
  })

  it('enumerates only inclusive UTC dates across month boundaries', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())
    await cache.write([
      { date: '2026-07-31', usdValue: 10 },
      { date: '2026-08-01', usdValue: 20 },
      { date: '2026-08-02', usdValue: 30 }
    ])

    await expect(cache.read('2026-07-31', '2026-08-02')).resolves.toMatchObject({
      totals: [
        { date: '2026-07-31', usdValue: 10 },
        { date: '2026-08-01', usdValue: 20 },
        { date: '2026-08-02', usdValue: 30 }
      ]
    })
    expect(redis.hmgetCalls.at(-1)?.fields).toEqual(['__meta', '2026-07-31', '2026-08-01', '2026-08-02'])
  })

  it('serves fresh provisional totals alongside complete rows', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    await cache.write([
      { date: '2026-08-01', usdValue: 10, isComplete: true },
      { date: '2026-08-02', usdValue: 20, isComplete: false }
    ])
    await expect(cache.read('2026-08-01', '2026-08-02')).resolves.toEqual({
      totals: [
        { date: '2026-08-01', usdValue: 10 },
        { date: '2026-08-02', usdValue: 20, isComplete: false }
      ],
      oldestUpdatedAt: new Date(1_000)
    })
  })

  it('omits provisional totals after their one-hour retry interval', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())
    await cache.write([{ date: '2026-08-01', usdValue: 10, isComplete: false }])

    now.mockReturnValue(1_000 + 60 * 60 * 1000 - 1)
    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [{ date: '2026-08-01', usdValue: 10, isComplete: false }],
      oldestUpdatedAt: new Date(1_000)
    })

    now.mockReturnValue(1_000 + 60 * 60 * 1000)
    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
  })

  it('upgrades an expired provisional total to a durable complete row', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())
    await cache.write([{ date: '2026-08-01', usdValue: 10, isComplete: false }])

    now.mockReturnValue(1_000 + 60 * 60 * 1000)
    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
    await expect(cache.write([{ date: '2026-08-01', usdValue: 12, isComplete: true }])).resolves.toBe(true)

    now.mockReturnValue(1_000 + 3 * 60 * 60 * 1000)
    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [{ date: '2026-08-01', usdValue: 12 }],
      oldestUpdatedAt: new Date(1_000 + 60 * 60 * 1000)
    })
  })

  it('fails open as a cache miss when the range lookup fails', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    redis.hmgetError = new Error('Redis unavailable')
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    await expect(cache.read('2026-08-01', '2026-08-02')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
    expect(redis.hmgetCalls.at(-1)?.fields).toEqual(['__meta', '2026-08-01', '2026-08-02'])
  })

  it('ignores malformed, negative, and future-dated cached totals', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const nowMs = 1_000_000
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    vi.spyOn(Date, 'now').mockReturnValue(nowMs)
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())
    const dates = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']
    await cache.write(dates.map((date) => ({ date, usdValue: 10 })))

    const hash = redis.hashes.get(getWalletLedgerDailyUsdTotalsKey(WALLET_HASH, 'all'))
    hash?.set(dates[0], JSON.stringify({ usdValue: null, updatedAtMs: nowMs, isComplete: true }))
    hash?.set(dates[1], JSON.stringify({ usdValue: -1, updatedAtMs: nowMs, isComplete: true }))
    hash?.set(dates[2], JSON.stringify({ usdValue: 10, updatedAtMs: nowMs, isComplete: 'false' }))
    hash?.set(dates[3], JSON.stringify({ usdValue: 10, updatedAtMs: nowMs + 5 * 60 * 1000 + 1, isComplete: true }))

    await expect(cache.read(dates[0], dates[3])).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
  })

  it('rejects invalid totals before writing them', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    await expect(cache.write([{ date: '2026-08-01', usdValue: -1 }])).rejects.toThrow(
      'Wallet ledger daily USD cache total must be a non-negative finite number'
    )
    await expect(
      cache.write([{ date: '2026-08-01', usdValue: 10, isComplete: 'false' } as unknown as THoldingsCachedTotal])
    ).rejects.toThrow('Wallet ledger daily USD cache completeness must be a boolean')
    expect(redis.hashes.size).toBe(0)
  })

  it('repairs a wrong-type derived cache key during an ordinary fenced write', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const key = getWalletLedgerDailyUsdTotalsKey(WALLET_HASH, 'all')
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    redis.values.set(key, 'malformed-string-cache')
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    await expect(cache.write([{ date: '2026-08-01', usdValue: 10 }])).resolves.toBe(true)
    expect(redis.values.has(key)).toBe(false)
    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toMatchObject({
      totals: [{ date: '2026-08-01', usdValue: 10 }]
    })
  })

  it('retains pre-dirty dates when ledger synchronization commits before a later balance cache read', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const previous = encodeWalletLedgerPayload(
      walletPayload({ updatedAtMs: 2, appliedInvalidationSequence: 4, withDeposit: false })
    )
    const current = encodeWalletLedgerPayload(
      walletPayload({ updatedAtMs: 3, appliedInvalidationSequence: 5, withDeposit: true })
    )
    redis.values.set(getWalletLedgerKey(WALLET_HASH), previous.value)
    const previousCache = createWalletLedgerDailyUsdTotalsCache(
      getWalletLedgerDailyUsdCacheIdentity(previous.ledger, 'all')
    )
    await previousCache.write([
      { date: '2026-08-01', usdValue: 10 },
      { date: '2026-08-02', usdValue: 20 },
      { date: '2026-08-03', usdValue: 30 }
    ])
    redis.values.set(getWalletLedgerLockKey(WALLET_HASH), 'sync-worker')

    await expect(
      commitStoredWalletLedger({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'sync-worker' },
        value: current.value,
        cacheTransitions: createWalletLedgerDailyUsdCacheCommitTransitions({
          previous: previous.ledger,
          current: current.ledger,
          dirtyFromDate: '2026-08-02',
          reset: false
        })
      })
    ).resolves.toEqual({ status: 'ok' })

    const laterBalanceCache = createWalletLedgerDailyUsdTotalsCache(
      getWalletLedgerDailyUsdCacheIdentity(current.ledger, 'all')
    )
    await expect(laterBalanceCache.read('2026-08-01', '2026-08-03')).resolves.toEqual({
      totals: [{ date: '2026-08-01', usdValue: 10 }],
      oldestUpdatedAt: expect.any(Date)
    })
  })

  it('treats a different ledger identity as a full miss', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    const previousCache = createWalletLedgerDailyUsdTotalsCache(identity())
    await previousCache.write([{ date: '2026-08-01', usdValue: 10 }])

    const changedEventCache = createWalletLedgerDailyUsdTotalsCache(identity({ eventRevision: CURRENT_EVENT_REVISION }))
    const changedSequenceCache = createWalletLedgerDailyUsdTotalsCache(identity({ appliedInvalidationSequence: 5 }))
    const changedSourceCache = createWalletLedgerDailyUsdTotalsCache(identity({ sourceGeneration: 2 }))
    const changedCalculationCache = createWalletLedgerDailyUsdTotalsCache(
      identity({ ledgerCalculationVersion: 'calculation-v2' })
    )

    await expect(changedEventCache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
    await expect(changedSequenceCache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
    await expect(changedSourceCache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
    await expect(changedCalculationCache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
  })

  it('invalidates derived totals when the valuation revision changes without replaying the ledger', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    vi.stubEnv('HOLDINGS_LEDGER_VALUATION_REVISION', 'prices-v1')
    const cache = createWalletLedgerDailyUsdTotalsCache(identity())

    await cache.write([{ date: '2026-08-01', usdValue: 10 }])
    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toMatchObject({
      totals: [{ date: '2026-08-01', usdValue: 10 }]
    })

    vi.stubEnv('HOLDINGS_LEDGER_VALUATION_REVISION', 'prices-v2')
    await expect(cache.read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
    await expect(cache.write([{ date: '2026-08-02', usdValue: 20 }])).resolves.toBe(true)
    await expect(cache.read('2026-08-01', '2026-08-02')).resolves.toMatchObject({
      totals: [{ date: '2026-08-02', usdValue: 20 }]
    })

    const meta = JSON.parse(
      redis.hashes.get(getWalletLedgerDailyUsdTotalsKey(WALLET_HASH, 'all'))?.get('__meta') ?? '{}'
    ) as Record<string, unknown>
    expect(meta.valuationRevision).toBe('prices-v2')
  })

  it('rejects a stale calculation write after the stored wallet ledger advances', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    storeWalletRevision(redis, CURRENT_LEDGER_REVISION)
    const staleCache = createWalletLedgerDailyUsdTotalsCache(identity())

    await expect(staleCache.write([{ date: '2026-08-01', usdValue: 10 }])).resolves.toBe(false)
    expect(redis.hashes.size).toBe(0)
  })

  it('replaces mismatched cache metadata only when the requested ledger is still current', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const previous = identity()
    const current = identity({
      ledgerRevision: CURRENT_LEDGER_REVISION,
      eventRevision: CURRENT_EVENT_REVISION,
      appliedInvalidationSequence: 5
    })
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    await createWalletLedgerDailyUsdTotalsCache(previous).write([{ date: '2026-08-01', usdValue: 10 }])
    storeWalletRevision(redis, CURRENT_LEDGER_REVISION)

    await expect(
      createWalletLedgerDailyUsdTotalsCache(current).write([{ date: '2026-08-02', usdValue: 20 }])
    ).resolves.toBe(true)
    await expect(createWalletLedgerDailyUsdTotalsCache(current).read('2026-08-01', '2026-08-02')).resolves.toEqual({
      totals: [{ date: '2026-08-02', usdValue: 20 }],
      oldestUpdatedAt: expect.any(Date)
    })
  })

  it('retains pre-dirty dates and removes the affected tail during a fenced transition', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const previous = identity()
    const current = identity({
      ledgerRevision: CURRENT_LEDGER_REVISION,
      eventRevision: CURRENT_EVENT_REVISION,
      appliedInvalidationSequence: 5
    })
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    await createWalletLedgerDailyUsdTotalsCache(previous).write([
      { date: '2026-08-01', usdValue: 10 },
      { date: '2026-08-02', usdValue: 20 },
      { date: '2026-08-03', usdValue: 30 }
    ])
    storeWalletRevision(redis, CURRENT_LEDGER_REVISION)

    await expect(
      transitionWalletLedgerDailyUsdTotalsCache({
        previous,
        current,
        dirtyFromDate: '2026-08-02',
        reset: false
      })
    ).resolves.toBe(true)
    await expect(createWalletLedgerDailyUsdTotalsCache(current).read('2026-08-01', '2026-08-03')).resolves.toEqual({
      totals: [{ date: '2026-08-01', usdValue: 10 }],
      oldestUpdatedAt: expect.any(Date)
    })
  })

  it('retains every date for a metadata-only transition and resets on an incompatible predecessor', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const previous = identity()
    const current = identity({
      ledgerRevision: CURRENT_LEDGER_REVISION,
      appliedInvalidationSequence: 5
    })
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    await createWalletLedgerDailyUsdTotalsCache(previous).write([{ date: '2026-08-01', usdValue: 10 }])
    storeWalletRevision(redis, CURRENT_LEDGER_REVISION)

    await transitionWalletLedgerDailyUsdTotalsCache({ previous, current, dirtyFromDate: null, reset: false })
    await expect(
      createWalletLedgerDailyUsdTotalsCache(current).read('2026-08-01', '2026-08-01')
    ).resolves.toMatchObject({
      totals: [{ date: '2026-08-01', usdValue: 10 }]
    })

    const resetCurrent = identity({
      ledgerRevision: CURRENT_LEDGER_REVISION,
      eventRevision: CURRENT_EVENT_REVISION,
      appliedInvalidationSequence: 6
    })
    await transitionWalletLedgerDailyUsdTotalsCache({
      previous: identity({ eventRevision: 'f'.repeat(64) }),
      current: resetCurrent,
      dirtyFromDate: null,
      reset: false
    })
    await expect(createWalletLedgerDailyUsdTotalsCache(resetCurrent).read('2026-08-01', '2026-08-01')).resolves.toEqual(
      {
        totals: [],
        oldestUpdatedAt: null
      }
    )
  })

  it('honors an explicit reset even when event metadata did not change', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const current = identity({ ledgerRevision: CURRENT_LEDGER_REVISION })
    storeWalletRevision(redis, CURRENT_LEDGER_REVISION)
    await createWalletLedgerDailyUsdTotalsCache(current).write([{ date: '2026-08-01', usdValue: 10 }])

    await expect(
      transitionWalletLedgerDailyUsdTotalsCache({
        previous: current,
        current,
        dirtyFromDate: null,
        reset: true
      })
    ).resolves.toBe(true)
    await expect(createWalletLedgerDailyUsdTotalsCache(current).read('2026-08-01', '2026-08-01')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
  })

  it('does not create an empty hash while transitioning an unused vault version', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const previous = identity({ version: 'v2' })
    const current = identity({
      version: 'v2',
      ledgerRevision: CURRENT_LEDGER_REVISION,
      eventRevision: CURRENT_EVENT_REVISION,
      appliedInvalidationSequence: 5
    })
    storeWalletRevision(redis, CURRENT_LEDGER_REVISION)

    await expect(
      transitionWalletLedgerDailyUsdTotalsCache({
        previous,
        current,
        dirtyFromDate: '2026-08-01',
        reset: true
      })
    ).resolves.toBe(true)
    expect(redis.hashes.has(getWalletLedgerDailyUsdTotalsKey(WALLET_HASH, 'v2'))).toBe(false)
  })

  it('does not transition or delete totals when the current ledger revision fence no longer matches', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const previous = identity()
    const current = identity({
      ledgerRevision: CURRENT_LEDGER_REVISION,
      eventRevision: CURRENT_EVENT_REVISION,
      appliedInvalidationSequence: 5
    })
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)
    await createWalletLedgerDailyUsdTotalsCache(previous).write([{ date: '2026-08-01', usdValue: 10 }])

    await expect(
      transitionWalletLedgerDailyUsdTotalsCache({
        previous,
        current,
        dirtyFromDate: '2026-08-01',
        reset: false
      })
    ).resolves.toBe(false)
    await expect(
      createWalletLedgerDailyUsdTotalsCache(previous).read('2026-08-01', '2026-08-01')
    ).resolves.toMatchObject({
      totals: [{ date: '2026-08-01', usdValue: 10 }]
    })
  })

  it('logs bounded cache timings and outcomes without cache identities', async () => {
    const redis = mocks.redis as FakeDailyUsdRedis
    const previous = identity()
    const current = identity({
      ledgerRevision: CURRENT_LEDGER_REVISION,
      eventRevision: CURRENT_EVENT_REVISION,
      appliedInvalidationSequence: 5
    })
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    storeWalletRevision(redis, PREVIOUS_LEDGER_REVISION)

    await withHoldingsDebugContext(
      createHoldingsDebugContext('ledger-portfolio-history', '0x1111111111111111111111111111111111111111', true),
      async () => {
        const cache = createWalletLedgerDailyUsdTotalsCache(previous)
        await cache.write([{ date: '2026-08-01', usdValue: 10 }])
        await cache.read('2026-08-01', '2026-08-02')
        storeWalletRevision(redis, CURRENT_LEDGER_REVISION)
        await transitionWalletLedgerDailyUsdTotalsCache({
          previous,
          current,
          dirtyFromDate: '2026-08-01',
          reset: false
        })
      }
    )

    const output = consoleLog.mock.calls.map(([message]) => String(message)).join('\n')
    expect(output).toContain('queued daily USD totals cache write')
    expect(output).toContain('completed daily USD totals cache write')
    expect(output).toContain('completed daily USD totals cache read')
    expect(output).toContain('completed daily USD totals cache transition')
    expect(output).toContain('"dirtyFromDate":"2026-08-01"')
    expect(output).toContain('"status":"saved"')
    expect(output).toContain('"status":"hit"')
    expect(output).toContain('"status":"applied"')
    expect(output).not.toContain(WALLET_HASH)
    expect(output).not.toContain(PREVIOUS_LEDGER_REVISION)
    expect(output).not.toContain(PREVIOUS_EVENT_REVISION)
  })
})
