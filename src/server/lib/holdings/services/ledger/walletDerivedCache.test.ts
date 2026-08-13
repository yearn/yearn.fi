import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import type { THoldingsLedgerGrowthResponse } from '@/server/lib/holdings/services/ledger/rows'
import type { HoldingsPnLSimpleHistoryResponse } from '@/server/lib/holdings/services/pnlSimple'
import { createDeferred } from '@/server/lib/holdings/test-utils/deferred'

const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111'
const WALLET_HASH = hashLedgerWalletAddress(WALLET_ADDRESS)
const LEDGER_REVISION = 'b'.repeat(64)
const EVENT_REVISION = 'c'.repeat(64)
const REDIS = { readYourWritesSyncToken: 'sync-token', get: vi.fn(), eval: vi.fn() }

const mocks = vi.hoisted(() => ({
  adoptSyncToken: vi.fn(),
  getRedis: vi.fn(),
  getTimedRedis: vi.fn()
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  adoptHoldingsLedgerRedisReadYourWritesSyncToken: mocks.adoptSyncToken,
  executeHoldingsLedgerRedisOperation: (_operation: string, action: () => Promise<unknown>) => action(),
  getHoldingsLedgerRedisClient: mocks.getRedis,
  getHoldingsLedgerRedisClientWithTimeout: mocks.getTimedRedis
}))

import {
  enqueueWalletLedgerDerivedPortfolioCacheWrite,
  getWalletLedgerDerivedPortfolioCacheKey,
  readWalletLedgerDerivedPortfolioCache,
  resetWalletLedgerDerivedPortfolioCacheForTests,
  type TWalletLedgerDerivedPortfolioCacheIdentity,
  type TWalletLedgerDerivedPortfolioCacheValue,
  writeWalletLedgerDerivedPortfolioCache
} from '@/server/lib/holdings/services/ledger/walletDerivedCache'

function identity(
  overrides: Partial<TWalletLedgerDerivedPortfolioCacheIdentity> = {}
): TWalletLedgerDerivedPortfolioCacheIdentity {
  return {
    walletHash: WALLET_HASH,
    ledgerRevision: LEDGER_REVISION,
    eventRevision: EVENT_REVISION,
    sourceGeneration: 2,
    appliedInvalidationSequence: 3,
    ledgerCalculationVersion: 'calculation-v1',
    latestSettledDayTimestamp: Date.UTC(2026, 7, 7) / 1000,
    version: 'all',
    timeframe: '1y',
    ...overrides
  }
}

function value(complete = true): TWalletLedgerDerivedPortfolioCacheValue {
  return {
    protocolReturn: {
      address: WALLET_ADDRESS,
      version: 'all',
      timeframe: '1y',
      generatedAt: '2026-08-08T00:00:00.000Z',
      summary: { totalVaults: 1, isComplete: complete },
      dataPoints: [],
      familySeries: []
    } as unknown as HoldingsPnLSimpleHistoryResponse,
    growth: {
      address: WALLET_ADDRESS,
      version: 'all',
      generatedAt: '2026-08-08T00:00:00.000Z',
      summary: { totalVaults: 1, isComplete: complete },
      vaults: []
    } as unknown as THoldingsLedgerGrowthResponse
  }
}

describe('wallet ledger derived portfolio cache', () => {
  beforeEach(() => {
    resetWalletLedgerDerivedPortfolioCacheForTests()
    vi.clearAllMocks()
    vi.stubEnv('HOLDINGS_LEDGER_VALUATION_REVISION', 'valuation-v1')
    mocks.getRedis.mockReturnValue(REDIS)
    mocks.getTimedRedis.mockReturnValue(REDIS)
    REDIS.get.mockResolvedValue(null)
    REDIS.eval.mockResolvedValue(1)
  })

  it('uses a wallet-scoped key without exposing the address', () => {
    expect(getWalletLedgerDerivedPortfolioCacheKey(identity())).toBe(
      `holdings:wallet-ledger:v3:{${WALLET_HASH}}:derived-portfolio:v1:all:1y`
    )
  })

  it('round-trips a complete result and fences the write against the exact ledger revision', async () => {
    const expected = value()
    const written = await writeWalletLedgerDerivedPortfolioCache(identity(), expected)
    const encoded = REDIS.eval.mock.calls[0]?.[2]?.[1]
    REDIS.get.mockResolvedValue(encoded)

    const read = await readWalletLedgerDerivedPortfolioCache(identity())

    expect(written).toBe('saved')
    expect(encoded).toMatch(
      /^holdings-wallet-ledger-derived-portfolio:opaque:v1:brotli-q4-base64-quality-v1:c:[a-f0-9]{64}:[a-f0-9]{64}:/
    )
    expect(REDIS.eval).toHaveBeenCalledWith(
      expect.stringContaining('holdings-wallet-ledger-derived-portfolio-write-v2'),
      [
        `holdings:wallet-ledger:v3:{${WALLET_HASH}}`,
        `holdings:wallet-ledger:v3:{${WALLET_HASH}}:derived-portfolio:v1:all:1y`
      ],
      [
        `holdings-wallet-ledger:opaque:v3:brotli-q4-base64:${LEDGER_REVISION}:`,
        expect.any(String),
        '1800',
        '1',
        expect.stringMatching(
          /^holdings-wallet-ledger-derived-portfolio:opaque:v1:brotli-q4-base64-quality-v1:c:[a-f0-9]{64}:$/
        )
      ]
    )
    expect(read).toEqual({ status: 'hit', value: expected })
    expect(mocks.getTimedRedis).toHaveBeenCalledWith(3_000)
    expect(mocks.getTimedRedis).toHaveBeenCalledTimes(1)
    expect(mocks.getRedis).toHaveBeenCalledTimes(1)
    expect(mocks.adoptSyncToken).toHaveBeenCalledWith(REDIS)
  })

  it('serves an enqueued value from memory while Redis persistence is still pending', async () => {
    const redisWrite = createDeferred<number>()
    REDIS.eval.mockReturnValueOnce(redisWrite.promise)
    const expected = value()

    const enqueued = enqueueWalletLedgerDerivedPortfolioCacheWrite(identity(), expected)
    const read = await readWalletLedgerDerivedPortfolioCache(identity())

    expect(enqueued.status).toBe('queued')
    expect(enqueued.persistence).not.toBeNull()
    expect(read).toEqual({ status: 'hit', value: expected })
    expect(REDIS.get).not.toHaveBeenCalled()
    expect(mocks.getRedis).not.toHaveBeenCalled()

    redisWrite.resolve(1)
    await expect(enqueued.persistence).resolves.toBe('saved')
  })

  it('keeps a complete in-memory result while a concurrent provisional write finishes later', async () => {
    const completeRedisWrite = createDeferred<number>()
    const provisionalRedisWrite = createDeferred<number>()
    REDIS.eval.mockReturnValueOnce(completeRedisWrite.promise).mockReturnValueOnce(provisionalRedisWrite.promise)
    const completeValue = value()
    const provisionalValue = value(false)

    const completeWrite = enqueueWalletLedgerDerivedPortfolioCacheWrite(identity(), completeValue)
    const provisionalWrite = enqueueWalletLedgerDerivedPortfolioCacheWrite(identity(), provisionalValue)

    expect(completeWrite.status).toBe('queued')
    expect(provisionalWrite.status).toBe('queued')
    expect(REDIS.eval).toHaveBeenCalledTimes(2)
    await expect(readWalletLedgerDerivedPortfolioCache(identity())).resolves.toEqual({
      status: 'hit',
      value: completeValue
    })
    expect(REDIS.eval.mock.calls[0]?.[2]?.[4]).toBe(REDIS.eval.mock.calls[1]?.[2]?.[4])

    completeRedisWrite.resolve(1)
    provisionalRedisWrite.resolve(2)
    await expect(completeWrite.persistence).resolves.toBe('saved')
    await expect(provisionalWrite.persistence).resolves.toBe('preserved-complete')
  })

  it('does not let an older fenced write suppress persistence for a newer ledger revision', async () => {
    const olderRedisWrite = createDeferred<number>()
    const newerRedisWrite = createDeferred<number>()
    REDIS.eval.mockReturnValueOnce(olderRedisWrite.promise).mockReturnValueOnce(newerRedisWrite.promise)
    const newerLedgerRevision = 'd'.repeat(64)

    const olderWrite = enqueueWalletLedgerDerivedPortfolioCacheWrite(identity(), value())
    const newerWrite = enqueueWalletLedgerDerivedPortfolioCacheWrite(
      identity({ ledgerRevision: newerLedgerRevision }),
      value()
    )

    expect(olderWrite.status).toBe('queued')
    expect(newerWrite.status).toBe('queued')
    expect(REDIS.eval).toHaveBeenCalledTimes(2)
    expect(REDIS.eval.mock.calls[0]?.[2]?.[0]).toContain(LEDGER_REVISION)
    expect(REDIS.eval.mock.calls[1]?.[2]?.[0]).toContain(newerLedgerRevision)

    olderRedisWrite.resolve(0)
    newerRedisWrite.resolve(1)
    await expect(olderWrite.persistence).resolves.toBe('fenced')
    await expect(newerWrite.persistence).resolves.toBe('saved')
  })

  it('preserves an existing complete Redis payload when a provisional writer arrives later', async () => {
    const redisState = { encoded: null as string | null }
    REDIS.eval.mockImplementation(async (_script: string, _keys: string[], args: string[]) => {
      const existingIsComplete = redisState.encoded?.startsWith(args[4] ?? '') === true
      if (args[3] === '0' && existingIsComplete) {
        return 2
      }
      redisState.encoded = args[1] ?? null
      return 1
    })
    REDIS.get.mockImplementation(async () => redisState.encoded)
    const completeValue = value()

    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), completeValue)).resolves.toBe('saved')
    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), value(false))).resolves.toBe('preserved-complete')
    await expect(readWalletLedgerDerivedPortfolioCache(identity())).resolves.toEqual({
      status: 'hit',
      value: completeValue
    })
  })

  it('keeps a validated value in memory when Redis storage is disabled', async () => {
    mocks.getTimedRedis.mockReturnValueOnce(null)
    const expected = value()

    const enqueued = enqueueWalletLedgerDerivedPortfolioCacheWrite(identity(), expected)

    expect(enqueued).toEqual({ status: 'memory-only', persistence: null })
    await expect(readWalletLedgerDerivedPortfolioCache(identity())).resolves.toEqual({
      status: 'hit',
      value: expected
    })
    expect(mocks.getRedis).not.toHaveBeenCalled()
  })

  it('compresses a representative derived history below its raw JSON size', async () => {
    const baseValue = value()
    const historicalValue = {
      ...baseValue,
      protocolReturn: {
        ...baseValue.protocolReturn,
        dataPoints: Array.from({ length: 1_000 }, (_, index) => ({
          timestamp: 1_700_000_000 + index * 86_400,
          value: 12_345.67 + index,
          deposited: 10_000,
          withdrawn: 0
        }))
      }
    } as unknown as TWalletLedgerDerivedPortfolioCacheValue

    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), historicalValue)).resolves.toBe('saved')
    const encoded = REDIS.eval.mock.calls[0]?.[2]?.[1] as string

    expect(Buffer.byteLength(encoded, 'utf8')).toBeLessThan(Buffer.byteLength(JSON.stringify(historicalValue), 'utf8'))
  })

  it('treats corrupt compressed values as cache misses', async () => {
    await writeWalletLedgerDerivedPortfolioCache(identity(), value())
    const encoded = REDIS.eval.mock.calls[0]?.[2]?.[1] as string
    const checksum = encoded.match(/[a-f0-9]{64}(?=:)/)?.[0]
    const corruptChecksum = checksum ? `${checksum[0] === 'a' ? 'b' : 'a'}${checksum.slice(1)}` : ''
    REDIS.get.mockResolvedValue(encoded.replace(checksum ?? '', corruptChecksum))

    await expect(readWalletLedgerDerivedPortfolioCache(identity())).resolves.toEqual({ status: 'miss' })
  })

  it('rejects oversized decoded writes and encoded reads without touching Redis', async () => {
    const baseValue = value()
    const oversizedValue = {
      ...baseValue,
      protocolReturn: {
        ...baseValue.protocolReturn,
        generatedAt: 'x'.repeat(8 * 1024 * 1024)
      }
    } as TWalletLedgerDerivedPortfolioCacheValue

    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), oversizedValue)).resolves.toBe('oversized')
    expect(REDIS.eval).not.toHaveBeenCalled()

    REDIS.get.mockResolvedValue('x'.repeat(8 * 1024 * 1024 + 1))
    await expect(readWalletLedgerDerivedPortfolioCache(identity())).resolves.toEqual({ status: 'miss' })
  })

  it('misses automatically when the event revision or valuation revision changes', async () => {
    await writeWalletLedgerDerivedPortfolioCache(identity(), value())
    REDIS.get.mockResolvedValue(REDIS.eval.mock.calls[0]?.[2]?.[1])

    const changedEventRevision = await readWalletLedgerDerivedPortfolioCache(
      identity({ eventRevision: 'd'.repeat(64) })
    )
    vi.stubEnv('HOLDINGS_LEDGER_VALUATION_REVISION', 'valuation-v2')
    const changedValuationRevision = await readWalletLedgerDerivedPortfolioCache(identity())

    expect(changedEventRevision).toEqual({ status: 'miss' })
    expect(changedValuationRevision).toEqual({ status: 'miss' })
  })

  it('rejects a payload written for a different wallet address', async () => {
    const mismatched = value()
    const otherAddress = '0x2222222222222222222222222222222222222222'
    const wrongWalletValue = {
      protocolReturn: { ...mismatched.protocolReturn, address: otherAddress },
      growth: { ...mismatched.growth, address: otherAddress }
    } as TWalletLedgerDerivedPortfolioCacheValue

    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), wrongWalletValue)).resolves.toBe('error')
    expect(REDIS.eval).not.toHaveBeenCalled()
  })

  it('keeps incomplete upstream results through the portfolio freshness window', async () => {
    const status = await writeWalletLedgerDerivedPortfolioCache(identity(), value(false))

    expect(status).toBe('saved-provisional')
    expect(REDIS.eval.mock.calls[0]?.[2]?.[2]).toBe('1800')
  })

  it('reports a stale calculation rejected by the wallet revision fence', async () => {
    REDIS.eval.mockResolvedValueOnce(0)

    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), value())).resolves.toBe('fenced')
  })

  it('retries one transient Redis write before giving up the computed result', async () => {
    REDIS.eval.mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(1)

    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), value())).resolves.toBe('saved')
    expect(REDIS.eval).toHaveBeenCalledTimes(2)
  })

  it('does not retry a non-transient Redis write rejection', async () => {
    REDIS.eval.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }))

    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), value())).resolves.toBe('error')
    expect(REDIS.eval).toHaveBeenCalledTimes(1)
  })

  it('fails open when Redis reads or writes fail', async () => {
    REDIS.get.mockRejectedValueOnce(new Error('unavailable'))
    REDIS.eval.mockRejectedValue(new Error('unavailable'))

    await expect(readWalletLedgerDerivedPortfolioCache(identity())).resolves.toEqual({ status: 'error' })
    await expect(writeWalletLedgerDerivedPortfolioCache(identity(), value())).resolves.toBe('error')
    expect(REDIS.eval).toHaveBeenCalledTimes(2)
  })

  it('reports disabled storage without throwing', async () => {
    mocks.getRedis.mockReturnValueOnce(null)

    await expect(readWalletLedgerDerivedPortfolioCache(identity())).resolves.toEqual({ status: 'disabled' })
  })
})
