import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, parseUtcDateParam } from './breakdown'

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
})
