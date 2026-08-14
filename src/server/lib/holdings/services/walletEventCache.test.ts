import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserEvents } from '@/server/lib/holdings/types'

const redisStorageMocks = vi.hoisted(() => ({
  getHoldingsRedisClient: vi.fn(),
  handleHoldingsRedisError: vi.fn()
}))

vi.mock('@/server/lib/holdings/storage/redis', () => redisStorageMocks)

import {
  decodeWalletEventCachePayload,
  encodeWalletEventCachePayload,
  getCachedWalletEvents,
  getWalletEventCacheKey,
  saveCachedWalletEvents
} from '@/server/lib/holdings/services/walletEventCache'

const USER_ADDRESS = '0x00000000000000000000000000000000000000A1'
const VAULT_ADDRESS = '0x00000000000000000000000000000000000000B2'
const MAX_TIMESTAMP = 1_800_000_000
const CACHED_AT_MS = 1_800_000_000_000

const EVENTS: UserEvents = {
  deposits: [
    {
      id: 'deposit-1',
      vaultAddress: VAULT_ADDRESS,
      chainId: 1,
      blockNumber: 100,
      blockTimestamp: 1_700_000_000,
      logIndex: 1,
      transactionHash: '0xdeposit',
      transactionFrom: USER_ADDRESS,
      owner: USER_ADDRESS,
      sender: USER_ADDRESS,
      assets: '1000000',
      shares: '999999999999999999'
    }
  ],
  withdrawals: [
    {
      id: 'withdrawal-1',
      vaultAddress: VAULT_ADDRESS,
      chainId: 1,
      blockNumber: 200,
      blockTimestamp: 1_700_000_100,
      logIndex: 2,
      transactionHash: '0xwithdrawal',
      transactionFrom: USER_ADDRESS,
      owner: USER_ADDRESS,
      assets: '500000',
      shares: '499999999999999999'
    }
  ],
  transfersIn: [
    {
      id: 'transfer-in-1',
      vaultAddress: VAULT_ADDRESS,
      chainId: 1,
      blockNumber: 300,
      blockTimestamp: 1_700_000_200,
      logIndex: 3,
      transactionHash: '0xtransferin',
      transactionFrom: USER_ADDRESS,
      sender: '0x00000000000000000000000000000000000000C3',
      receiver: USER_ADDRESS,
      value: '100000000000000000'
    }
  ],
  transfersOut: [
    {
      id: 'transfer-out-1',
      vaultAddress: VAULT_ADDRESS,
      chainId: 1,
      blockNumber: 400,
      blockTimestamp: 1_700_000_300,
      logIndex: 4,
      transactionHash: '0xtransferout',
      transactionFrom: USER_ADDRESS,
      sender: USER_ADDRESS,
      receiver: '0x00000000000000000000000000000000000000D4',
      value: '50000000000000000'
    }
  ]
}

const IDENTITY = {
  userAddress: USER_ADDRESS,
  maxTimestamp: MAX_TIMESTAMP
}

function encodeEvents(events: UserEvents = EVENTS, maxTimestamp = MAX_TIMESTAMP, cachedAtMs = CACHED_AT_MS): string {
  return encodeWalletEventCachePayload({
    version: 1,
    maxTimestamp,
    cachedAtMs,
    events
  })
}

describe('wallet event cache codec', () => {
  it('round trips normalized events through Brotli without changing integer strings', () => {
    const encoded = encodeEvents()

    expect(encoded).toMatch(/^br1:/)
    expect(encoded).not.toContain(USER_ADDRESS)
    expect(decodeWalletEventCachePayload(encoded)).toEqual({
      version: 1,
      maxTimestamp: MAX_TIMESTAMP,
      cachedAtMs: CACHED_AT_MS,
      events: EVENTS
    })
  })

  it('treats malformed compressed data and invalid event shapes as misses', () => {
    const invalidEvents = {
      ...EVENTS,
      deposits: [{ ...EVENTS.deposits[0], shares: 1 as unknown as string }]
    }

    expect(decodeWalletEventCachePayload('br1:not-brotli')).toBeNull()
    expect(decodeWalletEventCachePayload('br1:AA')).toBeNull()
    expect(decodeWalletEventCachePayload(encodeEvents(invalidEvents))).toBeNull()
  })
})

describe('wallet event cache storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses a hashed wallet-and-cutoff key and overwrites it with a five-minute ttl', async () => {
    const setMock = vi.fn().mockResolvedValue('OK')
    redisStorageMocks.getHoldingsRedisClient.mockReturnValue({ set: setMock })

    const saved = await saveCachedWalletEvents(IDENTITY, EVENTS, CACHED_AT_MS)
    const key = getWalletEventCacheKey(IDENTITY)

    expect(saved).toBe(true)
    expect(key).toMatch(/^holdings:wallet-events:v1:[a-f0-9]{64}:1800000000$/)
    expect(key).not.toContain(USER_ADDRESS.toLowerCase())
    expect(setMock).toHaveBeenCalledWith(key, expect.stringMatching(/^br1:/), { ex: 5 * 60 })
  })

  it('returns a fresh event set and rejects stale, future, or mismatched payloads', async () => {
    const getMock = vi
      .fn()
      .mockResolvedValueOnce(encodeEvents())
      .mockResolvedValueOnce(encodeEvents())
      .mockResolvedValueOnce(encodeEvents(EVENTS, MAX_TIMESTAMP, CACHED_AT_MS + 1))
      .mockResolvedValueOnce(encodeEvents(EVENTS, MAX_TIMESTAMP - 1))
    redisStorageMocks.getHoldingsRedisClient.mockReturnValue({ get: getMock })

    await expect(getCachedWalletEvents(IDENTITY, CACHED_AT_MS + 5 * 60 * 1000 - 1)).resolves.toEqual(EVENTS)
    await expect(getCachedWalletEvents(IDENTITY, CACHED_AT_MS + 5 * 60 * 1000)).resolves.toBeNull()
    await expect(getCachedWalletEvents(IDENTITY, CACHED_AT_MS)).resolves.toBeNull()
    await expect(getCachedWalletEvents(IDENTITY, CACHED_AT_MS)).resolves.toBeNull()
  })

  it('falls back cleanly when Redis is unavailable or errors', async () => {
    redisStorageMocks.getHoldingsRedisClient.mockReturnValueOnce(null)
    await expect(getCachedWalletEvents(IDENTITY)).resolves.toBeNull()

    const redisError = new Error('Redis unavailable')
    redisStorageMocks.getHoldingsRedisClient.mockReturnValue({ get: vi.fn().mockRejectedValue(redisError) })

    await expect(getCachedWalletEvents(IDENTITY)).resolves.toBeNull()
    expect(redisStorageMocks.handleHoldingsRedisError).toHaveBeenCalledWith(
      'wallet event cache lookup failed',
      redisError
    )
  })

  it('does not fail the request when a cache overwrite errors', async () => {
    const redisError = new Error('Redis write unavailable')
    redisStorageMocks.getHoldingsRedisClient.mockReturnValue({ set: vi.fn().mockRejectedValue(redisError) })

    await expect(saveCachedWalletEvents(IDENTITY, EVENTS)).resolves.toBe(false)
    expect(redisStorageMocks.handleHoldingsRedisError).toHaveBeenCalledWith(
      'wallet event cache save failed',
      redisError
    )
  })
})
