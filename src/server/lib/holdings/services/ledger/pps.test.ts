import { describe, expect, it, vi } from 'vitest'
import { getLedgerHistoricalPpsCacheKey, resolveLedgerHistoricalPps } from '@/server/lib/holdings/services/ledger/pps'
import type { TProtocolReturnHistoricalPpsRequirement } from '@/server/lib/holdings/services/pnlSimple'

const VAULT = '0x1111111111111111111111111111111111111111'

function requirement(
  overrides: Partial<TProtocolReturnHistoricalPpsRequirement> = {}
): TProtocolReturnHistoricalPpsRequirement {
  return {
    key: `1:${VAULT}:100:0:0x${'a'.repeat(64)}`,
    reason: 'transfer',
    eventKind: 'transfer',
    chainId: 1,
    vaultAddress: VAULT,
    blockNumber: 100,
    blockTimestamp: 1_000,
    logIndex: 0,
    transactionHash: `0x${'a'.repeat(64)}`,
    ...overrides
  }
}

describe('ledger targeted historical PPS cache', () => {
  it('uses cached event PPS and fetches only missing vault timelines', async () => {
    const cached = requirement()
    const missing = requirement({
      key: `1:${VAULT}:200:1:0x${'b'.repeat(64)}`,
      blockNumber: 200,
      blockTimestamp: 2_000,
      logIndex: 1,
      transactionHash: `0x${'b'.repeat(64)}`
    })
    const fetchPps = vi.fn().mockResolvedValue(new Map([[`1:${VAULT}`, new Map([[1_500, 1.2]])]]))
    const writeCached = vi.fn().mockResolvedValue(undefined)

    const result = await resolveLedgerHistoricalPps([cached, missing], {
      readCached: vi.fn(async (entry) => (entry.key === cached.key ? 1.1 : null)),
      writeCached,
      fetchPps
    })

    expect(fetchPps).toHaveBeenCalledWith([{ chainId: 1, vaultAddress: VAULT }])
    expect(writeCached).toHaveBeenCalledWith(missing, 1.2)
    expect(result).toEqual({
      values: [
        { key: cached.key, pricePerShare: 1.1 },
        { key: missing.key, pricePerShare: 1.2 }
      ],
      cacheHits: 1,
      fetched: 1,
      missing: 0
    })
  })

  it('does not cache unresolved PPS requirements', async () => {
    const unresolved = requirement()
    const writeCached = vi.fn().mockResolvedValue(undefined)

    const result = await resolveLedgerHistoricalPps([unresolved], {
      readCached: vi.fn().mockResolvedValue(null),
      writeCached,
      fetchPps: vi.fn().mockResolvedValue(new Map([[`1:${VAULT}`, new Map()]]))
    })

    expect(result).toEqual({ values: [], cacheHits: 0, fetched: 0, missing: 1 })
    expect(writeCached).not.toHaveBeenCalled()
  })

  it('uses a global non-wallet cache key without exposing the transaction hash', () => {
    const entry = requirement()
    const key = getLedgerHistoricalPpsCacheKey(entry)

    expect(key).toContain(`:${entry.chainId}:${VAULT}:`)
    expect(key).not.toContain(entry.transactionHash)
  })
})
