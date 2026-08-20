import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultMetadata } from '../types'
import { toVaultKey } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'

const fetchHistoricalPricesForTokenTimestampsMock = vi.fn()
const getHistoricalPriceFetchFailedBatchesMock = vi.fn()
const getPriceAtTimestampMock = vi.fn()
const getSettledAddressScopedContextMock = vi.fn()
const getSettledVersionedPpsContextMock = vi.fn()
const getVaultIdentifiersMock = vi.fn()
const selectVersionedEventsMock = vi.fn()
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
const debugLogMock = vi.fn()

vi.mock('./cache', () => ({
  getCachedProtocolReturnHistorySnapshot: async (...args: unknown[]) => {
    const cached = await getCachedProtocolReturnHistoryMock(...args)
    return cached ? ('settledDate' in cached ? cached : { settledDate: args[1], response: cached }) : null
  },
  getProtocolReturnHistoryCacheKey: getProtocolReturnHistoryCacheKeyMock,
  saveCachedProtocolReturnHistory: saveCachedProtocolReturnHistoryMock
}))

vi.mock('./debug', () => ({
  debugError: vi.fn(),
  debugLog: debugLogMock,
  reportHoldingsProgress: vi.fn()
}))

vi.mock('./defillama', () => ({
  fetchHistoricalPricesForTokenTimestamps: fetchHistoricalPricesForTokenTimestampsMock,
  getChainPrefix: vi.fn(() => 'ethereum'),
  getHistoricalPriceFetchFailedBatches: getHistoricalPriceFetchFailedBatchesMock,
  getPriceAtTimestamp: getPriceAtTimestampMock
}))

vi.mock('./settledHoldingsContext', () => ({
  getSettledAddressScopedContext: getSettledAddressScopedContextMock,
  getSettledVersionedPpsContext: getSettledVersionedPpsContextMock,
  getVaultIdentifiers: getVaultIdentifiersMock,
  selectVersionedEvents: selectVersionedEventsMock
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

function emptyGrowthResponse(generatedAt: string) {
  return {
    generatedAt,
    summary: {
      totalVaults: 0,
      completeVaults: 0,
      partialVaults: 0,
      isComplete: true
    },
    vaults: []
  }
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
    getSettledAddressScopedContextMock.mockResolvedValue(settledContext)
    getSettledVersionedPpsContextMock.mockResolvedValue(settledContext)
    selectVersionedEventsMock.mockReturnValue({
      events: settledContext.selectedEvents,
      vaultIdentifiers: settledContext.selectedVaultIdentifiers
    })
  })

  it('starts all timeframe at the supported history floor', async () => {
    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')

    const response = await getHoldingsProtocolReturnHistory(USER, 'all', 'seq', 'paged', 'all')

    expect(generateDailyTimestampsFromRangeMock).toHaveBeenCalledWith(HISTORY_START_TIMESTAMP, 200)
    expect(response.dataPoints.map((point) => point.timestamp)).toEqual([
      HISTORY_START_TIMESTAMP + 1,
      HISTORY_START_TIMESTAMP + 86_401
    ])
    expect(response).not.toHaveProperty('growth')
    expect(saveCachedProtocolReturnHistoryMock).toHaveBeenCalledWith(
      {
        userAddress: USER,
        version: 'all',
        timeframe: 'all',
        vaultScope: undefined
      },
      'date-201',
      [{ address: VAULT, chainId: 1 }],
      expect.objectContaining({ protocolReturn: response }),
      expect.any(Number)
    )
  })

  it('derives portfolio growth from the final protocol-return vaults', async () => {
    const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')

    const response = await getHoldingsProtocolReturnPortfolio(USER, 'all', 'seq', 'paged', '1y')

    expect(response.growth.generatedAt).toBe(response.protocolReturn.generatedAt)
    expect(response.growth.summary).toEqual({
      totalVaults: 1,
      completeVaults: 1,
      partialVaults: 0,
      isComplete: true
    })
    expect(response.growth.vaults).toEqual([
      {
        chainId: 1,
        vaultAddress: VAULT,
        status: 'ok',
        issues: [],
        baselineUsd: 100,
        baselineExposureUsdYears: expect.any(Number),
        growthUsd: 0,
        growthPct: 0,
        annualizedProtocolReturnPct: null,
        metadata: {
          symbol: 'TST',
          decimals: 18,
          assetDecimals: 18,
          tokenAddress: ASSET
        }
      }
    ])
  })

  it('values growth history at the latest price and keeps recoverable missing-price families eligible', async () => {
    const firstTimestamp = event.blockTimestamp + 1
    const secondTimestamp = firstTimestamp + 100
    generateDailyTimestampsMock.mockReturnValue([event.blockTimestamp, event.blockTimestamp + 100])
    getPriceAtTimestampMock.mockReturnValue(0)
    getPPSMock.mockImplementation((_ppsMap: Map<number, number>, timestamp: number) =>
      timestamp >= secondTimestamp ? 1.1 : 1
    )
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(
      new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [100, 2],
            [200, 3]
          ])
        ],
        [WETH_PRICE_KEY, new Map([[200, 1]])]
      ])
    )

    const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnPortfolio(USER, 'all', 'seq', 'paged', '1y')
    const growthVault = response.growth.vaults[0]

    expect(response.protocolReturn.summary.isComplete).toBe(false)
    expect(growthVault).toMatchObject({
      status: 'ok',
      issues: [],
      baselineUsd: 300,
      baselineExposureUsdYears: expect.any(Number),
      annualizedProtocolReturnPct: expect.any(Number)
    })
    expect(growthVault?.growthUsd).toBeCloseTo(30)
    expect(growthVault?.growthPct).toBeCloseTo(10)
    expect(response.protocolReturn.dataPoints[0]?.growthUsd).toBe(0)
    expect(response.protocolReturn.dataPoints[1]?.growthUsd).toBeCloseTo(30)
    expect(response.protocolReturn.dataPoints.map((point) => point.growthWeightUsd)).toEqual([0, 0])
    expect(response.protocolReturn.familySeries).toHaveLength(1)
    expect(response.protocolReturn.familySeries[0]).toMatchObject({
      chainId: 1,
      vaultAddress: VAULT,
      dataPoints: [
        { timestamp: firstTimestamp, growthUsd: 0, growthWeightUsd: 0 },
        { timestamp: secondTimestamp, growthWeightUsd: 0 }
      ]
    })
    expect(response.protocolReturn.familySeries[0]?.dataPoints[1]?.growthUsd).toBeCloseTo(30)
  })

  it('normalizes string decimals in cached portfolio growth metadata', async () => {
    const generatedAt = '2026-07-15T00:00:00.000Z'
    getCachedProtocolReturnHistoryMock.mockResolvedValue({
      protocolReturn: {
        address: USER,
        version: 'all',
        timeframe: '1y',
        generatedAt,
        summary: {
          totalVaults: 1,
          completeVaults: 1,
          partialVaults: 0,
          recommendedGrowthDisplay: 'index',
          recommendedGrowthDisplayReason: 'mixed',
          openBaselineCompositionUsd: { stable: 1, ethFamily: 0, other: 0 },
          isComplete: true
        },
        dataPoints: [],
        familySeries: []
      },
      growth: {
        generatedAt,
        summary: {
          totalVaults: 1,
          completeVaults: 1,
          partialVaults: 0,
          isComplete: true
        },
        vaults: [
          {
            chainId: 1,
            vaultAddress: VAULT,
            status: 'ok',
            issues: [],
            baselineUsd: 100,
            baselineExposureUsdYears: 1,
            growthUsd: 1,
            growthPct: 1,
            annualizedProtocolReturnPct: 1,
            metadata: {
              symbol: 'TST',
              decimals: '18',
              assetDecimals: '6',
              tokenAddress: ASSET
            }
          }
        ]
      }
    })

    const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnPortfolio(USER, 'all', 'seq', 'paged', '1y')

    expect(response.growth.vaults[0]?.metadata).toMatchObject({
      decimals: 18,
      assetDecimals: 6
    })
  })

  it('serves the settled protocol return history snapshot before loading wallet events', async () => {
    const loadSettledContext = vi.fn(async () => settledContext)
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
    getCachedProtocolReturnHistoryMock.mockResolvedValue({
      protocolReturn: cachedResponse,
      growth: emptyGrowthResponse(cachedResponse.generatedAt)
    })

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(
      USER,
      'all',
      'parallel',
      'paged',
      '1y',
      undefined,
      undefined,
      loadSettledContext
    )

    expect(response).toBe(cachedResponse)
    expect(loadSettledContext).not.toHaveBeenCalled()
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
      expect.objectContaining({ protocolReturn: response }),
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
      expect.objectContaining({ protocolReturn: response }),
      expect.any(Number)
    )
  })

  it('appends a missing settled date and matches a clean rebuild', async () => {
    const firstDay = 1_800_000_000
    const secondDay = firstDay + 86_400
    const thirdDay = secondDay + 86_400
    const fourthDay = thirdDay + 86_400
    const fifthDay = fourthDay + 86_400
    getPPSMock.mockImplementation(
      (_timeline: Map<number, number>, timestamp: number) =>
        1 + (Math.max(firstDay, timestamp) - firstDay) / 86_400 / 100
    )
    generateDailyTimestampsMock.mockReturnValue([firstDay, secondDay, thirdDay, fourthDay])

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    const firstSavedResponse = saveCachedProtocolReturnHistoryMock.mock.calls[0]?.[3]
    expect(firstSavedResponse).toBeDefined()

    generateDailyTimestampsMock.mockReturnValue([secondDay, thirdDay, fourthDay, fifthDay])
    getCachedProtocolReturnHistoryMock.mockResolvedValue({
      settledDate: `date-${fourthDay + 1}`,
      response: firstSavedResponse
    })
    saveCachedProtocolReturnHistoryMock.mockClear()

    const appended = await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')
    expect(appended.dataPoints.map((point) => point.timestamp)).toEqual([
      secondDay + 1,
      thirdDay + 1,
      fourthDay + 1,
      fifthDay + 1
    ])
    expect(debugLogMock).toHaveBeenCalledWith(
      'protocol-return-history',
      'appended missing protocol return dates',
      expect.objectContaining({ cachedPoints: 3, calculatedPoints: 2, overlapMatched: true })
    )

    getCachedProtocolReturnHistoryMock.mockResolvedValue(null)
    const rebuilt = await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')
    const withoutGeneratedAtAndAggregateIndex = (response: typeof rebuilt) => ({
      ...response,
      generatedAt: '',
      dataPoints: response.dataPoints.map((point) => ({ ...point, growthIndex: null }))
    })

    expect(withoutGeneratedAtAndAggregateIndex(appended)).toEqual(withoutGeneratedAtAndAggregateIndex(rebuilt))
    appended.dataPoints.forEach((point, index) => {
      const rebuiltGrowthIndex = rebuilt.dataPoints[index]?.growthIndex
      if (point.growthIndex === null || rebuiltGrowthIndex === null || rebuiltGrowthIndex === undefined) {
        expect(point.growthIndex).toBe(rebuiltGrowthIndex)
        return
      }
      expect(point.growthIndex).toBeCloseTo(rebuiltGrowthIndex, 10)
    })
  })

  it('rebuilds instead of appending when the replayed overlap day changed', async () => {
    const firstDay = 1_800_000_000
    const secondDay = firstDay + 86_400
    const thirdDay = secondDay + 86_400
    generateDailyTimestampsMock.mockReturnValue([firstDay, secondDay])

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')
    const cachedResponse = saveCachedProtocolReturnHistoryMock.mock.calls[0]?.[3]

    generateDailyTimestampsMock.mockReturnValue([secondDay, thirdDay])
    getPPSMock.mockImplementation((_timeline: Map<number, number>, timestamp: number) =>
      timestamp >= secondDay ? 2 : 1
    )
    getCachedProtocolReturnHistoryMock.mockResolvedValue({
      settledDate: `date-${secondDay + 1}`,
      response: cachedResponse
    })
    debugLogMock.mockClear()

    await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(debugLogMock).toHaveBeenCalledWith(
      'protocol-return-history',
      'rebuilt protocol return history',
      expect.objectContaining({ cachedPoints: 0, calculatedPoints: 2, overlapMatched: false })
    )
  })

  it('rebuilds cached history when its latest-price growth valuation changed', async () => {
    const firstDay = 1_800_000_000
    const secondDay = firstDay + 86_400
    const thirdDay = secondDay + 86_400
    generateDailyTimestampsMock.mockReturnValue([firstDay, secondDay])
    getPPSMock.mockImplementation((_timeline: Map<number, number>, timestamp: number) =>
      timestamp >= secondDay ? 1.1 : 1
    )
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(
      new Map([
        [ASSET_PRICE_KEY, new Map([[firstDay, 1]])],
        [WETH_PRICE_KEY, new Map([[firstDay, 1]])]
      ])
    )

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')
    const cachedResponse = saveCachedProtocolReturnHistoryMock.mock.calls[0]?.[3]

    generateDailyTimestampsMock.mockReturnValue([secondDay, thirdDay])
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(
      new Map([
        [ASSET_PRICE_KEY, new Map([[thirdDay, 2]])],
        [WETH_PRICE_KEY, new Map([[thirdDay, 1]])]
      ])
    )
    getCachedProtocolReturnHistoryMock.mockResolvedValue({
      settledDate: `date-${secondDay + 1}`,
      response: cachedResponse
    })
    debugLogMock.mockClear()

    await getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(debugLogMock).toHaveBeenCalledWith(
      'protocol-return-history',
      'rebuilt protocol return history',
      expect.objectContaining({ cachedPoints: 0, calculatedPoints: 2, overlapMatched: false })
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
    const cachedPortfolioResponse = {
      protocolReturn: cachedResponse,
      growth: emptyGrowthResponse(cachedResponse.generatedAt)
    }
    const cacheLookup: { resolve?: (value: typeof cachedPortfolioResponse | null) => void } = {}
    const cacheLookupPromise = new Promise<typeof cachedPortfolioResponse | null>((resolve) => {
      cacheLookup.resolve = resolve
    })
    getCachedProtocolReturnHistoryMock.mockReturnValue(cacheLookupPromise)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const firstRequest = getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')
    const secondRequest = getHoldingsProtocolReturnHistory(USER, 'all', 'parallel', 'paged', '1y')

    expect(getCachedProtocolReturnHistoryMock).toHaveBeenCalledTimes(1)
    cacheLookup.resolve?.(cachedPortfolioResponse)
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([cachedResponse, cachedResponse])
    expect(getSettledVersionedPpsContextMock).not.toHaveBeenCalled()
  })
})
