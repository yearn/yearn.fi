import { beforeEach, describe, expect, it, vi } from 'vitest'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const SNAPSHOT_ID = `snapshot_${'a'.repeat(32)}`

const mocks = vi.hoisted(() => ({
  getHistoricalHoldingsChart: vi.fn(),
  getHoldingsProtocolReturnHistory: vi.fn(),
  handleLedgerDerivedRequest: vi.fn()
}))

vi.mock('@/server/holdings/ledger/derived', () => ({
  handleLedgerDerivedRequest: mocks.handleLedgerDerivedRequest
}))

vi.mock('@/server/lib/holdings', () => ({
  getHistoricalHoldingsChart: mocks.getHistoricalHoldingsChart,
  getHoldingsProtocolReturnHistory: mocks.getHoldingsProtocolReturnHistory
}))

import { GET } from '@/server/holdings/ledger/portfolio-history'

function request(query = ''): Request {
  return new Request(
    `https://yearn.fi/api/holdings/ledger/portfolio-history?address=${ADDRESS}&snapshotId=${SNAPSHOT_ID}${query}`
  )
}

describe('combined ledger portfolio history route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleLedgerDerivedRequest.mockImplementation(async (ledgerRequest, handler) =>
      handler(ledgerRequest, { cacheMode: 'bypass', eventSource: { key: 'snapshot-source' } })
    )
    mocks.getHistoricalHoldingsChart.mockResolvedValue({
      address: ADDRESS.toLowerCase(),
      hasActivity: true,
      dataPoints: [{ date: '2026-08-07', value: 42 }]
    })
    mocks.getHoldingsProtocolReturnHistory.mockResolvedValue({
      address: ADDRESS.toLowerCase(),
      version: 'all',
      timeframe: '1y',
      generatedAt: '2026-08-08T00:00:00.000Z',
      summary: { totalVaults: 1 },
      dataPoints: [],
      familySeries: []
    })
  })

  it('calculates both histories from one verified ledger event source', async () => {
    const ledgerRequest = request('&denomination=eth&timeframe=all&version=v3')
    const response = await GET(ledgerRequest)

    expect(response.status).toBe(200)
    expect(mocks.handleLedgerDerivedRequest).toHaveBeenCalledWith(ledgerRequest, expect.any(Function), {
      debugRoute: 'ledger-portfolio-history'
    })
    expect(mocks.getHistoricalHoldingsChart).toHaveBeenCalledWith(
      ADDRESS,
      'v3',
      'seq',
      'paged',
      'eth',
      'all',
      undefined,
      expect.objectContaining({ eventSource: { key: 'snapshot-source' } })
    )
    expect(mocks.getHoldingsProtocolReturnHistory).toHaveBeenCalledWith(
      ADDRESS,
      'v3',
      'seq',
      'paged',
      'all',
      undefined,
      undefined,
      expect.objectContaining({
        eventSource: { key: 'snapshot-source' },
        protocolReturnEventEnrichment: 'address-only'
      })
    )
    await expect(response.json()).resolves.toMatchObject({
      address: ADDRESS.toLowerCase(),
      version: 'v3',
      denomination: 'eth',
      timeframe: 'all',
      balance: {
        denomination: 'eth',
        timeframe: 'all',
        dataPoints: [{ date: '2026-08-07', value: 42 }]
      },
      protocolReturn: {
        summary: { totalVaults: 1 }
      }
    })
  })

  it('returns not found only when both ledger projections are empty', async () => {
    mocks.getHistoricalHoldingsChart.mockResolvedValueOnce({
      address: ADDRESS.toLowerCase(),
      hasActivity: false,
      dataPoints: []
    })
    mocks.getHoldingsProtocolReturnHistory.mockResolvedValueOnce({
      summary: { totalVaults: 0 },
      dataPoints: [],
      familySeries: []
    })

    const response = await GET(request())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'No holdings found for address' })
  })
})
