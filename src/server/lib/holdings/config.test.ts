import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  holdingsConfig,
  parseHoldingsLedgerMode,
  parseHoldingsLedgerSourceRevision
} from '@/server/lib/holdings/config'

describe('holdings ledger mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults unknown and missing values to off', () => {
    expect(parseHoldingsLedgerMode(undefined)).toBe('off')
    expect(parseHoldingsLedgerMode('enabled')).toBe('off')
  })

  it('accepts the shadow and read-write modes', () => {
    expect(parseHoldingsLedgerMode(' SHADOW ')).toBe('shadow')
    expect(parseHoldingsLedgerMode('read-write')).toBe('read-write')
  })

  it('reads the mode from the environment lazily', () => {
    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'shadow')
    expect(holdingsConfig.ledgerMode).toBe('shadow')

    vi.stubEnv('HOLDINGS_LEDGER_MODE', 'read-write')
    expect(holdingsConfig.ledgerMode).toBe('read-write')
  })

  it('reads bounded incremental synchronization settings with safe defaults', () => {
    expect(holdingsConfig.ledgerOverlapBlocks).toBe(50_000)
    expect(holdingsConfig.ledgerReconcileIntervalMs).toBe(7 * 24 * 60 * 60 * 1000)

    vi.stubEnv('HOLDINGS_LEDGER_OVERLAP_BLOCKS', '12345')
    vi.stubEnv('HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS', '3600')
    expect(holdingsConfig.ledgerOverlapBlocks).toBe(12_345)
    expect(holdingsConfig.ledgerReconcileIntervalMs).toBe(3_600_000)

    vi.stubEnv('HOLDINGS_LEDGER_OVERLAP_BLOCKS', '0')
    vi.stubEnv('HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS', 'not-a-number')
    expect(holdingsConfig.ledgerOverlapBlocks).toBe(50_000)
    expect(holdingsConfig.ledgerReconcileIntervalMs).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('uses an explicit deterministic Envio chain contract for ledger coverage', () => {
    expect(holdingsConfig.ledgerChainIds).toEqual([1, 10, 137, 250, 8453, 42_161, 747_474])

    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '42161,1,10')
    expect(holdingsConfig.ledgerChainIds).toEqual([1, 10, 42_161])

    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1,invalid')
    expect(holdingsConfig.ledgerChainIds).toEqual([1, 10, 137, 250, 8453, 42_161, 747_474])
  })

  it('reads a bounded non-secret source revision with a stable default', () => {
    expect(parseHoldingsLedgerSourceRevision(undefined)).toBe('default')
    expect(parseHoldingsLedgerSourceRevision('  ')).toBe('default')
    expect(parseHoldingsLedgerSourceRevision(' envio-reindex_2026.08.06 ')).toBe('envio-reindex_2026.08.06')
    expect(parseHoldingsLedgerSourceRevision('https://private-indexer.example')).toBe('default')
    expect(parseHoldingsLedgerSourceRevision('x'.repeat(97))).toBe('default')

    vi.stubEnv('HOLDINGS_LEDGER_SOURCE_REVISION', 'deploy-abc123')
    expect(holdingsConfig.ledgerSourceRevision).toBe('deploy-abc123')

    vi.stubEnv('HOLDINGS_LEDGER_SOURCE_REVISION', 'invalid/revision')
    expect(holdingsConfig.ledgerSourceRevision).toBe('default')
  })
})
