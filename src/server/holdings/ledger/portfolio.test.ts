import { beforeEach, describe, expect, it, vi } from 'vitest'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const UPDATED_AT_MS = Date.UTC(2026, 7, 8, 12)
const EVENT_SOURCE = {
  key: 'wallet-ledger-source',
  latestSettledDayTimestamp: Date.UTC(2026, 7, 7) / 1000,
  eventUpperTimestamp: UPDATED_AT_MS / 1000,
  load: vi.fn()
}

const LEDGER = {
  schemaVersion: 1,
  calculationVersion: 'calculation-v1',
  walletHash: 'wallet-hash',
  sourceFingerprint: 'source-fingerprint',
  sourceGeneration: 1,
  coverage: [
    { chainId: 1, startBlock: 100, endBlock: null, completeThroughBlock: 1_000 },
    { chainId: 10, startBlock: 200, endBlock: null, completeThroughBlock: 2_000 }
  ],
  streams: {
    v3Deposits: [{ id: 'deposit' }],
    v3Withdrawals: [],
    v2Deposits: [],
    v2Withdrawals: [],
    transfersIn: [{ id: 'transfer' }],
    transfersOut: []
  },
  createdAtMs: UPDATED_AT_MS - 1_000,
  updatedAtMs: UPDATED_AT_MS,
  revision: 'ledger-revision',
  encodedBytes: 100,
  decodedBytes: 200
}

const mocks = vi.hoisted(() => ({
  createWalletLedgerEventSource: vi.fn(),
  getLedgerAdminAccessError: vi.fn(),
  getLedgerReadinessError: vi.fn(),
  getHistoricalHoldingsChart: vi.fn(),
  getHoldingsProtocolReturnHistory: vi.fn(),
  getLedgerProtocolReturnRows: vi.fn(),
  isWalletLedgerCompatible: vi.fn(),
  readWalletLedger: vi.fn(),
  synchronizeWalletLedger: vi.fn()
}))

vi.mock('@/server/holdings/ledger/access', () => ({
  getLedgerAdminAccessError: mocks.getLedgerAdminAccessError,
  getLedgerReadinessError: mocks.getLedgerReadinessError,
  isValidLedgerWalletAddress: (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)
}))

vi.mock('@/server/lib/holdings', () => ({
  getHistoricalHoldingsChart: mocks.getHistoricalHoldingsChart,
  getHoldingsProtocolReturnHistory: mocks.getHoldingsProtocolReturnHistory
}))

vi.mock('@/server/lib/holdings/services/ledger/rows', () => ({
  getLedgerProtocolReturnRows: mocks.getLedgerProtocolReturnRows
}))

vi.mock('@/server/lib/holdings/services/ledger/wallet', () => ({
  createWalletLedgerEventSource: mocks.createWalletLedgerEventSource,
  isWalletLedgerCompatible: mocks.isWalletLedgerCompatible,
  readWalletLedger: mocks.readWalletLedger,
  synchronizeWalletLedger: mocks.synchronizeWalletLedger
}))

import { GET, OPTIONS } from '@/server/holdings/ledger/portfolio'

function createRequest(query = ''): Request {
  return new Request(`https://yearn.fi/api/holdings/ledger/portfolio?address=${ADDRESS}${query}`)
}

function createBalance(hasActivity = true) {
  return {
    address: ADDRESS.toLowerCase(),
    hasActivity,
    dataPoints: hasActivity ? [{ date: '2026-08-07', value: 42 }] : []
  }
}

function createProtocolReturn(totalVaults = 1) {
  return {
    address: ADDRESS.toLowerCase(),
    version: 'all',
    timeframe: '1y',
    generatedAt: '2026-08-08T12:00:00.000Z',
    summary: { totalVaults },
    dataPoints: totalVaults > 0 ? [{ date: '2026-08-07' }] : [],
    familySeries: []
  }
}

function createGrowth(totalVaults = 1) {
  return {
    address: ADDRESS.toLowerCase(),
    version: 'all',
    generatedAt: '2026-08-08T12:00:00.000Z',
    summary: { totalVaults },
    vaults: totalVaults > 0 ? [{ chainId: 1, vaultAddress: '0x2222222222222222222222222222222222222222' }] : []
  }
}

describe('wallet ledger portfolio route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getLedgerAdminAccessError.mockReturnValue(null)
    mocks.getLedgerReadinessError.mockReturnValue(null)
    mocks.isWalletLedgerCompatible.mockReturnValue(true)
    mocks.synchronizeWalletLedger.mockResolvedValue({ status: 'ready', outcome: 'updated', ledger: LEDGER })
    mocks.readWalletLedger.mockResolvedValue({ status: 'missing' })
    mocks.createWalletLedgerEventSource.mockReturnValue(EVENT_SOURCE)
    mocks.getHistoricalHoldingsChart.mockResolvedValue(createBalance())
    mocks.getHoldingsProtocolReturnHistory.mockResolvedValue(createProtocolReturn())
    mocks.getLedgerProtocolReturnRows.mockResolvedValue(createGrowth())
  })

  it('allows the protected rebuild header in CORS preflight', () => {
    const response = OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('x-admin-secret')
  })

  it('refreshes one wallet ledger and calculates all portfolio projections from the same event source', async () => {
    const response = await GET(createRequest('&version=v3&denomination=eth&timeframe=all'))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0, must-revalidate')
    expect(mocks.getLedgerAdminAccessError).not.toHaveBeenCalled()
    expect(mocks.synchronizeWalletLedger).toHaveBeenCalledWith({ address: ADDRESS, forceRebuild: false })
    expect(mocks.createWalletLedgerEventSource).toHaveBeenCalledWith({
      ledger: LEDGER,
      eventUpperTimestamp: UPDATED_AT_MS / 1000,
      latestSettledDayTimestamp: Date.UTC(2026, 7, 7) / 1000
    })
    expect(mocks.getHistoricalHoldingsChart).toHaveBeenCalledWith(
      ADDRESS,
      'v3',
      'seq',
      'paged',
      'eth',
      'all',
      undefined,
      expect.objectContaining({ eventSource: EVENT_SOURCE, cacheMode: 'bypass' })
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
        eventSource: EVENT_SOURCE,
        cacheMode: 'bypass',
        protocolReturnEventEnrichment: 'address-only'
      })
    )
    expect(mocks.getLedgerProtocolReturnRows).toHaveBeenCalledWith({
      address: ADDRESS,
      version: 'v3',
      eventSource: EVENT_SOURCE
    })
    await expect(response.json()).resolves.toMatchObject({
      address: ADDRESS.toLowerCase(),
      version: 'v3',
      denomination: 'eth',
      timeframe: 'all',
      ledger: {
        revision: 'ledger-revision',
        freshness: 'refreshed',
        syncedAtMs: UPDATED_AT_MS,
        eventUpperTimestamp: UPDATED_AT_MS / 1000,
        latestSettledDayTimestamp: Date.UTC(2026, 7, 7) / 1000,
        eventCount: 2,
        coverageByChain: [
          { chainId: 1, progressBlock: 1_000 },
          { chainId: 10, progressBlock: 2_000 }
        ]
      },
      balance: { dataPoints: [{ date: '2026-08-07', value: 42 }] },
      protocolReturn: { summary: { totalVaults: 1 } },
      growth: { summary: { totalVaults: 1 } }
    })
  })

  it('reads the cached wallet value without synchronizing when refresh is disabled', async () => {
    mocks.readWalletLedger.mockResolvedValueOnce({ status: 'ready', ledger: LEDGER })

    const response = await GET(createRequest('&refresh=0'))

    expect(response.status).toBe(200)
    expect(mocks.synchronizeWalletLedger).not.toHaveBeenCalled()
    expect(mocks.readWalletLedger).toHaveBeenCalledWith({ address: ADDRESS })
    await expect(response.json()).resolves.toMatchObject({ ledger: { freshness: 'cached' } })
  })

  it('does not report an uncached no-refresh request as an empty wallet', async () => {
    const response = await GET(createRequest('&refresh=0'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'No stored holdings ledger is available',
      reasonCode: 'missing'
    })
  })

  it('reports a recently synchronized wallet value as cached when no source check was needed', async () => {
    mocks.synchronizeWalletLedger.mockResolvedValueOnce({ status: 'ready', outcome: 'fresh', ledger: LEDGER })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ledger: { freshness: 'cached' } })
  })

  it('passes an explicit forced rebuild into synchronization', async () => {
    const response = await GET(createRequest('&forceRebuild=1'))

    expect(response.status).toBe(200)
    expect(mocks.getLedgerAdminAccessError).toHaveBeenCalledWith(expect.any(Request), { requiresEnvio: true })
    expect(mocks.synchronizeWalletLedger).toHaveBeenCalledWith({ address: ADDRESS, forceRebuild: true })
  })

  it('keeps forced rebuilds behind ledger admin access', async () => {
    mocks.getLedgerAdminAccessError.mockReturnValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await GET(createRequest('&forceRebuild=1'))

    expect(response.status).toBe(401)
    expect(mocks.synchronizeWalletLedger).not.toHaveBeenCalled()
  })

  it('fails over before synchronization when the public ledger path is not ready', async () => {
    mocks.getLedgerReadinessError.mockReturnValueOnce({ error: 'Holdings ledger mode is off' })

    const response = await GET(createRequest())

    expect(response.status).toBe(503)
    expect(mocks.getLedgerReadinessError).toHaveBeenCalledWith({ requiresEnvio: true, requiresReadWrite: true })
    expect(mocks.synchronizeWalletLedger).not.toHaveBeenCalled()
  })

  it('returns syncing for a cold wallet when another request owns the refresh lock', async () => {
    mocks.synchronizeWalletLedger.mockResolvedValueOnce({
      status: 'syncing',
      reasonCode: 'lock_busy'
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(202)
    expect(response.headers.get('Retry-After')).toBe('2')
    await expect(response.json()).resolves.toEqual({ status: 'syncing', reasonCode: 'lock_busy' })
    expect(mocks.getHistoricalHoldingsChart).not.toHaveBeenCalled()
  })

  it('serves the existing wallet value as stale when another request is refreshing it', async () => {
    mocks.synchronizeWalletLedger.mockResolvedValueOnce({
      status: 'syncing',
      reasonCode: 'lock_busy'
    })
    mocks.readWalletLedger.mockResolvedValueOnce({ status: 'ready', ledger: LEDGER })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ledger: { freshness: 'stale' } })
  })

  it('never serves an incompatible cached wallet value', async () => {
    mocks.readWalletLedger.mockResolvedValueOnce({ status: 'ready', ledger: LEDGER })
    mocks.isWalletLedgerCompatible.mockReturnValueOnce(false)

    const response = await GET(createRequest('&refresh=0'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Stored holdings ledger is incompatible',
      reasonCode: 'incompatible'
    })
    expect(mocks.getHistoricalHoldingsChart).not.toHaveBeenCalled()
  })

  it('returns success for a closed wallet with history and no open growth rows', async () => {
    mocks.getLedgerProtocolReturnRows.mockResolvedValueOnce(createGrowth(0))

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ growth: { summary: { totalVaults: 0 }, vaults: [] } })
  })

  it('returns not found only when every portfolio projection is empty', async () => {
    mocks.getHistoricalHoldingsChart.mockResolvedValueOnce(createBalance(false))
    mocks.getHoldingsProtocolReturnHistory.mockResolvedValueOnce(createProtocolReturn(0))
    mocks.getLedgerProtocolReturnRows.mockResolvedValueOnce(createGrowth(0))

    const response = await GET(createRequest())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'No holdings found for address' })
  })

  it('rejects invalid refresh combinations before accessing the wallet ledger', async () => {
    const [invalidFlag, invalidCombination] = await Promise.all([
      GET(createRequest('&refresh=yes')),
      GET(createRequest('&refresh=0&forceRebuild=1'))
    ])

    expect(invalidFlag.status).toBe(400)
    expect(invalidCombination.status).toBe(400)
    expect(mocks.synchronizeWalletLedger).not.toHaveBeenCalled()
    expect(mocks.readWalletLedger).not.toHaveBeenCalled()
  })
})
