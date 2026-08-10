import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { THoldingsEventSource } from '@/server/lib/holdings/services/eventSource'
import type { TResolvedLedgerHistoricalPps } from '@/server/lib/holdings/services/ledger/pps'
import { getLedgerProtocolReturnRows } from '@/server/lib/holdings/services/ledger/rows'
import type { UserEvents, VaultMetadata } from '@/server/lib/holdings/types'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT = '0x2222222222222222222222222222222222222222'
const ASSET = '0x3333333333333333333333333333333333333333'
const COUNTERPARTY = '0x4444444444444444444444444444444444444444'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const SHARES = (100n * 10n ** 18n).toString()
const EVENT_TIMESTAMP = 1_786_000_000
const CURRENT_TIMESTAMP = EVENT_TIMESTAMP + 86_400

const metadata = new Map<string, VaultMetadata>([
  [
    `1:${VAULT.toLowerCase()}`,
    {
      address: VAULT,
      chainId: 1,
      version: 'v3',
      category: 'stable',
      currentPricePerShare: 1.2,
      token: {
        address: ASSET,
        symbol: 'USDC',
        decimals: 18
      },
      decimals: 18
    }
  ]
])

function createEventSource(events: UserEvents): THoldingsEventSource {
  return {
    key: 'verified-ledger-snapshot',
    latestSettledDayTimestamp: CURRENT_TIMESTAMP - 86_400,
    eventUpperTimestamp: CURRENT_TIMESTAMP,
    load: vi.fn().mockResolvedValue(events)
  }
}

function createEmptyEvents(overrides: Partial<UserEvents>): UserEvents {
  return {
    deposits: [],
    withdrawals: [],
    transfersIn: [],
    transfersOut: [],
    ...overrides
  }
}

function createOptions(resolveHistoricalPps = vi.fn()) {
  const fetchMetadata = vi.fn().mockResolvedValue(metadata)
  const resolveNestedMetadata = vi.fn().mockImplementation(async (value: Map<string, VaultMetadata>) => value)
  const fetchPps = vi.fn()

  return {
    dependencies: {
      fetchMetadata,
      resolveNestedMetadata,
      resolveHistoricalPps,
      fetchPps
    },
    options: {
      fetchMetadata,
      resolveNestedMetadata,
      resolveHistoricalPps,
      fetchPps
    }
  }
}

describe('fast ledger growth row orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses emitted deposit assets and removes the matching mint without requesting historical PPS', async () => {
    const transactionHash = `0x${'a'.repeat(64)}`
    const eventSource = createEventSource(
      createEmptyEvents({
        deposits: [
          {
            id: 'deposit-1',
            vaultAddress: VAULT,
            chainId: 1,
            blockNumber: 20_000_000,
            blockTimestamp: EVENT_TIMESTAMP,
            logIndex: 1,
            transactionHash,
            transactionFrom: ADDRESS,
            owner: ADDRESS,
            sender: ADDRESS,
            assets: SHARES,
            shares: SHARES
          }
        ],
        transfersIn: [
          {
            id: 'mint-1',
            vaultAddress: VAULT,
            chainId: 1,
            blockNumber: 20_000_000,
            blockTimestamp: EVENT_TIMESTAMP,
            logIndex: 2,
            transactionHash,
            transactionFrom: ADDRESS,
            sender: ZERO_ADDRESS,
            receiver: ADDRESS,
            value: SHARES
          }
        ]
      })
    )
    const resolveHistoricalPps = vi.fn().mockResolvedValue({
      values: [],
      cacheHits: 0,
      fetched: 0,
      missing: 0
    } satisfies TResolvedLedgerHistoricalPps)
    const { dependencies, options } = createOptions(resolveHistoricalPps)

    const response = await getLedgerProtocolReturnRows({
      address: ADDRESS,
      version: 'all',
      eventSource,
      options
    })

    expect(eventSource.load).toHaveBeenCalledWith({
      userAddress: ADDRESS,
      version: 'all',
      maxTimestamp: CURRENT_TIMESTAMP,
      fetchType: 'seq',
      paginationMode: 'paged'
    })
    expect(resolveHistoricalPps).toHaveBeenCalledWith([])
    expect(dependencies.fetchPps).not.toHaveBeenCalled()
    expect(response.summary).toMatchObject({
      totalVaults: 1,
      completeVaults: 1,
      historicalPpsRequirements: 0,
      historicalPpsFetched: 0,
      historicalPpsMissing: 0,
      isComplete: true
    })
    expect(response.vaults).toHaveLength(1)
    expect(response.vaults[0]).toMatchObject({
      chainId: 1,
      vaultAddress: VAULT.toLowerCase(),
      status: 'ok',
      sharesFormatted: 100,
      pricePerShare: 1.2,
      currentUnderlying: 120,
      baselineUnderlying: 100,
      growthUnderlying: 20,
      growthPct: 20,
      baselineExposureUnderlyingYears: 100 / 365,
      annualizedProtocolReturnPct: 7300,
      deposits: 1,
      transfersIn: 0
    })
  })

  it('uses the targeted historical PPS resolution for a genuine transfer receipt', async () => {
    const eventSource = createEventSource(
      createEmptyEvents({
        transfersIn: [
          {
            id: 'transfer-in-1',
            vaultAddress: VAULT,
            chainId: 1,
            blockNumber: 20_000_001,
            blockTimestamp: EVENT_TIMESTAMP,
            logIndex: 3,
            transactionHash: `0x${'b'.repeat(64)}`,
            transactionFrom: COUNTERPARTY,
            sender: COUNTERPARTY,
            receiver: ADDRESS,
            value: SHARES
          }
        ]
      })
    )
    const resolveHistoricalPps = vi.fn().mockImplementation(async (requirements) => ({
      values: requirements.map((requirement: { key: string }) => ({
        key: requirement.key,
        pricePerShare: 1
      })),
      cacheHits: 1,
      fetched: 0,
      missing: 0
    }))
    const { dependencies, options } = createOptions(resolveHistoricalPps)

    const response = await getLedgerProtocolReturnRows({
      address: ADDRESS,
      version: 'all',
      eventSource,
      options
    })

    const requirements = resolveHistoricalPps.mock.calls[0]?.[0]
    expect(requirements).toHaveLength(1)
    expect(requirements[0]).toMatchObject({
      reason: 'transfer',
      eventKind: 'transfer',
      chainId: 1,
      vaultAddress: VAULT.toLowerCase(),
      blockNumber: 20_000_001,
      blockTimestamp: EVENT_TIMESTAMP,
      logIndex: 3
    })
    expect(dependencies.fetchPps).not.toHaveBeenCalled()
    expect(response.summary).toMatchObject({
      totalVaults: 1,
      completeVaults: 1,
      historicalPpsRequirements: 1,
      historicalPpsCacheHits: 1,
      historicalPpsFetched: 0,
      historicalPpsMissing: 0,
      isComplete: true
    })
    expect(response.vaults[0]).toMatchObject({
      status: 'ok',
      currentUnderlying: 120,
      baselineUnderlying: 100,
      growthUnderlying: 20,
      growthPct: 20,
      baselineExposureUnderlyingYears: 100 / 365,
      annualizedProtocolReturnPct: 7300,
      deposits: 0,
      transfersIn: 1
    })
  })
})
