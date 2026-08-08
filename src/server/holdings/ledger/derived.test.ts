import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { THoldingsEventSource } from '@/server/lib/holdings/services/eventSource'
import { LEDGER_CALCULATION_VERSION } from '@/server/lib/holdings/services/ledger/state'

const SNAPSHOT_ID = `snapshot_${'a'.repeat(32)}`
const ADDRESS = '0x1111111111111111111111111111111111111111'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  createEventSource: vi.fn(),
  getRedis: vi.fn(),
  loadSnapshot: vi.fn()
}))

vi.mock('@/server/holdings/ledger/access', () => ({
  getLedgerAdminAccessError: mocks.access,
  isValidLedgerWalletAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value)
}))

vi.mock('@/server/lib/holdings/services/ledger/consumer', () => ({
  createLedgerEventSource: mocks.createEventSource
}))

vi.mock('@/server/lib/holdings/services/ledger/snapshot', () => ({
  loadVerifiedLedgerSnapshot: mocks.loadSnapshot
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  getHoldingsLedgerRedisClient: mocks.getRedis
}))

import { handleLedgerDerivedRequest } from '@/server/holdings/ledger/derived'

const EVENT_SOURCE: THoldingsEventSource = {
  key: 'ledger-source',
  latestSettledDayTimestamp: 1_000,
  eventUpperTimestamp: 1_100,
  load: vi.fn()
}

function createRequest(query = `address=${ADDRESS}&snapshotId=${SNAPSHOT_ID}`): Request {
  return new Request(`https://yearn.fi/api/holdings/ledger/history?${query}`, {
    headers: { 'x-admin-secret': 'secret' }
  })
}

describe('ledger derived route coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1,10')
    mocks.access.mockReturnValue(null)
    mocks.getRedis.mockReturnValue({})
    mocks.createEventSource.mockReturnValue(EVENT_SOURCE)
    mocks.loadSnapshot.mockResolvedValue({
      status: 'ready',
      pin: {
        snapshotId: SNAPSHOT_ID,
        latestSettledDayTimestamp: 1_000,
        eventUpperTimestamp: 1_100
      },
      head: { revision: 'revision-1', sourceGeneration: 3 },
      headSource: 'active',
      manifest: {
        recordCount: 10,
        chunks: [{ checksum: 'chunk-checksum' }],
        indexes: [{ checksum: 'index-checksum' }]
      },
      verified: { opaque: true }
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('authenticates before parsing wallet-scoped query parameters', async () => {
    mocks.access.mockReturnValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }))
    const handler = vi.fn()

    const response = await handleLedgerDerivedRequest(createRequest(''), handler)

    expect(response.status).toBe(401)
    expect(mocks.loadSnapshot).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
  })

  it('can require Envio for protocol companion-event enrichment before reading Redis', async () => {
    const unavailable = Response.json({ error: 'Holdings ledger source is unavailable' }, { status: 503 })
    mocks.access.mockReturnValueOnce(unavailable)
    const handler = vi.fn()

    const response = await handleLedgerDerivedRequest(createRequest(), handler, { requiresEnvio: true })

    expect(response.status).toBe(503)
    expect(mocks.access).toHaveBeenCalledWith(expect.any(Request), { requiresEnvio: true })
    expect(mocks.loadSnapshot).not.toHaveBeenCalled()
  })

  it('replays one verified snapshot with derived caches bypassed and safe revision headers', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { value: 42 },
          { headers: { 'X-Handler-Header': 'preserved', 'Cache-Control': 'public, max-age=60' } }
        )
      )

    const response = await handleLedgerDerivedRequest(createRequest(), handler)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ value: 42 })
    expect(handler).toHaveBeenCalledWith(expect.any(Request), {
      eventSource: EVENT_SOURCE,
      cacheMode: 'bypass'
    })
    expect(mocks.loadSnapshot).toHaveBeenCalledWith(expect.objectContaining({ expectedChainIds: [1, 10] }))
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
    expect(response.headers.get('X-Handler-Header')).toBe('preserved')
    expect(response.headers.get('X-Holdings-Ledger-Snapshot')).toBe(SNAPSHOT_ID)
    expect(response.headers.get('X-Holdings-Ledger-Revision')).toBe('revision-1')
    expect(response.headers.get('X-Holdings-Ledger-Source-Generation')).toBe('3')
    expect(response.headers.get('X-Holdings-Ledger-Calculation-Version')).toBe(LEDGER_CALCULATION_VERSION)
  })

  it('emits opt-in coordinator timings without logging wallet or snapshot identifiers', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const handler = vi.fn().mockResolvedValue(Response.json({ value: 42 }))

    const response = await handleLedgerDerivedRequest(
      createRequest(`address=${ADDRESS}&snapshotId=${SNAPSHOT_ID}&debug=1`),
      handler,
      {
        debugRoute: 'ledger-history'
      }
    )

    expect(response.status).toBe(200)
    const output = consoleLog.mock.calls.flat().join('\n')
    expect(output).toContain('loaded and verified pinned ledger snapshot')
    expect(output).toContain('completed derived holdings calculation')
    expect(output).toContain('"durationMs"')
    expect(output).not.toContain(ADDRESS)
    expect(output).not.toContain(SNAPSHOT_ID)
    expect(output).not.toContain('revision-1')
    expect(output).not.toContain('chunk-checksum')
    consoleLog.mockRestore()
  })

  it('keeps coordinator timing logs disabled by default', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const handler = vi.fn().mockResolvedValue(Response.json({ value: 42 }))

    const response = await handleLedgerDerivedRequest(createRequest(), handler, { debugRoute: 'ledger-history' })

    expect(response.status).toBe(200)
    expect(consoleLog).not.toHaveBeenCalled()
    consoleLog.mockRestore()
  })

  it('fails closed when the pinned snapshot is missing', async () => {
    mocks.loadSnapshot.mockResolvedValueOnce({ status: 'missing' })
    const handler = vi.fn()

    const response = await handleLedgerDerivedRequest(createRequest(), handler)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ reasonCode: 'missing' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects invalid server snapshot identifiers before Redis reads', async () => {
    const handler = vi.fn()
    const response = await handleLedgerDerivedRequest(
      createRequest(`address=${ADDRESS}&snapshotId=user-controlled`),
      handler
    )

    expect(response.status).toBe(400)
    expect(mocks.loadSnapshot).not.toHaveBeenCalled()
  })
})
