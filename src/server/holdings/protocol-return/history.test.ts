import { beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_ADDRESS = '0x2222222222222222222222222222222222222222'

const ensureHoldingsStorageInitializedMock = vi.fn()
const getHoldingsProtocolReturnHistoryMock = vi.fn()
const startHoldingsProgressMock = vi.fn()
const updateHoldingsProgressMock = vi.fn()

vi.mock('../../lib/holdings', () => ({
  ensureHoldingsStorageInitialized: ensureHoldingsStorageInitializedMock,
  getHoldingsProtocolReturnHistory: getHoldingsProtocolReturnHistoryMock
}))

vi.mock('../../lib/holdings/services/progress', () => ({
  startHoldingsProgress: startHoldingsProgressMock,
  updateHoldingsProgress: updateHoldingsProgressMock
}))

vi.mock('../../lib/holdings/services/debug', () => ({
  createHoldingsDebugContext: vi.fn((route, address, enabled, options) => ({ route, address, enabled, options })),
  debugError: vi.fn(),
  debugLog: vi.fn(),
  isHoldingsDebugRequested: vi.fn(() => false),
  withHoldingsDebugContext: vi.fn((_context, fn) => fn())
}))

function createRequest(query: Record<string, string>): Request {
  return new Request(`https://yearn.fi/api/holdings/protocol-return/history?${new URLSearchParams(query)}`)
}

describe('holdings protocol return history route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureHoldingsStorageInitializedMock.mockResolvedValue(undefined)
    startHoldingsProgressMock.mockResolvedValue('progress-id')
    updateHoldingsProgressMock.mockResolvedValue(undefined)
    getHoldingsProtocolReturnHistoryMock.mockResolvedValue({
      address: TEST_ADDRESS,
      version: 'all',
      timeframe: '1y',
      summary: { totalVaults: 1 },
      dataPoints: [{ date: '2026-04-21', value: 1 }]
    })
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('returns private no-store cache headers for wallet-scoped protocol return history responses', async () => {
    const { default: handler } = await import('./history')
    const response = await handler(createRequest({ address: TEST_ADDRESS }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
  })
})
