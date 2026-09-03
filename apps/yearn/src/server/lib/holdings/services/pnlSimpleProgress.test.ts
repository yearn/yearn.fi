import { describe, expect, it, vi } from 'vitest'
import type { TSettledAddressScopedContext } from '@/server/lib/holdings/services/settledHoldingsContext'

const cacheMocks = vi.hoisted(() => ({
  getCachedProtocolReturnHistorySnapshot: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/lib/holdings/services/cache')>()),
  getCachedProtocolReturnHistorySnapshot: cacheMocks.getCachedProtocolReturnHistorySnapshot
}))

import { withHoldingsProgressReporter } from '@/server/lib/holdings/services/debug'
import { getHoldingsProtocolReturnPortfolio } from '@/server/lib/holdings/services/pnlSimple'

const USER = '0x1111111111111111111111111111111111111111'

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  const state: { resolve?: (value: T) => void } = {}
  const promise = new Promise<T>((resolve) => {
    state.resolve = resolve
  })

  return {
    promise,
    resolve: (value): void => state.resolve?.(value)
  }
}

const EMPTY_CONTEXT: TSettledAddressScopedContext = {
  address: USER,
  latestSettledDayTimestamp: 86_400,
  maxTimestamp: 172_799,
  events: {
    deposits: [],
    withdrawals: [],
    transfersIn: [],
    transfersOut: []
  },
  timeline: [],
  hasActivity: false,
  rawEvents: [],
  rawVaultIdentifiers: [],
  vaultMetadata: new Map(),
  metadataFetchFailedVaults: 0
}

describe('protocol return in-flight progress', () => {
  it('replays current Growth progress and broadcasts later stages to joined requests', async () => {
    cacheMocks.getCachedProtocolReturnHistorySnapshot.mockResolvedValue(null)
    const context = createDeferred<TSettledAddressScopedContext>()
    const loadContext = vi.fn(() => context.promise)
    const firstReporter = vi.fn()
    const secondReporter = vi.fn()

    const firstRequest = withHoldingsProgressReporter(firstReporter, () =>
      getHoldingsProtocolReturnPortfolio(USER, '1y', undefined, loadContext)
    )
    await vi.waitFor(() =>
      expect(firstReporter).toHaveBeenCalledWith(
        12,
        'Fetching historical user data',
        'Starting protocol return history'
      )
    )

    const secondRequest = withHoldingsProgressReporter(secondReporter, () =>
      getHoldingsProtocolReturnPortfolio(USER, '1y', undefined, loadContext)
    )

    expect(secondReporter).toHaveBeenCalledWith(12, 'Fetching historical user data', 'Starting protocol return history')

    context.resolve(EMPTY_CONTEXT)
    await Promise.all([firstRequest, secondRequest])

    expect(loadContext).toHaveBeenCalledTimes(1)
    expect(cacheMocks.getCachedProtocolReturnHistorySnapshot).toHaveBeenCalledTimes(1)
    expect(secondReporter).toHaveBeenCalledWith(
      30,
      'Loaded wallet events and started vault share prices',
      '0 settled events'
    )
    expect(secondReporter).toHaveBeenCalledWith(40, 'Enriched historical wallet events', '0 events')
    expect(secondReporter).toHaveBeenCalledWith(94, 'No historical protocol return events found', null)
  })
})
