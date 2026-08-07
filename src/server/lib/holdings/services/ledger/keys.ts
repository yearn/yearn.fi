import { createHash } from 'node:crypto'
import { LEDGER_INDEX_SHARD_COUNT, LEDGER_SCHEMA_VERSION } from '@/server/lib/holdings/services/ledger/types'

const LEDGER_KEY_PREFIX = `holdings:ledger:v${LEDGER_SCHEMA_VERSION}`
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const EVM_WALLET_ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/
const KEY_NAMESPACE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function assertWalletHash(walletHash: string): void {
  if (!SHA256_PATTERN.test(walletHash)) {
    throw new Error('Ledger wallet hash must be a lowercase SHA-256 digest')
  }
}

function assertContentChecksum(checksum: string): void {
  if (!SHA256_PATTERN.test(checksum)) {
    throw new Error('Ledger content checksum must be a lowercase SHA-256 digest')
  }
}

function assertKeyId(value: string, label: string): void {
  if (!KEY_ID_PATTERN.test(value)) {
    throw new Error(`${label} contains unsupported key characters`)
  }
}

function assertSourceGeneration(sourceGeneration: number): void {
  if (!Number.isSafeInteger(sourceGeneration) || sourceGeneration < 0) {
    throw new Error('Ledger source generation must be a non-negative safe integer')
  }
}

function assertIndexShard(shard: number): void {
  if (!Number.isSafeInteger(shard) || shard < 0 || shard >= LEDGER_INDEX_SHARD_COUNT) {
    throw new Error(`Ledger index shard must be between 0 and ${LEDGER_INDEX_SHARD_COUNT - 1}`)
  }
}

function getLedgerKeyNamespaceSegment(): string {
  const namespace = process.env.HOLDINGS_LEDGER_KEY_NAMESPACE
  if (namespace === undefined || namespace === '') {
    return ''
  }
  if (!KEY_NAMESPACE_PATTERN.test(namespace)) {
    throw new Error('Ledger key namespace must contain 1-64 ASCII letters, digits, underscores, or hyphens')
  }
  return `:namespace:${namespace}`
}

function getWalletKeyPrefix(walletHash: string): string {
  assertWalletHash(walletHash)
  return `${LEDGER_KEY_PREFIX}:{${walletHash}}${getLedgerKeyNamespaceSegment()}`
}

export function hashLedgerWalletAddress(walletAddress: string): string {
  const normalizedAddress = walletAddress.trim().toLowerCase()
  if (!EVM_WALLET_ADDRESS_PATTERN.test(normalizedAddress)) {
    throw new Error('Ledger wallet address must be a 20-byte 0x-prefixed hexadecimal value')
  }
  return createHash('sha256').update(normalizedAddress).digest('hex')
}

export function getLedgerHeadKey(walletHash: string): string {
  return `${getWalletKeyPrefix(walletHash)}:head`
}

export function getLedgerPreviousHeadKey(walletHash: string): string {
  return `${getWalletKeyPrefix(walletHash)}:head:previous`
}

export function getLedgerRevisionManifestKey(walletHash: string, sourceGeneration: number, revision: string): string {
  assertSourceGeneration(sourceGeneration)
  assertKeyId(revision, 'Ledger revision')
  return `${getWalletKeyPrefix(walletHash)}:manifest:${sourceGeneration}:${revision}`
}

export function getLedgerChunkKey(walletHash: string, checksum: string): string {
  assertContentChecksum(checksum)
  return `${getWalletKeyPrefix(walletHash)}:chunk:${checksum}`
}

export function getLedgerIndexShardKey(walletHash: string, shard: number, checksum: string): string {
  assertIndexShard(shard)
  assertContentChecksum(checksum)
  return `${getWalletKeyPrefix(walletHash)}:index:${shard.toString(16).padStart(2, '0')}:${checksum}`
}

export function getLedgerLockKey(walletHash: string): string {
  return `${getWalletKeyPrefix(walletHash)}:lock`
}

export function getLedgerFenceKey(walletHash: string): string {
  return `${getWalletKeyPrefix(walletHash)}:fence`
}

export function getLedgerSyncStatusKey(walletHash: string): string {
  return `${getWalletKeyPrefix(walletHash)}:sync-status`
}

export function getLedgerSnapshotKey(walletHash: string, snapshotId: string): string {
  assertKeyId(snapshotId, 'Ledger snapshot id')
  return `${getWalletKeyPrefix(walletHash)}:snapshot:${snapshotId}`
}
