import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OPTIONS, POST } from '@/server/holdings/ledger/sync'

const mocks = vi.hoisted(() => {
  class TestSyncError extends Error {
    readonly reasonCode: string
    readonly statusCode: number

    constructor(reasonCode: string, statusCode: number) {
      super('Holdings ledger synchronization failed')
      this.reasonCode = reasonCode
      this.statusCode = statusCode
    }
  }
  return {
    access: vi.fn(),
    sync: vi.fn(),
    TestSyncError
  }
})

vi.mock('@/server/holdings/ledger/access', () => ({
  getLedgerAdminAccessError: mocks.access,
  isValidLedgerWalletAddress: (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)
}))

vi.mock('@/server/lib/holdings/services/ledger/sync', () => ({
  HoldingsLedgerSyncError: mocks.TestSyncError,
  syncHoldingsLedger: mocks.sync
}))

const ADDRESS = '0x1111111111111111111111111111111111111111'

function createRequest(body: string, debug = false, secret = 'test-secret'): Request {
  return new Request(`https://yearn.fi/api/holdings/ledger/sync${debug ? '?debug=1' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
    body
  })
}

function createUpdatedResult() {
  return {
    status: 'updated',
    syncType: 'warm',
    revision: 'revision_01',
    sourceGeneration: 3,
    events: { cached: 10, fetched: 2, added: 1, replaced: 1, deleted: 0, total: 11 },
    streams: { privateEvent: 'private-event-payload' },
    envio: { pages: 2, rows: 12, chains: 2, validationQueries: 2, readyChains: 1, laggingChains: 1 },
    storage: { chunks: 3, indexShards: 64, encodedBytes: 1_024, newBlobs: 2 },
    dirty: {
      fromTimestamp: 1_700_000_000,
      fromDate: '2023-11-14',
      reasons: ['tail_append', 'https://private-indexer.example/graphql']
    },
    parity: { status: 'match', reasonCode: null },
    durationMs: 50,
    walletHash: 'private-wallet-hash',
    sourceFingerprint: 'private-source-fingerprint',
    cursor: 'private-cursor',
    checksum: 'private-checksum'
  }
}

describe('holdings ledger sync admin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.access.mockReturnValue(null)
    mocks.sync.mockResolvedValue(createUpdatedResult())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps timing logs disabled by default', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const response = await POST(createRequest(JSON.stringify({ address: ADDRESS })))

    expect(response.status).toBe(200)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('emits opt-in timing and count logs without wallet, revision, or source identifiers', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const response = await POST(createRequest(JSON.stringify({ address: ADDRESS }), true))

    expect(response.status).toBe(200)
    const output = logSpy.mock.calls.flat().join('\n')
    expect(output).toContain('[HoldingsDebug]')
    expect(output).toContain('started holdings ledger sync request')
    expect(output).toContain('completed holdings ledger sync request')
    expect(output).toContain('"durationMs":')
    expect(output).toContain('"totalEvents":11')
    ;[
      ADDRESS,
      'revision_01',
      'private-wallet-hash',
      'private-source-fingerprint',
      'private-indexer',
      'private-event-payload',
      'private-cursor',
      'private-checksum'
    ].forEach((secret) => {
      expect(output.toLowerCase()).not.toContain(secret.toLowerCase())
    })
  })

  it('authenticates before attempting to parse a malformed body', async () => {
    const unauthorized = Response.json({ error: 'Unauthorized' }, { status: 401 })
    mocks.access.mockReturnValue(unauthorized)
    const request = createRequest('{')

    const response = await POST(request)

    expect(response).toBe(unauthorized)
    expect(mocks.access).toHaveBeenCalledWith(request, { requiresEnvio: true })
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it.each([
    ['malformed JSON', '{'],
    ['missing address', '{}'],
    ['array body', '[]'],
    ['invalid address', JSON.stringify({ address: '0x1234' })],
    ['extra field', JSON.stringify({ address: ADDRESS, sourceUrl: 'https://private.example' })],
    ['invalid forceRebuild', JSON.stringify({ address: ADDRESS, forceRebuild: 1 })],
    ['invalid compareLegacy', JSON.stringify({ address: ADDRESS, compareLegacy: null })]
  ])('rejects %s with the same fixed response', async (_label, body) => {
    const response = await POST(createRequest(body))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' })
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('returns a retryable 202 when another worker owns the lock', async () => {
    mocks.sync.mockResolvedValue({ status: 'syncing', reasonCode: 'lock_busy' })

    const response = await POST(createRequest(JSON.stringify({ address: ADDRESS })))

    expect(mocks.sync).toHaveBeenCalledWith({ address: ADDRESS })
    expect(response.status).toBe(202)
    expect(response.headers.get('Retry-After')).toBe('2')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
    await expect(response.json()).resolves.toEqual({ status: 'syncing', reasonCode: 'lock_busy' })
  })

  it('passes exact options and allowlists a successful response', async () => {
    const response = await POST(
      createRequest(JSON.stringify({ address: ADDRESS, forceRebuild: true, compareLegacy: false }))
    )

    expect(mocks.sync).toHaveBeenCalledWith({ address: ADDRESS, forceRebuild: true, compareLegacy: false })
    expect(response.status).toBe(200)
    const responseBody = await response.json()
    expect(responseBody).toEqual({
      status: 'updated',
      syncType: 'warm',
      revision: 'revision_01',
      sourceGeneration: 3,
      eventCounts: { cached: 10, fetched: 2, added: 1, replaced: 1, deleted: 0, total: 11 },
      envio: { pages: 2, rows: 12, chains: 2, validationQueries: 2, readyChains: 1, laggingChains: 1 },
      storage: { chunks: 3, indexShards: 64, encodedBytes: 1_024, newBlobs: 2 },
      dirty: { fromTimestamp: 1_700_000_000, fromDate: '2023-11-14', reasons: ['tail_append'] },
      parity: { status: 'match', reasonCode: null },
      durationMs: 50
    })

    const serialized = JSON.stringify(responseBody)
    const secrets = [
      'private-wallet-hash',
      'private-source-fingerprint',
      'private-indexer',
      'private-event-payload',
      'private-cursor',
      'private-checksum'
    ]
    secrets.forEach((secret) => {
      expect(serialized).not.toContain(secret)
    })
  })

  it('returns fixed typed and generic errors without logging or reflecting exception details', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.sync.mockRejectedValue(new mocks.TestSyncError('upstream_failed', 502))
    const typed = await POST(createRequest(JSON.stringify({ address: ADDRESS })))
    expect(typed.status).toBe(502)
    await expect(typed.json()).resolves.toEqual({
      error: 'Holdings ledger synchronization failed',
      reasonCode: 'upstream_failed'
    })

    mocks.sync.mockRejectedValue(new Error('https://private-indexer.example private-wallet-hash private-event'))
    const generic = await POST(createRequest(JSON.stringify({ address: ADDRESS })))
    expect(generic.status).toBe(500)
    await expect(generic.json()).resolves.toEqual({
      error: 'Holdings ledger synchronization failed',
      reasonCode: 'storage_failed'
    })
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('serves no-store admin CORS preflight responses', () => {
    const response = OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, x-admin-secret')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
  })
})
