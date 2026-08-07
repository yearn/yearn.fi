import { describe, expect, it } from 'vitest'
import {
  acquireLedgerLock,
  getLedgerLockToken,
  releaseLedgerLock,
  renewLedgerLock,
  type TLedgerScriptRedis
} from '@/server/lib/holdings/services/ledger/lock'

const WALLET_HASH = 'a'.repeat(64)
const LOCK_KEY = `holdings:ledger:v1:{${WALLET_HASH}}:lock`
const FENCE_KEY = `holdings:ledger:v1:{${WALLET_HASH}}:fence`

class FakeLedgerLockRedis implements TLedgerScriptRedis {
  readonly values = new Map<string, string>()
  readonly ttls = new Map<string, number>()

  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData> {
    const result = script.includes('holdings-ledger-lock-acquire-v1')
      ? this.acquire(keys, args)
      : script.includes('holdings-ledger-lock-renew-v1')
        ? this.renew(keys, args)
        : script.includes('holdings-ledger-lock-release-v1')
          ? this.release(keys, args)
          : -1

    return Promise.resolve(result as TData)
  }

  private acquire(keys: string[], args: unknown[]): number {
    const lockKey = keys[0] ?? ''
    const fenceKey = keys[1] ?? ''
    const owner = String(args[0])
    const existing = this.values.get(lockKey)

    if (existing) {
      const ownerPrefix = `${owner}:`
      if (existing.startsWith(ownerPrefix)) {
        this.ttls.set(lockKey, Number(args[1]))
        return Number(existing.slice(ownerPrefix.length))
      }
      return 0
    }

    const fence = Number(this.values.get(fenceKey) ?? '0') + 1
    this.values.set(fenceKey, String(fence))
    this.values.set(lockKey, `${owner}:${fence}`)
    this.ttls.set(lockKey, Number(args[1]))
    return fence
  }

  private renew(keys: string[], args: unknown[]): number {
    const lockKey = keys[0] ?? ''
    const token = String(args[0])

    if (this.values.get(lockKey) !== token) {
      return 0
    }

    this.ttls.set(lockKey, Number(args[1]))
    return 1
  }

  private release(keys: string[], args: unknown[]): number {
    const lockKey = keys[0] ?? ''

    if (this.values.get(lockKey) !== String(args[0])) {
      return 0
    }

    this.values.delete(lockKey)
    this.ttls.delete(lockKey)
    return 1
  }
}

describe('ledger lock', () => {
  it('atomically acquires one owner and allocates a fencing token', async () => {
    const redis = new FakeLedgerLockRedis()
    const first = await acquireLedgerLock({
      redis,
      lockKey: LOCK_KEY,
      fenceKey: FENCE_KEY,
      owner: 'worker-a',
      ttlMs: 10_000
    })
    const contended = await acquireLedgerLock({
      redis,
      lockKey: LOCK_KEY,
      fenceKey: FENCE_KEY,
      owner: 'worker-b',
      ttlMs: 10_000
    })

    expect(first).toEqual({ status: 'acquired', lock: { owner: 'worker-a', fence: 1 } })
    expect(contended).toEqual({ status: 'busy' })
    expect(redis.values.get(LOCK_KEY)).toBe('worker-a:1')
    expect(redis.values.get(FENCE_KEY)).toBe('1')
    expect(redis.ttls.get(LOCK_KEY)).toBe(10_000)
  })

  it('makes a retried acquire idempotent for the same attempt owner', async () => {
    const redis = new FakeLedgerLockRedis()
    const first = await acquireLedgerLock({
      redis,
      lockKey: LOCK_KEY,
      fenceKey: FENCE_KEY,
      owner: 'worker-attempt-a',
      ttlMs: 10_000
    })
    const retried = await acquireLedgerLock({
      redis,
      lockKey: LOCK_KEY,
      fenceKey: FENCE_KEY,
      owner: 'worker-attempt-a',
      ttlMs: 20_000
    })

    expect(retried).toEqual(first)
    expect(redis.values.get(FENCE_KEY)).toBe('1')
    expect(redis.ttls.get(LOCK_KEY)).toBe(20_000)
  })

  it('renews and releases only the exact owner and fence token', async () => {
    const redis = new FakeLedgerLockRedis()
    const acquired = await acquireLedgerLock({
      redis,
      lockKey: LOCK_KEY,
      fenceKey: FENCE_KEY,
      owner: 'worker-a',
      ttlMs: 10_000
    })
    const lock = acquired.status === 'acquired' ? acquired.lock : { owner: 'unexpected', fence: 999 }
    const staleLock = { owner: lock.owner, fence: lock.fence + 1 }

    expect(await renewLedgerLock({ redis, lockKey: LOCK_KEY, lock: staleLock, ttlMs: 20_000 })).toEqual({
      status: 'lock_lost'
    })
    expect(await releaseLedgerLock({ redis, lockKey: LOCK_KEY, lock: staleLock })).toEqual({
      status: 'lock_lost'
    })
    expect(await renewLedgerLock({ redis, lockKey: LOCK_KEY, lock, ttlMs: 20_000 })).toEqual({
      status: 'renewed'
    })
    expect(redis.ttls.get(LOCK_KEY)).toBe(20_000)
    expect(await releaseLedgerLock({ redis, lockKey: LOCK_KEY, lock })).toEqual({ status: 'released' })
    expect(redis.values.has(LOCK_KEY)).toBe(false)
  })

  it('rejects a stale worker after a later owner receives a higher fence', async () => {
    const redis = new FakeLedgerLockRedis()
    const first = await acquireLedgerLock({
      redis,
      lockKey: LOCK_KEY,
      fenceKey: FENCE_KEY,
      owner: 'worker-a',
      ttlMs: 10_000
    })
    const firstLock = first.status === 'acquired' ? first.lock : { owner: 'unexpected', fence: 999 }
    await releaseLedgerLock({ redis, lockKey: LOCK_KEY, lock: firstLock })
    const second = await acquireLedgerLock({
      redis,
      lockKey: LOCK_KEY,
      fenceKey: FENCE_KEY,
      owner: 'worker-b',
      ttlMs: 10_000
    })

    expect(second).toEqual({ status: 'acquired', lock: { owner: 'worker-b', fence: 2 } })
    expect(await renewLedgerLock({ redis, lockKey: LOCK_KEY, lock: firstLock, ttlMs: 10_000 })).toEqual({
      status: 'lock_lost'
    })
    expect(await releaseLedgerLock({ redis, lockKey: LOCK_KEY, lock: firstLock })).toEqual({
      status: 'lock_lost'
    })
    expect(getLedgerLockToken(firstLock)).toBe('worker-a:1')
  })

  it('rejects non-integer Redis script responses', async () => {
    const redis = {
      eval: () => Promise.resolve(null)
    } as unknown as TLedgerScriptRedis

    await expect(
      acquireLedgerLock({ redis, lockKey: LOCK_KEY, fenceKey: FENCE_KEY, owner: 'worker-a', ttlMs: 10_000 })
    ).rejects.toThrow('Ledger lock acquire script returned an invalid integer')
  })

  it('rejects in-scope keys that are not the canonical lock and fence roles', async () => {
    const redis = new FakeLedgerLockRedis()

    await expect(
      acquireLedgerLock({
        redis,
        lockKey: `${LOCK_KEY}:unexpected`,
        fenceKey: FENCE_KEY,
        owner: 'worker-a',
        ttlMs: 10_000
      })
    ).rejects.toThrow(/canonical wallet lock and fence keys/i)
    expect(redis.values.size).toBe(0)
  })
})
