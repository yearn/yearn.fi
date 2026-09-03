import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TSettledAddressScopedContext } from './settledHoldingsContext'

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
const fetchMultipleVaultsPPSMock = vi.fn()
const getPPSMock = vi.fn()
const getPpsFetchFailedVaultsMock = vi.fn()
const fetchHistoricalPricesMock = vi.fn()
const getHistoricalPriceFetchFailedBatchesMock = vi.fn()
const getChainPrefixMock = vi.fn()
const getPriceAtTimestampMock = vi.fn()
const buildAddressScopedRawPnlEventsMock = vi.fn()
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

vi.mock('./pnlEvents', () => ({
  buildAddressScopedRawPnlEvents: buildAddressScopedRawPnlEventsMock
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
  getVaultMetadataFetchFailedVaults: vi.fn(() => 0),
  markVaultMetadataFetchFailures: vi.fn((metadata: Map<unknown, unknown>) => metadata),
  prefetchGlobalVaultMetadata: vi.fn(() => Promise.resolve())
}))

vi.mock('./kong', () => ({
  fetchMultipleVaultsPPS: fetchMultipleVaultsPPSMock,
  getPPS: getPPSMock,
  getPpsFetchFailedVaults: getPpsFetchFailedVaultsMock
}))

vi.mock('./prices', () => ({
  fetchHistoricalPrices: fetchHistoricalPricesMock,
  fetchHistoricalPricesForTokenTimestamps: fetchHistoricalPricesMock,
  getHistoricalPriceFetchFailedBatches: getHistoricalPriceFetchFailedBatchesMock,
  getChainPrefix: getChainPrefixMock,
  getPriceAtTimestamp: getPriceAtTimestampMock
}))

describe('getHistoricalHoldings', () => {
  beforeEach(() => {
    buildAddressScopedRawPnlEventsMock.mockImplementation(() => {
      const timeline = buildPositionTimelineMock.mock.results.at(-1)?.value
      if (!Array.isArray(timeline) || timeline.length === 0) {
        return []
      }

      const vaults = getUniqueVaultsMock(timeline) ?? []
      const blockTimestamp =
        timeline.find((entry: { blockTimestamp?: number }) => typeof entry.blockTimestamp === 'number')
          ?.blockTimestamp ?? 0
      return vaults.map((vault: { chainId: number; vaultAddress: string }) => ({
        chainId: vault.chainId,
        familyVaultAddress: vault.vaultAddress,
        blockTimestamp
      }))
    })
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
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('fills small gaps to use bounded daily price ranges', async () => {
    const day = 86_400
    const fullRange = Array.from({ length: 10 }, (_value, index) => 100 + index * day)
    const sparseRange = fullRange.filter((_timestamp, index) => index !== 5)
    const { fillBoundedHeldAssetPriceRanges } = await import('./aggregator')

    expect(fillBoundedHeldAssetPriceRanges([{ chainId: 1, address: '0xasset', timestamps: sparseRange }])).toEqual([
      { chainId: 1, address: '0xasset', timestamps: fullRange }
    ])
  })

  it('does not fill daily price ranges beyond the duplication budget', async () => {
    const day = 86_400
    const sparseRange = [100, 100 + 9 * day]
    const { fillBoundedHeldAssetPriceRanges } = await import('./aggregator')

    expect(fillBoundedHeldAssetPriceRanges([{ chainId: 1, address: '0xasset', timestamps: sparseRange }])).toEqual([
      { chainId: 1, address: '0xasset', timestamps: sparseRange }
    ])
  })

  it('combines visible V2 and V3 vaults into one cached history', async () => {
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
    fetchHistoricalPricesMock.mockResolvedValue(
      new Map([
        [`ethereum:${v2TokenAddress}`, new Map([[101, 1]])],
        [`ethereum:${v3TokenAddress}`, new Map([[101, 1]])]
      ])
    )
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockReturnValue(1)
    getShareBalanceAtTimestampMock.mockImplementation((_timeline: unknown, vaultAddress: string) => {
      return vaultAddress === v2VaultAddress ? 2n * 10n ** 18n : 5n * 10n ** 18n
    })
    generateDailyTimestampsFromRangeMock.mockReturnValue([])
    checkCacheStalenessMock.mockResolvedValue(false)

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress)

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 101 + CURRENT_DAY_LOOKAHEAD_SECONDS)
    expect(getCachedTotalsWithTimestampMock).toHaveBeenCalledWith(userAddress, 'date-100', 'date-100')
    expect(fetchMultipleVaultsPPSMock).toHaveBeenCalledWith(vaults)
    expect(saveCachedTotalsMock).toHaveBeenCalledWith(userAddress, [{ date: 'date-100', usdValue: 7 }])
    expect(response.hasActivity).toBe(true)
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 7 }])
  })

  it('uses the fixed bounded event-fetch pipeline', async () => {
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
    await getHistoricalHoldings(userAddress)

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 101 + CURRENT_DAY_LOOKAHEAD_SECONDS)
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
    const response = await getHistoricalHoldingsChart(userAddress, 'usd', '1y', [
      { chainId: 1, vaultAddress: firstVaultAddress },
      { chainId: 1, vaultAddress: secondVaultAddress }
    ])

    expect(getCachedTotalsWithTimestampMock).not.toHaveBeenCalled()
    expect(saveCachedTotalsMock).not.toHaveBeenCalled()
    expect(fetchMultipleVaultsPPSMock).toHaveBeenCalledWith([
      { chainId: 1, vaultAddress: firstVaultAddress },
      { chainId: 1, vaultAddress: secondVaultAddress }
    ])
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, value: 5 }])
  })

  it('requests prices only for held dates and does not carry a stale daily quote forward', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000b1'
    const tokenAddress = '0x0000000000000000000000000000000000000bb1'
    const timeline = [{ blockTimestamp: 150, blockNumber: 1 }]
    const vaults = [{ chainId: 1, vaultAddress }]

    generateDailyTimestampsMock.mockReturnValue([100, 200, 300])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({ totals: [], oldestUpdatedAt: null })
    fetchUserEventsMock.mockResolvedValue({ deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] })
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
            [101, 2],
            [201, 2],
            [301, 2]
          ])
        ]
      ])
    )
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[201, 1]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(2)
    getShareBalanceAtTimestampMock.mockImplementation(
      (_timeline: unknown, _vaultAddress: string, _chainId: number, timestamp: number) =>
        timestamp === 101 ? 0n : 1n * 10n ** 18n
    )
    generateDailyTimestampsFromRangeMock.mockReturnValue([])

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress)

    expect(buildPositionTimelineIndexMock).toHaveBeenCalledWith(timeline)
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([
      { chainId: 1, address: tokenAddress, timestamps: [201, 301] }
    ])
    expect(getPriceAtTimestampMock).not.toHaveBeenCalled()
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, totalUsdValue: 0 },
      { date: 'date-200', timestamp: 201, totalUsdValue: 2 },
      { date: 'date-300', timestamp: 301, totalUsdValue: 0 }
    ])
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
    const response = await getHistoricalHoldings(userAddress)

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 201 + CURRENT_DAY_LOOKAHEAD_SECONDS)
    expect(fetchMultipleVaultsMetadataMock).toHaveBeenCalled()
    expect(checkCacheStalenessMock).toHaveBeenCalledWith(
      [{ address: vaultAddress, chainId: 1 }],
      new Date('2026-03-31T00:00:00Z')
    )
    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).not.toHaveBeenCalled()
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, totalUsdValue: 1 },
      { date: 'date-200', timestamp: 201, totalUsdValue: 2 }
    ])
  })

  it('serves fully cached portfolio history without resolving its deferred wallet context', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const loadSettledContext = vi.fn(async () => {
      throw new Error('wallet context should remain deferred')
    })

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({
      totals: [
        { date: 'date-100', usdValue: 1 },
        { date: 'date-200', usdValue: 2 }
      ],
      oldestUpdatedAt: new Date('2026-03-31T00:00:00Z')
    })

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, '1y', undefined, loadSettledContext, () =>
      Promise.resolve([{ chainId: 1, vaultAddress: '0x00000000000000000000000000000000000000dd' }])
    )

    expect(loadSettledContext).not.toHaveBeenCalled()
    expect(fetchUserEventsMock).not.toHaveBeenCalled()
    expect(fetchMultipleVaultsMetadataMock).not.toHaveBeenCalled()
    expect(checkCacheStalenessMock).toHaveBeenCalledWith(
      [{ address: '0x00000000000000000000000000000000000000dd', chainId: 1 }],
      new Date('2026-03-31T00:00:00Z')
    )
    expect(response.hasActivity).toBe(true)
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, totalUsdValue: 1 },
      { date: 'date-200', timestamp: 201, totalUsdValue: 2 }
    ])
  })

  it('loads wallet context when a cached protocol response has no vaults to validate totals with', async () => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000df'
    const timeline = [{ id: 'cached-entry' }]
    const loadSettledContext = vi.fn(
      async () =>
        ({
          address: userAddress,
          latestSettledDayTimestamp: 200,
          maxTimestamp: 201,
          events: { deposits: [], withdrawals: [], transfersIn: [], transfersOut: [] },
          timeline,
          hasActivity: true,
          rawEvents: [],
          rawVaultIdentifiers: [{ chainId: 1, vaultAddress }],
          vaultMetadata: new Map([
            [
              `1:${vaultAddress}`,
              {
                address: vaultAddress,
                chainId: 1,
                version: 'v3',
                token: { address: vaultAddress, symbol: 'TEST', decimals: 18 },
                decimals: 18
              }
            ]
          ]),
          metadataFetchFailedVaults: 0
        }) as TSettledAddressScopedContext
    )

    generateDailyTimestampsMock.mockReturnValue([100, 200])
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getCachedTotalsWithTimestampMock.mockResolvedValue({
      totals: [
        { date: 'date-100', usdValue: 1 },
        { date: 'date-200', usdValue: 2 }
      ],
      oldestUpdatedAt: new Date('2026-03-31T00:00:00Z')
    })

    const { getHistoricalHoldings } = await import('./aggregator')
    await getHistoricalHoldings(userAddress, '1y', undefined, loadSettledContext, () => Promise.resolve([]))

    expect(loadSettledContext).toHaveBeenCalledTimes(1)
    expect(checkCacheStalenessMock).toHaveBeenCalledWith(
      [{ address: vaultAddress, chainId: 1 }],
      new Date('2026-03-31T00:00:00Z')
    )
    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
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
    const events = {
      deposits: [],
      withdrawals: [],
      transfersIn: [],
      transfersOut: []
    }
    const vaultMetadata = new Map([
      [
        `1:${vaultAddress}`,
        {
          address: vaultAddress,
          chainId: 1,
          version: 'v3' as const,
          token: {
            address: tokenAddress,
            symbol: 'STALE',
            decimals: 18
          },
          decimals: 18
        }
      ]
    ])
    const loadSettledContext = vi.fn(
      async () =>
        ({
          address: userAddress,
          latestSettledDayTimestamp: 200,
          maxTimestamp: 201,
          events,
          timeline: [{ id: 'stale-entry' }],
          hasActivity: true,
          rawEvents: [{ chainId: 1, familyVaultAddress: vaultAddress, blockTimestamp: 100 }],
          rawVaultIdentifiers: [{ chainId: 1, vaultAddress }],
          vaultMetadata,
          metadataFetchFailedVaults: 0
        }) as unknown as TSettledAddressScopedContext
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
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)
    checkCacheStalenessMock.mockResolvedValue(true)

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, '1y', undefined, loadSettledContext, () =>
      Promise.resolve([{ chainId: 1, vaultAddress }])
    )

    expect(loadSettledContext).toHaveBeenCalledTimes(1)
    expect(clearUserCacheMock).toHaveBeenCalledWith(userAddress)
    expect(fetchMultipleVaultsPPSMock).toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([
      { chainId: 1, address: tokenAddress, timestamps: [101, 201] }
    ])
    expect(getShareBalanceAtTimestampMock).toHaveBeenNthCalledWith(1, [{ id: 'stale-entry' }], vaultAddress, 1, 101)
    expect(getShareBalanceAtTimestampMock).toHaveBeenNthCalledWith(2, [{ id: 'stale-entry' }], vaultAddress, 1, 201)
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, totalUsdValue: 6 },
      { date: 'date-200', timestamp: 201, totalUsdValue: 6 }
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
    const response = await getHistoricalHoldings(userAddress)

    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).not.toHaveBeenCalled()
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 0 }])
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
    const response = await getHistoricalHoldingsChart(userAddress, 'usd', 'all')

    expect(generateDailyTimestampsFromRangeMock).toHaveBeenCalledWith(1_704_067_200, 200)
    expect(getCachedTotalsWithTimestampMock).toHaveBeenCalledWith(userAddress, 'date-50', 'date-200')
    expect(saveCachedTotalsMock).toHaveBeenCalledWith(userAddress, [
      { date: 'date-50', usdValue: 1 },
      { date: 'date-100', usdValue: 1 },
      { date: 'date-200', usdValue: 1 }
    ])
    expect(response.timeframe).toBe('all')
    expect(response.hasActivity).toBe(true)
    expect(response.dataPoints).toEqual([
      { date: 'date-50', timestamp: 51, value: 1 },
      { date: 'date-100', timestamp: 101, value: 1 },
      { date: 'date-200', timestamp: 201, value: 1 }
    ])
  })

  it.each([
    { label: 'partial price fetch failures', failedPriceBatches: 1, failedPpsVaults: 0 },
    { label: 'partial PPS fetch failures', failedPriceBatches: 0, failedPpsVaults: 1 }
  ])('does not cache recalculated totals after $label', async ({ failedPriceBatches, failedPpsVaults }) => {
    const userAddress = '0x93a62da5a14c80f265dabc077fcee437b1a0efde'
    const vaultAddress = '0x00000000000000000000000000000000000000b2'
    const tokenAddress = '0x0000000000000000000000000000000000000bb2'
    const timeline = [{ blockTimestamp: 100, blockNumber: 1 }]
    const vaults = [{ chainId: 1, vaultAddress }]

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
    fetchMultipleVaultsPPSMock.mockResolvedValue(new Map([[`1:${vaultAddress}`, new Map([[100, 1]])]]))
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[101, 1]])]]))
    getHistoricalPriceFetchFailedBatchesMock.mockReturnValue(failedPriceBatches)
    getPpsFetchFailedVaultsMock.mockReturnValue(failedPpsVaults)
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockReturnValue(1)
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)
    generateDailyTimestampsFromRangeMock.mockReturnValue([])

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress)

    expect(saveCachedTotalsMock).not.toHaveBeenCalled()
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 1 }])
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
    fetchUserEventsMock.mockImplementation((_address: string, maxTimestamp?: number) =>
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
    const response = await getHistoricalHoldingsChart(userAddress, 'usd', '1y')

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 201 + CURRENT_DAY_LOOKAHEAD_SECONDS)
    expect(response.hasActivity).toBe(true)
    expect(response.dataPoints).toEqual([
      { date: 'date-100', timestamp: 101, value: 0 },
      { date: 'date-200', timestamp: 201, value: 0 }
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
    const response = await getHoldingsBreakdown(userAddress)

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 86600)
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([{ chainId: 1, address: tokenAddress, timestamps: [201] }])
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
    const response = await getHoldingsBreakdown(userAddress, 100)

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 86500)
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([{ chainId: 1, address: tokenAddress, timestamps: [101] }])
    expect(getShareBalanceAtTimestampMock).toHaveBeenCalledWith(timeline, vaultAddress, 1, 101)
    expect(response.date).toBe('date-101')
    expect(response.timestamp).toBe(101)
    expect(response.summary.totalUsdValue).toBe(60)
  })
})
