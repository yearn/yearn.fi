import { normalizeEnsoSettlement, observeEnsoSettlement } from '@shared/hooks/ensoSettlement'
import type { TSettlementRequirement, TTransactionRecord } from '@yearn/vault-widget/lifecycle'
import { afterEach, describe, expect, it, vi } from 'vitest'

const hash = `0x${'a'.repeat(64)}` as const
const record = {
  original: { canonicalChainId: 1, executionChainId: 1, hash },
  effective: { canonicalChainId: 1, executionChainId: 1, hash },
  settlement: { provider: 'enso', protocols: ['relay'], destinationChainId: 10, legs: [], coverage: 'incomplete' }
} as unknown as TTransactionRecord
afterEach(() => vi.unstubAllGlobals())
describe('Enso settlement admission', () => {
  it('admits overall delivery without manufacturing a destination hash or network', () => {
    expect(normalizeEnsoSettlement({ status: 'delivered', destinationTxHash: hash }, record, 1)).toMatchObject({
      outcome: 'delivered',
      authority: 'overall',
      destination: undefined
    })
  })
  it.each([{ sourceChainId: 8453 }, { sourceTxHash: `0x${'b'.repeat(64)}` }, { destinationChainId: 8453 }])(
    'rejects mismatched provider identity %j',
    (mismatch) => {
      expect(() => normalizeEnsoSettlement({ status: 'delivered', ...mismatch }, record, 1)).toThrow('route')
    }
  )
  it('preserves original cache observation time and next eligible time', () => {
    expect(normalizeEnsoSettlement({ status: 'inflight', observedAt: 10, nextCheckAt: 30 }, record, 20)).toMatchObject({
      observedAt: 10,
      nextCheckAt: 30
    })
  })
  it('does not claim whole-route authority for a multi-bridge route', () => {
    const multiple = {
      ...record,
      settlement: { ...(record.settlement as TSettlementRequirement), protocols: ['relay'], bridgeCount: 2 }
    } as TTransactionRecord
    expect(normalizeEnsoSettlement({ status: 'delivered' }, multiple, 1)).toMatchObject({ authority: 'partial' })
  })
  it('retains failed callback evidence and observed refund separately', () => {
    expect(
      normalizeEnsoSettlement({ status: 'delivered', ensoDestinationEvent: { success: false } }, record, 1).legs
    ).toEqual([{ id: 'enso:destination-callback', outcome: 'failed', callback: 'failed' }])
    expect(normalizeEnsoSettlement({ status: 'failed', refundTxHash: hash }, record, 1)).toMatchObject({
      outcome: 'failed',
      funds: 'refunded',
      refund: record.original
    })
  })
  it('offers only implemented external trackers for manual recovery', () => {
    const known = normalizeEnsoSettlement({ status: 'ready_for_manual_execution', bridgeRequestId: hash }, record, 1)
    expect(known).toMatchObject({
      outcome: 'manual',
      funds: 'recoverable',
      recovery: { kind: 'external', url: `https://relay.link/transaction/${hash}` }
    })
    expect(
      normalizeEnsoSettlement(
        { status: 'ready_for_manual_execution', recoveryUrl: 'javascript:alert(1)' },
        {
          ...record,
          settlement: { ...(record.settlement as TSettlementRequirement), protocols: ['future-protocol'] }
        } as TTransactionRecord,
        1
      ).recovery
    ).toBeUndefined()
  })
  it('keeps unknown protocols trackable and HTTP errors retryable', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'Queued', nextCheckAt: 30 }, { status: 429 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(
      observeEnsoSettlement(
        {
          ...record,
          settlement: { ...(record.settlement as TSettlementRequirement), protocols: ['cctp-v3'] }
        } as TTransactionRecord,
        new AbortController().signal
      )
    ).rejects.toThrow('Queued')
    expect(fetcher.mock.calls[0][0]).toContain('protocol=cctp-v3')
  })
})
