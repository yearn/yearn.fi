import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultMetadata } from '../types'
import { toVaultKey } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'

const fetchHistoricalPricesForTokenTimestampsMock = vi.fn()
const getHistoricalPriceFetchFailedBatchesMock = vi.fn()
const getPriceAtTimestampMock = vi.fn()
const getSettledVersionedPpsContextMock = vi.fn()
const getVaultIdentifiersMock = vi.fn()
const fetchActivityEventsByTransactionHashesMock = vi.fn()
const generateDailyTimestampsMock = vi.fn()
const generateDailyTimestampsFromRangeMock = vi.fn()
const toSettledDayTimestampMock = vi.fn()
const timestampToDateStringMock = vi.fn()
const getPPSMock = vi.fn()
const getPpsFetchFailedVaultsMock = vi.fn()
const getNestedVaultPpsIdentifiersFromPriceRequestsMock = vi.fn()
const getCachedProtocolReturnHistoryMock = vi.fn()
const getProtocolReturnHistoryCacheKeyMock = vi.fn()
const saveCachedProtocolReturnHistoryMock = vi.fn()

vi.mock('./cache', () => ({
  getCachedProtocolReturnHistory: getCachedProtocolReturnHistoryMock,
  getProtocolReturnHistoryCacheKey: getProtocolReturnHistoryCacheKeyMock,
  saveCachedProtocolReturnHistory: saveCachedProtocolReturnHistoryMock
}))

vi.mock('./defillama', () => ({
  fetchHistoricalPricesForTokenTimestamps: fetchHistoricalPricesForTokenTimestampsMock,
  getChainPrefix: vi.fn(() => 'ethereum'),
  getHistoricalPriceFetchFailedBatches: getHistoricalPriceFetchFailedBatchesMock,
  getPriceAtTimestamp: getPriceAtTimestampMock
}))

vi.mock('./settledHoldingsContext', () => ({
  getSettledVersionedPpsContext: getSettledVersionedPpsContextMock,
  getVaultIdentifiers: getVaultIdentifiersMock
}))

vi.mock('./graphql', () => ({
  fetchActivityEventsByTransactionHashes: fetchActivityEventsByTransactionHashesMock
}))

vi.mock('./holdings', () => ({
  generateDailyTimestamps: generateDailyTimestampsMock,
  generateDailyTimestampsFromRange: generateDailyTimestampsFromRangeMock,
  toSettledDayTimestamp: toSettledDayTimestampMock,
  timestampToDateString: timestampToDateStringMock
}))

vi.mock('./kong', () => ({
  getPPS: getPPSMock,
  getPpsFetchFailedVaults: getPpsFetchFailedVaultsMock
}))

vi.mock('./nestedVaultPrices', () => ({
  expandNestedVaultAssetPriceRequests: vi.fn((requests: unknown[]) => requests),
  deriveNestedVaultAssetPriceData: vi.fn(({ priceData }: { priceData: Map<string, Map<number, number>> }) => priceData),
  getNestedVaultPpsIdentifiersFromPriceRequests: getNestedVaultPpsIdentifiersFromPriceRequestsMock,
  mergeVaultIdentifiers: vi.fn((identifiers: unknown[]) => identifiers)
}))

vi.mock('./pnlEvents', () => ({
  mergeAddressScopedRawPnlEventsWithTransactionActivity: vi.fn((events: TRawPnlEvent[]) => events)
}))

const USER = '0x1111111111111111111111111111111111111111'
const VAULT = '0x3333333333333333333333333333333333333333'
const NESTED_VAULT = '0x5555555555555555555555555555555555555555'
const ASSET = '0x4444444444444444444444444444444444444444'
const ONE = 10n ** 18n
const HISTORY_START_TIMESTAMP = 1_704_067_200
const VAULT_KEY = toVaultKey(1, VAULT)
const ASSET_PRICE_KEY = `ethereum:${ASSET}`
const WETH_PRICE_KEY = 'ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

const metadata = new Map<string, VaultMetadata>([
  [
    VAULT_KEY,
    {
      address: VAULT,
      chainId: 1,
      version: 'v3',
      category: 'stable',
      token: {
        address: ASSET,
        symbol: 'TST',
        decimals: 18
      },
      decimals: 18
    }
  ]
])

const event = {
  kind: 'deposit',
  id: 'deposit',
  chainId: 1,
  vaultAddress: VAULT,
  familyVaultAddress: VAULT,
  isStakingVault: false,
  blockNumber: 1,
  blockTimestamp: 1_600_000_000,
  logIndex: 0,
  transactionHash: '0xdeposit',
  transactionFrom: USER,
  owner: USER,
  sender: USER,
  shares: 100n * ONE,
  assets: 100n * ONE,
  scopes: {
    address: true,
    tx: false
  }
} as TRawPnlEvent

const settledContext = {
  address: USER,
  latestSettledDayTimestamp: 200,
  maxTimestamp: 201,
  events: {
    deposits: [],
    withdrawals: [],
    transfersIn: [],
    transfersOut: []
  },
  timeline: [],
  hasActivity: true,
  rawEvents: [event],
  rawVaultIdentifiers: [{ chainId: 1, vaultAddress: VAULT }],
  vaultMetadata: metadata,
  metadataFetchFailedVaults: 0,
  selectedEvents: [event],
  selectedVaultIdentifiers: [{ chainId: 1, vaultAddress: VAULT }],
  ppsIdentifiers: [{ chainId: 1, vaultAddress: VAULT }],
  ppsData: new Map([[VAULT_KEY, new Map([[HISTORY_START_TIMESTAMP + 1, 1]])]])
}

describe('getHoldingsProtocolReturnHistory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    generateDailyTimestampsMock.mockReturnValue([200])
    generateDailyTimestampsFromRangeMock.mockReturnValue([HISTORY_START_TIMESTAMP, HISTORY_START_TIMESTAMP + 86_400])
    toSettledDayTimestampMock.mockImplementation((timestamp: number) => timestamp + 1)
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getPPSMock.mockReturnValue(1)
    getPpsFetchFailedVaultsMock.mockReturnValue(0)
    getNestedVaultPpsIdentifiersFromPriceRequestsMock.mockReturnValue([])
    getHistoricalPriceFetchFailedBatchesMock.mockReturnValue(0)
    getPriceAtTimestampMock.mockReturnValue(1)
    getCachedProtocolReturnHistoryMock.mockResolvedValue(null)
    getProtocolReturnHistoryCacheKeyMock.mockReturnValue('protocol-return-history-cache-key')
    saveCachedProtocolReturnHistoryMock.mockResolvedValue(true)
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(
      new Map([
        [ASSET_PRICE_KEY, new Map([[HISTORY_START_TIMESTAMP + 1, 1]])],
        [WETH_PRICE_KEY, new Map([[HISTORY_START_TIMESTAMP + 1, 1]])]
      ])
    )
    fetchActivityEventsByTransactionHashesMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfers: []
    })
    getVaultIdentifiersMock.mockReturnValue([{ chainId: 1, vaultAddress: VAULT }])
    getSettledVersionedPpsContextMock.mockResolvedValue(settledContext)
  })

  it('starts all timeframe at the supported history floor', async () => {
    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')

    const response = await getHoldingsProtocolReturnHistory(USER, 'all', 'seq', 'paged', 'all')

    expect(generateDailyTimestampsFromRangeMock).toHaveBeenCalledWith(HISTORY_START_TIMESTAMP, 200)
    expect(response.dataPoints.map((point) => point.timestamp)).toEqual([
      HISTORY_START_TIMESTAMP + 1,
      HISTORY_START_TIMESTAMP + 86_401
    ])
    expect(saveCachedProtocolReturnHistoryMock).toHaveBeenCalledWith(
      {
        userAddress: USER,
        version: 'all',
        timeframe: 'all',
        vaultScope: undefined
      },
      'date-201',
      [{ address: VAULT, chainId: 1 }],
      response,
      expect.any(Number)
    )
  })

  it('serves the settled protocol return history snapshot before loading wallet events', async () => {
    const cachedResponse = {
      address: USER,
      version: 'all' as const,
      timeframe: '1y' as const,
      generatedAt: '2026-07-15T00:00:00.000Z',
      summary: {
        totalVaults: 1,
        completeVaults: 1,
        partialVaults: 0,
        recommendedGrowthDisplay: 'index' as const,
        recommendedGrowthDisplayReason: 'mixed' as const,
        openBaselineCompositionUsd: { stable: 1, ethFamily: 0, other: 0 },
        isComplete: true
      },
      dataPoints: [],
      familySeries: []
    }
    getCachedProtocolReturnHistoryMock.mockResolvedValue(cachedResponse)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(response).toBe(cachedResponse)
    expect(getSettledVersionedPpsContextMock).not.toHaveBeenCalled()
    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('caches a successful partial protocol return history calculation', async () => {
    getPPSMock.mockReturnValue(null)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(response.summary.isComplete).toBe(false)
    expect(response.summary.totalVaults).toBe(1)
    expect(saveCachedProtocolReturnHistoryMock).toHaveBeenCalledWith(
      expect.any(Object),
      'date-201',
      [{ address: VAULT, chainId: 1 }],
      response,
      expect.any(Number)
    )
  })

  it('does not cache protocol return history when a price request succeeds without prices', async () => {
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(new Map())

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(response.summary.totalVaults).toBe(1)
    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('does not cache protocol return history when a historical price batch fails', async () => {
    getHistoricalPriceFetchFailedBatchesMock.mockReturnValue(1)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(response.summary.totalVaults).toBe(1)
    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('does not cache protocol return history when a PPS request fails', async () => {
    getPpsFetchFailedVaultsMock.mockReturnValue(1)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('does not cache protocol return history when a metadata fallback fails', async () => {
    getSettledVersionedPpsContextMock.mockResolvedValue({
      ...settledContext,
      metadataFetchFailedVaults: 1
    })

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('tracks nested PPS vaults as cache invalidation dependencies', async () => {
    getNestedVaultPpsIdentifiersFromPriceRequestsMock.mockReturnValue([{ chainId: 1, vaultAddress: NESTED_VAULT }])

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(saveCachedProtocolReturnHistoryMock).toHaveBeenCalledWith(
      expect.any(Object),
      'date-201',
      [
        { address: VAULT, chainId: 1 },
        { address: NESTED_VAULT, chainId: 1 }
      ],
      response,
      expect.any(Number)
    )
  })

  it('coalesces identical protocol return history requests while the cache lookup is in flight', async () => {
    const cachedResponse = {
      address: USER,
      version: 'all' as const,
      timeframe: '1y' as const,
      generatedAt: '2026-07-15T00:00:00.000Z',
      summary: {
        totalVaults: 0,
        completeVaults: 0,
        partialVaults: 0,
        recommendedGrowthDisplay: 'index' as const,
        recommendedGrowthDisplayReason: 'mixed' as const,
        openBaselineCompositionUsd: { stable: 0, ethFamily: 0, other: 0 },
        isComplete: true
      },
      dataPoints: [],
      familySeries: []
    }
    const cacheLookup: { resolve?: (value: typeof cachedResponse | null) => void } = {}
    const cacheLookupPromise = new Promise<typeof cachedResponse | null>((resolve) => {
      cacheLookup.resolve = resolve
    })
    getCachedProtocolReturnHistoryMock.mockReturnValue(cacheLookupPromise)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const firstRequest = getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')
    const secondRequest = getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(getCachedProtocolReturnHistoryMock).toHaveBeenCalledTimes(1)
    cacheLookup.resolve?.(cachedResponse)
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([cachedResponse, cachedResponse])
    expect(getSettledVersionedPpsContextMock).not.toHaveBeenCalled()
  })
})
