import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const SNAPSHOT_ID = `snapshot_${'b'.repeat(32)}`
const REQUEST_NOW_MS = Date.UTC(2026, 7, 6, 12, 34, 56)
const LATEST_SETTLED_DAY_TIMESTAMP = Math.floor(Date.UTC(2026, 7, 5) / 1000)
const EVENT_UPPER_TIMESTAMP = Math.floor(REQUEST_NOW_MS / 1000)

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  createSnapshot: vi.fn(),
  getRedis: vi.fn(),
  sync: vi.fn()
}))

vi.mock('@/server/holdings/ledger/access', () => ({
  getLedgerAdminAccessError: mocks.access,
  isValidLedgerWalletAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value)
}))

vi.mock('@/server/lib/holdings/services/ledger/snapshot', () => ({
  createVerifiedLedgerSnapshot: mocks.createSnapshot
}))

vi.mock('@/server/lib/holdings/services/ledger/sync', () => ({
  HoldingsLedgerSyncError: class HoldingsLedgerSyncError extends Error {},
  syncHoldingsLedger: mocks.sync
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  getHoldingsLedgerRedisClient: mocks.getRedis
}))

import { POST } from '@/server/holdings/ledger/snapshot'

function createRequest(body: unknown, debug = false): Request {
  return new Request(`https://yearn.fi/api/holdings/ledger/snapshot${debug ? '?debug=1' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'secret' },
    body: JSON.stringify(body)
  })
}

function createUnchangedSyncResult(laggingChains = 0) {
  return {
    status: 'unchanged',
    syncType: 'warm',
    revision: 'private-sync-revision',
    sourceGeneration: 2,
    events: { cached: 10, fetched: 2, added: 1, replaced: 1, deleted: 0, total: 11 },
    streams: {},
    envio: {
      pages: 2,
      rows: 12,
      chains: 2,
      validationQueries: 0,
      strategy: 'warm-batched',
      requests: 2,
      presenceRequests: 0,
      batchedRequests: 2,
      continuationRequests: 0,
      readyChains: 2 - laggingChains,
      laggingChains
    },
    storage: { chunks: 3, indexShards: 64, encodedBytes: 1_024, newBlobs: 2 },
    dirty: { fromTimestamp: null, fromDate: null, reasons: [] },
    parity: { status: 'not-run', reasonCode: null },
    durationMs: 50
  }
}

describe('holdings ledger snapshot route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(REQUEST_NOW_MS)
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1,10')
    mocks.access.mockReturnValue(null)
    mocks.getRedis.mockReturnValue({})
    mocks.sync.mockResolvedValue(createUnchangedSyncResult())
    mocks.createSnapshot.mockResolvedValue({
      status: 'ready',
      pin: {
        snapshotId: SNAPSHOT_ID,
        latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
        eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
        expiresAtMs: REQUEST_NOW_MS + 30 * 60 * 1000
      },
      head: { revision: 'revision-1', sourceGeneration: 2 },
      headSource: 'active'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('keeps timing logs disabled by default', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const response = await POST(createRequest({ address: ADDRESS }))

    expect(response.status).toBe(201)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('emits opt-in timing logs without wallet, snapshot, revision, or source identifiers', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const response = await POST(createRequest({ address: ADDRESS }, true))

    expect(response.status).toBe(201)
    const output = logSpy.mock.calls.flat().join('\n')
    expect(output).toContain('[HoldingsDebug]')
    expect(output).toContain('started holdings ledger snapshot request')
    expect(output).toContain('completed ledger synchronization before snapshot')
    expect(output).toContain('completed verified snapshot pin operation')
    expect(output).toContain('completed holdings ledger snapshot request')
    expect(output).toContain('"durationMs":')
    expect(output).toContain('"strategy":"warm-batched"')
    expect(output).toContain('"requests":2')
    ;[ADDRESS, SNAPSHOT_ID, 'revision-1', 'private-sync-revision'].forEach((secret) => {
      expect(output.toLowerCase()).not.toContain(secret.toLowerCase())
    })
  })

  it('refreshes once and returns a server-issued coherent snapshot', async () => {
    const response = await POST(createRequest({ address: ADDRESS }))

    expect(response.status).toBe(201)
    expect(mocks.sync).toHaveBeenCalledWith({
      address: ADDRESS,
      forceRebuild: undefined,
      compareLegacy: undefined
    })
    expect(mocks.createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        latestSettledDayTimestamp: LATEST_SETTLED_DAY_TIMESTAMP,
        eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
        expectedChainIds: [1, 10],
        fallbackToPrevious: false,
        nowMs: REQUEST_NOW_MS
      })
    )
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      snapshotId: SNAPSHOT_ID,
      revision: 'revision-1',
      sourceGeneration: 2,
      headSource: 'active',
      freshness: 'refreshed'
    })
  })

  it('can pin the last verified head without calling Envio', async () => {
    const response = await POST(createRequest({ address: ADDRESS, refresh: false }))

    expect(response.status).toBe(201)
    expect(mocks.access).toHaveBeenCalledTimes(1)
    expect(mocks.sync).not.toHaveBeenCalled()
    expect(mocks.createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackToPrevious: true, nowMs: REQUEST_NOW_MS })
    )
    await expect(response.json()).resolves.toMatchObject({ freshness: 'last-known-good' })
  })

  it('rejects refresh-only controls when pinning last-known-good state', async () => {
    const response = await POST(createRequest({ address: ADDRESS, refresh: false, forceRebuild: true }))

    expect(response.status).toBe(400)
    expect(mocks.sync).not.toHaveBeenCalled()
    expect(mocks.createSnapshot).not.toHaveBeenCalled()
  })

  it('starts the 30 minute logical lifetime after synchronization while retaining the request cutoff', async () => {
    const postSyncNowMs = REQUEST_NOW_MS + 5 * 60 * 1000
    mocks.sync.mockImplementationOnce(async () => {
      vi.setSystemTime(postSyncNowMs)
      return createUnchangedSyncResult()
    })

    const response = await POST(createRequest({ address: ADDRESS }))

    expect(response.status).toBe(201)
    expect(mocks.createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        eventUpperTimestamp: EVENT_UPPER_TIMESTAMP,
        nowMs: postSyncNowMs
      })
    )
  })

  it('returns retry guidance instead of pinning while another sync owns the lock', async () => {
    mocks.sync.mockResolvedValueOnce({ status: 'syncing', reasonCode: 'lock_busy' })

    const response = await POST(createRequest({ address: ADDRESS }))

    expect(response.status).toBe(202)
    expect(response.headers.get('Retry-After')).toBe('2')
    expect(mocks.createSnapshot).not.toHaveBeenCalled()
  })

  it('does not pin a wall-clock snapshot while an Envio chain is lagging', async () => {
    mocks.sync.mockResolvedValueOnce(createUnchangedSyncResult(1))

    const response = await POST(createRequest({ address: ADDRESS }))

    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('30')
    await expect(response.json()).resolves.toMatchObject({ reasonCode: 'source_lagging' })
    expect(mocks.createSnapshot).not.toHaveBeenCalled()
  })

  it('authenticates before parsing the request body', async () => {
    mocks.access.mockReturnValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await POST(createRequest({ unexpected: true }))

    expect(response.status).toBe(401)
    expect(mocks.sync).not.toHaveBeenCalled()
    expect(mocks.createSnapshot).not.toHaveBeenCalled()
  })
})
