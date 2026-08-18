import type { SetCommandOptions } from '@upstash/redis'
import { afterEach, describe, expect, it } from 'vitest'
import { encodeWalletLedgerPayload } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  acquireWalletLedgerLock,
  commitStoredWalletLedger,
  commitWalletLedgerCheckedMarker,
  getWalletLedgerCheckedMarkerKey,
  getWalletLedgerKey,
  getWalletLedgerLockKey,
  readStoredWalletLedger,
  readVerifiedWalletLedgerHeader,
  readWalletLedgerCheckedMarker,
  releaseWalletLedgerLock,
  renewWalletLedgerLock,
  type TWalletLedgerRedis,
  verifyWalletLedgerSnapshotUnderLock
} from '@/server/lib/holdings/services/ledger/walletStore'
import {
  type TWalletLedgerPayloadV3,
  WALLET_LEDGER_CHECKED_MARKER_SCHEMA_VERSION,
  WALLET_LEDGER_SCHEMA_VERSION
} from '@/server/lib/holdings/services/ledger/walletTypes'

const WALLET_HASH = 'a'.repeat(64)

class FakeWalletLedgerRedis implements TWalletLedgerRedis {
  readonly values = new Map<string, string>()
  readonly hashes = new Map<string, Map<string, string>>()
  readonly ttls = new Map<string, number>()
  readonly ttlSeconds = new Map<string, number>()
  lastCommitScript: string | null = null

  get<TData>(key: string): Promise<TData | null> {
    return Promise.resolve((this.values.get(key) as TData | undefined) ?? null)
  }

  llen(): Promise<number> {
    return Promise.resolve(0)
  }

  lrange<TData>(): Promise<TData[]> {
    return Promise.resolve([])
  }

  rpush<TData>(_key: string, ..._elements: TData[]): Promise<number> {
    return Promise.resolve(0)
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
      if (script.includes('holdings-wallet-ledger-header-read-v2')) {
        const ledgerValue = this.values.get(keys[0] ?? '')
        const markerValue = this.values.get(keys[1] ?? '')
        const prefixLength = Number(script.match(/string\.sub\(ledgerValue, 1, (\d+)\)/)?.[1] ?? 0)
        return ledgerValue === undefined || markerValue === undefined
          ? [0]
          : [1, ledgerValue.slice(0, prefixLength), markerValue, ledgerValue.length]
      }
      if (script.includes('holdings-wallet-ledger-snapshot-verify-v2')) {
        if (!ownsLock) {
          return [0]
        }
        const ledgerValue = this.values.get(keys[1] ?? '')
        const expectedPrefix = String(args[1])
        if (
          (expectedPrefix === '' && ledgerValue !== undefined) ||
          (expectedPrefix !== '' &&
            (!ledgerValue?.startsWith(expectedPrefix) || ledgerValue.length !== Number(args[2])))
        ) {
          return [2]
        }
        const markerValue = this.values.get(keys[2] ?? '')
        return markerValue === undefined ? [1, 0] : [1, 1, markerValue]
      }
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
      if (script.includes('holdings-wallet-ledger-checked-marker-commit-v3')) {
        const valueKey = keys[1] ?? ''
        const markerKey = keys[2] ?? ''
        const expectedPrefix = String(args[1])
        if (
          !this.values.get(valueKey)?.startsWith(expectedPrefix) ||
          this.values.get(valueKey)?.length !== Number(args[2])
        ) {
          return 2
        }
        this.values.set(markerKey, String(args[3]))
        const ttlMs = this.ttls.get(valueKey)
        if (ttlMs !== undefined) {
          this.ttls.set(markerKey, ttlMs)
        } else {
          this.ttls.delete(markerKey)
        }
        if (String(args[4]) === '1') {
          this.values.delete(lockKey)
          this.ttls.delete(lockKey)
        }
        return 1
      }
      if (script.includes('holdings-wallet-ledger-commit-v5')) {
        const valueKey = keys[1] ?? ''
        const markerKey = keys.at(-1) ?? ''
        const cacheKeys = keys.slice(2, -1)
        const ttlMs = Number(args[2])
        this.lastCommitScript = script
        cacheKeys.forEach((cacheKey) => {
          if (this.values.has(cacheKey)) {
            this.values.delete(cacheKey)
            this.ttls.delete(cacheKey)
            this.ttlSeconds.delete(cacheKey)
            this.hashes.delete(cacheKey)
          }
        })
        this.values.set(valueKey, String(args[1]))
        this.values.set(markerKey, String(args.at(-1)))
        if (ttlMs > 0) {
          this.ttls.set(valueKey, ttlMs)
          this.ttls.set(markerKey, ttlMs)
        } else {
          this.ttls.delete(valueKey)
          this.ttls.delete(markerKey)
        }
        cacheKeys.forEach((cacheKey, index) => {
          const argumentIndex = 3 + index * 5
          const previousMeta = String(args[argumentIndex] ?? '')
          const currentMeta = String(args[argumentIndex + 1] ?? '')
          const dirtyFromDate = String(args[argumentIndex + 2] ?? '')
          const reset = String(args[argumentIndex + 3] ?? '') === '1'
          const ttlSeconds = Number(args[argumentIndex + 4])
          const existing = this.hashes.get(cacheKey)
          if (!existing) {
            return
          }
          if (existing.get('__meta') === currentMeta) {
            this.ttlSeconds.set(cacheKey, ttlSeconds)
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
          this.ttlSeconds.set(cacheKey, ttlSeconds)
        })
        if (String(args.at(-2)) === '1') {
          this.values.delete(lockKey)
          this.ttls.delete(lockKey)
        }
        return 1
      }
      return -1
    })()
    return Promise.resolve(result as TData)
  }
}

function createPayload(updatedAtMs: number): TWalletLedgerPayloadV3 {
  return {
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: 'wallet-ledger-test-v1',
    walletHash: WALLET_HASH,
    sourceFingerprint: 'b'.repeat(64),
    sourceGeneration: 1,
    appliedInvalidationSequence: 0,
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
    updatedAtMs,
    reconciledAtMs: 1
  }
}

describe('wallet ledger store', () => {
  afterEach(() => {
    delete process.env.HOLDINGS_LEDGER_KEY_NAMESPACE
  })

  it('uses one wallet-scoped value, one checked marker, and one temporary lock key', () => {
    expect(getWalletLedgerKey(WALLET_HASH)).toBe(`holdings:wallet-ledger:v3:{${WALLET_HASH}}`)
    expect(getWalletLedgerLockKey(WALLET_HASH)).toBe(`holdings:wallet-ledger:v3:{${WALLET_HASH}}:lock`)
    expect(getWalletLedgerCheckedMarkerKey(WALLET_HASH)).toBe(`holdings:wallet-ledger:v3:{${WALLET_HASH}}:checked`)
    process.env.HOLDINGS_LEDGER_KEY_NAMESPACE = 'test_1'
    expect(getWalletLedgerKey(WALLET_HASH)).toBe(`holdings:wallet-ledger:v3:{${WALLET_HASH}}:namespace:test_1`)
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
    await expect(readWalletLedgerCheckedMarker({ redis, walletHash: WALLET_HASH })).resolves.toMatchObject({
      status: 'ready',
      marker: { revision: encoded.ledger.revision, reconciledAtMs: encoded.ledger.reconciledAtMs }
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

  it('atomically verifies an unchanged decoded snapshot and returns the current marker', async () => {
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
    await commitStoredWalletLedger({ redis, walletHash: WALLET_HASH, lock: acquired.lock, value: encoded.value })

    await expect(
      verifyWalletLedgerSnapshotUnderLock({
        redis,
        walletHash: WALLET_HASH,
        lock: acquired.lock,
        expectedRevision: encoded.ledger.revision,
        expectedEncodedBytes: encoded.ledger.encodedBytes
      })
    ).resolves.toMatchObject({
      status: 'unchanged',
      marker: { status: 'ready', marker: { revision: encoded.ledger.revision } }
    })
  })

  it('distinguishes unchanged absence, changed storage, and lost lock ownership', async () => {
    const redis = new FakeWalletLedgerRedis()
    redis.values.set(getWalletLedgerLockKey(WALLET_HASH), 'worker-a')

    await expect(
      verifyWalletLedgerSnapshotUnderLock({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-a' },
        expectedRevision: null,
        expectedEncodedBytes: null
      })
    ).resolves.toEqual({ status: 'unchanged', marker: { status: 'missing' } })

    const encoded = encodeWalletLedgerPayload(createPayload(2))
    redis.values.set(getWalletLedgerKey(WALLET_HASH), encoded.value)
    await expect(
      verifyWalletLedgerSnapshotUnderLock({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-a' },
        expectedRevision: null,
        expectedEncodedBytes: null
      })
    ).resolves.toEqual({ status: 'changed' })
    await expect(
      verifyWalletLedgerSnapshotUnderLock({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-b' },
        expectedRevision: encoded.ledger.revision,
        expectedEncodedBytes: encoded.ledger.encodedBytes
      })
    ).resolves.toEqual({ status: 'lock_lost' })
  })

  it('can atomically release the owned lock after committing the complete value', async () => {
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
        releaseLockOnSuccess: true
      })
    ).resolves.toEqual({ status: 'ok' })

    expect(redis.values.get(getWalletLedgerKey(WALLET_HASH))).toBe(encoded.value)
    expect(redis.values.has(getWalletLedgerCheckedMarkerKey(WALLET_HASH))).toBe(true)
    expect(redis.values.has(getWalletLedgerLockKey(WALLET_HASH))).toBe(false)
    await expect(releaseWalletLedgerLock({ redis, walletHash: WALLET_HASH, lock: acquired.lock })).resolves.toEqual({
      status: 'lock_lost'
    })
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
        value: next.value,
        releaseLockOnSuccess: true
      })
    ).resolves.toEqual({ status: 'lock_lost' })
    expect(redis.values.get(getWalletLedgerKey(WALLET_HASH))).toBe(previous.value)
    expect(redis.values.get(getWalletLedgerLockKey(WALLET_HASH))).toBe('worker-b')
  })

  it('atomically advances cache metadata while retaining dates before the dirty boundary', async () => {
    const redis = new FakeWalletLedgerRedis()
    const previous = encodeWalletLedgerPayload(createPayload(2))
    const next = encodeWalletLedgerPayload(createPayload(3))
    const cacheKey = `${getWalletLedgerKey(WALLET_HASH)}:daily-usd:v1:all`
    redis.values.set(getWalletLedgerKey(WALLET_HASH), previous.value)
    redis.hashes.set(
      cacheKey,
      new Map([
        ['__meta', 'previous-meta'],
        ['2026-08-01', '10'],
        ['2026-08-02', '20'],
        ['2026-08-03', '30']
      ])
    )
    const acquired = await acquireWalletLedgerLock({
      redis,
      walletHash: WALLET_HASH,
      token: 'worker-a',
      ttlMs: 300_000
    })
    if (acquired.status !== 'acquired') {
      throw new Error('Expected wallet lock')
    }
    const transition = {
      key: cacheKey,
      previousMeta: 'previous-meta',
      currentMeta: 'current-meta',
      dirtyFromDate: '2026-08-02',
      reset: false,
      ttlSeconds: 2_592_000
    } as const

    await expect(
      commitStoredWalletLedger({
        redis,
        walletHash: WALLET_HASH,
        lock: acquired.lock,
        value: next.value,
        cacheTransitions: [transition]
      })
    ).resolves.toEqual({ status: 'ok' })
    expect(redis.values.get(getWalletLedgerKey(WALLET_HASH))).toBe(next.value)
    expect(Object.fromEntries(redis.hashes.get(cacheKey) ?? [])).toEqual({
      __meta: 'current-meta',
      '2026-08-01': '10'
    })

    await expect(
      commitStoredWalletLedger({
        redis,
        walletHash: WALLET_HASH,
        lock: acquired.lock,
        value: next.value,
        cacheTransitions: [transition]
      })
    ).resolves.toEqual({ status: 'ok' })
    expect(Object.fromEntries(redis.hashes.get(cacheKey) ?? [])).toEqual({
      __meta: 'current-meta',
      '2026-08-01': '10'
    })
    expect(redis.ttlSeconds.get(cacheKey)).toBe(2_592_000)
  })

  it('preflights and removes a wrong-type cache key before advancing the ledger value', async () => {
    const redis = new FakeWalletLedgerRedis()
    const previous = encodeWalletLedgerPayload(createPayload(2))
    const next = encodeWalletLedgerPayload(createPayload(3))
    const cacheKey = `${getWalletLedgerKey(WALLET_HASH)}:daily-usd:v1:all`
    redis.values.set(getWalletLedgerKey(WALLET_HASH), previous.value)
    redis.values.set(cacheKey, 'malformed-string-cache')
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
        value: next.value,
        cacheTransitions: [
          {
            key: cacheKey,
            previousMeta: 'previous-meta',
            currentMeta: 'current-meta',
            dirtyFromDate: '2026-08-02',
            reset: false,
            ttlSeconds: 2_592_000
          }
        ]
      })
    ).resolves.toEqual({ status: 'ok' })

    expect(redis.values.get(getWalletLedgerKey(WALLET_HASH))).toBe(next.value)
    expect(redis.values.has(cacheKey)).toBe(false)
    expect(redis.hashes.has(cacheKey)).toBe(false)
    const script = redis.lastCommitScript ?? ''
    expect(script.indexOf("redis.call('TYPE', KEYS[keyIndex])")).toBeGreaterThan(-1)
    expect(script.indexOf("redis.call('TYPE', KEYS[keyIndex])")).toBeLessThan(
      script.indexOf("redis.call('SET', KEYS[2]")
    )
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
    expect(redis.ttls.get(getWalletLedgerCheckedMarkerKey(WALLET_HASH))).toBe(86_400_000)
  })

  it('updates only the checked marker when the lock and exact ledger revision still match', async () => {
    const redis = new FakeWalletLedgerRedis()
    const encoded = encodeWalletLedgerPayload(createPayload(2))
    redis.values.set(getWalletLedgerKey(WALLET_HASH), encoded.value)
    redis.values.set(getWalletLedgerLockKey(WALLET_HASH), 'worker-a')

    await expect(
      commitWalletLedgerCheckedMarker({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-a' },
        ledger: encoded.ledger,
        checkedAtMs: 10,
        effectiveReconciledAtMs: 1,
        coveredAtMs: 2,
        coverage: encoded.ledger.coverage
      })
    ).resolves.toEqual({ status: 'ok' })
    expect(redis.values.get(getWalletLedgerKey(WALLET_HASH))).toBe(encoded.value)
    await expect(readWalletLedgerCheckedMarker({ redis, walletHash: WALLET_HASH })).resolves.toMatchObject({
      status: 'ready',
      marker: {
        schemaVersion: WALLET_LEDGER_CHECKED_MARKER_SCHEMA_VERSION,
        revision: encoded.ledger.revision,
        eventRevision: encoded.ledger.eventRevision,
        calculationVersion: encoded.ledger.calculationVersion,
        sourceGeneration: encoded.ledger.sourceGeneration,
        appliedInvalidationSequence: encoded.ledger.appliedInvalidationSequence,
        updatedAtMs: encoded.ledger.updatedAtMs,
        coveredAtMs: 2,
        eventCount: 0,
        hasActivity: false,
        encodedBytes: encoded.ledger.encodedBytes,
        decodedBytes: encoded.ledger.decodedBytes,
        checkedAtMs: 10,
        reconciledAtMs: 1,
        coverage: encoded.ledger.coverage
      }
    })
    await expect(readVerifiedWalletLedgerHeader({ redis, walletHash: WALLET_HASH })).resolves.toMatchObject({
      status: 'ready',
      header: { revision: encoded.ledger.revision, eventRevision: encoded.ledger.eventRevision }
    })
  })

  it('fails the lightweight header read closed when the exact ledger revision no longer matches', async () => {
    const redis = new FakeWalletLedgerRedis()
    const previous = encodeWalletLedgerPayload(createPayload(2))
    const current = encodeWalletLedgerPayload(createPayload(3))
    redis.values.set(getWalletLedgerKey(WALLET_HASH), previous.value)
    redis.values.set(getWalletLedgerLockKey(WALLET_HASH), 'worker-a')
    await commitWalletLedgerCheckedMarker({
      redis,
      walletHash: WALLET_HASH,
      lock: { token: 'worker-a' },
      ledger: previous.ledger,
      checkedAtMs: 10,
      effectiveReconciledAtMs: 1,
      coveredAtMs: 2,
      coverage: previous.ledger.coverage
    })
    redis.values.set(getWalletLedgerKey(WALLET_HASH), current.value)

    await expect(readVerifiedWalletLedgerHeader({ redis, walletHash: WALLET_HASH })).resolves.toEqual({
      status: 'ledger_changed'
    })
    redis.values.set(getWalletLedgerKey(WALLET_HASH), previous.value.slice(0, -8))
    await expect(readVerifiedWalletLedgerHeader({ redis, walletHash: WALLET_HASH })).resolves.toEqual({
      status: 'ledger_changed'
    })
    redis.values.set(getWalletLedgerCheckedMarkerKey(WALLET_HASH), 'not-json')
    await expect(readVerifiedWalletLedgerHeader({ redis, walletHash: WALLET_HASH })).resolves.toEqual({
      status: 'corrupt'
    })
  })

  it('rejects marker refresh and locked snapshot reuse when the stored value is truncated', async () => {
    const redis = new FakeWalletLedgerRedis()
    const encoded = encodeWalletLedgerPayload(createPayload(2))
    redis.values.set(getWalletLedgerKey(WALLET_HASH), encoded.value.slice(0, -8))
    redis.values.set(getWalletLedgerLockKey(WALLET_HASH), 'worker-a')

    await expect(
      commitWalletLedgerCheckedMarker({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-a' },
        ledger: encoded.ledger,
        checkedAtMs: 10,
        effectiveReconciledAtMs: 1,
        coveredAtMs: 2,
        coverage: encoded.ledger.coverage
      })
    ).resolves.toEqual({ status: 'ledger_changed' })
    await expect(
      verifyWalletLedgerSnapshotUnderLock({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-a' },
        expectedRevision: encoded.ledger.revision,
        expectedEncodedBytes: encoded.ledger.encodedBytes
      })
    ).resolves.toEqual({ status: 'changed' })
  })

  it('can atomically release the owned lock after committing only the checked marker', async () => {
    const redis = new FakeWalletLedgerRedis()
    const encoded = encodeWalletLedgerPayload(createPayload(2))
    redis.values.set(getWalletLedgerKey(WALLET_HASH), encoded.value)
    redis.values.set(getWalletLedgerLockKey(WALLET_HASH), 'worker-a')

    await expect(
      commitWalletLedgerCheckedMarker({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-a' },
        ledger: encoded.ledger,
        checkedAtMs: 10,
        effectiveReconciledAtMs: 1,
        coveredAtMs: 2,
        coverage: encoded.ledger.coverage,
        releaseLockOnSuccess: true
      })
    ).resolves.toEqual({ status: 'ok' })

    expect(redis.values.has(getWalletLedgerCheckedMarkerKey(WALLET_HASH))).toBe(true)
    expect(redis.values.has(getWalletLedgerLockKey(WALLET_HASH))).toBe(false)
  })

  it('rejects a checked-marker CAS after the stored ledger revision changes', async () => {
    const redis = new FakeWalletLedgerRedis()
    const previous = encodeWalletLedgerPayload(createPayload(2))
    const current = encodeWalletLedgerPayload(createPayload(3))
    redis.values.set(getWalletLedgerKey(WALLET_HASH), current.value)
    redis.values.set(getWalletLedgerLockKey(WALLET_HASH), 'worker-a')

    await expect(
      commitWalletLedgerCheckedMarker({
        redis,
        walletHash: WALLET_HASH,
        lock: { token: 'worker-a' },
        ledger: previous.ledger,
        checkedAtMs: 10,
        effectiveReconciledAtMs: 1,
        coveredAtMs: 2,
        coverage: previous.ledger.coverage,
        releaseLockOnSuccess: true
      })
    ).resolves.toEqual({ status: 'ledger_changed' })
    expect(redis.values.has(getWalletLedgerCheckedMarkerKey(WALLET_HASH))).toBe(false)
    expect(redis.values.get(getWalletLedgerLockKey(WALLET_HASH))).toBe('worker-a')
  })

  it('classifies malformed stored data as corrupt without changing it', async () => {
    const redis = new FakeWalletLedgerRedis()
    redis.values.set(getWalletLedgerKey(WALLET_HASH), 'not-a-wallet-ledger')

    await expect(readStoredWalletLedger({ redis, walletHash: WALLET_HASH })).resolves.toEqual({ status: 'corrupt' })
    expect(redis.values.get(getWalletLedgerKey(WALLET_HASH))).toBe('not-a-wallet-ledger')
  })

  it('classifies malformed checked-marker data as corrupt without changing it', async () => {
    const redis = new FakeWalletLedgerRedis()
    redis.values.set(getWalletLedgerCheckedMarkerKey(WALLET_HASH), '{"schemaVersion":1}')

    await expect(readWalletLedgerCheckedMarker({ redis, walletHash: WALLET_HASH })).resolves.toEqual({
      status: 'corrupt'
    })
    expect(redis.values.get(getWalletLedgerCheckedMarkerKey(WALLET_HASH))).toBe('{"schemaVersion":1}')
  })
})
