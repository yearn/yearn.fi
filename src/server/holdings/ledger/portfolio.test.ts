import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeferred } from '@/server/lib/holdings/test-utils/deferred'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const UPDATED_AT_MS = Date.UTC(2026, 7, 8, 12)
const WALLET_HASH = 'a'.repeat(64)
const SOURCE_FINGERPRINT = 'b'.repeat(64)
const LEDGER_REVISION = 'c'.repeat(64)
const EVENT_REVISION = 'd'.repeat(64)
const TOTALS_CACHE = { read: vi.fn(), write: vi.fn() }
const DERIVED_CACHE_IDENTITY = {
  walletHash: WALLET_HASH,
  ledgerRevision: LEDGER_REVISION,
  eventRevision: EVENT_REVISION,
  sourceGeneration: 1,
  appliedInvalidationSequence: 2,
  ledgerCalculationVersion: 'calculation-v1',
  latestSettledDayTimestamp: Date.UTC(2026, 7, 7) / 1000,
  version: 'all',
  timeframe: '1y'
}
const VALUATION_LOADER = {
  key: 'valuation-loader',
  fetchVaultPps: vi.fn(),
  fetchHistoricalPrices: vi.fn()
}
const SETTLED_CONTEXT = Promise.resolve({ key: 'settled-context' })
const EVENT_SOURCE = {
  key: 'wallet-ledger-source',
  latestSettledDayTimestamp: Date.UTC(2026, 7, 7) / 1000,
  eventUpperTimestamp: UPDATED_AT_MS / 1000,
  load: vi.fn()
}

const LEDGER = {
  schemaVersion: 3,
  calculationVersion: 'calculation-v1',
  walletHash: WALLET_HASH,
  sourceFingerprint: SOURCE_FINGERPRINT,
  sourceGeneration: 1,
  appliedInvalidationSequence: 2,
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
  reconciledAtMs: UPDATED_AT_MS - 1_000,
  revision: LEDGER_REVISION,
  eventRevision: EVENT_REVISION,
  encodedBytes: 100,
  decodedBytes: 200
}

const SYNC_TRANSITION = {
  previousEventRevision: EVENT_REVISION,
  previousAppliedInvalidationSequence: 2,
  dirtyFromTimestamp: null
}

const mocks = vi.hoisted(() => ({
  createWalletLedgerDailyUsdTotalsCache: vi.fn(),
  createWalletLedgerEventSource: vi.fn(),
  getWalletLedgerDailyUsdDateRange: vi.fn(),
  createHoldingsValuationLoader: vi.fn(),
  getLedgerAdminAccessError: vi.fn(),
  getLedgerReadinessError: vi.fn(),
  getHistoricalHoldingsChart: vi.fn(),
  getHoldingsProtocolReturnHistory: vi.fn(),
  getLedgerProtocolReturnRows: vi.fn(),
  getSettledAddressScopedContext: vi.fn(),
  getRedis: vi.fn(),
  after: vi.fn(),
  enqueueWalletLedgerDerivedPortfolioCacheWrite: vi.fn(),
  readInvalidationHead: vi.fn(),
  readVerifiedWalletLedgerHeaderForAddress: vi.fn(),
  isWalletLedgerCompatible: vi.fn(),
  readWalletLedgerDerivedPortfolioCache: vi.fn(),
  readWalletLedger: vi.fn(),
  synchronizeWalletLedger: vi.fn(),
  prefetchGlobalVaultMetadata: vi.fn(),
  resetGlobalVaultMetadataCacheForBenchmark: vi.fn()
}))

vi.mock('next/server', () => ({ after: mocks.after }))

vi.mock('@/server/holdings/ledger/access', () => ({
  getLedgerAdminAccessError: mocks.getLedgerAdminAccessError,
  getLedgerReadinessError: mocks.getLedgerReadinessError,
  isValidLedgerWalletAddress: (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address)
}))

vi.mock('@/server/lib/holdings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/lib/holdings')>()),
  getHistoricalHoldingsChart: mocks.getHistoricalHoldingsChart,
  getHoldingsProtocolReturnHistory: mocks.getHoldingsProtocolReturnHistory
}))

vi.mock('@/server/lib/holdings/services/ledger/rows', () => ({
  getLedgerProtocolReturnRows: mocks.getLedgerProtocolReturnRows
}))

vi.mock('@/server/lib/holdings/services/valuationLoader', () => ({
  createHoldingsValuationLoader: mocks.createHoldingsValuationLoader
}))

vi.mock('@/server/lib/holdings/services/vaults', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/lib/holdings/services/vaults')>()),
  prefetchGlobalVaultMetadata: mocks.prefetchGlobalVaultMetadata,
  resetGlobalVaultMetadataCacheForBenchmark: mocks.resetGlobalVaultMetadataCacheForBenchmark
}))

vi.mock('@/server/lib/holdings/services/settledHoldingsContext', () => ({
  getSettledAddressScopedContext: mocks.getSettledAddressScopedContext
}))

vi.mock('@/server/lib/holdings/services/ledger/walletDerivedCache', () => ({
  enqueueWalletLedgerDerivedPortfolioCacheWrite: mocks.enqueueWalletLedgerDerivedPortfolioCacheWrite,
  readWalletLedgerDerivedPortfolioCache: mocks.readWalletLedgerDerivedPortfolioCache
}))

vi.mock('@/server/lib/holdings/services/ledger/wallet', () => ({
  createWalletLedgerDailyUsdTotalsCache: mocks.createWalletLedgerDailyUsdTotalsCache,
  createWalletLedgerEventSource: mocks.createWalletLedgerEventSource,
  getWalletLedgerDailyUsdDateRange: mocks.getWalletLedgerDailyUsdDateRange,
  isWalletLedgerCompatible: mocks.isWalletLedgerCompatible,
  readWalletLedger: mocks.readWalletLedger,
  readVerifiedWalletLedgerHeaderForAddress: mocks.readVerifiedWalletLedgerHeaderForAddress,
  synchronizeWalletLedger: mocks.synchronizeWalletLedger
}))

vi.mock('@/server/lib/holdings/services/ledger/walletInvalidation', () => ({
  readWalletLedgerInvalidationHead: mocks.readInvalidationHead
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  getHoldingsLedgerRedisClient: mocks.getRedis
}))

import { GET, OPTIONS } from '@/server/holdings/ledger/portfolio'

function createRequest(query = ''): Request {
  return new Request(`https://yearn.fi/api/holdings/ledger/portfolio?address=${ADDRESS}${query}`)
}

function createBalance(hasActivity = true, isComplete = true) {
  return {
    address: ADDRESS.toLowerCase(),
    hasActivity,
    isComplete,
    dataPoints: hasActivity ? [{ date: '2026-08-07', value: 42, isComplete }] : []
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
    mocks.synchronizeWalletLedger.mockResolvedValue({
      status: 'ready',
      outcome: 'updated',
      syncType: 'warm',
      ledger: LEDGER,
      effectiveCoverage: LEDGER.coverage,
      coveredAtMs: UPDATED_AT_MS,
      transition: SYNC_TRANSITION
    })
    mocks.readWalletLedger.mockResolvedValue({ status: 'missing' })
    mocks.readVerifiedWalletLedgerHeaderForAddress.mockResolvedValue({ status: 'missing' })
    mocks.getRedis.mockReturnValue({ marker: 'redis' })
    mocks.readInvalidationHead.mockResolvedValue(2)
    mocks.createWalletLedgerEventSource.mockReturnValue(EVENT_SOURCE)
    mocks.createWalletLedgerDailyUsdTotalsCache.mockReturnValue(TOTALS_CACHE)
    mocks.getWalletLedgerDailyUsdDateRange.mockReturnValue({
      startDate: '2026-08-07',
      endDate: '2026-08-07',
      dates: ['2026-08-07']
    })
    TOTALS_CACHE.read.mockResolvedValue({ totals: [], oldestUpdatedAt: null })
    TOTALS_CACHE.write.mockResolvedValue(true)
    mocks.createHoldingsValuationLoader.mockReturnValue(VALUATION_LOADER)
    mocks.prefetchGlobalVaultMetadata.mockResolvedValue(undefined)
    mocks.resetGlobalVaultMetadataCacheForBenchmark.mockResolvedValue(undefined)
    mocks.getSettledAddressScopedContext.mockReturnValue(SETTLED_CONTEXT)
    mocks.readWalletLedgerDerivedPortfolioCache.mockResolvedValue({ status: 'miss' })
    mocks.enqueueWalletLedgerDerivedPortfolioCacheWrite.mockReturnValue({
      status: 'queued',
      persistence: Promise.resolve('saved')
    })
    mocks.getHistoricalHoldingsChart.mockResolvedValue(createBalance())
    mocks.getHoldingsProtocolReturnHistory.mockResolvedValue(createProtocolReturn())
    mocks.getLedgerProtocolReturnRows.mockResolvedValue(createGrowth())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
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
    expect(mocks.prefetchGlobalVaultMetadata).toHaveBeenCalledTimes(1)
    expect(mocks.prefetchGlobalVaultMetadata.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.synchronizeWalletLedger.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    expect(mocks.synchronizeWalletLedger).toHaveBeenCalledWith({
      address: ADDRESS,
      forceRebuild: false,
      prefetchVaultMetadata: true,
      onVaultsDiscovered: expect.any(Function)
    })
    expect(mocks.createWalletLedgerEventSource).toHaveBeenCalledWith({
      ledger: LEDGER,
      eventUpperTimestamp: UPDATED_AT_MS / 1000,
      latestSettledDayTimestamp: Date.UTC(2026, 7, 7) / 1000
    })
    expect(mocks.getSettledAddressScopedContext).toHaveBeenCalledWith({
      userAddress: ADDRESS,
      fetchType: 'seq',
      paginationMode: 'paged',
      eventSource: EVENT_SOURCE
    })
    expect(mocks.readWalletLedgerDerivedPortfolioCache).toHaveBeenCalledWith({
      ...DERIVED_CACHE_IDENTITY,
      version: 'v3',
      timeframe: 'all'
    })
    expect(mocks.getHistoricalHoldingsChart).toHaveBeenCalledWith(
      ADDRESS,
      'v3',
      'seq',
      'paged',
      'eth',
      'all',
      undefined,
      expect.objectContaining({
        eventSource: EVENT_SOURCE,
        totalsCache: TOTALS_CACHE,
        valuationLoader: VALUATION_LOADER
      })
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
        valuationLoader: VALUATION_LOADER,
        settledContext: SETTLED_CONTEXT,
        protocolReturnEventEnrichment: 'address-only'
      })
    )
    expect(mocks.getLedgerProtocolReturnRows).toHaveBeenCalledWith({
      address: ADDRESS,
      version: 'v3',
      eventSource: EVENT_SOURCE,
      options: { valuationLoader: VALUATION_LOADER, settledContext: SETTLED_CONTEXT }
    })
    expect(mocks.enqueueWalletLedgerDerivedPortfolioCacheWrite).toHaveBeenCalledWith(
      { ...DERIVED_CACHE_IDENTITY, version: 'v3', timeframe: 'all' },
      { protocolReturn: createProtocolReturn(), growth: createGrowth() }
    )
    await expect(response.json()).resolves.toMatchObject({
      address: ADDRESS.toLowerCase(),
      version: 'v3',
      denomination: 'eth',
      timeframe: 'all',
      ledger: {
        revision: LEDGER_REVISION,
        eventRevision: EVENT_REVISION,
        appliedInvalidationSequence: 2,
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
      balance: {
        isComplete: true,
        dataPoints: [{ date: '2026-08-07', value: 42, isComplete: true }]
      },
      protocolReturn: { summary: { totalVaults: 1 } },
      growth: { summary: { totalVaults: 1 } }
    })
  })

  it('returns without waiting for derived Redis persistence and extends it with after', async () => {
    const persistence = createDeferred<'saved'>()
    mocks.enqueueWalletLedgerDerivedPortfolioCacheWrite.mockReturnValueOnce({
      status: 'queued',
      persistence: persistence.promise
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    expect(mocks.after).toHaveBeenCalledTimes(1)
    const afterTask = mocks.after.mock.calls[0]?.[0] as (() => Promise<'saved'>) | undefined
    expect(afterTask?.()).toBe(persistence.promise)

    persistence.resolve('saved')
    await persistence.promise
  })

  it('returns without waiting for daily USD persistence and extends it with after', async () => {
    const persistence = createDeferred<boolean>()
    mocks.enqueueWalletLedgerDerivedPortfolioCacheWrite.mockReturnValueOnce({
      status: 'memory-only',
      persistence: null
    })
    mocks.getHistoricalHoldingsChart.mockImplementationOnce((...args: unknown[]) => {
      const options = args[7] as { readonly scheduleTotalsCacheWrite?: (write: Promise<boolean>) => void } | undefined
      options?.scheduleTotalsCacheWrite?.(persistence.promise)
      return Promise.resolve(createBalance())
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    expect(mocks.after).toHaveBeenCalledTimes(1)
    const afterTask = mocks.after.mock.calls[0]?.[0] as (() => Promise<boolean>) | undefined
    expect(afterTask?.()).toBe(persistence.promise)

    persistence.resolve(true)
    await persistence.promise
  })

  it('skips projection cache reads after a cold bootstrap while preserving daily USD writes', async () => {
    mocks.synchronizeWalletLedger.mockResolvedValueOnce({
      status: 'ready',
      outcome: 'updated',
      syncType: 'bootstrap',
      ledger: LEDGER,
      effectiveCoverage: LEDGER.coverage,
      coveredAtMs: UPDATED_AT_MS,
      transition: {
        previousEventRevision: null,
        previousAppliedInvalidationSequence: null,
        dirtyFromTimestamp: null
      }
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    expect(mocks.readWalletLedgerDerivedPortfolioCache).not.toHaveBeenCalled()
    const balanceOptions = mocks.getHistoricalHoldingsChart.mock.calls[0]?.[7] as
      | {
          readonly totalsCache?: {
            readonly read: (startDate: string, endDate: string) => Promise<unknown>
            readonly write: typeof TOTALS_CACHE.write
          }
        }
      | undefined
    expect(balanceOptions?.totalsCache).not.toBe(TOTALS_CACHE)
    await expect(balanceOptions?.totalsCache?.read('2026-08-07', '2026-08-07')).resolves.toEqual({
      totals: [],
      oldestUpdatedAt: null
    })
    expect(TOTALS_CACHE.read).not.toHaveBeenCalled()
    expect(balanceOptions?.totalsCache?.write).toBe(TOTALS_CACHE.write)
  })

  it('preserves daily USD reads but skips an impossible derived hit after wallet events change', async () => {
    mocks.synchronizeWalletLedger.mockResolvedValueOnce({
      status: 'ready',
      outcome: 'updated',
      syncType: 'warm',
      ledger: LEDGER,
      effectiveCoverage: LEDGER.coverage,
      coveredAtMs: UPDATED_AT_MS,
      transition: {
        previousEventRevision: 'e'.repeat(64),
        previousAppliedInvalidationSequence: 2,
        dirtyFromTimestamp: UPDATED_AT_MS / 1000
      }
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    expect(mocks.readWalletLedgerDerivedPortfolioCache).not.toHaveBeenCalled()
    expect(mocks.getHistoricalHoldingsChart).toHaveBeenCalledWith(
      ADDRESS,
      'all',
      'seq',
      'paged',
      'usd',
      '1y',
      undefined,
      expect.objectContaining({ totalsCache: TOTALS_CACHE })
    )
  })

  it('starts request-scoped PPS loading during synchronization without awaiting the prefetch', async () => {
    const ppsResult = createDeferred<Map<string, never>>()
    VALUATION_LOADER.fetchVaultPps.mockReturnValueOnce(ppsResult.promise)
    mocks.synchronizeWalletLedger.mockImplementationOnce(
      async ({ onVaultsDiscovered }: { readonly onVaultsDiscovered?: (vaults: readonly unknown[]) => void }) => {
        onVaultsDiscovered?.([{ chainId: 1, vaultAddress: '0x2222222222222222222222222222222222222222' }])
        return {
          status: 'ready',
          outcome: 'updated',
          syncType: 'warm',
          ledger: LEDGER,
          effectiveCoverage: LEDGER.coverage,
          coveredAtMs: UPDATED_AT_MS,
          transition: SYNC_TRANSITION
        }
      }
    )

    try {
      const response = await GET(createRequest())

      expect(response.status).toBe(200)
      expect(mocks.createHoldingsValuationLoader.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.synchronizeWalletLedger.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
      )
      expect(VALUATION_LOADER.fetchVaultPps).toHaveBeenCalledWith(
        [{ chainId: 1, vaultAddress: '0x2222222222222222222222222222222222222222' }],
        { consumer: 'balance' }
      )
    } finally {
      ppsResult.resolve(new Map())
      await ppsResult.promise
    }
  })

  it('preserves provisional balance completeness in the combined response', async () => {
    mocks.getHistoricalHoldingsChart.mockResolvedValueOnce(createBalance(true, false))

    const response = await GET(createRequest())

    await expect(response.json()).resolves.toMatchObject({
      balance: {
        isComplete: false,
        dataPoints: [{ date: '2026-08-07', value: 42, isComplete: false }]
      }
    })
  })

  it('serves cached protocol return and growth without starting their valuation work', async () => {
    mocks.readWalletLedgerDerivedPortfolioCache.mockResolvedValueOnce({
      status: 'hit',
      value: { protocolReturn: createProtocolReturn(2), growth: createGrowth(2) }
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    expect(mocks.getHoldingsProtocolReturnHistory).not.toHaveBeenCalled()
    expect(mocks.getLedgerProtocolReturnRows).not.toHaveBeenCalled()
    expect(mocks.getSettledAddressScopedContext).not.toHaveBeenCalled()
    expect(mocks.enqueueWalletLedgerDerivedPortfolioCacheWrite).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      protocolReturn: { summary: { totalVaults: 2 } },
      growth: { summary: { totalVaults: 2 } }
    })
  })

  it('serves a fresh fully cached USD response without downloading or decoding wallet events', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1,10,137,250,8453,42161,747474')
    vi.useFakeTimers()
    vi.setSystemTime(UPDATED_AT_MS + 60_000)
    mocks.readVerifiedWalletLedgerHeaderForAddress.mockResolvedValueOnce({
      status: 'ready',
      header: {
        schemaVersion: 2,
        revision: LEDGER_REVISION,
        eventRevision: EVENT_REVISION,
        calculationVersion: 'canonical-envio-ledger-v3',
        sourceGeneration: 1,
        appliedInvalidationSequence: 2,
        updatedAtMs: UPDATED_AT_MS,
        coveredAtMs: UPDATED_AT_MS,
        eventCount: 2,
        hasActivity: true,
        encodedBytes: 1_000,
        decodedBytes: 2_000,
        checkedAtMs: UPDATED_AT_MS,
        reconciledAtMs: UPDATED_AT_MS,
        coverage: [
          { chainId: 1, startBlock: 100, endBlock: null, completeThroughBlock: 1_000 },
          { chainId: 10, startBlock: 200, endBlock: null, completeThroughBlock: 2_000 },
          { chainId: 137, startBlock: 300, endBlock: null, completeThroughBlock: 3_000 },
          { chainId: 250, startBlock: 400, endBlock: null, completeThroughBlock: 4_000 },
          { chainId: 8453, startBlock: 500, endBlock: null, completeThroughBlock: 5_000 },
          { chainId: 42161, startBlock: 600, endBlock: null, completeThroughBlock: 6_000 },
          { chainId: 747474, startBlock: 700, endBlock: null, completeThroughBlock: 7_000 }
        ]
      }
    })
    TOTALS_CACHE.read.mockResolvedValueOnce({
      totals: [{ date: '2026-08-07', usdValue: 42 }],
      oldestUpdatedAt: new Date(UPDATED_AT_MS)
    })
    mocks.readWalletLedgerDerivedPortfolioCache.mockResolvedValueOnce({
      status: 'hit',
      value: { protocolReturn: createProtocolReturn(2), growth: createGrowth(2) }
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    expect(mocks.synchronizeWalletLedger).not.toHaveBeenCalled()
    expect(mocks.prefetchGlobalVaultMetadata).not.toHaveBeenCalled()
    expect(mocks.readWalletLedger).not.toHaveBeenCalled()
    expect(mocks.createWalletLedgerEventSource).not.toHaveBeenCalled()
    expect(mocks.getHistoricalHoldingsChart).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      ledger: { revision: LEDGER_REVISION, freshness: 'cached', eventCount: 2 },
      balance: { isComplete: true, dataPoints: [{ date: '2026-08-07', value: 42, isComplete: true }] },
      protocolReturn: { summary: { totalVaults: 2 } },
      growth: { summary: { totalVaults: 2 } }
    })
  })

  it('resets process metadata before a benchmark cold request and confirms it in a response header', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_KEY_NAMESPACE', 'benchmark_portfolio_test')

    const response = await GET(createRequest('&benchmarkResetMetadataCache=1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-holdings-benchmark-metadata-cache-reset')).toBe('1')
    expect(mocks.resetGlobalVaultMetadataCacheForBenchmark).toHaveBeenCalledTimes(1)
    expect(mocks.resetGlobalVaultMetadataCacheForBenchmark.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.synchronizeWalletLedger.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
  })

  it('rejects process metadata reset outside an isolated benchmark namespace', async () => {
    const response = await GET(createRequest('&benchmarkResetMetadataCache=1'))

    expect(response.status).toBe(403)
    expect(mocks.resetGlobalVaultMetadataCacheForBenchmark).not.toHaveBeenCalled()
    expect(mocks.synchronizeWalletLedger).not.toHaveBeenCalled()
  })

  it('falls back to the full ledger path when either cache is incomplete', async () => {
    vi.stubEnv('HOLDINGS_LEDGER_CHAIN_IDS', '1,10,137,250,8453,42161,747474')
    vi.useFakeTimers()
    vi.setSystemTime(UPDATED_AT_MS + 60_000)
    mocks.readVerifiedWalletLedgerHeaderForAddress.mockResolvedValueOnce({
      status: 'ready',
      header: {
        schemaVersion: 2,
        revision: LEDGER_REVISION,
        eventRevision: EVENT_REVISION,
        calculationVersion: 'canonical-envio-ledger-v3',
        sourceGeneration: 1,
        appliedInvalidationSequence: 2,
        updatedAtMs: UPDATED_AT_MS,
        coveredAtMs: UPDATED_AT_MS,
        eventCount: 2,
        hasActivity: true,
        encodedBytes: 1_000,
        decodedBytes: 2_000,
        checkedAtMs: UPDATED_AT_MS,
        reconciledAtMs: UPDATED_AT_MS,
        coverage: [
          { chainId: 1, startBlock: 100, endBlock: null, completeThroughBlock: 1_000 },
          { chainId: 10, startBlock: 200, endBlock: null, completeThroughBlock: 2_000 },
          { chainId: 137, startBlock: 300, endBlock: null, completeThroughBlock: 3_000 },
          { chainId: 250, startBlock: 400, endBlock: null, completeThroughBlock: 4_000 },
          { chainId: 8453, startBlock: 500, endBlock: null, completeThroughBlock: 5_000 },
          { chainId: 42161, startBlock: 600, endBlock: null, completeThroughBlock: 6_000 },
          { chainId: 747474, startBlock: 700, endBlock: null, completeThroughBlock: 7_000 }
        ]
      }
    })
    TOTALS_CACHE.read.mockResolvedValueOnce({ totals: [], oldestUpdatedAt: null })
    mocks.readWalletLedgerDerivedPortfolioCache.mockResolvedValueOnce({
      status: 'hit',
      value: { protocolReturn: createProtocolReturn(2), growth: createGrowth(2) }
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    expect(mocks.synchronizeWalletLedger).toHaveBeenCalledTimes(1)
    expect(mocks.getHistoricalHoldingsChart).toHaveBeenCalledTimes(1)
  })

  it('uses the combined portfolio route identifier in debug logs', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      const response = await GET(createRequest('&debug=1'))

      expect(response.status).toBe(200)
      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('[HoldingsDebug][ledger-portfolio-'))
    } finally {
      consoleLog.mockRestore()
    }
  })

  it('reads the cached wallet value without synchronizing when refresh is disabled', async () => {
    mocks.readWalletLedger.mockResolvedValueOnce({ status: 'ready', ledger: LEDGER })

    const response = await GET(createRequest('&refresh=0'))

    expect(response.status).toBe(200)
    expect(mocks.synchronizeWalletLedger).not.toHaveBeenCalled()
    expect(mocks.prefetchGlobalVaultMetadata).not.toHaveBeenCalled()
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
    mocks.synchronizeWalletLedger.mockResolvedValueOnce({
      status: 'ready',
      outcome: 'fresh',
      syncType: 'fresh',
      ledger: LEDGER,
      effectiveCoverage: LEDGER.coverage,
      coveredAtMs: UPDATED_AT_MS,
      transition: SYNC_TRANSITION
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ledger: { freshness: 'cached' } })
  })

  it('passes an explicit forced rebuild into synchronization', async () => {
    const response = await GET(createRequest('&forceRebuild=1'))

    expect(response.status).toBe(200)
    expect(mocks.getLedgerAdminAccessError).toHaveBeenCalledWith(expect.any(Request), { requiresEnvio: true })
    expect(mocks.synchronizeWalletLedger).toHaveBeenCalledWith({
      address: ADDRESS,
      forceRebuild: true,
      prefetchVaultMetadata: true,
      onVaultsDiscovered: expect.any(Function)
    })
    expect(mocks.readWalletLedgerDerivedPortfolioCache).not.toHaveBeenCalled()
    expect(mocks.enqueueWalletLedgerDerivedPortfolioCacheWrite).toHaveBeenCalled()
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
