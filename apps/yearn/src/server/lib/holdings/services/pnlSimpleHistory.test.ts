import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultMetadata } from '../types'
import { toVaultKey } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'

const fetchHistoricalPricesForTokenTimestampsMock = vi.fn()
const getHistoricalPriceFetchFailedBatchesMock = vi.fn()
const getPriceAtTimestampMock = vi.fn()
const getSettledAddressScopedContextMock = vi.fn()
const getSettledPpsContextMock = vi.fn()
const getVaultIdentifiersMock = vi.fn()
const selectEventsMock = vi.fn()
const fetchActivityEventsByTransactionHashesMock = vi.fn()
const generateDailyTimestampsMock = vi.fn()
const generateDailyTimestampsFromRangeMock = vi.fn()
const toSettledDayTimestampMock = vi.fn()
const timestampToDateStringMock = vi.fn()
const getPPSMock = vi.fn()
const getPpsFetchFailedVaultsMock = vi.fn()
const deriveNestedVaultAssetPriceDataMock = vi.fn()
const expandNestedVaultAssetPriceRequestsMock = vi.fn()
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
  getHoldingsProgressReporter: vi.fn(() => undefined),
  reportHoldingsProgress: vi.fn(),
  withHoldingsProgressReporter: (_reporter: unknown, fn: () => Promise<unknown>) => fn()
}))

vi.mock('./prices', () => ({
  fetchHistoricalPricesForTokenTimestamps: fetchHistoricalPricesForTokenTimestampsMock,
  getChainPrefix: vi.fn(() => 'ethereum'),
  getHistoricalPriceFetchFailedBatches: getHistoricalPriceFetchFailedBatchesMock,
  getPriceAtTimestamp: getPriceAtTimestampMock
}))

vi.mock('./settledHoldingsContext', () => ({
  getSettledAddressScopedContext: getSettledAddressScopedContextMock,
  getSettledPpsContext: getSettledPpsContextMock,
  getVaultIdentifiers: getVaultIdentifiersMock,
  selectEvents: selectEventsMock
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

vi.mock('./nestedVaultPrices', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./nestedVaultPrices')>()),
  expandNestedVaultAssetPriceRequests: expandNestedVaultAssetPriceRequestsMock,
  deriveNestedVaultAssetPriceData: deriveNestedVaultAssetPriceDataMock,
  getNestedVaultPpsIdentifiersFromPriceRequests: getNestedVaultPpsIdentifiersFromPriceRequestsMock,
  mergeVaultIdentifiers: vi.fn((identifiers: unknown[]) => identifiers)
}))

vi.mock('./pnlEvents', () => ({
  mergeAddressScopedRawPnlEventsWithTransactionActivity: vi.fn((events: TRawPnlEvent[]) => events)
}))

const USER = '0x1111111111111111111111111111111111111111'
const OTHER = '0x2222222222222222222222222222222222222222'
const VAULT = '0x3333333333333333333333333333333333333333'
const NESTED_VAULT = '0x5555555555555555555555555555555555555555'
const ASSET = '0x4444444444444444444444444444444444444444'
const ONE = 10n ** 18n
const HISTORY_START_TIMESTAMP = 1_704_067_200
const VAULT_KEY = toVaultKey(1, VAULT)
const NESTED_VAULT_KEY = toVaultKey(1, NESTED_VAULT)
const ASSET_PRICE_KEY = `ethereum:${ASSET}`
const NESTED_VAULT_PRICE_KEY = `ethereum:${NESTED_VAULT}`
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
const nestedMetadata = new Map<string, VaultMetadata>([
  [
    VAULT_KEY,
    {
      ...metadata.get(VAULT_KEY)!,
      token: {
        address: NESTED_VAULT,
        symbol: 'yvTST',
        decimals: 18
      }
    }
  ],
  [
    NESTED_VAULT_KEY,
    {
      address: NESTED_VAULT,
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
const EVENT_RECEIPT_DAY_TIMESTAMP = Math.floor(event.blockTimestamp / 86_400) * 86_400
const DEFAULT_LATEST_SETTLED_TIMESTAMP = EVENT_RECEIPT_DAY_TIMESTAMP + 4 * 86_400 - 1

const settledContext = {
  address: USER,
  latestSettledDayTimestamp: DEFAULT_LATEST_SETTLED_TIMESTAMP - 1,
  maxTimestamp: DEFAULT_LATEST_SETTLED_TIMESTAMP,
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

async function runNestedHybridHistoryScenario(hasExitPrice: boolean) {
  const day = 86_400
  const depositTimestamp = EVENT_RECEIPT_DAY_TIMESTAMP
  const exitTimestamp = depositTimestamp + 2 * day
  const firstHistoryTimestamp = depositTimestamp + day + 1
  const finalHistoryTimestamp = exitTimestamp + day + 1
  const events = [
    { ...event, blockTimestamp: depositTimestamp },
    {
      ...event,
      kind: 'withdrawal',
      id: 'nested-partial-withdrawal',
      blockNumber: 2,
      blockTimestamp: exitTimestamp,
      transactionHash: '0xnested-partial-withdrawal',
      shares: 50n * ONE,
      assets: 60n * ONE
    }
  ] as TRawPnlEvent[]
  const outerPpsData = new Map([
    [firstHistoryTimestamp, 1],
    [finalHistoryTimestamp, 1.2]
  ])
  const innerPpsData = new Map([
    [depositTimestamp, 1],
    [depositTimestamp + day, 1],
    [exitTimestamp, 3]
  ])
  const ppsData = new Map([
    [VAULT_KEY, outerPpsData],
    [NESTED_VAULT_KEY, innerPpsData]
  ])
  const nestedContext = {
    ...settledContext,
    rawEvents: events,
    selectedEvents: events,
    vaultMetadata: nestedMetadata,
    ppsIdentifiers: [
      { chainId: 1, vaultAddress: VAULT },
      { chainId: 1, vaultAddress: NESTED_VAULT }
    ],
    ppsData
  }
  const underlyingPrices = new Map<number, number>([
    [depositTimestamp, 1],
    [depositTimestamp + day, 2],
    ...(hasExitPrice ? ([[exitTimestamp, 9]] as const) : [])
  ])
  const nestedVaultPrices = new Map<number, number>(hasExitPrice ? [[exitTimestamp, 27]] : [])
  const wethPrices = new Map([
    [depositTimestamp, 1],
    [depositTimestamp + day, 1]
  ])
  const actualNestedVaultPrices = await vi.importActual<typeof import('./nestedVaultPrices')>('./nestedVaultPrices')
  expandNestedVaultAssetPriceRequestsMock.mockImplementation(
    actualNestedVaultPrices.expandNestedVaultAssetPriceRequests
  )
  deriveNestedVaultAssetPriceDataMock.mockImplementation(actualNestedVaultPrices.deriveNestedVaultAssetPriceData)
  generateDailyTimestampsMock.mockReturnValue([firstHistoryTimestamp - 1, finalHistoryTimestamp - 1])
  getSettledAddressScopedContextMock.mockResolvedValue(nestedContext)
  getSettledPpsContextMock.mockResolvedValue(nestedContext)
  selectEventsMock.mockReturnValue({
    events,
    vaultIdentifiers: nestedContext.selectedVaultIdentifiers
  })
  getNestedVaultPpsIdentifiersFromPriceRequestsMock.mockReturnValue([{ chainId: 1, vaultAddress: NESTED_VAULT }])
  getPPSMock.mockImplementation((ppsMap: Map<number, number>, timestamp: number) => {
    if (ppsMap === innerPpsData) {
      return timestamp >= exitTimestamp ? 3 : 1
    }
    return timestamp >= exitTimestamp ? 1.2 : 1
  })
  getPriceAtTimestampMock.mockImplementation((priceMap: Map<number, number>, timestamp: number) => {
    const latestPrice = Array.from(priceMap.entries())
      .filter(([priceTimestamp, price]) => priceTimestamp <= timestamp && price > 0)
      .toSorted(([leftTimestamp], [rightTimestamp]) => leftTimestamp - rightTimestamp)
      .at(-1)
    return latestPrice?.[1] ?? 0
  })
  fetchHistoricalPricesForTokenTimestampsMock.mockImplementation(async (requests: Array<{ address: string }>) =>
    requests[0]?.address.toLowerCase() === WETH_PRICE_KEY.split(':')[1]
      ? new Map([[WETH_PRICE_KEY, wethPrices]])
      : new Map([
          [NESTED_VAULT_PRICE_KEY, nestedVaultPrices],
          [ASSET_PRICE_KEY, underlyingPrices]
        ])
  )

  const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')
  const response = await getHoldingsProtocolReturnPortfolio(USER, '1y')
  const receiptDerivationArgs = deriveNestedVaultAssetPriceDataMock.mock.calls[0]?.[0] as
    | Parameters<typeof actualNestedVaultPrices.deriveNestedVaultAssetPriceData>[0]
    | undefined
  const exitDerivationArgs = deriveNestedVaultAssetPriceDataMock.mock.calls[1]?.[0] as
    | Parameters<typeof actualNestedVaultPrices.deriveNestedVaultAssetPriceData>[0]
    | undefined

  return {
    depositTimestamp,
    exitTimestamp,
    firstHistoryTimestamp,
    finalHistoryTimestamp,
    response,
    receiptDerivationArgs,
    exitDerivationArgs
  }
}

describe('getHoldingsProtocolReturnHistory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    generateDailyTimestampsMock.mockReturnValue([DEFAULT_LATEST_SETTLED_TIMESTAMP - 1])
    generateDailyTimestampsFromRangeMock.mockReturnValue([HISTORY_START_TIMESTAMP, HISTORY_START_TIMESTAMP + 86_400])
    toSettledDayTimestampMock.mockImplementation((timestamp: number) => timestamp + 1)
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getPPSMock.mockReturnValue(1)
    getPpsFetchFailedVaultsMock.mockReturnValue(0)
    expandNestedVaultAssetPriceRequestsMock.mockImplementation((requests: unknown[]) => requests)
    deriveNestedVaultAssetPriceDataMock.mockImplementation(
      ({ priceData }: { priceData: Map<string, Map<number, number>> }) => priceData
    )
    getNestedVaultPpsIdentifiersFromPriceRequestsMock.mockReturnValue([])
    getHistoricalPriceFetchFailedBatchesMock.mockReturnValue(0)
    getPriceAtTimestampMock.mockReturnValue(1)
    getCachedProtocolReturnHistoryMock.mockResolvedValue(null)
    getProtocolReturnHistoryCacheKeyMock.mockReturnValue('protocol-return-history-cache-key')
    saveCachedProtocolReturnHistoryMock.mockResolvedValue(true)
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(
      new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [EVENT_RECEIPT_DAY_TIMESTAMP, 1],
            [EVENT_RECEIPT_DAY_TIMESTAMP + 86_400, 1]
          ])
        ],
        [
          WETH_PRICE_KEY,
          new Map([
            [EVENT_RECEIPT_DAY_TIMESTAMP, 1],
            [EVENT_RECEIPT_DAY_TIMESTAMP + 86_400, 1]
          ])
        ]
      ])
    )
    fetchActivityEventsByTransactionHashesMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfers: []
    })
    getVaultIdentifiersMock.mockReturnValue([{ chainId: 1, vaultAddress: VAULT }])
    getSettledAddressScopedContextMock.mockResolvedValue(settledContext)
    getSettledPpsContextMock.mockResolvedValue(settledContext)
    selectEventsMock.mockReturnValue({
      events: settledContext.selectedEvents,
      vaultIdentifiers: settledContext.selectedVaultIdentifiers
    })
  })

  it('starts all timeframe at the supported history floor', async () => {
    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')

    const response = await getHoldingsProtocolReturnHistory(USER, 'all')

    expect(generateDailyTimestampsFromRangeMock).toHaveBeenCalledWith(
      HISTORY_START_TIMESTAMP,
      DEFAULT_LATEST_SETTLED_TIMESTAMP - 1
    )
    expect(response.dataPoints.map((point) => point.timestamp)).toEqual([
      HISTORY_START_TIMESTAMP + 1,
      HISTORY_START_TIMESTAMP + 86_401
    ])
    expect(response).not.toHaveProperty('growth')
    expect(saveCachedProtocolReturnHistoryMock).toHaveBeenCalledWith(
      {
        userAddress: USER,
        timeframe: 'all',
        vaultScope: undefined
      },
      `date-${DEFAULT_LATEST_SETTLED_TIMESTAMP}`,
      [{ address: VAULT, chainId: 1 }],
      expect.objectContaining({ protocolReturn: response }),
      expect.any(Number)
    )
  })

  it('derives portfolio growth from the final protocol-return vaults', async () => {
    const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')

    const response = await getHoldingsProtocolReturnPortfolio(USER, '1y')

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
        growthUnderlying: 0,
        growthUsd: 0,
        growthPct: 0,
        annualizedProtocolReturnPct: 0,
        metadata: {
          symbol: 'TST',
          decimals: 18,
          assetDecimals: 18,
          tokenAddress: ASSET
        }
      }
    ])
  })

  it.each(['withdrawal', 'transfer_out'] as const)(
    'excludes a current-day %s from settled rows, charts, and price requests',
    async (exitKind) => {
      const currentDayTimestamp = DEFAULT_LATEST_SETTLED_TIMESTAMP + 1
      const currentDayExit = {
        ...event,
        ...(exitKind === 'withdrawal'
          ? { kind: 'withdrawal', owner: USER }
          : { kind: 'transfer', sender: USER, receiver: OTHER }),
        id: `current-day-${exitKind}`,
        blockNumber: 2,
        blockTimestamp: currentDayTimestamp,
        transactionHash: `0xcurrent-day-${exitKind}`,
        shares: 50n * ONE,
        assets: 1_000n * ONE
      } as TRawPnlEvent
      const events = [event, currentDayExit]
      generateDailyTimestampsMock.mockReturnValue([
        DEFAULT_LATEST_SETTLED_TIMESTAMP - 86_401,
        DEFAULT_LATEST_SETTLED_TIMESTAMP - 1
      ])
      selectEventsMock.mockReturnValue({
        events,
        vaultIdentifiers: settledContext.selectedVaultIdentifiers
      })
      getPPSMock.mockImplementation((_ppsMap: Map<number, number>, timestamp: number) =>
        timestamp >= DEFAULT_LATEST_SETTLED_TIMESTAMP ? 1.1 : 1
      )

      const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')
      const response = await getHoldingsProtocolReturnPortfolio(USER, '1y')
      const rowGrowthUsd = response.growth.vaults[0]?.growthUsd
      const aggregateGrowthUsd = response.protocolReturn.dataPoints.at(-1)?.growthUsd
      const familyGrowthUsd = response.protocolReturn.familySeries.reduce(
        (total, family) => total + (family.dataPoints.at(-1)?.growthUsd ?? 0),
        0
      )
      const requestedSeries = fetchHistoricalPricesForTokenTimestampsMock.mock.calls.flatMap(
        ([requests]) => requests as Array<{ address: string; timestamps: number[] }>
      )
      const assetRequest = requestedSeries.find((request) => request.address.toLowerCase() === ASSET.toLowerCase())

      expect(fetchActivityEventsByTransactionHashesMock.mock.calls[0]?.[0]).toEqual(new Map([[1, ['0xdeposit']]]))
      expect(fetchActivityEventsByTransactionHashesMock.mock.calls[0]?.[1]).toBe(DEFAULT_LATEST_SETTLED_TIMESTAMP)
      expect(getSettledPpsContextMock.mock.calls[0]?.[0]).not.toHaveProperty('vaultIdentifiers')
      expect(assetRequest?.timestamps).toEqual([EVENT_RECEIPT_DAY_TIMESTAMP, EVENT_RECEIPT_DAY_TIMESTAMP + 86_400])
      expect(response.growth.vaults[0]?.issues).toEqual([])
      expect(response.growth.vaults[0]?.growthUnderlying).toBeCloseTo(10)
      expect(rowGrowthUsd).toBeCloseTo(10)
      expect(aggregateGrowthUsd).toBeCloseTo(rowGrowthUsd ?? Number.NaN)
      expect(familyGrowthUsd).toBeCloseTo(rowGrowthUsd ?? Number.NaN)
    }
  )

  it('requests exit-day USD prices without expanding receipt ETH timestamps', async () => {
    const day = 86_400
    const depositTimestamp = Math.floor(event.blockTimestamp / day) * day
    const exitTimestamp = depositTimestamp + 3 * day
    const events = [
      { ...event, blockTimestamp: depositTimestamp },
      {
        ...event,
        kind: 'withdrawal',
        id: 'withdrawal',
        blockNumber: 2,
        blockTimestamp: exitTimestamp,
        transactionHash: '0xwithdrawal',
        shares: 50n * ONE,
        assets: 60n * ONE
      }
    ] as TRawPnlEvent[]
    generateDailyTimestampsMock.mockReturnValue([exitTimestamp + day])
    selectEventsMock.mockReturnValue({
      events,
      vaultIdentifiers: settledContext.selectedVaultIdentifiers
    })

    const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')
    await getHoldingsProtocolReturnPortfolio(USER, '1y')

    const requestedSeries = fetchHistoricalPricesForTokenTimestampsMock.mock.calls.flatMap(
      ([requests]) => requests as Array<{ address: string; timestamps: number[] }>
    )
    const assetRequest = requestedSeries.find((request) => request.address.toLowerCase() === ASSET.toLowerCase())
    const wethRequest = requestedSeries.find(
      (request) => request.address.toLowerCase() === WETH_PRICE_KEY.split(':')[1]
    )

    expect(assetRequest?.timestamps).toEqual([depositTimestamp, depositTimestamp + day, exitTimestamp])
    expect(wethRequest?.timestamps).toEqual([depositTimestamp, depositTimestamp + day])
  })

  it('keeps exit prices out of the latest reference and conserves hybrid growth history', async () => {
    const day = 86_400
    const depositTimestamp = Math.floor(event.blockTimestamp / day) * day
    const exitTimestamp = depositTimestamp + 2 * day
    const firstHistoryTimestamp = depositTimestamp + day + 1
    const finalHistoryTimestamp = exitTimestamp + day + 1
    const events = [
      { ...event, blockTimestamp: depositTimestamp },
      {
        ...event,
        kind: 'withdrawal',
        id: 'partial-withdrawal',
        blockNumber: 2,
        blockTimestamp: exitTimestamp,
        transactionHash: '0xpartial-withdrawal',
        shares: 50n * ONE,
        assets: 60n * ONE
      }
    ] as TRawPnlEvent[]
    const assetPrices = new Map([
      [depositTimestamp, 1],
      [depositTimestamp + day, 2],
      [exitTimestamp, 3]
    ])
    const wethPrices = new Map([
      [depositTimestamp, 1],
      [depositTimestamp + day, 1]
    ])
    generateDailyTimestampsMock.mockReturnValue([firstHistoryTimestamp - 1, finalHistoryTimestamp - 1])
    selectEventsMock.mockReturnValue({
      events,
      vaultIdentifiers: settledContext.selectedVaultIdentifiers
    })
    getPPSMock.mockImplementation((_ppsMap: Map<number, number>, timestamp: number) =>
      timestamp >= exitTimestamp ? 1.2 : 1
    )
    getPriceAtTimestampMock.mockImplementation(
      (priceMap: Map<number, number>, timestamp: number) => priceMap.get(timestamp) ?? 0
    )
    fetchHistoricalPricesForTokenTimestampsMock.mockImplementation(async (requests: Array<{ address: string }>) =>
      requests[0]?.address.toLowerCase() === WETH_PRICE_KEY.split(':')[1]
        ? new Map([[WETH_PRICE_KEY, wethPrices]])
        : new Map([[ASSET_PRICE_KEY, assetPrices]])
    )

    const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnPortfolio(USER, '1y')
    const rowGrowthUsd = response.growth.vaults[0]?.growthUsd
    const aggregateGrowthUsd = response.protocolReturn.dataPoints.at(-1)?.growthUsd
    const familyGrowthUsd = response.protocolReturn.familySeries[0]?.dataPoints.at(-1)?.growthUsd

    expect(response.protocolReturn.dataPoints.map((point) => point.timestamp)).toEqual([
      firstHistoryTimestamp,
      finalHistoryTimestamp
    ])
    expect(response.growth.vaults[0]?.baselineUsd).toBeCloseTo(200)
    expect(rowGrowthUsd).toBeCloseTo(50)
    expect(aggregateGrowthUsd).toBeCloseTo(rowGrowthUsd ?? Number.NaN)
    expect(familyGrowthUsd).toBeCloseTo(rowGrowthUsd ?? Number.NaN)
  })

  it('keeps an exit-only nested price out of the receipt reference series', async () => {
    const scenario = await runNestedHybridHistoryScenario(true)
    const rowGrowthUsd = scenario.response.growth.vaults[0]?.growthUsd
    const aggregateGrowthUsd = scenario.response.protocolReturn.dataPoints.at(-1)?.growthUsd
    const familyGrowthUsd = scenario.response.protocolReturn.familySeries[0]?.dataPoints.at(-1)?.growthUsd

    expect(scenario.receiptDerivationArgs?.priceData.get(NESTED_VAULT_PRICE_KEY)?.has(scenario.exitTimestamp)).toBe(
      false
    )
    expect(scenario.receiptDerivationArgs?.priceData.get(ASSET_PRICE_KEY)?.has(scenario.exitTimestamp)).toBe(false)
    expect(scenario.exitDerivationArgs?.priceData.get(NESTED_VAULT_PRICE_KEY)?.get(scenario.exitTimestamp)).toBe(27)
    expect(scenario.exitDerivationArgs?.underlyingPriceLookup).toBe('exact')
    expect(scenario.response.growth.vaults[0]).toMatchObject({
      status: 'ok',
      issues: [],
      baselineUsd: 200
    })
    expect(rowGrowthUsd).toBeCloseTo(1430)
    expect(aggregateGrowthUsd).toBeCloseTo(rowGrowthUsd ?? Number.NaN)
    expect(familyGrowthUsd).toBeCloseTo(rowGrowthUsd ?? Number.NaN)
    expect(scenario.response.protocolReturn.dataPoints.at(-1)?.growthUsdEstimated).toBe(false)
    expect(scenario.response.protocolReturn.familySeries[0]?.dataPoints.at(-1)?.growthUsdEstimated).toBe(false)
  })

  it('does not synthesize a missing nested exit price from an older receipt underlying price', async () => {
    const scenario = await runNestedHybridHistoryScenario(false)
    const rowGrowthUsd = scenario.response.growth.vaults[0]?.growthUsd
    const aggregateGrowthUsd = scenario.response.protocolReturn.dataPoints.at(-1)?.growthUsd
    const familyGrowthUsd = scenario.response.protocolReturn.familySeries[0]?.dataPoints.at(-1)?.growthUsd

    expect(scenario.exitDerivationArgs?.priceData.get(NESTED_VAULT_PRICE_KEY)?.has(scenario.exitTimestamp)).toBe(false)
    expect(scenario.exitDerivationArgs?.priceData.get(ASSET_PRICE_KEY)?.has(scenario.depositTimestamp)).toBe(false)
    expect(scenario.exitDerivationArgs?.priceData.get(ASSET_PRICE_KEY)?.has(scenario.exitTimestamp)).toBe(false)
    expect(scenario.exitDerivationArgs?.underlyingPriceLookup).toBe('exact')
    expect(scenario.response.growth.vaults[0]).toMatchObject({
      status: 'ok',
      issues: ['missing_exit_price'],
      baselineUsd: 200
    })
    expect(rowGrowthUsd).toBeCloseTo(520)
    expect(aggregateGrowthUsd).toBeCloseTo(rowGrowthUsd ?? Number.NaN)
    expect(familyGrowthUsd).toBeCloseTo(rowGrowthUsd ?? Number.NaN)
    expect(scenario.response.protocolReturn.dataPoints.at(-1)?.growthUsdEstimated).toBe(true)
    expect(scenario.response.protocolReturn.familySeries[0]?.dataPoints.at(-1)?.growthUsdEstimated).toBe(true)
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
        [ASSET_PRICE_KEY, new Map([[EVENT_RECEIPT_DAY_TIMESTAMP, 3]])],
        [WETH_PRICE_KEY, new Map([[EVENT_RECEIPT_DAY_TIMESTAMP, 1]])]
      ])
    )

    const { getHoldingsProtocolReturnPortfolio } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnPortfolio(USER, '1y')
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
        { timestamp: firstTimestamp, growthUsd: 0, growthWeightUsd: 0, growthWeightEth: null },
        { timestamp: secondTimestamp, growthWeightUsd: 0, growthWeightEth: null }
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
            growthUnderlying: 1,
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
    const response = await getHoldingsProtocolReturnPortfolio(USER, '1y')

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
    const response = await getHoldingsProtocolReturnHistory(USER, '1y', undefined, loadSettledContext)

    expect(response).toBe(cachedResponse)
    expect(loadSettledContext).not.toHaveBeenCalled()
    expect(getSettledPpsContextMock).not.toHaveBeenCalled()
    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('caches a successful partial protocol return history calculation', async () => {
    getPPSMock.mockReturnValue(null)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, '1y')

    expect(response.summary.isComplete).toBe(false)
    expect(response.summary.totalVaults).toBe(1)
    expect(saveCachedProtocolReturnHistoryMock).toHaveBeenCalledWith(
      expect.any(Object),
      `date-${DEFAULT_LATEST_SETTLED_TIMESTAMP}`,
      [{ address: VAULT, chainId: 1 }],
      expect.objectContaining({ protocolReturn: response }),
      expect.any(Number)
    )
  })

  it('does not cache protocol return history when a price request succeeds without prices', async () => {
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(new Map())

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, '1y')

    expect(response.summary.totalVaults).toBe(1)
    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('does not cache protocol return history when a historical price batch fails', async () => {
    getHistoricalPriceFetchFailedBatchesMock.mockReturnValue(1)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, '1y')

    expect(response.summary.totalVaults).toBe(1)
    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('does not cache protocol return history when a PPS request fails', async () => {
    getPpsFetchFailedVaultsMock.mockReturnValue(1)

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    await getHoldingsProtocolReturnHistory(USER, '1y')

    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('does not cache protocol return history when a metadata fallback fails', async () => {
    getSettledPpsContextMock.mockResolvedValue({
      ...settledContext,
      metadataFetchFailedVaults: 1
    })

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    await getHoldingsProtocolReturnHistory(USER, '1y')

    expect(saveCachedProtocolReturnHistoryMock).not.toHaveBeenCalled()
  })

  it('tracks nested PPS vaults as cache invalidation dependencies', async () => {
    getNestedVaultPpsIdentifiersFromPriceRequestsMock.mockReturnValue([{ chainId: 1, vaultAddress: NESTED_VAULT }])

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    const response = await getHoldingsProtocolReturnHistory(USER, '1y')

    expect(saveCachedProtocolReturnHistoryMock).toHaveBeenCalledWith(
      expect.any(Object),
      `date-${DEFAULT_LATEST_SETTLED_TIMESTAMP}`,
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
    await getHoldingsProtocolReturnHistory(USER, '1y')

    const firstSavedResponse = saveCachedProtocolReturnHistoryMock.mock.calls[0]?.[3]
    expect(firstSavedResponse).toBeDefined()

    generateDailyTimestampsMock.mockReturnValue([secondDay, thirdDay, fourthDay, fifthDay])
    getCachedProtocolReturnHistoryMock.mockResolvedValue({
      settledDate: `date-${fourthDay + 1}`,
      response: firstSavedResponse
    })
    saveCachedProtocolReturnHistoryMock.mockClear()

    const appended = await getHoldingsProtocolReturnHistory(USER, '1y')
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
    const rebuilt = await getHoldingsProtocolReturnHistory(USER, '1y')
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
    await getHoldingsProtocolReturnHistory(USER, '1y')
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

    await getHoldingsProtocolReturnHistory(USER, '1y')

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
        [
          ASSET_PRICE_KEY,
          new Map([
            [EVENT_RECEIPT_DAY_TIMESTAMP, 1],
            [EVENT_RECEIPT_DAY_TIMESTAMP + 86_400, 1]
          ])
        ],
        [WETH_PRICE_KEY, new Map([[EVENT_RECEIPT_DAY_TIMESTAMP, 1]])]
      ])
    )

    const { getHoldingsProtocolReturnHistory } = await import('./pnlSimple')
    await getHoldingsProtocolReturnHistory(USER, '1y')
    const cachedResponse = saveCachedProtocolReturnHistoryMock.mock.calls[0]?.[3]

    generateDailyTimestampsMock.mockReturnValue([secondDay, thirdDay])
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(
      new Map([
        [
          ASSET_PRICE_KEY,
          new Map([
            [EVENT_RECEIPT_DAY_TIMESTAMP, 1],
            [EVENT_RECEIPT_DAY_TIMESTAMP + 86_400, 2]
          ])
        ],
        [WETH_PRICE_KEY, new Map([[EVENT_RECEIPT_DAY_TIMESTAMP, 1]])]
      ])
    )
    getCachedProtocolReturnHistoryMock.mockResolvedValue({
      settledDate: `date-${secondDay + 1}`,
      response: cachedResponse
    })
    debugLogMock.mockClear()

    await getHoldingsProtocolReturnHistory(USER, '1y')

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
    const firstRequest = getHoldingsProtocolReturnHistory(USER, '1y')
    const secondRequest = getHoldingsProtocolReturnHistory(USER, '1y')

    expect(getCachedProtocolReturnHistoryMock).toHaveBeenCalledTimes(1)
    cacheLookup.resolve?.(cachedPortfolioResponse)
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([cachedResponse, cachedResponse])
    expect(getSettledPpsContextMock).not.toHaveBeenCalled()
  })
})
