import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getCachedTotalsWithTimestampMock = vi.fn()
const saveCachedTotalsMock = vi.fn()
const clearUserCacheMock = vi.fn()
const checkCacheStalenessMock = vi.fn()
const fetchUserEventsMock = vi.fn()
const buildPositionTimelineMock = vi.fn()
const generateDailyTimestampsMock = vi.fn()
const generateDailyTimestampsFromRangeMock = vi.fn()
const getShareBalanceAtTimestampMock = vi.fn()
const getUniqueVaultsMock = vi.fn()
const toSettledDayTimestampMock = vi.fn()
const timestampToDateStringMock = vi.fn()
const fetchMultipleVaultsMetadataMock = vi.fn()
const fetchMultipleVaultsPPSMock = vi.fn()
const getPPSMock = vi.fn()
const fetchHistoricalPricesMock = vi.fn()
const getChainPrefixMock = vi.fn()
const getPriceAtTimestampMock = vi.fn()

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
  generateDailyTimestamps: generateDailyTimestampsMock,
  generateDailyTimestampsFromRange: generateDailyTimestampsFromRangeMock,
  getShareBalanceAtTimestamp: getShareBalanceAtTimestampMock,
  getUniqueVaults: getUniqueVaultsMock,
  toSettledDayTimestamp: toSettledDayTimestampMock,
  timestampToDateString: timestampToDateStringMock
}))

vi.mock('./vaults', () => ({
  fetchMultipleVaultsMetadata: fetchMultipleVaultsMetadataMock
}))

vi.mock('./kong', () => ({
  fetchMultipleVaultsPPS: fetchMultipleVaultsPPSMock,
  getPPS: getPPSMock
}))

vi.mock('./defillama', () => ({
  fetchHistoricalPrices: fetchHistoricalPricesMock,
  getChainPrefix: getChainPrefixMock,
  getPriceAtTimestamp: getPriceAtTimestampMock
}))

describe('getHistoricalHoldings', () => {
  beforeEach(() => {
    toSettledDayTimestampMock.mockImplementation((timestamp: number) => timestamp + 1)
    checkCacheStalenessMock.mockResolvedValue(false)
    clearUserCacheMock.mockResolvedValue(0)
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

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 'all', 86500, 'parallel', 'all')
    expect(getCachedTotalsWithTimestampMock).toHaveBeenCalledWith(userAddress, 'v2', 'date-100', 'date-100')
    expect(fetchMultipleVaultsPPSMock).toHaveBeenCalledWith([vaults[0]])
    expect(saveCachedTotalsMock).toHaveBeenCalledWith(userAddress, 'v2', [{ date: 'date-100', usdValue: 2 }])
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 2 }])
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

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 'all', 86500, 'seq', 'paged')
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

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 'all', 86600, 'seq', 'paged')
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
    getShareBalanceAtTimestampMock.mockReturnValue(1n * 10n ** 18n)
    checkCacheStalenessMock.mockResolvedValue(true)

    const { getHistoricalHoldings } = await import('./aggregator')
    const response = await getHistoricalHoldings(userAddress, 'all')

    expect(clearUserCacheMock).toHaveBeenCalledWith(userAddress, 'all')
    expect(fetchMultipleVaultsPPSMock).toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([{ chainId: 1, address: tokenAddress }], [101, 201])
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
    const response = await getHistoricalHoldings(userAddress, 'all')

    expect(fetchMultipleVaultsPPSMock).not.toHaveBeenCalled()
    expect(fetchHistoricalPricesMock).not.toHaveBeenCalled()
    expect(response.dataPoints).toEqual([{ date: 'date-100', timestamp: 101, totalUsdValue: 0 }])
  })

  it('expands all timeframe from the first wallet event to the latest settled day', async () => {
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
            [50, 1],
            [100, 1],
            [200, 1]
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

    expect(generateDailyTimestampsFromRangeMock).toHaveBeenCalledWith(50, 200)
    expect(getCachedTotalsWithTimestampMock).not.toHaveBeenCalled()
    expect(saveCachedTotalsMock).toHaveBeenCalledWith(userAddress, 'all', [
      { date: 'date-50', usdValue: 1 },
      { date: 'date-100', usdValue: 1 },
      { date: 'date-200', usdValue: 1 }
    ])
    expect(response.timeframe).toBe('all')
    expect(response.dataPoints).toEqual([
      { date: 'date-50', timestamp: 51, value: 1 },
      { date: 'date-100', timestamp: 101, value: 1 },
      { date: 'date-200', timestamp: 201, value: 1 }
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
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[201, 2]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(1.5)
    getPriceAtTimestampMock.mockReturnValue(2)
    getShareBalanceAtTimestampMock.mockReturnValue(2n * 10n ** 18n)

    const { getHoldingsBreakdown } = await import('./aggregator')
    const response = await getHoldingsBreakdown(userAddress, 'all', 'parallel', 'all')

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 'all', 86600, 'parallel', 'all')
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([{ chainId: 1, address: tokenAddress }], [201])
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
    fetchHistoricalPricesMock.mockResolvedValue(new Map([[`ethereum:${tokenAddress}`, new Map([[101, 4]])]]))
    getChainPrefixMock.mockReturnValue('ethereum')
    getPPSMock.mockReturnValue(3)
    getPriceAtTimestampMock.mockReturnValue(4)
    getShareBalanceAtTimestampMock.mockReturnValue(5n * 10n ** 18n)

    const { getHoldingsBreakdown } = await import('./aggregator')
    const response = await getHoldingsBreakdown(userAddress, 'all', 'seq', 'paged', 100)

    expect(fetchUserEventsMock).toHaveBeenCalledWith(userAddress, 'all', 86500, 'seq', 'paged')
    expect(fetchHistoricalPricesMock).toHaveBeenCalledWith([{ chainId: 1, address: tokenAddress }], [101])
    expect(getShareBalanceAtTimestampMock).toHaveBeenCalledWith(timeline, vaultAddress, 1, 101)
    expect(response.date).toBe('date-101')
    expect(response.timestamp).toBe(101)
    expect(response.summary.totalUsdValue).toBe(60)
  })
})
