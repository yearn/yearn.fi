import { describe, expect, it } from 'vitest'
import { compareLedgerOrder, compareLedgerStrings } from '@/server/lib/holdings/services/ledger/order'

describe('ledger deterministic ordering', () => {
  it('uses locale-independent binary string order', () => {
    const ids = ['event_1', 'event-2', 'Event-3']

    expect(ids.toSorted(compareLedgerStrings)).toEqual(['Event-3', 'event-2', 'event_1'])
    expect(
      ids
        .map((id) => ({ blockTimestamp: 1, blockNumber: 1, logIndex: 1, id }))
        .toSorted(compareLedgerOrder)
        .map(({ id }) => id)
    ).toEqual(['Event-3', 'event-2', 'event_1'])
  })
})
