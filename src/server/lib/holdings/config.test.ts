import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  holdingsConfig,
  parseHoldingsLedgerMode,
  parseHoldingsLedgerSourceRevision,
  parseHoldingsLedgerValuationRevision
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

  it('prefers development portfolio Redis credentials when configured', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO_DEV', 'https://dev-redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO_DEV', 'dev-token')
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', 'token')

    expect(holdingsConfig.redisUrl).toBe('https://dev-redis.example')
    expect(holdingsConfig.redisToken).toBe('dev-token')
  })

  it('falls back to the standard portfolio Redis credentials', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO_DEV', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO_DEV', '')
    vi.stubEnv('UPSTASH_REDIS_REST_URL_PORTFOLIO', 'https://redis.example')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN_PORTFOLIO', 'token')

    expect(holdingsConfig.redisUrl).toBe('https://redis.example')
    expect(holdingsConfig.redisToken).toBe('token')
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
    expect(holdingsConfig.ledgerChainIds).toEqual([1, 10, 137, 8453, 42_161, 747_474])

    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '42161,1,10')
    expect(holdingsConfig.ledgerChainIds).toEqual([1, 10, 42_161])

    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1,invalid')
    expect(holdingsConfig.ledgerChainIds).toEqual([1, 10, 137, 8453, 42_161, 747_474])
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

  it('reads a bounded non-secret valuation revision with a stable default', () => {
    expect(parseHoldingsLedgerValuationRevision(undefined)).toBe('default')
    expect(parseHoldingsLedgerValuationRevision('  ')).toBe('default')
    expect(parseHoldingsLedgerValuationRevision(' pps-fix_2026.08.12 ')).toBe('pps-fix_2026.08.12')
    expect(parseHoldingsLedgerValuationRevision('price/correction')).toBe('default')
    expect(parseHoldingsLedgerValuationRevision('x'.repeat(97))).toBe('default')

    vi.stubEnv('HOLDINGS_LEDGER_VALUATION_REVISION', 'valuation-abc123')
    expect(holdingsConfig.ledgerValuationRevision).toBe('valuation-abc123')

    vi.stubEnv('HOLDINGS_LEDGER_VALUATION_REVISION', 'invalid/revision')
    expect(holdingsConfig.ledgerValuationRevision).toBe('default')
  })
})
