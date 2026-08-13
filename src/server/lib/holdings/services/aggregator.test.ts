import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeferred } from '@/server/lib/holdings/test-utils/deferred'

const getCachedTotalsWithTimestampMock = vi.fn()
const saveCachedTotalsMock = vi.fn()
const clearUserCacheMock = vi.fn()
const checkCacheStalenessMock = vi.fn()
const fetchUserEventsMock = vi.fn()
const buildPositionTimelineMock = vi.fn()
const buildPositionTimelineIndexMock = vi.fn()
const generateDailyTimestampsMock = vi.fn()
const generateDailyTimestampsFromRangeMock = vi.fn()
const getIndexedShareBalanceAtTimestampMock = vi.fn()
const getShareBalanceAtTimestampMock = vi.fn()
const getUniqueVaultsMock = vi.fn()
const toSettledDayTimestampMock = vi.fn()
const timestampToDateStringMock = vi.fn()
const fetchMultipleVaultsMetadataMock = vi.fn()
const getVaultMetadataFetchFailedVaultsMock = vi.fn()
const fetchMultipleVaultsPPSMock = vi.fn()
const getPPSMock = vi.fn()
const getPpsFetchFailedVaultsMock = vi.fn()
const fetchHistoricalPricesMock = vi.fn()
const fetchMissingHistoricalAssetPricesFromKongMock = vi.fn()
const createKongAssetPricePrefetcherMock = vi.fn()
const getHistoricalPriceFetchFailedBatchesMock = vi.fn()
const getChainPrefixMock = vi.fn()
const getPriceAtTimestampMock = vi.fn()
const CURRENT_DAY_LOOKAHEAD_SECONDS = 24 * 60 * 60

vi.mock('./cache', () => ({
  getCachedTotalsWithTimestamp: getCachedTotalsWithTimestampMock,
  saveCachedTotals: saveCachedTotalsMock,
  clearUserCache: clearUserCacheMock,
  checkCacheStaleness: checkCacheStalenessMock
}))

vi.mock('./graphql', () => ({
  fetchUserEvents: fetchUserEventsMock
}))

vi.mock('./holdings', () => ({
  buildPositionTimeline: buildPositionTimelineMock,
  buildPositionTimelineIndex: buildPositionTimelineIndexMock,
  generateDailyTimestamps: generateDailyTimestampsMock,
  generateDailyTimestampsFromRange: generateDailyTimestampsFromRangeMock,
  getIndexedShareBalanceAtTimestamp: getIndexedShareBalanceAtTimestampMock,
  getShareBalanceAtTimestamp: getShareBalanceAtTimestampMock,
  getUniqueVaults: getUniqueVaultsMock,
  toSettledDayTimestamp: toSettledDayTimestampMock,
  timestampToDateString: timestampToDateStringMock
}))

vi.mock('./vaults', () => ({
  fetchMultipleVaultsMetadata: fetchMultipleVaultsMetadataMock,
  getVaultMetadataFetchFailedVaults: getVaultMetadataFetchFailedVaultsMock,
  markVaultMetadataFetchFailures: vi.fn((metadata: Map<unknown, unknown>) => metadata)
}))

vi.mock('./kong', () => ({
  fetchMultipleVaultsPPS: fetchMultipleVaultsPPSMock,
  getPPS: getPPSMock,
  getPpsFetchFailedVaults: getPpsFetchFailedVaultsMock
}))

vi.mock('./defillama', () => ({
  fetchHistoricalPrices: fetchHistoricalPricesMock,
  fetchHistoricalPricesForTokenTimestamps: fetchHistoricalPricesMock,
  getHistoricalPriceFetchFailedBatches: getHistoricalPriceFetchFailedBatchesMock,
  getChainPrefix: getChainPrefixMock,
  getPriceAtTimestamp: getPriceAtTimestampMock
}))

vi.mock('@/server/lib/holdings/services/kongAssetPrices', () => ({
  createKongAssetPricePrefetcher: createKongAssetPricePrefetcherMock,
  fetchMissingHistoricalAssetPricesFromKong: fetchMissingHistoricalAssetPricesFromKongMock
}))

describe('getHistoricalHoldings', () => {
  beforeEach(() => {
    buildPositionTimelineIndexMock.mockImplementation((timeline: unknown) => timeline)
    getIndexedShareBalanceAtTimestampMock.mockImplementation(
      (timeline: unknown, vaultAddress: string, chainId: number, timestamp: number) =>
        getShareBalanceAtTimestampMock(timeline, vaultAddress, chainId, timestamp)
    )
    toSettledDayTimestampMock.mockImplementation((timestamp: number) => timestamp + 1)
    checkCacheStalenessMock.mockResolvedValue(false)
    clearUserCacheMock.mockResolvedValue(0)
    getHistoricalPriceFetchFailedBatchesMock.mockReturnValue(0)
    getPpsFetchFailedVaultsMock.mockReturnValue(0)
    getVaultMetadataFetchFailedVaultsMock.mockReturnValue(0)
    fetchMissingHistoricalAssetPricesFromKongMock.mockResolvedValue(new Map())
    createKongAssetPricePrefetcherMock.mockReturnValue({
      prefetch: vi.fn(),
      resolve: fetchMissingHistoricalAssetPricesFromKongMock
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('caches versioned history separately and filters vaults using authoritative metadata version', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(999_000)

    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const v2VaultAddress = '0x00000000000000000000000000000000000000a2'
    const v3VaultAddress = '0x00000000000000000000000000000000000000a3'
    const v2TokenAddress = '0x0000000000000000000000000000000000000aa2'
    const v3TokenAddress = '0x0000000000000000000000000000000000000aa3'
    const timeline = [{ id: 'v2-entry' }, { id: 'v3-entry' }]
    const vaults = [
      { chainId: 1, vaultAddress: v2VaultAddress },
      { chainId: 1, vaultAddress: v3VaultAddress }
    ]

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({ totals: [], oldestUpdatedAt: null })
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue(timeline)
    getUniqueVaultsMock.mockReturnValue(vaults)
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${v2VaultAddress}`,
          {
            address: v2VaultAddress,
            chainId: 1,
            version: 'v2',
            token: {
              address: v2TokenAddress,
              symbol: 'TKN2',
              decimals: 18
            },
            decimals: 18
          }
        ],
        [
          `1:${v3VaultAddress}`,
          {
            address: v3VaultAddress,
            chainId: 1,
            version: 'v3',
            token: {
              address: v3TokenAddress,
              symbol: 'TKN3',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockImplementation(async (requestedVaults: typeof vaults) => {
      return new Map(
        requestedVaults.map((vault) => [`${vault.chainId}:${vault.vaultAddress.toLowerCase()}`, new Map([[100, 1]])])
      )
    })
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${v2TokenAddress}`, new Map([[101, 1]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockReturnValue(1)
    getShareBalanceAtTimestampMock.mockImplementation((_timeline: unknown, vaultAddress: string) => {
      return vaultAddress === v2VaultAddress ? 2n * 10n ** 18n : 5n * 10n ** 18n
    })
    generateDailyTimestampsFromRangeMock.mockReturnValue([])
    checkCacheStalenessMock.mockResolvedValue(false)

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'v2', 'parallel', 'all')

    expect(fetchUserEventsMock).toHaveBeenCalledWith(
      userAddress,
      'all',
      101 + CURRENT_DAY_LOOKAHEAD_SECONDS,
      'parallel',
      'all'
    )
    expect(getCachedTotalsWithTimestampMock).toHaveBeenCalledWith(userAddress, 'v2', 'date-100', 'date-100')
    expect(fetchMultipleVaultsPPSMock).toHaveBeenCalledWith([vaults[0]])
    expect(saveCachedTotalsMock).toHaveBeenCalledWith(userAddress, 'v2', [{ date: 'date-100', usdValue: 2 }])
    expect(response.hasActivity).toBe(true)
    expect(response.isComplete).toBe(true)
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 2, isComplete: true }])
  })

  it('defaults history event fetching to sequential paged mode', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({ totals: [], oldestUpdatedAt: null })
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue([])
    generateDailyTimestampsFromRangeMock.mockReturnValue([])

    const { getHistoricalHoldings } = await import('./aggregator')
    await getHistoricalHoldings(userAddress, 'all')

    expect(fetchUserEventsMock).toHaveBeenCalledWith(
      userAddress,
      'all',
      101 + CURRENT_DAY_LOOKAHEAD_SECONDS,
      'seq',
      'paged'
    )
  })

  it('filters historical chart calculations to requested vaults without using aggregate cache', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const firstVaultAddress = '0x00000000000000000000000000000000000000a1'
    const secondVaultAddress = '0x00000000000000000000000000000000000000a2'
    const excludedVaultAddress = '0x00000000000000000000000000000000000000a3'
    const tokenAddress = '0x0000000000000000000000000000000000000aa1'
    const timeline = [{ blockTimestamp: 100, blockNumber: 1 }]
    const vaults = [
      { chainId: 1, vaultAddress: firstVaultAddress },
      { chainId: 1, vaultAddress: secondVaultAddress },
      { chainId: 1, vaultAddress: excludedVaultAddress }
    ]

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue(timeline)
    getUniqueVaultsMock.mockReturnValue(vaults)
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map(
        vaults.map((vault) => [
          `1:${vault.vaultAddress}`,
          {
            address: vault.vaultAddress,
            chainId: 1,
            version: 'v3',
            token: {
              address: tokenAddress,
              symbol: 'TKN',
              decimals: 18
            },
            decimals: 18
          }
        ])
      )
    )
    fetchMultipleVaultsPPSMock.mockImplementation(async (requestedVaults: typeof vaults) => {
      return new Map(requestedVaults.map((vault) => [`1:${vault.vaultAddress}`, new Map([[101, 1]])]))
    })
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[101, 1]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockReturnValue(1)
    getShareBalanceAtTimestampMock.mockImplementation((_timeline: unknown, vaultAddress: string) => {
      if (vaultAddress === firstVaultAddress) return 2n * 10n ** 18n
      if (vaultAddress === secondVaultAddress) return 3n * 10n ** 18n
      return 100n * 10n ** 18n
    })

    const { getHistoricalHoldingsChart } = await import('./aggregator')
    const response = await getHistoricalHoldingsChart(userAddress, 'all', 'parallel', 'all', 'usd', '1y', [
      { chainId: 1, vaultAddress: firstVaultAddress },
      { chainId: 1, vaultAddress: secondVaultAddress }
    ])

    expect(getCachedTotalsWithTimestampMock).not.toHaveBeenCalled()
    expect(saveCachedTotalsMock).not.toHaveBeenCalled()
    expect(fetchMultipleVaultsPPSMock).toHaveBeenCalledWith([
      { chainId: 1, vaultAddress: firstVaultAddress },
      { chainId: 1, vaultAddress: secondVaultAddress }
    ])
    expect(response.isComplete).toBe(true)
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, value: 5, isComplete: true }])
  })

  it('returns fully cached history after validating cache staleness', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000dd'
    const tokenAddress = '0x0000000000000000000000000000000000000dd0'

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({
      totals: [
        { date: 'date-100', usdValue: 1 },
        { date: 'date-200', usdValue: 2 }
      ],
      oldestUpdatedAt: new Date('2026-03-31T00:00:00Z')
    })
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue([{ id: 'cached-entry' }])
    getUniqueVaultsMock.mockReturnValue([{ chainId: 1, vaultAddress }])
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 1,
            version: 'v3',
            token: {
              address: tokenAddress,
              symbol: 'CACHE',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    generateDailyTimestampsFromRangeMock.mockReturnValue([])

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all')

    expect(fetchUserEventsMock).toHaveBeenCalledWith(
      userAddress,
      'all',
      201 + CURRENT_DAY_LOOKAHEAD_SECONDS,
      'seq',
      'paged'
    )
    expect(fetchMultipleVaultsMetadataMock).toHaveBeenCalled()
    expect(checkCacheStalenessMock).toHaveBeenCalledWith(
      [{ address: vaultAddress, chainId: 1 }],
      new Date('2026-03-31T00:00:00Z')
    )
    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).not.toHaveBeenCalled()
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, totalUsdValue: 1, isComplete: true },
      { date: 'date-200', timestamp: 201, totalUsdValue: 2, isComplete: true }
    ])
  })

  it('recomputes stale fully cached history after vault invalidation', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000ee'
    const tokenAddress = '0x0000000000000000000000000000000000000ee0'

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({
      totals: [
        { date: 'date-100', usdValue: 1 },
        { date: 'date-200', usdValue: 2 }
      ],
      oldestUpdatedAt: new Date('2026-03-31T00:00:00Z')
    })
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue([{ id: 'stale-entry' }])
    getUniqueVaultsMock.mockReturnValue([{ chainId: 1, vaultAddress }])
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 1,
            version: 'v3',
            token: {
              address: tokenAddress,
              symbol: 'STALE',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          new Map([
            [101, 2],
            [201, 2]
          ])
        ]
      ])
    )
    fetchHistoricalPricesMock.mockResolvedValue(
      new Map([
        [
          `ethereum:${tokenAddress}`,
          new Map([
            [101, 3],
            [201, 3]
          ])
        ]
      ])
    )
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(2)
    getPriceAtTimestampMock.mockReturnValue(3)
    getShareBalanceAtTimestampMock.mockImplementation(
      (_timeline: unknown, _vaultAddress: string, _chainId: number, timestamp: number) =>
        timestamp === 101 ? BigInt(0) : 1n * 10n ** 18n
    )
    checkCacheStalenessMock.mockResolvedValue(true)

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all')

    expect(clearUserCacheMock).toHaveBeenCalledWith(userAddress, 'all')
    expect(fetchMultipleVaultsPPSMock).toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([{ chainId: 1, address: tokenAddress, timestamps: [201] }], {
      resolution: 'utc_day'
    })
    expect(getShareBalanceAtTimestampMock).toHaveBeenNthCalledWith(1, [{ id: 'stale-entry' }], vaultAddress, 1, 101)
    expect(getShareBalanceAtTimestampMock).toHaveBeenNthCalledWith(2, [{ id: 'stale-entry' }], vaultAddress, 1, 201)
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, totalUsdValue: 0, isComplete: true },
      { date: 'date-200', timestamp: 201, totalUsdValue: 6, isComplete: true }
    ])
  })

  it('excludes hidden vaults from historical holdings totals', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const hiddenVaultAddress = '0x00000000000000000000000000000000000000c2'

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({ totals: [], oldestUpdatedAt: null })
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue([{ id: 'hidden-entry' }])
    generateDailyTimestampsFromRangeMock.mockReturnValue([])
    getUniqueVaultsMock.mockReturnValue([{ chainId: 1, vaultAddress: hiddenVaultAddress }])
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${hiddenVaultAddress}`,
          {
            address: hiddenVaultAddress,
            chainId: 1,
            version: 'v3',
            isHidden: true,
            token: {
              address: '0x0000000000000000000000000000000000000cc2',
              symbol: 'HIDDEN',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all')

    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).not.toHaveBeenCalled()
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 0, isComplete: true }])
  })

  it('expands all timeframe from the supported history start to the latest settled day', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000b2'
    const tokenAddress = '0x0000000000000000000000000000000000000bb2'
    const timeline = [{ blockTimestamp: 50, blockNumber: 1 }]
    const vaults = [{ chainId: 1, vaultAddress }]

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    generateDailyTimestampsFromRangeMock.mockReturnValue([50, 100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({ totals: [], oldestUpdatedAt: null })
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue(timeline)
    getUniqueVaultsMock.mockReturnValue(vaults)
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 1,
            version: 'v3',
            token: {
              address: tokenAddress,
              symbol: 'TKN',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockResolvedValue(new Map([[`1:${vaultAddress}`, new Map([[50, 1]])]]))
    fetchHistoricalPricesMock.mockResolvedValue(
      new Map([
        [
          `ethereum:${tokenAddress}`,
          new Map([
            [51, 1],
            [101, 1],
            [201, 1]
          ])
        ]
      ])
    )
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockReturnValue(1)
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)
    checkCacheStalenessMock.mockResolvedValue(false)

    const { getHistoricalHoldingsChart } = await import('./aggregator')
    const response = await getHistoricalHoldingsChart(userAddress, 'all', 'parallel', 'all', 'usd', 'all')

    expect(generateDailyTimestampsFromRangeMock).toHaveBeenCalledWith(1_704_067_200, 200)
    expect(getCachedTotalsWithTimestampMock).toHaveBeenCalledWith(userAddress, 'all', 'date-50', 'date-200')
    expect(saveCachedTotalsMock).toHaveBeenCalledWith(userAddress, 'all', [
      { date: 'date-50', usdValue: 1 },
      { date: 'date-100', usdValue: 1 },
      { date: 'date-200', usdValue: 1 }
    ])
    expect(response.timeframe).toBe('all')
    expect(response.hasActivity).toBe(true)
    expect(response.dataPoints).toEqual([
      { date: 'date-50', timestamp: 51, value: 1, isComplete: true },
      { date: 'date-100', timestamp: 101, value: 1, isComplete: true },
      { date: 'date-200', timestamp: 201, value: 1, isComplete: true }
    ])
  })

  it('caches complete dates while retrying only dates with missing position inputs', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000b2'
    const tokenAddress = '0x0000000000000000000000000000000000000bb2'
    const timeline = [{ blockTimestamp: 100, blockNumber: 1 }]
    const vaults = [{ chainId: 1, vaultAddress }]

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({ totals: [], oldestUpdatedAt: null })
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue(timeline)
    getUniqueVaultsMock.mockReturnValue(vaults)
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 1,
            version: 'v3',
            token: {
              address: tokenAddress,
              symbol: 'TKN',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          new Map([
            [101, 1],
            [201, 1]
          ])
        ]
      ])
    )
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[201, 1]])]]))
    getHistoricalPriceFetchFailedBatchesMock.mockReturnValue(1)
    getPpsFetchFailedVaultsMock.mockReturnValue(1)
    getVaultMetadataFetchFailedVaultsMock.mockReturnValue(1)
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockImplementation((_prices: unknown, timestamp: number) => (timestamp === 101 ? 0 : 1))
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)
    generateDailyTimestampsFromRangeMock.mockReturnValue([])

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all')

    expect(saveCachedTotalsMock).toHaveBeenCalledWith(userAddress, 'all', [{ date: 'date-200', usdValue: 1 }])
    expect(response.isComplete).toBe(false)
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, totalUsdValue: 0, isComplete: false },
      { date: 'date-200', timestamp: 201, totalUsdValue: 1, isComplete: true }
    ])

    saveCachedTotalsMock.mockClear()
    const suppliedTotalsCache = {
      read: vi.fn().mockResolvedValue({
        totals: [{ date: 'date-200', usdValue: 1 }],
        oldestUpdatedAt: new Date(1_000)
      }),
      write: vi.fn()
    }
    const retryResponse = await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      totalsCache: suppliedTotalsCache
    })
    expect(saveCachedTotalsMock).not.toHaveBeenCalled()
    expect(suppliedTotalsCache.write).toHaveBeenCalledWith([{ date: 'date-100', usdValue: 0, isComplete: false }])
    expect(fetchHistoricalPricesMock).toHaveBeenLastCalledWith(
      [{ chainId: 1, address: tokenAddress, timestamps: [101] }],
      { resolution: 'utc_day' }
    )
    expect(retryResponse.isComplete).toBe(false)
    expect(retryResponse.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, totalUsdValue: 0, isComplete: false },
      { date: 'date-200', timestamp: 201, totalUsdValue: 1, isComplete: true }
    ])
  })

  it('uses a Kong daily-average asset price only for its exact UTC day without overriding the primary price', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000b2'
    const tokenAddress = '0x0000000000000000000000000000000000000bb2'
    const suppliedTotalsCache = {
      read: vi.fn().mockResolvedValue({ totals: [], oldestUpdatedAt: null }),
      write: vi.fn()
    }

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({ deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] })
    buildPositionTimelineMock.mockReturnValue([{ blockTimestamp: 100, blockNumber: 1 }])
    getUniqueVaultsMock.mockReturnValue([{ chainId: 10, vaultAddress }])
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `10:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 10,
            version: 'v2',
            token: { address: tokenAddress, symbol: 'LP', decimals: 18 },
            decimals: 18
          }
        ]
      ])
    )
    const primaryPriceData = new Map([[`optimism:${tokenAddress}`, new Map([[101, 4]])]])
    const kongPriceData = new Map([
      [
        `optimism:${tokenAddress}`,
        new Map([
          [101, 999],
          [201, 3]
        ])
      ]
    ])
    const prefetch = vi.fn()
    const resolve = vi.fn().mockResolvedValue(kongPriceData)
    createKongAssetPricePrefetcherMock.mockReturnValue({ prefetch, resolve })
    const valuationLoader = {
      key: 'valuation-loader-kong-overlap',
      fetchVaultPps: vi.fn().mockResolvedValue(new Map([[`10:${vaultAddress}`, new Map([[101, 2]])]])),
      fetchHistoricalPrices: vi.fn().mockImplementation(
        async (
          _requests: unknown,
          options: {
            onMissingHistoricalPrice: (request: { chainId: number; address: string; timestamps: number[] }) => void
          }
        ) => {
          options.onMissingHistoricalPrice({ chainId: 10, address: tokenAddress, timestamps: [201] })
          return primaryPriceData
        }
      )
    }
    getChainPrefixMock.mockReturnValue('optimism')
    getPPSMock.mockReturnValue(2)
    getPriceAtTimestampMock.mockImplementation((prices: Map<number, number>, timestamp: number) =>
      prices.get(timestamp)
    )
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)

    const { getHistoricalHoldings } = await import('@/server/lib/holdings/services/aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      totalsCache: suppliedTotalsCache,
      valuationLoader
    })

    expect(prefetch).toHaveBeenCalledWith([{ chainId: 10, assetAddress: tokenAddress }])
    expect(resolve).toHaveBeenCalledWith([
      {
        chainId: 10,
        vaultAddress,
        assetAddress: tokenAddress,
        timestamps: [201]
      }
    ])
    expect(prefetch.mock.invocationCallOrder[0]).toBeLessThan(resolve.mock.invocationCallOrder[0] ?? 0)
    expect(response).toMatchObject({
      isComplete: true,
      dataPoints: [
        { date: 'date-100', timestamp: 101, totalUsdValue: 8, isComplete: true },
        { date: 'date-200', timestamp: 201, totalUsdValue: 6, isComplete: true }
      ]
    })
    expect(suppliedTotalsCache.write).toHaveBeenCalledWith([
      { date: 'date-100', usdValue: 8, isComplete: true },
      { date: 'date-200', usdValue: 6, isComplete: true }
    ])
  })

  it('does not carry a pre-exit asset price across an unpriced re-entry gap', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000b2'
    const tokenAddress = '0x0000000000000000000000000000000000000bb2'
    const suppliedTotalsCache = {
      read: vi.fn().mockResolvedValue({ totals: [], oldestUpdatedAt: null }),
      write: vi.fn()
    }

    generateDailyTimestampsMock.mockReturnValue([100, 200, 300])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({ deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] })
    buildPositionTimelineMock.mockReturnValue([{ blockTimestamp: 100, blockNumber: 1 }])
    getUniqueVaultsMock.mockReturnValue([{ chainId: 1, vaultAddress }])
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 1,
            version: 'v2',
            token: { address: tokenAddress, symbol: 'TKN', decimals: 18 },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          new Map([
            [101, 1],
            [301, 1]
          ])
        ]
      ])
    )
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[101, 2]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockReturnValue(2)
    getShareBalanceAtTimestampMock.mockImplementation(
      (_timeline: unknown, _vaultAddress: string, _chainId: number, timestamp: number) =>
        timestamp === 201 ? BigInt(0) : 1n * 10n ** 18n
    )

    const { getHistoricalHoldings } = await import('@/server/lib/holdings/services/aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      totalsCache: suppliedTotalsCache
    })

    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith(
      [{ chainId: 1, address: tokenAddress, timestamps: [101, 301] }],
      { resolution: 'utc_day' }
    )
    expect(fetchMissingHistoricalAssetPricesFromKongMock).toHaveBeenCalledWith({
      requirements: [
        {
          chainId: 1,
          vaultAddress,
          assetAddress: tokenAddress,
          timestamps: [301]
        }
      ]
    })
    expect(response).toMatchObject({
      isComplete: false,
      dataPoints: [
        { date: 'date-100', timestamp: 101, totalUsdValue: 2, isComplete: true },
        { date: 'date-200', timestamp: 201, totalUsdValue: 0, isComplete: true },
        { date: 'date-300', timestamp: 301, totalUsdValue: 0, isComplete: false }
      ]
    })
  })

  it('marks versioned dates incomplete when an unclassified vault has shares', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const knownVaultAddress = '0x00000000000000000000000000000000000000b2'
    const unknownVaultAddress = '0x00000000000000000000000000000000000000b3'
    const tokenAddress = '0x0000000000000000000000000000000000000bb2'
    const vaults = [
      { chainId: 1, vaultAddress: knownVaultAddress },
      { chainId: 1, vaultAddress: unknownVaultAddress }
    ]
    const suppliedTotalsCache = {
      read: vi.fn().mockResolvedValue({ totals: [], oldestUpdatedAt: null }),
      write: vi.fn()
    }

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({ deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] })
    buildPositionTimelineMock.mockReturnValue([{ blockTimestamp: 100, blockNumber: 1 }])
    getUniqueVaultsMock.mockReturnValue(vaults)
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${knownVaultAddress}`,
          {
            address: knownVaultAddress,
            chainId: 1,
            version: 'v2',
            token: { address: tokenAddress, symbol: 'TKN', decimals: 18 },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockResolvedValue(new Map([[`1:${knownVaultAddress}`, new Map([[101, 1]])]]))
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[101, 1]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockReturnValue(1)
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'v2', 'seq', 'paged', '1y', undefined, {
      totalsCache: suppliedTotalsCache
    })

    expect(response.isComplete).toBe(false)
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 1, isComplete: false }])
    expect(suppliedTotalsCache.write).toHaveBeenCalledWith([{ date: 'date-100', usdValue: 1, isComplete: false }])
  })

  it('rejects a zero-looking versioned history when every active vault is unclassified', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const unknownVaultAddress = '0x00000000000000000000000000000000000000b3'
    const suppliedTotalsCache = {
      read: vi.fn().mockResolvedValue({ totals: [], oldestUpdatedAt: null }),
      write: vi.fn()
    }

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({ deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] })
    buildPositionTimelineMock.mockReturnValue([{ blockTimestamp: 100, blockNumber: 1 }])
    getUniqueVaultsMock.mockReturnValue([{ chainId: 1, vaultAddress: unknownVaultAddress }])
    fetchMultipleVaultsMetadataMock.mockResolvedValue(new Map())
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'v2', 'seq', 'paged', '1y', undefined, {
      totalsCache: suppliedTotalsCache
    })

    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).not.toHaveBeenCalled()
    expect(response.isComplete).toBe(false)
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 0, isComplete: false }])
    expect(suppliedTotalsCache.write).toHaveBeenCalledWith([{ date: 'date-100', usdValue: 0, isComplete: false }])
  })

  it('schedules a supplied totals-cache write only when explicitly requested', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const unknownVaultAddress = '0x00000000000000000000000000000000000000b3'
    const scheduledWrite = createDeferred<boolean>()
    const scheduled = createDeferred<{ readonly persistence: Promise<boolean> }>()
    const scheduledTotalsCache = {
      read: vi.fn().mockResolvedValue({ totals: [], oldestUpdatedAt: null }),
      write: vi.fn().mockReturnValue(scheduledWrite.promise)
    }

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({ deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] })
    buildPositionTimelineMock.mockReturnValue([{ blockTimestamp: 100, blockNumber: 1 }])
    getUniqueVaultsMock.mockReturnValue([{ chainId: 1, vaultAddress: unknownVaultAddress }])
    fetchMultipleVaultsMetadataMock.mockResolvedValue(new Map())
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)

    const { getHistoricalHoldings } = await import('@/server/lib/holdings/services/aggregator')
    const scheduledResponsePromise = getHistoricalHoldings(userAddress, 'v2', 'seq', 'paged', '1y', undefined, {
      totalsCache: scheduledTotalsCache,
      scheduleTotalsCacheWrite: (persistence) => {
        scheduled.resolve({ persistence })
      }
    })
    const scheduledPersistence = (await scheduled.promise).persistence
    const scheduledResponse = await scheduledResponsePromise

    expect(scheduledResponse.isComplete).toBe(false)
    expect(scheduledTotalsCache.write).toHaveBeenCalledWith([{ date: 'date-100', usdValue: 0, isComplete: false }])
    scheduledWrite.resolve(true)
    await expect(scheduledPersistence).resolves.toBe(true)

    const awaitedWrite = createDeferred<boolean>()
    const awaitedTotalsCache = {
      read: vi.fn().mockResolvedValue({ totals: [], oldestUpdatedAt: null }),
      write: vi.fn().mockReturnValue(awaitedWrite.promise)
    }
    const awaitedResponsePromise = getHistoricalHoldings(userAddress, 'v2', 'seq', 'paged', '1y', undefined, {
      totalsCache: awaitedTotalsCache
    })
    const awaitedState = { completed: false }
    void awaitedResponsePromise.then(() => {
      awaitedState.completed = true
    })
    await vi.waitFor(() => {
      expect(awaitedTotalsCache.write).toHaveBeenCalledTimes(1)
    })
    expect(awaitedState.completed).toBe(false)

    awaitedWrite.resolve(true)
    await expect(awaitedResponsePromise).resolves.toMatchObject({ isComplete: false })
  })

  it('checks legacy versioned cache invalidation against vaults whose metadata is unavailable', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const knownVaultAddress = '0x00000000000000000000000000000000000000c2'
    const unknownVaultAddress = '0x00000000000000000000000000000000000000c3'
    const vaults = [
      { chainId: 1, vaultAddress: knownVaultAddress },
      { chainId: 1, vaultAddress: unknownVaultAddress }
    ]

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({
      totals: [{ date: 'date-100', usdValue: 10 }],
      oldestUpdatedAt: new Date(1_000)
    })
    fetchUserEventsMock.mockResolvedValue({ deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] })
    buildPositionTimelineMock.mockReturnValue([{ blockTimestamp: 100, blockNumber: 1 }])
    getUniqueVaultsMock.mockReturnValue(vaults)
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${knownVaultAddress}`,
          {
            address: knownVaultAddress,
            chainId: 1,
            version: 'v2',
            token: {
              address: '0x0000000000000000000000000000000000000cc2',
              symbol: 'TKN',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    checkCacheStalenessMock.mockResolvedValue(false)

    const { getHistoricalHoldings } = await import('./aggregator')
    await getHistoricalHoldings(userAddress, 'v2')

    expect(checkCacheStalenessMock).toHaveBeenCalledWith(
      [
        { address: knownVaultAddress, chainId: 1 },
        { address: unknownVaultAddress, chainId: 1 }
      ],
      new Date(1_000)
    )
  })

  it.each([
    0,
    Number.NaN,
    Number.POSITIVE_INFINITY
  ])('returns and provisionally caches a daily total when PPS is invalid (%s)', async (invalidPps) => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000d2'
    const tokenAddress = '0x0000000000000000000000000000000000000dd2'
    const suppliedTotalsCache = {
      read: vi.fn().mockResolvedValue({ totals: [], oldestUpdatedAt: null }),
      write: vi.fn()
    }

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({ deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] })
    buildPositionTimelineMock.mockReturnValue([{ blockTimestamp: 100, blockNumber: 1 }])
    getUniqueVaultsMock.mockReturnValue([{ chainId: 1, vaultAddress }])
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 1,
            version: 'v3',
            token: { address: tokenAddress, symbol: 'TKN', decimals: 18 },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockResolvedValue(new Map([[`1:${vaultAddress}`, new Map([[101, invalidPps]])]]))
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[101, 1]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(invalidPps)
    getPriceAtTimestampMock.mockReturnValue(1)
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      totalsCache: suppliedTotalsCache
    })

    expect(response.isComplete).toBe(false)
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 0, isComplete: false }])
    expect(suppliedTotalsCache.write).toHaveBeenCalledWith([{ date: 'date-100', usdValue: 0, isComplete: false }])
  })

  it('marks history as active even when only unsettled same-day events exist', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000e1'
    const sameDayDeposit = {
      id: 'same-day-deposit',
      vaultAddress,
      chainId: 1,
      blockNumber: 2,
      blockTimestamp: 250,
      logIndex: 0,
      transactionHash: '0x123',
      transactionFrom: userAddress,
      owner: userAddress,
      sender: userAddress,
      shares: '1000000000000000000',
      assets: '1000000000000000000'
    }

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({ totals: [], oldestUpdatedAt: null })
    fetchUserEventsMock.mockImplementation((_address: string, _version: string, maxTimestamp?: number) =>
      Promise.resolve({
        deposits: (maxTimestamp ?? 0) >= sameDayDeposit.blockTimestamp ? [sameDayDeposit] : [],
        withdrawals: [],
        transfersIn: [],
        transfersOut: []
      })
    )
    buildPositionTimelineMock.mockImplementation((deposits: Array<{ blockTimestamp: number; blockNumber: number }>) => {
      return deposits.map((deposit) => ({
        blockTimestamp: deposit.blockTimestamp,
        blockNumber: deposit.blockNumber
      }))
    })
    getUniqueVaultsMock.mockReturnValue([])
    generateDailyTimestampsFromRangeMock.mockReturnValue([])

    const { getHistoricalHoldingsChart } = await import('./aggregator')
    const response = await getHistoricalHoldingsChart(userAddress, 'all', 'seq', 'paged', 'usd', '1y')

    expect(fetchUserEventsMock).toHaveBeenCalledWith(
      userAddress,
      'all',
      201 + CURRENT_DAY_LOOKAHEAD_SECONDS,
      'seq',
      'paged'
    )
    expect(response.hasActivity).toBe(true)
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, value: 0, isComplete: true },
      { date: 'date-200', timestamp: 201, value: 0, isComplete: true }
    ])
  })

  it('builds breakdown using the latest chart timestamp instead of current time', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(999_000)

    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000a2'
    const tokenAddress = '0x0000000000000000000000000000000000000aa2'
    const timeline = [{ id: 'entry-1' }]
    const vaults = [{ chainId: 1, vaultAddress }]

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue(timeline)
    getUniqueVaultsMock.mockReturnValue(vaults)
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 1,
            version: 'v3',
            token: {
              address: tokenAddress,
              symbol: 'TKN',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockResolvedValue(new Map([[`1:${vaultAddress}`, new Map([[201, 1.5]])]]))
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[200, 2]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1.5)
    getPriceAtTimestampMock.mockReturnValue(2)
    getShareBalanceAtTimestampMock.mockReturnValue(2n * 10n ** 18n)

    const { getHoldingsBreakdown } = await import('./aggregator')
    const response = await getHoldingsBreakdown(userAddress, 'all', 'parallel', 'all')

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 'all', 86600, 'parallel', 'all')
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([{ chainId: 1, address: tokenAddress, timestamps: [201] }], {
      resolution: 'utc_day'
    })
    expect(getShareBalanceAtTimestampMock).toHaveBeenCalledWith(timeline, vaultAddress, 1, 201)
    expect(response).toEqual({
      address: userAddress,
      version: 'all',
      date: 'date-201',
      timestamp: 201,
      summary: {
        totalVaults: 1,
        vaultsWithShares: 1,
        totalUsdValue: 6,
        missingMetadata: 0,
        missingPps: 0,
        missingPrice: 0
      },
      vaults: [
        {
          chainId: 1,
          vaultAddress,
          shares: '2000000000000000000',
          sharesFormatted: 2,
          pricePerShare: 1.5,
          tokenPrice: 2,
          usdValue: 6,
          metadata: {
            symbol: 'TKN',
            decimals: 18,
            tokenAddress
          },
          status: 'ok'
        }
      ],
      issues: {
        missingMetadata: [],
        missingPps: [],
        missingPrice: []
      }
    })
  })

  it('builds breakdown for an explicitly requested historical date', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000b2'
    const tokenAddress = '0x0000000000000000000000000000000000000bb2'
    const timeline = [{ id: 'entry-2' }]
    const vaults = [{ chainId: 1, vaultAddress }]

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue(timeline)
    getUniqueVaultsMock.mockReturnValue(vaults)
    fetchMultipleVaultsMetadataMock.mockResolvedValue(
      new Map([
        [
          `1:${vaultAddress}`,
          {
            address: vaultAddress,
            chainId: 1,
            version: 'v3',
            token: {
              address: tokenAddress,
              symbol: 'OLD',
              decimals: 18
            },
            decimals: 18
          }
        ]
      ])
    )
    fetchMultipleVaultsPPSMock.mockResolvedValue(new Map([[`1:${vaultAddress}`, new Map([[101, 3]])]]))
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[100, 4]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(3)
    getPriceAtTimestampMock.mockReturnValue(4)
    getShareBalanceAtTimestampMock.mockReturnValue(5n * 10n ** 18n)

    const { getHoldingsBreakdown } = await import('./aggregator')
    const response = await getHoldingsBreakdown(userAddress, 'all', 'seq', 'paged', 100)

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 'all', 86500, 'seq', 'paged')
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([{ chainId: 1, address: tokenAddress, timestamps: [101] }], {
      resolution: 'utc_day'
    })
    expect(getShareBalanceAtTimestampMock).toHaveBeenCalledWith(timeline, vaultAddress, 1, 101)
    expect(response.date).toBe('date-101')
    expect(response.timestamp).toBe(101)
    expect(response.summary.totalUsdValue).toBe(60)
  })

  it('loads fixed-snapshot history through an injected source and bypasses persistent derived caches', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const eventSource = {
      key: 'ledger:revision-1',
      latestSettledDayTimestamp: 31_449_600,
      eventUpperTimestamp: 31_536_001,
      load: vi.fn().mockResolvedValue({
        deposits: [],
        withdrawals: [],
        transfersIn: [],
        transfersOut: []
      })
    }

    generateDailyTimestampsFromRangeMock.mockReturnValue([31_449_600])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    buildPositionTimelineMock.mockReturnValue([])
    getUniqueVaultsMock.mockReturnValue([])

    const { getHistoricalHoldings } = await import('@/server/lib/holdings/services/aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      eventSource
    })

    expect(eventSource.load).toHaveBeenCalledWith({
      userAddress,
      version: 'all',
      maxTimestamp: 31_536_001,
      fetchType: 'seq',
      paginationMode: 'paged'
    })
    expect(fetchUserEventsMock).not.toHaveBeenCalled()
    expect(generateDailyTimestampsFromRangeMock).toHaveBeenCalledWith(0, 31_449_600)
    expect(getCachedTotalsWithTimestampMock).not.toHaveBeenCalled()
    expect(checkCacheStalenessMock).not.toHaveBeenCalled()
    expect(clearUserCacheMock).not.toHaveBeenCalled()
    expect(saveCachedTotalsMock).not.toHaveBeenCalled()
    expect(response).toEqual({
      address: userAddress,
      periodDays: 1,
      timeframe: '1y',
      hasActivity: false,
      isComplete: true,
      dataPoints: [{ date: 'date-31449600', timestamp: 31_449_601, totalUsdValue: 0, isComplete: true }]
    })
  })

  it('reuses a prepared settled context instead of loading the injected source again', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const events = {
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    }
    const eventSource = {
      key: 'ledger:prepared-revision',
      latestSettledDayTimestamp: 31_449_600,
      eventUpperTimestamp: 31_536_001,
      load: vi.fn()
    }
    const settledContext = Promise.resolve({
      address: userAddress,
      eventSourceKey: eventSource.key,
      latestSettledDayTimestamp: eventSource.latestSettledDayTimestamp,
      maxTimestamp: eventSource.eventUpperTimestamp,
      events,
      timeline: [],
      hasActivity: false,
      rawEvents: [],
      rawVaultIdentifiers: [],
      vaultMetadata: new Map(),
      metadataFetchFailedVaults: 0
    })

    generateDailyTimestampsFromRangeMock.mockReturnValue([31_449_600])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)

    const { getHistoricalHoldings } = await import('@/server/lib/holdings/services/aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      eventSource,
      settledContext
    })

    expect(eventSource.load).not.toHaveBeenCalled()
    expect(fetchUserEventsMock).not.toHaveBeenCalled()
    expect(fetchMultipleVaultsMetadataMock).not.toHaveBeenCalled()
    expect(response.hasActivity).toBe(false)
  })

  it('uses an explicitly supplied totals cache with an injected event source', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const eventSource = {
      key: 'wallet-ledger:revision-1',
      latestSettledDayTimestamp: 31_449_600,
      eventUpperTimestamp: 31_536_001,
      hasActivity: true,
      load: vi.fn().mockResolvedValue({
        deposits: [],
        withdrawals: [],
        transfersIn: [],
        transfersOut: []
      })
    }
    const totalsCache = {
      read: vi.fn().mockResolvedValue({
        totals: [{ date: 'date-31449600', usdValue: 42 }],
        oldestUpdatedAt: new Date(1_000)
      }),
      write: vi.fn()
    }

    generateDailyTimestampsFromRangeMock.mockReturnValue([31_449_600])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    buildPositionTimelineMock.mockReturnValue([])
    getUniqueVaultsMock.mockReturnValue([])

    const { getHistoricalHoldings } = await import('@/server/lib/holdings/services/aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      eventSource,
      totalsCache
    })

    expect(totalsCache.read).toHaveBeenCalledWith('date-31449600', 'date-31449600')
    expect(totalsCache.write).not.toHaveBeenCalled()
    expect(eventSource.load).not.toHaveBeenCalled()
    expect(fetchMultipleVaultsMetadataMock).not.toHaveBeenCalled()
    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).not.toHaveBeenCalled()
    expect(getCachedTotalsWithTimestampMock).not.toHaveBeenCalled()
    expect(checkCacheStalenessMock).not.toHaveBeenCalled()
    expect(response.isComplete).toBe(true)
    expect(response.dataPoints).toEqual([
      { date: 'date-31449600', timestamp: 31_449_601, totalUsdValue: 42, isComplete: true }
    ])
  })

  it('does not carry an earlier ETH price into a missing historical chart day', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const firstDay = 31_449_600
    const secondDay = 31_536_000
    const firstValuationTimestamp = firstDay + 1
    const secondValuationTimestamp = secondDay + 1
    const eventSource = {
      key: 'wallet-ledger:revision-eth-gap',
      latestSettledDayTimestamp: secondDay,
      eventUpperTimestamp: secondDay + 86_400,
      hasActivity: true,
      load: vi.fn()
    }
    const totalsCache = {
      read: vi.fn().mockResolvedValue({
        totals: [
          { date: `date-${firstDay}`, usdValue: 40 },
          { date: `date-${secondDay}`, usdValue: 20 }
        ],
        oldestUpdatedAt: new Date(1_000)
      }),
      write: vi.fn()
    }
    const valuationLoader = {
      key: 'valuation-loader-eth-gap',
      fetchVaultPps: vi.fn(),
      fetchHistoricalPrices: vi
        .fn()
        .mockResolvedValue(
          new Map([['ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', new Map([[firstValuationTimestamp, 2]])]])
        )
    }

    generateDailyTimestampsFromRangeMock.mockReturnValue([firstDay, secondDay])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getChainPrefixMock.mockReturnValue('ethereum')
    getPriceAtTimestampMock.mockImplementation((prices: Map<number, number>, timestamp: number) => {
      return (
        Array.from(prices.entries())
          .filter(([candidate]) => candidate <= timestamp)
          .toSorted(([left], [right]) => left - right)
          .at(-1)?.[1] ?? 0
      )
    })

    const { getHistoricalHoldingsChart } = await import('@/server/lib/holdings/services/aggregator')
    const response = await getHistoricalHoldingsChart(userAddress, 'all', 'seq', 'paged', 'eth', '1y', undefined, {
      eventSource,
      totalsCache,
      valuationLoader
    })

    expect(valuationLoader.fetchHistoricalPrices).toHaveBeenCalledWith(
      [
        {
          chainId: 1,
          address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          timestamps: [firstValuationTimestamp, secondValuationTimestamp]
        }
      ],
      { resolution: 'utc_day', consumer: 'balance' }
    )
    expect(response).toMatchObject({
      denomination: 'eth',
      isComplete: false,
      dataPoints: [
        { timestamp: firstValuationTimestamp, value: 20, isComplete: true },
        { timestamp: secondValuationTimestamp, value: 0, isComplete: false }
      ]
    })
  })

  it('serves a fresh provisional total from the supplied cache without loading valuation inputs', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const eventSource = {
      key: 'wallet-ledger:revision-1',
      latestSettledDayTimestamp: 31_449_600,
      eventUpperTimestamp: 31_536_001,
      hasActivity: true,
      load: vi.fn()
    }
    const totalsCache = {
      read: vi.fn().mockResolvedValue({
        totals: [{ date: 'date-31449600', usdValue: 40, isComplete: false }],
        oldestUpdatedAt: new Date(1_000)
      }),
      write: vi.fn()
    }

    generateDailyTimestampsFromRangeMock.mockReturnValue([31_449_600])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)

    const { getHistoricalHoldings } = await import('@/server/lib/holdings/services/aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      eventSource,
      totalsCache
    })

    expect(totalsCache.read).toHaveBeenCalledWith('date-31449600', 'date-31449600')
    expect(totalsCache.write).not.toHaveBeenCalled()
    expect(eventSource.load).not.toHaveBeenCalled()
    expect(fetchMultipleVaultsMetadataMock).not.toHaveBeenCalled()
    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).not.toHaveBeenCalled()
    expect(response).toEqual({
      address: userAddress,
      periodDays: 1,
      timeframe: '1y',
      hasActivity: true,
      isComplete: false,
      dataPoints: [{ date: 'date-31449600', timestamp: 31_449_601, totalUsdValue: 40, isComplete: false }]
    })
  })

  it('supports explicit persistent derived-cache bypass with the legacy event source', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'

    generateDailyTimestampsMock.mockReturnValue([100])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    fetchUserEventsMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    })
    buildPositionTimelineMock.mockReturnValue([])
    generateDailyTimestampsFromRangeMock.mockReturnValue([])

    const { getHistoricalHoldings } = await import('@/server/lib/holdings/services/aggregator')
    await getHistoricalHoldings(userAddress, 'all', 'seq', 'paged', '1y', undefined, {
      cacheMode: 'bypass'
    })

    expect(fetchUserEventsMock).toHaveBeenCalled()
    expect(getCachedTotalsWithTimestampMock).not.toHaveBeenCalled()
    expect(checkCacheStalenessMock).not.toHaveBeenCalled()
    expect(clearUserCacheMock).not.toHaveBeenCalled()
    expect(saveCachedTotalsMock).not.toHaveBeenCalled()
  })

  it('uses an injected source fixed date for the default breakdown request', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const eventSource = {
      key: 'ledger:revision-1',
      latestSettledDayTimestamp: 300,
      eventUpperTimestamp: 86_700,
      load: vi.fn().mockResolvedValue({
        deposits: [],
        withdrawals: [],
        transfersIn: [],
        transfersOut: []
      })
    }

    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    buildPositionTimelineMock.mockReturnValue([])

    const { getHoldingsBreakdown } = await import('@/server/lib/holdings/services/aggregator')
    const response = await getHoldingsBreakdown(userAddress, 'all', 'seq', 'paged', undefined, {
      eventSource,
      cacheMode: 'bypass'
    })

    expect(eventSource.load).toHaveBeenCalledWith({
      userAddress,
      version: 'all',
      maxTimestamp: 86_700,
      fetchType: 'seq',
      paginationMode: 'paged'
    })
    expect(fetchUserEventsMock).not.toHaveBeenCalled()
    expect(generateDailyTimestampsMock).not.toHaveBeenCalled()
    expect(response).toMatchObject({
      address: userAddress,
      version: 'all',
      date: 'date-301',
      timestamp: 301,
      message: 'No events found'
    })
  })
})
