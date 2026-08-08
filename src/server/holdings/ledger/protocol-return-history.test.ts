import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleLedgerDerivedRequest: vi.fn(),
  handleHoldingsProtocolReturnHistoryRequest: vi.fn()
}))

vi.mock('@/server/holdings/ledger/derived', () => ({
  handleLedgerDerivedRequest: mocks.handleLedgerDerivedRequest
}))

vi.mock('@/server/holdings/protocol-return/history', () => ({
  handleHoldingsProtocolReturnHistoryRequest: mocks.handleHoldingsProtocolReturnHistoryRequest
}))

import { GET } from '@/server/holdings/ledger/protocol-return-history'

describe('ledger protocol-return history route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleHoldingsProtocolReturnHistoryRequest.mockResolvedValue(Response.json({ value: 42 }))
    mocks.handleLedgerDerivedRequest.mockImplementation(async (request, handler) =>
      handler(request, { cacheMode: 'bypass' })
    )
  })

  it('uses address-only events without requiring live Envio access', async () => {
    const request = new Request('https://yearn.fi/api/holdings/ledger/protocol-return/history')

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mocks.handleLedgerDerivedRequest).toHaveBeenCalledWith(request, expect.any(Function), {
      debugRoute: 'ledger-protocol-return-history'
    })
    expect(mocks.handleHoldingsProtocolReturnHistoryRequest).toHaveBeenCalledWith(request, {
      cacheMode: 'bypass',
      protocolReturnEventEnrichment: 'address-only'
    })
  })
})
