import { assertLedgerKeysShareWalletScope } from '@/server/lib/holdings/services/ledger/keyScope'
import { getLedgerFenceKey, getLedgerLockKey } from '@/server/lib/holdings/services/ledger/keys'
import { executeHoldingsLedgerRedisOperation } from '@/server/lib/holdings/storage/ledgerRedis'

export interface TLedgerScriptRedis {
  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData>
}

export interface TLedgerLock {
  owner: string
  fence: number
}

export type TAcquireLedgerLockResult = { status: 'acquired'; lock: TLedgerLock } | { status: 'busy' }

export type TRenewLedgerLockResult = { status: 'renewed' } | { status: 'lock_lost' }

export type TReleaseLedgerLockResult = { status: 'released' } | { status: 'lock_lost' }

const ACQUIRE_LEDGER_LOCK_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-ledger-lock-acquire-v1
local current = redis.call('GET', KEYS[1])
if current then
  local ownerPrefix = ARGV[1] .. ':'
  if string.sub(current, 1, string.len(ownerPrefix)) == ownerPrefix then
    local existingFence = tonumber(string.sub(current, string.len(ownerPrefix) + 1))
    if existingFence then
      redis.call('PEXPIRE', KEYS[1], ARGV[2])
      return existingFence
    end
  end
  return 0
end

local fence = redis.call('INCR', KEYS[2])
local token = ARGV[1] .. ':' .. tostring(fence)
local stored = redis.call('SET', KEYS[1], token, 'PX', ARGV[2], 'NX')

if not stored then
  return 0
end

return fence
`

const RENEW_LEDGER_LOCK_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-ledger-lock-renew-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end

return redis.call('PEXPIRE', KEYS[1], ARGV[2])
`

const RELEASE_LEDGER_LOCK_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-ledger-lock-release-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end

return redis.call('DEL', KEYS[1])
`

function assertNonEmpty(value: string, label: string): void {
  if (value.length === 0) {
    throw new Error(`${label} must not be empty`)
  }
}

function assertOwner(owner: string): void {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(owner)) {
    throw new Error('Ledger lock owner must be a bounded opaque identifier')
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`)
  }
}

function parseScriptInteger(value: unknown, label: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)
        ? Number(value)
        : Number.NaN

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} returned an invalid integer`)
  }

  return parsed
}

export function getLedgerLockToken(lock: TLedgerLock): string {
  assertOwner(lock.owner)
  assertPositiveSafeInteger(lock.fence, 'Ledger lock fence')
  return `${lock.owner}:${lock.fence}`
}

export async function acquireLedgerLock(args: {
  redis: TLedgerScriptRedis
  lockKey: string
  fenceKey: string
  owner: string
  ttlMs: number
}): Promise<TAcquireLedgerLockResult> {
  assertNonEmpty(args.lockKey, 'Ledger lock key')
  assertNonEmpty(args.fenceKey, 'Ledger fence key')
  const walletHash = assertLedgerKeysShareWalletScope([args.lockKey, args.fenceKey])
  assertOwner(args.owner)
  assertPositiveSafeInteger(args.ttlMs, 'Ledger lock TTL')

  if (args.lockKey === args.fenceKey) {
    throw new Error('Ledger lock and fence keys must be distinct')
  }
  if (args.lockKey !== getLedgerLockKey(walletHash) || args.fenceKey !== getLedgerFenceKey(walletHash)) {
    throw new Error('Ledger lock acquisition requires the canonical wallet lock and fence keys')
  }

  const rawFence = await executeHoldingsLedgerRedisOperation('lock', () =>
    args.redis.eval<string[], unknown>(
      ACQUIRE_LEDGER_LOCK_SCRIPT,
      [args.lockKey, args.fenceKey],
      [args.owner, String(args.ttlMs)]
    )
  )
  const fence = parseScriptInteger(rawFence, 'Ledger lock acquire script')

  return fence === 0 ? { status: 'busy' } : { status: 'acquired', lock: { owner: args.owner, fence } }
}

export async function renewLedgerLock(args: {
  redis: TLedgerScriptRedis
  lockKey: string
  lock: TLedgerLock
  ttlMs: number
}): Promise<TRenewLedgerLockResult> {
  assertNonEmpty(args.lockKey, 'Ledger lock key')
  const walletHash = assertLedgerKeysShareWalletScope([args.lockKey])
  if (args.lockKey !== getLedgerLockKey(walletHash)) {
    throw new Error('Ledger lock renewal requires the canonical wallet lock key')
  }
  assertPositiveSafeInteger(args.ttlMs, 'Ledger lock TTL')

  const renewed = parseScriptInteger(
    await executeHoldingsLedgerRedisOperation('lock', () =>
      args.redis.eval<string[], unknown>(
        RENEW_LEDGER_LOCK_SCRIPT,
        [args.lockKey],
        [getLedgerLockToken(args.lock), String(args.ttlMs)]
      )
    ),
    'Ledger lock renew script'
  )

  return renewed === 1 ? { status: 'renewed' } : { status: 'lock_lost' }
}

export async function releaseLedgerLock(args: {
  redis: TLedgerScriptRedis
  lockKey: string
  lock: TLedgerLock
}): Promise<TReleaseLedgerLockResult> {
  assertNonEmpty(args.lockKey, 'Ledger lock key')
  const walletHash = assertLedgerKeysShareWalletScope([args.lockKey])
  if (args.lockKey !== getLedgerLockKey(walletHash)) {
    throw new Error('Ledger lock release requires the canonical wallet lock key')
  }

  const released = parseScriptInteger(
    await executeHoldingsLedgerRedisOperation('lock', () =>
      args.redis.eval<string[], unknown>(RELEASE_LEDGER_LOCK_SCRIPT, [args.lockKey], [getLedgerLockToken(args.lock)])
    ),
    'Ledger lock release script'
  )

  return released === 1 ? { status: 'released' } : { status: 'lock_lost' }
}
