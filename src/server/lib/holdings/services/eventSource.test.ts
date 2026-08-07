import { describe, expect, it, vi } from 'vitest'
import { getHoldingsEventSourceKey, type THoldingsEventSource } from '@/server/lib/holdings/services/eventSource'

function createSource(overrides: Partial<THoldingsEventSource> = {}): THoldingsEventSource {
  return {
    key: 'ledger:revision-1',
    latestSettledDayTimestamp: 100,
    eventUpperTimestamp: 200,
    load: vi.fn(),
    ...overrides
  }
}

describe('holdings event source identity', () => {
  it('keeps legacy and fixed ledger snapshots in separate request scopes', () => {
    const source = createSource()

    expect(getHoldingsEventSourceKey()).toBe('legacy')
    expect(getHoldingsEventSourceKey(source)).not.toBe(
      getHoldingsEventSourceKey(createSource({ key: 'ledger:revision-2' }))
    )
    expect(getHoldingsEventSourceKey(source)).not.toBe(
      getHoldingsEventSourceKey(createSource({ latestSettledDayTimestamp: 101 }))
    )
    expect(getHoldingsEventSourceKey(source)).not.toBe(
      getHoldingsEventSourceKey(createSource({ eventUpperTimestamp: 201 }))
    )
  })
})
