import { getAddress } from 'viem'
import { executeHoldingsLedgerRedisOperation } from '@/server/lib/holdings/storage/ledgerRedis'

const KEY_NAMESPACE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const WALLET_LEDGER_INVALIDATION_KEY_PREFIX = 'holdings:wallet-ledger-invalidations:v1'
export const WALLET_LEDGER_MAX_PENDING_INVALIDATIONS = 256

export interface TWalletLedgerInvalidationVault {
  readonly chainId: number
  readonly address: string
  readonly fromBlock: number
}

export interface TWalletLedgerInvalidationRecord {
  readonly schemaVersion: 1
  readonly createdAtMs: number
  readonly vaults: readonly TWalletLedgerInvalidationVault[]
}

export interface TWalletLedgerInvalidationRedis {
  llen(key: string): Promise<number>
  lrange<TData>(key: string, start: number, end: number): Promise<TData[]>
  rpush<TData>(key: string, ...elements: TData[]): Promise<number>
}

export type TPendingWalletLedgerInvalidations =
  | {
      readonly status: 'ready'
      readonly headSequence: number
      readonly records: readonly TWalletLedgerInvalidationRecord[]
    }
  | { readonly status: 'gap'; readonly headSequence: number }

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

export function getWalletLedgerInvalidationLogKey(): string {
  return `${WALLET_LEDGER_INVALIDATION_KEY_PREFIX}${getNamespaceSegment()}`
}

function assertSafeInteger(value: unknown, label: string, minimum = 0): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function normalizeVault(value: TWalletLedgerInvalidationVault): TWalletLedgerInvalidationVault {
  assertSafeInteger(value.chainId, 'Wallet ledger invalidation chain id', 1)
  assertSafeInteger(value.fromBlock, 'Wallet ledger invalidation start block')
  return {
    chainId: value.chainId,
    address: getAddress(value.address).toLowerCase(),
    fromBlock: value.fromBlock
  }
}

function normalizeVaults(vaults: readonly TWalletLedgerInvalidationVault[]): readonly TWalletLedgerInvalidationVault[] {
  if (vaults.length === 0) {
    throw new Error('Wallet ledger invalidation must contain at least one vault')
  }
  return Array.from(
    vaults
      .reduce((byIdentity, candidate) => {
        const vault = normalizeVault(candidate)
        const identity = `${vault.chainId}:${vault.address}`
        const existing = byIdentity.get(identity)
        byIdentity.set(
          identity,
          existing ? { ...vault, fromBlock: Math.min(existing.fromBlock, vault.fromBlock) } : vault
        )
        return byIdentity
      }, new Map<string, TWalletLedgerInvalidationVault>())
      .values()
  ).toSorted((left, right) => left.chainId - right.chainId || left.address.localeCompare(right.address))
}

function parseRecord(value: unknown): TWalletLedgerInvalidationRecord {
  const parsed = (() => {
    if (typeof value !== 'string') {
      return value
    }
    try {
      return JSON.parse(value) as unknown
    } catch {
      throw new Error('Wallet ledger invalidation record is invalid')
    }
  })()
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Wallet ledger invalidation record is invalid')
  }
  const record = parsed as Partial<TWalletLedgerInvalidationRecord>
  if (record.schemaVersion !== 1 || !Array.isArray(record.vaults)) {
    throw new Error('Wallet ledger invalidation record is invalid')
  }
  assertSafeInteger(record.createdAtMs, 'Wallet ledger invalidation timestamp')
  return {
    schemaVersion: 1,
    createdAtMs: record.createdAtMs,
    vaults: normalizeVaults(record.vaults)
  }
}

export async function appendWalletLedgerInvalidation(args: {
  readonly redis: Pick<TWalletLedgerInvalidationRedis, 'rpush'>
  readonly vaults: readonly TWalletLedgerInvalidationVault[]
  readonly createdAtMs?: number
}): Promise<number> {
  const createdAtMs = args.createdAtMs ?? Date.now()
  assertSafeInteger(createdAtMs, 'Wallet ledger invalidation timestamp')
  const record: TWalletLedgerInvalidationRecord = {
    schemaVersion: 1,
    createdAtMs,
    vaults: normalizeVaults(args.vaults)
  }
  return executeHoldingsLedgerRedisOperation('write', () =>
    args.redis.rpush(getWalletLedgerInvalidationLogKey(), JSON.stringify(record))
  )
}

export async function readWalletLedgerInvalidationHead(args: {
  readonly redis: Pick<TWalletLedgerInvalidationRedis, 'llen'>
}): Promise<number> {
  const head = await executeHoldingsLedgerRedisOperation('read', () =>
    args.redis.llen(getWalletLedgerInvalidationLogKey())
  )
  assertSafeInteger(head, 'Wallet ledger invalidation head')
  return head
}

export async function readPendingWalletLedgerInvalidations(args: {
  readonly redis: Pick<TWalletLedgerInvalidationRedis, 'llen' | 'lrange'>
  readonly appliedSequence: number
}): Promise<TPendingWalletLedgerInvalidations> {
  assertSafeInteger(args.appliedSequence, 'Wallet ledger applied invalidation sequence')
  const headSequence = await readWalletLedgerInvalidationHead({ redis: args.redis })
  if (args.appliedSequence > headSequence) {
    return { status: 'gap', headSequence }
  }
  if (args.appliedSequence === headSequence) {
    return { status: 'ready', headSequence, records: [] }
  }
  const pendingCount = headSequence - args.appliedSequence
  if (pendingCount > WALLET_LEDGER_MAX_PENDING_INVALIDATIONS) {
    return { status: 'gap', headSequence }
  }
  const values = await executeHoldingsLedgerRedisOperation('read', () =>
    args.redis.lrange<unknown>(getWalletLedgerInvalidationLogKey(), args.appliedSequence, headSequence - 1)
  )
  if (values.length !== pendingCount) {
    return { status: 'gap', headSequence }
  }
  try {
    return { status: 'ready', headSequence, records: values.map(parseRecord) }
  } catch {
    return { status: 'gap', headSequence }
  }
}

export function groupWalletLedgerInvalidationVaults(
  records: readonly TWalletLedgerInvalidationRecord[]
): ReadonlyMap<number, { readonly lowerBlock: number; readonly vaultAddresses: readonly string[] }> {
  return records
    .flatMap(({ vaults }) => vaults)
    .reduce((byChain, vault) => {
      const existing = byChain.get(vault.chainId)
      byChain.set(vault.chainId, {
        lowerBlock: Math.min(existing?.lowerBlock ?? vault.fromBlock, vault.fromBlock),
        vaultAddresses: Array.from(new Set([...(existing?.vaultAddresses ?? []), getAddress(vault.address)])).toSorted()
      })
      return byChain
    }, new Map<number, { readonly lowerBlock: number; readonly vaultAddresses: readonly string[] }>())
}
