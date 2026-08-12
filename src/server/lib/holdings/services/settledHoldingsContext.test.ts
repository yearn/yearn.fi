import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { THoldingsEventSource } from '@/server/lib/holdings/services/eventSource'
import type { UserEvents } from '@/server/lib/holdings/types'

const mocks = vi.hoisted(() => ({
  buildPositionTimeline: vi.fn(),
  fetchLegacyEvents: vi.fn(),
  fetchMetadata: vi.fn(),
  fetchPps: vi.fn(),
  generateDailyTimestamps: vi.fn(),
  getUniqueVaults: vi.fn(),
  mergeVaultIdentifiers: vi.fn(),
  toSettledDayTimestamp: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/graphql', () => ({
  fetchUserEvents: mocks.fetchLegacyEvents
}))

vi.mock('@/server/lib/holdings/services/holdings', () => ({
  buildPositionTimeline: mocks.buildPositionTimeline,
  generateDailyTimestamps: mocks.generateDailyTimestamps,
  getUniqueVaults: mocks.getUniqueVaults,
  toSettledDayTimestamp: mocks.toSettledDayTimestamp
}))

vi.mock('@/server/lib/holdings/services/kong', () => ({
  fetchMultipleVaultsPPS: mocks.fetchPps
}))

vi.mock('@/server/lib/holdings/services/nestedVaultPrices', () => ({
  getNestedVaultPpsIdentifiersFromPriceRequests: vi.fn(() => []),
  mergeVaultIdentifiers: mocks.mergeVaultIdentifiers,
  resolveNestedVaultAssetMetadata: vi.fn((metadata: Map<string, unknown>) => Promise.resolve(metadata))
}))

vi.mock('@/server/lib/holdings/services/pnlEvents', () => ({
  buildAddressScopedRawPnlEvents: vi.fn(() => [])
}))

vi.mock('@/server/lib/holdings/services/vaults', () => ({
  fetchMultipleVaultsMetadata: mocks.fetchMetadata,
  getVaultMetadataFetchFailedVaults: vi.fn(() => 0)
}))

const EMPTY_EVENTS: UserEvents = {
  deposits: [],
  withdrawals: [],
  transfersIn: [],
  transfersOut: []
}

function createEventSource(key: string, events: UserEvents): THoldingsEventSource {
  return {
    key,
    latestSettledDayTimestamp: 100,
    eventUpperTimestamp: 86_501,
    load: vi.fn(() => Promise.resolve(events))
  }
}

describe('settled holdings event sources', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.buildPositionTimeline.mockImplementation((deposits: Array<{ id: string }>) =>
      deposits.map(({ id }) => ({ id }))
    )
    mocks.fetchMetadata.mockResolvedValue(new Map())
    mocks.generateDailyTimestamps.mockReturnValue([50])
    mocks.getUniqueVaults.mockReturnValue([])
    mocks.mergeVaultIdentifiers.mockImplementation((identifiers: unknown[]) => identifiers)
    mocks.toSettledDayTimestamp.mockImplementation((timestamp: number) => timestamp + 1)
  })

  it('uses the source fixed date and separates address contexts by source identity', async () => {
    const firstEvents: UserEvents = {
      ...EMPTY_EVENTS,
      deposits: [{ id: 'first' } as UserEvents['deposits'][number]]
    }
    const secondEvents: UserEvents = {
      ...EMPTY_EVENTS,
      deposits: [{ id: 'second' } as UserEvents['deposits'][number]]
    }
    const firstSource = createEventSource('ledger:first', firstEvents)
    const secondSource = createEventSource('ledger:second', secondEvents)
    const { getSettledAddressScopedContext } = await import('@/server/lib/holdings/services/settledHoldingsContext')

    const [first, second] = await Promise.all(
      [firstSource, secondSource].map((eventSource) =>
        getSettledAddressScopedContext({
          userAddress: '0x1111111111111111111111111111111111111111',
          fetchType: 'seq',
          paginationMode: 'paged',
          eventSource
        })
      )
    )

    expect(firstSource.load).toHaveBeenCalledWith({
      userAddress: '0x1111111111111111111111111111111111111111',
      version: 'all',
      maxTimestamp: 86_501,
      fetchType: 'seq',
      paginationMode: 'paged'
    })
    expect(secondSource.load).toHaveBeenCalledTimes(1)
    expect(mocks.fetchLegacyEvents).not.toHaveBeenCalled()
    expect(mocks.generateDailyTimestamps).not.toHaveBeenCalled()
    expect(first.eventSourceKey).not.toBe(second.eventSourceKey)
    expect(first.events.deposits[0]?.id).toBe('first')
    expect(second.events.deposits[0]?.id).toBe('second')
  })

  it('separates versioned PPS in-flight work by the supplied context source', async () => {
    const firstSource = createEventSource('ledger:first', EMPTY_EVENTS)
    const secondSource = createEventSource('ledger:second', EMPTY_EVENTS)
    const { getSettledAddressScopedContext, getSettledVersionedPpsContext } = await import(
      '@/server/lib/holdings/services/settledHoldingsContext'
    )
    const [firstContext, secondContext] = await Promise.all(
      [firstSource, secondSource].map((eventSource) =>
        getSettledAddressScopedContext({
          userAddress: '0x1111111111111111111111111111111111111111',
          fetchType: 'seq',
          paginationMode: 'paged',
          eventSource
        })
      )
    )
    const vaultIdentifiers = [{ chainId: 1, vaultAddress: '0x2222222222222222222222222222222222222222' }]
    mocks.fetchPps.mockResolvedValue(new Map())

    await Promise.all(
      [firstContext, secondContext].map((context) =>
        getSettledVersionedPpsContext({
          userAddress: '0x1111111111111111111111111111111111111111',
          version: 'all',
          fetchType: 'seq',
          paginationMode: 'paged',
          vaultIdentifiers,
          context
        })
      )
    )

    expect(mocks.fetchPps).toHaveBeenCalledTimes(2)
  })

  it('loads PPS through the request-scoped valuation loader when supplied', async () => {
    const eventSource = createEventSource('ledger:shared-loader', EMPTY_EVENTS)
    const { getSettledAddressScopedContext, getSettledVersionedPpsContext } = await import(
      '@/server/lib/holdings/services/settledHoldingsContext'
    )
    const context = await getSettledAddressScopedContext({
      userAddress: '0x1111111111111111111111111111111111111111',
      fetchType: 'seq',
      paginationMode: 'paged',
      eventSource
    })
    const vaultIdentifiers = [{ chainId: 1, vaultAddress: '0x2222222222222222222222222222222222222222' }]
    const fetchVaultPps = vi.fn().mockResolvedValue(new Map())

    await getSettledVersionedPpsContext({
      userAddress: '0x1111111111111111111111111111111111111111',
      version: 'all',
      fetchType: 'seq',
      paginationMode: 'paged',
      vaultIdentifiers,
      context,
      valuationLoader: {
        key: 'request-loader',
        fetchVaultPps,
        fetchHistoricalPrices: vi.fn()
      },
      valuationConsumer: 'protocol-return'
    })

    expect(fetchVaultPps).toHaveBeenCalledWith(vaultIdentifiers, { consumer: 'protocol-return' })
    expect(mocks.fetchPps).not.toHaveBeenCalled()
  })

  it('separates versioned PPS in-flight work by valuation consumer', async () => {
    const eventSource = createEventSource('ledger:consumer-priority', EMPTY_EVENTS)
    const { getSettledAddressScopedContext, getSettledVersionedPpsContext } = await import(
      '@/server/lib/holdings/services/settledHoldingsContext'
    )
    const context = await getSettledAddressScopedContext({
      userAddress: '0x1111111111111111111111111111111111111111',
      fetchType: 'seq',
      paginationMode: 'paged',
      eventSource
    })
    const vaultIdentifiers = [{ chainId: 1, vaultAddress: '0x2222222222222222222222222222222222222222' }]
    const fetchVaultPps = vi.fn().mockResolvedValue(new Map())
    const valuationLoader = {
      key: 'consumer-loader',
      fetchVaultPps,
      fetchHistoricalPrices: vi.fn()
    }

    await Promise.all(
      (['balance', 'protocol-return'] as const).map((valuationConsumer) =>
        getSettledVersionedPpsContext({
          userAddress: '0x1111111111111111111111111111111111111111',
          version: 'all',
          fetchType: 'seq',
          paginationMode: 'paged',
          vaultIdentifiers,
          context,
          valuationLoader,
          valuationConsumer
        })
      )
    )

    expect(fetchVaultPps).toHaveBeenCalledTimes(2)
    expect(fetchVaultPps).toHaveBeenNthCalledWith(1, vaultIdentifiers, { consumer: 'balance' })
    expect(fetchVaultPps).toHaveBeenNthCalledWith(2, vaultIdentifiers, { consumer: 'protocol-return' })
  })
})
