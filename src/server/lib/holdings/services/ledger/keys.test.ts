import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLedgerChunkKey,
  getLedgerFenceKey,
  getLedgerHeadKey,
  getLedgerIndexShardKey,
  getLedgerLockKey,
  getLedgerPreviousHeadKey,
  getLedgerRevisionManifestKey,
  getLedgerSnapshotKey,
  getLedgerSyncStatusKey,
  hashLedgerWalletAddress
} from '@/server/lib/holdings/services/ledger/keys'
import { LEDGER_INDEX_SHARD_COUNT } from '@/server/lib/holdings/services/ledger/types'

const WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'
const WALLET_HASH = hashLedgerWalletAddress(WALLET_ADDRESS)
const CHECKSUM = 'a'.repeat(64)

describe('portfolio ledger Redis keys', () => {
  beforeEach(() => {
    vi.stubEnv('HOLDINGS_LEDGER_KEY_NAMESPACE', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('hashes wallet identities case-insensitively without exposing the input', () => {
    expect(WALLET_HASH).toMatch(/^[a-f0-9]{64}$/)
    expect(hashLedgerWalletAddress('  0X1234567890ABCDEF1234567890ABCDEF12345678\n')).toBe(WALLET_HASH)
    expect(getLedgerHeadKey(WALLET_HASH)).not.toContain(WALLET_ADDRESS)
  })

  it('rejects malformed wallet addresses without including the input in the error', () => {
    const privateInvalidInput = 'wallet-private-label'
    const invalidAddresses = [
      '',
      privateInvalidInput,
      '1234567890abcdef1234567890abcdef12345678',
      '0x1234567890abcdef1234567890abcdef1234567',
      '0x1234567890abcdef1234567890abcdef123456789',
      '0x1234567890abcdef1234567890abcdef1234567g'
    ]

    invalidAddresses.forEach((address) => {
      expect(() => hashLedgerWalletAddress(address)).toThrow(
        'Ledger wallet address must be a 20-byte 0x-prefixed hexadecimal value'
      )
    })

    const capturedError = (() => {
      try {
        hashLedgerWalletAddress(privateInvalidInput)
        return null
      } catch (error) {
        return error
      }
    })()

    expect(capturedError).toBeInstanceOf(Error)
    expect((capturedError as Error).message).not.toContain(privateInvalidInput)
  })

  it('builds wallet-co-located coordination and snapshot keys', () => {
    const prefix = `holdings:ledger:v1:{${WALLET_HASH}}`

    expect(getLedgerHeadKey(WALLET_HASH)).toBe(`${prefix}:head`)
    expect(getLedgerPreviousHeadKey(WALLET_HASH)).toBe(`${prefix}:head:previous`)
    expect(getLedgerLockKey(WALLET_HASH)).toBe(`${prefix}:lock`)
    expect(getLedgerFenceKey(WALLET_HASH)).toBe(`${prefix}:fence`)
    expect(getLedgerSyncStatusKey(WALLET_HASH)).toBe(`${prefix}:sync-status`)
    expect(getLedgerSnapshotKey(WALLET_HASH, 'request_01')).toBe(`${prefix}:snapshot:request_01`)
  })

  it('isolates immutable manifests by source generation and revision', () => {
    expect(getLedgerRevisionManifestKey(WALLET_HASH, 7, 'revision_01')).toBe(
      `holdings:ledger:v1:{${WALLET_HASH}}:manifest:7:revision_01`
    )
    expect(getLedgerRevisionManifestKey(WALLET_HASH, 8, 'revision_01')).not.toBe(
      getLedgerRevisionManifestKey(WALLET_HASH, 7, 'revision_01')
    )
  })

  it('keeps data and index blobs content-addressed outside revisions', () => {
    expect(getLedgerChunkKey(WALLET_HASH, CHECKSUM)).toBe(`holdings:ledger:v1:{${WALLET_HASH}}:chunk:${CHECKSUM}`)
    expect(getLedgerIndexShardKey(WALLET_HASH, 0, CHECKSUM)).toBe(
      `holdings:ledger:v1:{${WALLET_HASH}}:index:00:${CHECKSUM}`
    )
    expect(getLedgerIndexShardKey(WALLET_HASH, LEDGER_INDEX_SHARD_COUNT - 1, CHECKSUM)).toBe(
      `holdings:ledger:v1:{${WALLET_HASH}}:index:3f:${CHECKSUM}`
    )
  })

  it('inserts a configured namespace after the wallet hash tag in every key', () => {
    vi.stubEnv('HOLDINGS_LEDGER_KEY_NAMESPACE', 'benchmark_01-test')
    const prefix = `holdings:ledger:v1:{${WALLET_HASH}}:namespace:benchmark_01-test`

    expect(getLedgerHeadKey(WALLET_HASH)).toBe(`${prefix}:head`)
    expect(getLedgerPreviousHeadKey(WALLET_HASH)).toBe(`${prefix}:head:previous`)
    expect(getLedgerLockKey(WALLET_HASH)).toBe(`${prefix}:lock`)
    expect(getLedgerFenceKey(WALLET_HASH)).toBe(`${prefix}:fence`)
    expect(getLedgerSyncStatusKey(WALLET_HASH)).toBe(`${prefix}:sync-status`)
    expect(getLedgerSnapshotKey(WALLET_HASH, 'request_01')).toBe(`${prefix}:snapshot:request_01`)
    expect(getLedgerRevisionManifestKey(WALLET_HASH, 7, 'revision_01')).toBe(`${prefix}:manifest:7:revision_01`)
    expect(getLedgerChunkKey(WALLET_HASH, CHECKSUM)).toBe(`${prefix}:chunk:${CHECKSUM}`)
    expect(getLedgerIndexShardKey(WALLET_HASH, 0, CHECKSUM)).toBe(`${prefix}:index:00:${CHECKSUM}`)
  })

  it('rejects invalid configured namespaces without exposing their values', () => {
    const privateInvalidNamespace = 'benchmark:private'
    const invalidNamespaces = [' benchmark', privateInvalidNamespace, 'benchmark.with-dot', 'a'.repeat(65)]

    invalidNamespaces.forEach((namespace) => {
      vi.stubEnv('HOLDINGS_LEDGER_KEY_NAMESPACE', namespace)
      expect(() => getLedgerHeadKey(WALLET_HASH)).toThrow(
        'Ledger key namespace must contain 1-64 ASCII letters, digits, underscores, or hyphens'
      )
    })

    vi.stubEnv('HOLDINGS_LEDGER_KEY_NAMESPACE', privateInvalidNamespace)
    const capturedError = (() => {
      try {
        getLedgerHeadKey(WALLET_HASH)
        return null
      } catch (error) {
        return error
      }
    })()
    expect(capturedError).toBeInstanceOf(Error)
    expect((capturedError as Error).message).not.toContain(privateInvalidNamespace)
  })

  it('rejects malformed hashes, generations, shards, and opaque ids', () => {
    expect(() => getLedgerHeadKey('not-a-hash')).toThrow(/wallet hash/i)
    expect(() => getLedgerRevisionManifestKey(WALLET_HASH, -1, 'revision')).toThrow(/generation/i)
    expect(() => getLedgerRevisionManifestKey(WALLET_HASH, 1, 'revision:unsafe')).toThrow(/revision/i)
    expect(() => getLedgerIndexShardKey(WALLET_HASH, LEDGER_INDEX_SHARD_COUNT, CHECKSUM)).toThrow(/shard/i)
    expect(() => getLedgerSnapshotKey(WALLET_HASH, '../unsafe')).toThrow(/snapshot/i)
  })
})
