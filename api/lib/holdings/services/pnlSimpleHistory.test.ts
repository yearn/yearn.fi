import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultMetadata } from '../types'
import { toVaultKey } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'

const fetchHistoricalPricesForTokenTimestampsMock = vi.fn()
const getPriceAtTimestampMock = vi.fn()
const getSettledVersionedPpsContextMock = vi.fn()
const getVaultIdentifiersMock = vi.fn()
const fetchActivityEventsByTransactionHashesMock = vi.fn()
const generateDailyTimestampsMock = vi.fn()
const generateDailyTimestampsFromRangeMock = vi.fn()
const toSettledDayTimestampMock = vi.fn()
const timestampToDateStringMock = vi.fn()
const getPPSMock = vi.fn()

vi.mock('./defillama', () => ({
  fetchHistoricalPricesForTokenTimestamps: fetchHistoricalPricesForTokenTimestampsMock,
  getChainPrefix: vi.fn(() => 'ethereum'),
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
  getPPS: getPPSMock
}))

vi.mock('./nestedVaultPrices', () => ({
  expandNestedVaultAssetPriceRequests: vi.fn((requests: unknown[]) => requests),
  deriveNestedVaultAssetPriceData: vi.fn(({ priceData }: { priceData: Map<string, Map<number, number>> }) => priceData),
  getNestedVaultPpsIdentifiersFromPriceRequests: vi.fn(() => []),
  mergeVaultIdentifiers: vi.fn((identifiers: unknown[]) => identifiers)
}))

vi.mock('./pnlEvents', () => ({
  mergeAddressScopedRawPnlEventsWithTransactionActivity: vi.fn((events: TRawPnlEvent[]) => events)
}))

const USER = '0x1111111111111111111111111111111111111111'
const VAULT = '0x3333333333333333333333333333333333333333'
const ASSET = '0x4444444444444444444444444444444444444444'
const ONE = 10n ** 18n
const HISTORY_START_TIMESTAMP = 1_704_067_200
const VAULT_KEY = toVaultKey(1, VAULT)
const ASSET_PRICE_KEY = `ethereum:${ASSET}`

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

describe('getHoldingsProtocolReturnHistory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    generateDailyTimestampsMock.mockReturnValue([200])
    generateDailyTimestampsFromRangeMock.mockReturnValue([HISTORY_START_TIMESTAMP, HISTORY_START_TIMESTAMP + 86_400])
    toSettledDayTimestampMock.mockImplementation((timestamp: number) => timestamp + 1)
    timestampToDateStringMock.mockImplementation((timestamp: number) => `date-${timestamp}`)
    getPPSMock.mockReturnValue(1)
    getPriceAtTimestampMock.mockReturnValue(1)
    fetchHistoricalPricesForTokenTimestampsMock.mockResolvedValue(
      new Map([[ASSET_PRICE_KEY, new Map([[HISTORY_START_TIMESTAMP + 1, 1]])]])
    )
    fetchActivityEventsByTransactionHashesMock.mockResolvedValue({
      deposits: [],
      withdrawals: [],
      transfers: []
    })
    getVaultIdentifiersMock.mockReturnValue([{ chainId: 1, vaultAddress: VAULT }])
    getSettledVersionedPpsContextMock.mockResolvedValue({
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
      selectedEvents: [event],
      selectedVaultIdentifiers: [{ chainId: 1, vaultAddress: VAULT }],
      ppsIdentifiers: [{ chainId: 1, vaultAddress: VAULT }],
      ppsData: new Map([[VAULT_KEY, new Map([[HISTORY_START_TIMESTAMP + 1, 1]])]])
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
  })
})
