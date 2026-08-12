import type { SetCommandOptions } from '@upstash/redis'
import { decodeWalletLedgerValue } from '@/server/lib/holdings/services/ledger/walletCodec'
import type { TWalletLedgerReadResult } from '@/server/lib/holdings/services/ledger/walletTypes'
import { executeHoldingsLedgerRedisOperation } from '@/server/lib/holdings/storage/ledgerRedis'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const KEY_NAMESPACE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const LOCK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,192}$/
const WALLET_LEDGER_KEY_PREFIX = 'holdings:wallet-ledger:v3'

const RENEW_WALLET_LEDGER_LOCK_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-lock-renew-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
return redis.call('PEXPIRE', KEYS[1], ARGV[2])
`

const RELEASE_WALLET_LEDGER_LOCK_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-lock-release-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
return redis.call('DEL', KEYS[1])
`

const COMMIT_WALLET_LEDGER_SCRIPT = `#!lua flags=allow-key-locking
-- holdings-wallet-ledger-commit-v3
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
for keyIndex = 3, #KEYS do
  local keyTypeReply = redis.call('TYPE', KEYS[keyIndex])
  local keyType = keyTypeReply
  if type(keyTypeReply) == 'table' then
    keyType = keyTypeReply['ok']
  end
  if keyType ~= 'none' and keyType ~= 'hash' then
    redis.call('DEL', KEYS[keyIndex])
  end
end
local ttl = tonumber(ARGV[3])
if ttl ~= nil and ttl > 0 then
  redis.call('SET', KEYS[2], ARGV[2], 'PX', ttl)
else
  redis.call('SET', KEYS[2], ARGV[2])
end
for keyIndex = 3, #KEYS do
  local argumentIndex = 4 + ((keyIndex - 3) * 5)
  local previousMeta = ARGV[argumentIndex]
  local currentMeta = ARGV[argumentIndex + 1]
  local dirtyFromDate = ARGV[argumentIndex + 2]
  local reset = ARGV[argumentIndex + 3]
  local cacheTtl = ARGV[argumentIndex + 4]
  local existingMeta = redis.call('HGET', KEYS[keyIndex], '__meta')
  if existingMeta ~= false then
    if existingMeta == currentMeta then
      redis.call('EXPIRE', KEYS[keyIndex], cacheTtl)
    elseif reset == '1' then
      redis.call('DEL', KEYS[keyIndex])
      redis.call('HSET', KEYS[keyIndex], '__meta', currentMeta)
      redis.call('EXPIRE', KEYS[keyIndex], cacheTtl)
    else
      if previousMeta == '' or existingMeta ~= previousMeta then
        redis.call('DEL', KEYS[keyIndex])
      elseif dirtyFromDate ~= '' then
        local fields = redis.call('HKEYS', KEYS[keyIndex])
        for _, field in ipairs(fields) do
          if string.match(field, '^%d%d%d%d%-%d%d%-%d%d$') and field >= dirtyFromDate then
            redis.call('HDEL', KEYS[keyIndex], field)
          end
        end
      end
      redis.call('HSET', KEYS[keyIndex], '__meta', currentMeta)
      redis.call('EXPIRE', KEYS[keyIndex], cacheTtl)
    end
  end
end
return 1
`

export interface TWalletLedgerRedis {
  get<TData>(key: string): Promise<TData | null>
  llen(key: string): Promise<number>
  lrange<TData>(key: string, start: number, end: number): Promise<TData[]>
  rpush<TData>(key: string, ...elements: TData[]): Promise<number>
  set<TData>(key: string, value: TData, options?: SetCommandOptions): Promise<'OK' | TData | null>
  eval<TArgs extends unknown[], TData = unknown>(script: string, keys: string[], args: TArgs): Promise<TData>
}

export interface TWalletLedgerLock {
  readonly token: string
}

export interface TWalletLedgerCacheCommitTransition {
  readonly key: string
  readonly previousMeta: string | null
  readonly currentMeta: string
  readonly dirtyFromDate: string | null
  readonly reset: boolean
  readonly ttlSeconds: number
}

export type TAcquireWalletLedgerLockResult =
  | { readonly status: 'acquired'; readonly lock: TWalletLedgerLock }
  | { readonly status: 'busy' }

export type TWalletLedgerLockOperationResult = { readonly status: 'ok' } | { readonly status: 'lock_lost' }

function assertWalletHash(walletHash: string): void {
  if (!SHA256_PATTERN.test(walletHash)) {
    throw new Error('Wallet ledger wallet hash must be a lowercase SHA-256 digest')
  }
}

function assertLockToken(token: string): void {
  if (!LOCK_TOKEN_PATTERN.test(token)) {
    throw new Error('Wallet ledger lock token must be a bounded opaque identifier')
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`)
  }
}

function getNamespaceSegment(): string {
  const namespace = process.env.HOLDINGS_LEDGER_KEY_NAMESPACE
  if (namespace === undefined || namespace === '') {
    return ''
  }
  if (!KEY_NAMESPACE_PATTERN.test(namespace)) {
    throw new Error('Wallet ledger key namespace contains unsupported characters')
  }
  return `:namespace:${namespace}`
}

function getWalletKeyPrefix(walletHash: string): string {
  assertWalletHash(walletHash)
  return `${WALLET_LEDGER_KEY_PREFIX}:{${walletHash}}${getNamespaceSegment()}`
}

function parseScriptBoolean(value: unknown, label: string): boolean {
  if (value === 1 || value === '1') {
    return true
  }
  if (value === 0 || value === '0') {
    return false
  }
  throw new Error(`${label} returned an invalid status`)
}

export function getWalletLedgerKey(walletHash: string): string {
  return getWalletKeyPrefix(walletHash)
}

export function getWalletLedgerLockKey(walletHash: string): string {
  return `${getWalletKeyPrefix(walletHash)}:lock`
}

export async function readStoredWalletLedger(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'get'>
  readonly walletHash: string
}): Promise<TWalletLedgerReadResult> {
  const value = await executeHoldingsLedgerRedisOperation('read', () =>
    args.redis.get<unknown>(getWalletLedgerKey(args.walletHash))
  )
  if (value === null) {
    return { status: 'missing' }
  }
  try {
    return {
      status: 'ready',
      ledger: decodeWalletLedgerValue(value, args.walletHash)
    }
  } catch {
    return { status: 'corrupt' }
  }
}

export async function acquireWalletLedgerLock(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'set'>
  readonly walletHash: string
  readonly token: string
  readonly ttlMs: number
}): Promise<TAcquireWalletLedgerLockResult> {
  assertLockToken(args.token)
  assertPositiveSafeInteger(args.ttlMs, 'Wallet ledger lock TTL')
  const options: SetCommandOptions = { nx: true, px: args.ttlMs }
  const result = await executeHoldingsLedgerRedisOperation('lock', () =>
    args.redis.set(getWalletLedgerLockKey(args.walletHash), args.token, options)
  )
  if (result === 'OK') {
    return { status: 'acquired', lock: { token: args.token } }
  }
  if (result === null) {
    return { status: 'busy' }
  }
  throw new Error('Wallet ledger lock acquisition returned an unexpected result')
}

export async function renewWalletLedgerLock(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly ttlMs: number
}): Promise<TWalletLedgerLockOperationResult> {
  assertLockToken(args.lock.token)
  assertPositiveSafeInteger(args.ttlMs, 'Wallet ledger lock TTL')
  const renewed = parseScriptBoolean(
    await executeHoldingsLedgerRedisOperation('lock', () =>
      args.redis.eval<string[], unknown>(
        RENEW_WALLET_LEDGER_LOCK_SCRIPT,
        [getWalletLedgerLockKey(args.walletHash)],
        [args.lock.token, String(args.ttlMs)]
      )
    ),
    'Wallet ledger lock renewal'
  )
  return renewed ? { status: 'ok' } : { status: 'lock_lost' }
}

export async function releaseWalletLedgerLock(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
}): Promise<TWalletLedgerLockOperationResult> {
  assertLockToken(args.lock.token)
  const released = parseScriptBoolean(
    await executeHoldingsLedgerRedisOperation('lock', () =>
      args.redis.eval<string[], unknown>(
        RELEASE_WALLET_LEDGER_LOCK_SCRIPT,
        [getWalletLedgerLockKey(args.walletHash)],
        [args.lock.token]
      )
    ),
    'Wallet ledger lock release'
  )
  return released ? { status: 'ok' } : { status: 'lock_lost' }
}

export async function commitStoredWalletLedger(args: {
  readonly redis: Pick<TWalletLedgerRedis, 'eval'>
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly value: string
  readonly ttlMs?: number
  readonly cacheTransitions?: readonly TWalletLedgerCacheCommitTransition[]
}): Promise<TWalletLedgerLockOperationResult> {
  assertLockToken(args.lock.token)
  if (args.ttlMs !== undefined) {
    assertPositiveSafeInteger(args.ttlMs, 'Wallet ledger value TTL')
  }
  decodeWalletLedgerValue(args.value, args.walletHash)
  const cacheTransitions = args.cacheTransitions ?? []
  cacheTransitions.forEach((transition) => {
    if (!transition.key.startsWith(`${getWalletLedgerKey(args.walletHash)}:`)) {
      throw new Error('Wallet ledger cache transition key is outside the wallet hash slot')
    }
    if (transition.currentMeta.length === 0) {
      throw new Error('Wallet ledger cache transition metadata must not be empty')
    }
    if (transition.dirtyFromDate !== null && !UTC_DATE_PATTERN.test(transition.dirtyFromDate)) {
      throw new Error('Wallet ledger cache transition dirty date is invalid')
    }
    assertPositiveSafeInteger(transition.ttlSeconds, 'Wallet ledger cache transition TTL')
  })
  const committed = parseScriptBoolean(
    await executeHoldingsLedgerRedisOperation('commit', () =>
      args.redis.eval<string[], unknown>(
        COMMIT_WALLET_LEDGER_SCRIPT,
        [
          getWalletLedgerLockKey(args.walletHash),
          getWalletLedgerKey(args.walletHash),
          ...cacheTransitions.map(({ key }) => key)
        ],
        [
          args.lock.token,
          args.value,
          String(args.ttlMs ?? 0),
          ...cacheTransitions.flatMap((transition) => [
            transition.previousMeta ?? '',
            transition.currentMeta,
            transition.dirtyFromDate ?? '',
            transition.reset ? '1' : '0',
            String(transition.ttlSeconds)
          ])
        ]
      )
    ),
    'Wallet ledger commit'
  )
  return committed ? { status: 'ok' } : { status: 'lock_lost' }
}
