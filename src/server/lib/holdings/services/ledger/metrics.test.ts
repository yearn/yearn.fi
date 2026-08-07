import { describe, expect, it, vi } from 'vitest'
import { reportLedgerMetric, type TLedgerMetric } from '@/server/lib/holdings/services/ledger/metrics'

describe('ledger metrics', () => {
  it('emits a structured event with a hashed wallet identifier', () => {
    const logger = vi.fn()
    const walletHash = 'a'.repeat(64)

    reportLedgerMetric(
      {
        name: 'ledger.write',
        outcome: 'success',
        mode: 'shadow',
        walletHash,
        chunkCount: 4,
        encodedBytes: 1024
      },
      logger
    )

    expect(logger).toHaveBeenCalledTimes(1)
    expect(JSON.parse(logger.mock.calls[0]?.[0] ?? '{}')).toEqual({
      scope: 'holdings-ledger',
      name: 'ledger.write',
      outcome: 'success',
      mode: 'shadow',
      walletHash,
      chunkCount: 4,
      encodedBytes: 1024
    })
  })

  it('rejects an unhashed wallet identifier before logging', () => {
    const logger = vi.fn()

    expect(() =>
      reportLedgerMetric(
        {
          name: 'ledger.read',
          outcome: 'error',
          mode: 'shadow',
          walletHash: '0x0000000000000000000000000000000000000001'
        },
        logger
      )
    ).toThrow('Ledger metrics require a lowercase SHA-256 wallet hash')
    expect(logger).not.toHaveBeenCalled()
  })

  it('logs only allowlisted fields even when a caller passes extra sensitive properties', () => {
    const logger = vi.fn()
    const metric = {
      name: 'ledger.read',
      outcome: 'success',
      mode: 'shadow',
      walletHash: 'b'.repeat(64),
      indexerUrl: 'https://private-indexer.example',
      token: 'private-token',
      ledger: { private: 'payload' },
      eventCounts: {
        v3Deposits: { cached: 1, added: 2, replaced: 3, deleted: 4, secret: 'nested-private-token' }
      }
    } as unknown as TLedgerMetric

    reportLedgerMetric(metric, logger)

    const output = logger.mock.calls[0]?.[0] ?? ''
    expect(output).not.toContain('private-indexer')
    expect(output).not.toContain('private-token')
    expect(output).not.toContain('payload')
    expect(output).not.toContain('nested-private-token')
  })
})
