import { describe, expect, it, vi } from 'vitest'
import { resolveLedgerHistoricalPps } from '@/server/lib/holdings/services/ledger/pps'
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

describe('ledger targeted historical PPS resolution', () => {
  it('fetches each required vault timeline once and resolves values in request memory', async () => {
    const first = requirement()
    const second = requirement({
      key: `1:${VAULT}:200:1:0x${'b'.repeat(64)}`,
      blockNumber: 200,
      blockTimestamp: 2_000,
      logIndex: 1,
      transactionHash: `0x${'b'.repeat(64)}`
    })
    const fetchPps = vi.fn().mockResolvedValue(
      new Map([
        [
          `1:${VAULT}`,
          new Map([
            [1_000, 1.1],
            [2_000, 1.2]
          ])
        ]
      ])
    )

    const result = await resolveLedgerHistoricalPps([first, second], { fetchPps })

    expect(fetchPps).toHaveBeenCalledWith([{ chainId: 1, vaultAddress: VAULT }])
    expect(result).toEqual({
      values: [
        { key: first.key, pricePerShare: 1.1 },
        { key: second.key, pricePerShare: 1.2 }
      ],
      fetched: 2,
      missing: 0
    })
  })

  it('reports unresolved PPS requirements without persisting them', async () => {
    const unresolved = requirement()

    const result = await resolveLedgerHistoricalPps([unresolved], {
      fetchPps: vi.fn().mockResolvedValue(new Map([[`1:${VAULT}`, new Map()]]))
    })

    expect(result).toEqual({ values: [], fetched: 0, missing: 1 })
  })

  it('does not fetch when there are no requirements', async () => {
    const fetchPps = vi.fn()
    const result = await resolveLedgerHistoricalPps([], { fetchPps })

    expect(fetchPps).not.toHaveBeenCalled()
    expect(result).toEqual({ values: [], fetched: 0, missing: 0 })
  })
})
