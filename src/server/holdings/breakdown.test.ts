import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, handleHoldingsBreakdownRequest, parseUtcDateParam } from '@/server/holdings/breakdown'

const TEST_ADDRESS = '0x2222222222222222222222222222222222222222'

const { ensureHoldingsStorageInitializedMock, getHoldingsBreakdownMock } = vi.hoisted(() => ({
  ensureHoldingsStorageInitializedMock: vi.fn(),
  getHoldingsBreakdownMock: vi.fn()
}))

vi.mock('../lib/holdings', () => ({
  ensureHoldingsStorageInitialized: ensureHoldingsStorageInitializedMock,
  getHoldingsBreakdown: getHoldingsBreakdownMock
}))

function createRequest(query: Record<string, string>): Request {
  return new Request(`https://yearn.fi/api/holdings/breakdown?${new URLSearchParams(query)}`)
}

describe('parseUtcDateParam', () => {
  it('parses valid UTC dates', () => {
    expect(parseUtcDateParam('2026-02-28')).toBe(Math.floor(Date.UTC(2026, 1, 28) / 1000))
  })

  it('rejects impossible calendar dates instead of normalizing them', () => {
    expect(parseUtcDateParam('2026-02-31')).toBeNull()
    expect(parseUtcDateParam('2026-13-01')).toBeNull()
    expect(parseUtcDateParam('2026-00-10')).toBeNull()
  })
})

describe('holdings breakdown route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureHoldingsStorageInitializedMock.mockResolvedValue(undefined)
    getHoldingsBreakdownMock.mockResolvedValue({
      address: TEST_ADDRESS,
      version: 'all',
      date: '2026-02-28',
      vaults: []
    })
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('returns private no-store cache headers for wallet-scoped breakdown responses', async () => {
    const response = await GET(createRequest({ address: TEST_ADDRESS }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
  })

  it('passes a pinned ledger source through without requiring Envio configuration', async () => {
    delete process.env.ENVIO_GRAPHQL_URL
    const options = {
      eventSource: {
        key: 'ledger-source',
        latestSettledDayTimestamp: 1776729600,
        eventUpperTimestamp: 1776816000,
        load: vi.fn()
      },
      cacheMode: 'bypass' as const
    }

    const response = await handleHoldingsBreakdownRequest(createRequest({ address: TEST_ADDRESS }), options)

    expect(response.status).toBe(200)
    expect(getHoldingsBreakdownMock).toHaveBeenCalledWith(TEST_ADDRESS, 'all', 'seq', 'paged', undefined, options)
  })

  it('rejects dated ledger breakdowns after the pinned settled cutoff', async () => {
    const options = {
      eventSource: {
        key: 'ledger-source',
        latestSettledDayTimestamp: Math.floor(Date.UTC(2026, 3, 20) / 1000),
        eventUpperTimestamp: Math.floor(Date.UTC(2026, 3, 21) / 1000),
        load: vi.fn()
      },
      cacheMode: 'bypass' as const
    }

    const response = await handleHoldingsBreakdownRequest(
      createRequest({ address: TEST_ADDRESS, date: '2026-04-21' }),
      options
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Requested date is after the ledger snapshot settled cutoff'
    })
    expect(getHoldingsBreakdownMock).not.toHaveBeenCalled()
  })
})
