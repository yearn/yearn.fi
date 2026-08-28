import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureHoldingsStorageInitializedMock = vi.fn()
const getHoldingsProtocolReturnHistoryMock = vi.fn()
const TEST_WALLET_ADDRESS = process.env.HOLDINGS_TEST_WALLET_ADDRESS ?? '0x1111111111111111111111111111111111111111'

vi.mock('../../lib/holdings', () => ({
  ensureHoldingsStorageInitialized: ensureHoldingsStorageInitializedMock,
  getHoldingsProtocolReturnHistory: getHoldingsProtocolReturnHistoryMock
}))

function createRequest(query: Record<string, string>): Request {
  return new Request(`https://yearn.fi/api/holdings/pnl/simple-history?${new URLSearchParams(query)}`)
}

describe('holdings simple pnl history route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ensureHoldingsStorageInitializedMock.mockResolvedValue(undefined)
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.example/graphql'
  })

  it('passes multi-vault filters through the simple history alias', async () => {
    getHoldingsProtocolReturnHistoryMock.mockResolvedValue({
      address: TEST_WALLET_ADDRESS.toLowerCase(),
      version: 'all',
      timeframe: '1y',
      generatedAt: '2026-04-28T00:00:00.000Z',
      summary: {
        totalVaults: 2,
        completeVaults: 2,
        partialVaults: 0,
        recommendedGrowthDisplay: 'index',
        recommendedGrowthDisplayReason: 'mixed',
        openBaselineCompositionUsd: {
          stable: 0,
          ethFamily: 0,
          other: 0
        },
        isComplete: true
      },
      dataPoints: [],
      familySeries: []
    })

    const { default: handler } = await import('./simple-history')
    const response = await handler(
      createRequest({
        address: TEST_WALLET_ADDRESS,
        vaults: '1:0x696d02Db93291651ED510704c9b286841d506987,1:0xAaaFEa48472f77563961Cdb53291DEDfB46F9040'
      })
    )

    expect(response.status).toBe(200)
    expect(getHoldingsProtocolReturnHistoryMock).toHaveBeenCalledWith(
      TEST_WALLET_ADDRESS,
      'all',
      'seq',
      'paged',
      '1y',
      [
        { chainId: 1, vaultAddress: '0x696d02Db93291651ED510704c9b286841d506987' },
        { chainId: 1, vaultAddress: '0xAaaFEa48472f77563961Cdb53291DEDfB46F9040' }
      ]
    )
  })
})
