import { beforeEach, describe, expect, it, vi } from 'vitest'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const SNAPSHOT_ID = `snapshot_${'a'.repeat(32)}`
const EVENT_SOURCE = {
  key: 'verified-snapshot-source',
  latestSettledDayTimestamp: 1_786_089_600,
  eventUpperTimestamp: 1_786_176_000,
  load: vi.fn()
}

const mocks = vi.hoisted(() => ({
  getLedgerProtocolReturnRows: vi.fn(),
  handleLedgerDerivedRequest: vi.fn()
}))

vi.mock('@/server/holdings/ledger/derived', () => ({
  handleLedgerDerivedRequest: mocks.handleLedgerDerivedRequest
}))

vi.mock('@/server/lib/holdings/services/ledger/rows', () => ({
  getLedgerProtocolReturnRows: mocks.getLedgerProtocolReturnRows
}))

import { GET } from '@/server/holdings/ledger/growth'

function createRequest(query = ''): Request {
  return new Request(`https://yearn.fi/api/holdings/ledger/growth?address=${ADDRESS}&snapshotId=${SNAPSHOT_ID}${query}`)
}

function createGrowthResponse(totalVaults = 1) {
  return {
    address: ADDRESS.toLowerCase(),
    version: 'v3' as const,
    generatedAt: '2026-08-08T00:00:00.000Z',
    summary: {
      totalVaults,
      completeVaults: totalVaults,
      partialVaults: 0,
      historicalPpsRequirements: 0,
      historicalPpsCacheHits: 0,
      historicalPpsFetched: 0,
      historicalPpsMissing: 0,
      currentPpsFallbackVaults: 0,
      isComplete: true
    },
    vaults:
      totalVaults === 0
        ? []
        : [
            {
              chainId: 1,
              vaultAddress: '0x2222222222222222222222222222222222222222',
              status: 'ok' as const,
              issues: [],
              shares: '100000000000000000000',
              sharesFormatted: 100,
              pricePerShare: 1.2,
              currentUnderlying: 120,
              baselineUnderlying: 100,
              realizedBaselineUnderlying: 0,
              unrealizedBaselineUnderlying: 100,
              realizedGrowthUnderlying: 0,
              unrealizedGrowthUnderlying: 20,
              growthUnderlying: 20,
              growthPct: 20,
              baselineExposureUnderlyingYears: 100,
              annualizedProtocolReturnPct: 20,
              receiptCount: 1,
              exitCount: 0,
              deposits: 1,
              withdrawals: 0,
              transfersIn: 0,
              transfersOut: 0,
              unmatchedExitShares: '0',
              unmatchedExitSharesFormatted: 0,
              metadata: {
                symbol: 'USDC',
                decimals: 18,
                assetDecimals: 6,
                tokenAddress: '0x3333333333333333333333333333333333333333'
              }
            }
          ]
  }
}

describe('ledger growth route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleLedgerDerivedRequest.mockImplementation(async (request, handler) =>
      handler(request, { cacheMode: 'bypass', eventSource: EVENT_SOURCE })
    )
    mocks.getLedgerProtocolReturnRows.mockResolvedValue(createGrowthResponse())
  })

  it('projects the response from the verified snapshot event source with the ledger-growth debug identifier', async () => {
    const request = createRequest('&version=v3&debug=1')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mocks.handleLedgerDerivedRequest).toHaveBeenCalledWith(request, expect.any(Function), {
      debugRoute: 'ledger-growth'
    })
    expect(mocks.getLedgerProtocolReturnRows).toHaveBeenCalledWith({
      address: ADDRESS,
      version: 'v3',
      eventSource: EVENT_SOURCE
    })
    await expect(response.json()).resolves.toEqual(createGrowthResponse())
  })

  it('returns not found when the verified ledger has no open vault rows', async () => {
    mocks.getLedgerProtocolReturnRows.mockResolvedValueOnce(createGrowthResponse(0))

    const response = await GET(createRequest())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'No holdings found for address' })
  })

  it('fails closed when the coordinator does not provide a verified event source', async () => {
    mocks.handleLedgerDerivedRequest.mockImplementationOnce(async (request, handler) =>
      handler(request, { cacheMode: 'bypass' })
    )

    const response = await GET(createRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Verified holdings ledger event source is unavailable' })
    expect(mocks.getLedgerProtocolReturnRows).not.toHaveBeenCalled()
  })
})
