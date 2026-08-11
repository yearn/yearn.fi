import type { SetCommandOptions } from '@upstash/redis'
import { afterEach, describe, expect, it } from 'vitest'
import { encodeWalletLedgerPayload } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  acquireWalletLedgerLock,
  commitStoredWalletLedger,
  getWalletLedgerKey,
  getWalletLedgerLockKey,
  readStoredWalletLedger,
  releaseWalletLedgerLock,
  renewWalletLedgerLock,
  type TWalletLedgerRedis
} from '@/server/lib/holdings/services/ledger/walletStore'
import {
  type TWalletLedgerPayloadV1,
  WALLET_LEDGER_SCHEMA_VERSION
} from '@/server/lib/holdings/services/ledger/walletTypes'

const WALLET_HASH = 'a'.repeat(64)

class FakeWalletLedgerRedis implements TWalletLedgerRedis {
  readonly values = new Map<string, string>()
  readonly ttls = new Map<string, number>()

  get<TData>(key: string): Promise<TData | null> {
    return Promise.resolve((this.values.get(key) as TData | undefined) ?? null)
  }

  set<TData>(key: string, value: TData, options?: SetCommandOptions): Promise<'OK' | TData | null> {
    if (options?.nx && this.values.has(key)) {
      return Promise.resolve(null)
    }
    this.values.set(key, String(value))
    if (options && 'px' in options && options.px !== undefined) {
      this.ttls.set(key, options.px)
    }
    return Promise.resolve('OK')
  }

  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData> {
    const lockKey = keys[0] ?? ''
    const token = String(args[0])
    const ownsLock = this.values.get(lockKey) === token
    const result = (() => {
      if (!ownsLock) {
        return 0
      }
      if (script.includes('holdings-wallet-ledger-lock-renew-v1')) {
        this.ttls.set(lockKey, Number(args[1]))
        return 1
      }
      if (script.includes('holdings-wallet-ledger-lock-release-v1')) {
        this.values.delete(lockKey)
        this.ttls.delete(lockKey)
        return 1
      }
      if (script.includes('holdings-wallet-ledger-commit-v1')) {
        const valueKey = keys[1] ?? ''
        const ttlMs = Number(args[2])
        this.values.set(valueKey, String(args[1]))
        if (ttlMs > 0) {
          this.ttls.set(valueKey, ttlMs)
        } else {
          this.ttls.delete(valueKey)
        }
        return 1
      }
      return -1
    })()
    return Promise.resolve(result as TData)
  }
}

function createPayload(updatedAtMs: number): TWalletLedgerPayloadV1 {
  return {
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: 'wallet-ledger-test-v1',
    walletHash: WALLET_HASH,
    sourceFingerprint: 'b'.repeat(64),
    sourceGeneration: 1,
    coverage: [{ chainId: 1, startBlock: 1, endBlock: null, completeThroughBlock: 100 }],
    streams: {
      v3Deposits: [],
      v3Withdrawals: [],
      v2Deposits: [],
      v2Withdrawals: [],
      transfersIn: [],
      transfersOut: []
    },
    createdAtMs: 1,
    updatedAtMs
  }
}

describe('one-value wallet ledger store', () => {
  afterEach(() => {
    delete process.env.HOLDINGS_LEDGER_KEY_NAMESPACE
  })

  it('uses one wallet-scoped data key and one temporary lock key', () => {
    expect(getWalletLedgerKey(WALLET_HASH)).toBe(`holdings:wallet-ledger:v1:{${WALLET_HASH}}`)
    expect(getWalletLedgerLockKey(WALLET_HASH)).toBe(`holdings:wallet-ledger:v1:{${WALLET_HASH}}:lock`)
    process.env.HOLDINGS_LEDGER_KEY_NAMESPACE = 'test_1'
    expect(getWalletLedgerKey(WALLET_HASH)).toBe(`holdings:wallet-ledger:v1:{${WALLET_HASH}}:namespace:test_1`)
  })

  it('commits and reads the complete compressed value while the token owns the lock', async () => {
    const redis = new FakeWalletLedgerRedis()
    const encoded = encodeWalletLedgerPayload(createPayload(2))
    const acquired = await acquireWalletLedgerLock({
      redis,
      walletHash: WALLET_HASH,
      token: 'worker-a',
      ttlMs: 300_000
    })
    if (acquired.status !== 'acquired') {
      throw new Error('Expected wallet lock')
    }

    await expect(
      commitStoredWalletLedger({ redis, walletHash: WALLET_HASH, lock: acquired.lock, value: encoded.value })
    ).resolves.toEqual({ status: 'ok' })
    await expect(readStoredWalletLedger({ redis, walletHash: WALLET_HASH })).resolves.toEqual({
      status: 'ready',
      ledger: encoded.ledger
    })
    expect(redis.values.has(getWalletLedgerKey(WALLET_HASH))).toBe(true)
    expect(await renewWalletLedgerLock({ redis, walletHash: WALLET_HASH, lock: acquired.lock, ttlMs: 60_000 })).toEqual(
      { status: 'ok' }
    )
    expect(await releaseWalletLedgerLock({ redis, walletHash: WALLET_HASH, lock: acquired.lock })).toEqual({
      status: 'ok'
    })
    expect(redis.values.has(getWalletLedgerLockKey(WALLET_HASH))).toBe(false)
  })

  it('rejects a stale writer and preserves the previous complete value', async () => {
    const redis = new FakeWalletLedgerRedis()
    const previous = encodeWalletLedgerPayload(createPayload(2))
    const next = encodeWalletLedgerPayload(createPayload(3))
    redis.values.set(getWalletLedgerKey(WALLET_HASH), previous.value)
    redis.values.set(getWalletLedgerLockKey(WALLET_HASH), 'worker-b')

    await expect(
      commitStoredWalletLedger({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-a' },
        value: next.value
      })
    ).resolves.toEqual({ status: 'lock_lost' })
    expect(redis.values.get(getWalletLedgerKey(WALLET_HASH))).toBe(previous.value)
  })

  it('supports a bounded negative-cache TTL without changing the one-value shape', async () => {
    const redis = new FakeWalletLedgerRedis()
    const encoded = encodeWalletLedgerPayload(createPayload(2))
    const acquired = await acquireWalletLedgerLock({
      redis,
      walletHash: WALLET_HASH,
      token: 'worker-a',
      ttlMs: 300_000
    })
    if (acquired.status !== 'acquired') {
      throw new Error('Expected wallet lock')
    }

    await expect(
      commitStoredWalletLedger({
        redis,
        walletHash: WALLET_HASH,
        lock: acquired.lock,
        value: encoded.value,
        ttlMs: 86_400_000
      })
    ).resolves.toEqual({ status: 'ok' })
    expect(redis.ttls.get(getWalletLedgerKey(WALLET_HASH))).toBe(86_400_000)
  })

  it('classifies malformed stored data as corrupt without changing it', async () => {
    const redis = new FakeWalletLedgerRedis()
    redis.values.set(getWalletLedgerKey(WALLET_HASH), 'not-a-wallet-ledger')

    await expect(readStoredWalletLedger({ redis, walletHash: WALLET_HASH })).resolves.toEqual({ status: 'corrupt' })
    expect(redis.values.get(getWalletLedgerKey(WALLET_HASH))).toBe('not-a-wallet-ledger')
  })
})
