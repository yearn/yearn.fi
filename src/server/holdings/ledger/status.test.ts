import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, OPTIONS } from '@/server/holdings/ledger/status'

const mocks = vi.hoisted(() => {
  class TestStatusError extends Error {
    readonly reasonCode: string
    readonly statusCode: number

    constructor(reasonCode: string, statusCode: number) {
      super('Holdings ledger status read failed')
      this.reasonCode = reasonCode
      this.statusCode = statusCode
    }
  }
  return {
    access: vi.fn(),
    getStatus: vi.fn(),
    getRuntimeFingerprint: vi.fn(),
    TestStatusError
  }
})

vi.mock('@/server/holdings/ledger/access', () => ({
  getLedgerAdminAccessError: mocks.access,
  isValidLedgerWalletAddress: (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)
}))

vi.mock('@/server/lib/holdings/services/ledger/status', () => ({
  getHoldingsLedgerStatus: mocks.getStatus,
  HoldingsLedgerStatusError: mocks.TestStatusError
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  getHoldingsLedgerRuntimeFingerprint: mocks.getRuntimeFingerprint
}))

const ADDRESS = '0x1111111111111111111111111111111111111111'
const SUMMARY = {
  status: 'empty',
  headSource: null,
  revision: null,
  sourceGeneration: null,
  counts: { records: 0, chunks: 0, indexShards: 0 },
  bytes: {
    activeEncoded: 0,
    chunksEncoded: 0,
    chunksDecoded: 0,
    indexesEncoded: 0,
    indexesDecoded: 0
  },
  chainScope: [],
  coverage: [],
  dirty: { fromTimestamp: null, fromDate: null, reasons: [] },
  timestamps: { createdAtMs: null, updatedAtMs: null, reconciledAtMs: null },
  sync: {
    state: 'missing',
    reasonCode: null,
    sourceGeneration: null,
    revision: null,
    updatedAtMs: null,
    matchesHead: null
  }
}

function createRequest(query = ''): Request {
  return new Request(`https://yearn.fi/api/holdings/ledger/status${query}`)
}

describe('holdings ledger status admin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.access.mockReturnValue(null)
    mocks.getStatus.mockResolvedValue(SUMMARY)
    mocks.getRuntimeFingerprint.mockReturnValue('runtime-fingerprint')
  })

  it('authenticates before validating duplicate query input or calling the service', async () => {
    const unauthorized = Response.json({ error: 'Unauthorized' }, { status: 401 })
    mocks.access.mockReturnValue(unauthorized)
    const request = createRequest(`?address=${ADDRESS}&address=${ADDRESS}`)

    const response = await GET(request)

    expect(response).toBe(unauthorized)
    expect(mocks.access).toHaveBeenCalledWith(request)
    expect(mocks.getStatus).not.toHaveBeenCalled()
  })

  it.each([
    ['missing address', ''],
    ['duplicate address', `?address=${ADDRESS}&address=${ADDRESS}`],
    ['extra input', `?address=${ADDRESS}&forceRebuild=true`],
    ['invalid address', '?address=0x1234']
  ])('rejects %s with one fixed query response', async (_label, query) => {
    const response = await GET(createRequest(query))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request query' })
    expect(mocks.getStatus).not.toHaveBeenCalled()
  })

  it('returns the sanitized service summary with no-store admin CORS', async () => {
    const response = await GET(createRequest(`?address=${ADDRESS}`))

    expect(mocks.getStatus).toHaveBeenCalledWith(ADDRESS)
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
    expect(response.headers.get('X-Holdings-Ledger-Runtime-Fingerprint')).toBe('runtime-fingerprint')
    await expect(response.json()).resolves.toEqual(SUMMARY)
  })

  it('returns fixed typed and generic failures without reflecting sensitive details', async () => {
    mocks.getStatus.mockRejectedValue(new mocks.TestStatusError('decode_failed', 500))
    const typed = await GET(createRequest(`?address=${ADDRESS}`))
    expect(typed.status).toBe(500)
    await expect(typed.json()).resolves.toEqual({
      error: 'Holdings ledger status read failed',
      reasonCode: 'decode_failed'
    })

    mocks.getStatus.mockRejectedValue(new Error('private-wallet-hash private-key private-checksum'))
    const generic = await GET(createRequest(`?address=${ADDRESS}`))
    expect(generic.status).toBe(500)
    await expect(generic.json()).resolves.toEqual({
      error: 'Holdings ledger status read failed',
      reasonCode: 'storage_failed'
    })
  })

  it('serves no-store admin CORS preflight responses', () => {
    const response = OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, x-admin-secret')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
  })
})
