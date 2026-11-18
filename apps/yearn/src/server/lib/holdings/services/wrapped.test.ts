import { describe, expect, it, vi } from 'vitest'
import { buildPositionTimelineIndex } from '@/server/lib/holdings/services/holdings'
import type { HoldingsPnLSimpleHistoryResponse } from '@/server/lib/holdings/services/pnlSimple'
import type { TRawPnlEvent } from '@/server/lib/holdings/services/pnlTypes'
import { buildWrappedReturn, getWrapped } from '@/server/lib/holdings/services/wrapped'
import { summarizeWrappedPositions } from '@/server/lib/holdings/services/wrappedPositions'
import type { TimelineEvent, VaultMetadata } from '@/server/lib/holdings/types'

const mocks = vi.hoisted(() => ({ context: vi.fn(), history: vi.fn() }))
vi.mock('@/server/lib/holdings/services/pnlSimple', () => ({ getHoldingsProtocolReturnHistory: mocks.history }))
vi.mock('@/server/lib/holdings/services/settledHoldingsContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/lib/holdings/services/settledHoldingsContext')>()),
  getSettledAddressScopedContext: mocks.context
}))

const START = Date.UTC(2026, 0, 1) / 1000
const DAY = 86400
const VAULT = '0x1111111111111111111111111111111111111111'
const history = (indexes: Array<number | null>, complete = true): HoldingsPnLSimpleHistoryResponse => ({
  address: VAULT,
  version: 'all',
  timeframe: 'all',
  generatedAt: '2026-01-03T00:00:00.000Z',
  summary: {
    totalVaults: 1,
    completeVaults: complete ? 1 : 0,
    partialVaults: complete ? 0 : 1,
    recommendedGrowthDisplay: 'index',
    recommendedGrowthDisplayReason: 'mixed',
    openBaselineCompositionUsd: { stable: 0, ethFamily: 0, other: 0 },
    isComplete: complete
  },
  dataPoints: indexes.map((growthIndex, index) => ({
    date: new Date((START - 1 + index * DAY) * 1000).toISOString().slice(0, 10),
    timestamp: START - 1 + index * DAY,
    growthIndex,
    growthWeightUsd: 999_999,
    growthWeightEth: null,
    protocolReturnPct: 50,
    annualizedProtocolReturnPct: 200
  })),
  familySeries: []
})

describe('Wrapped calendar-year return', () => {
  it('rebases the existing index at Dec 31 and excludes pre-year gains', () => {
    const result = buildWrappedReturn(history([120, 123, 126]), START + 2 * DAY - 1)
    expect(result.pct).toBeCloseTo(5)
    expect(result.baselineDate).toBe('2025-12-31')
    expect(result.points.map((point) => point.value)).toEqual([102.49999999999999, 105])
  })
  it('preserves genuine zero and negative return', () => {
    expect(buildWrappedReturn(history([100, 100]), START + DAY - 1).pct).toBe(0)
    expect(buildWrappedReturn(history([100, 95]), START + DAY - 1).pct).toBeCloseTo(-5)
  })
  it('does not call missing coverage zero or annualize a partial series', () => {
    expect(buildWrappedReturn(history([100, null, 110]), START + 2 * DAY - 1).pct).toBeNull()
    expect(buildWrappedReturn(history([100, 110], false), START + DAY - 1).pct).toBeNull()
    expect(buildWrappedReturn(history([100, 110]), START + 2 * DAY - 1).pct).toBeNull()
    expect(buildWrappedReturn(history([0, 110]), START + DAY - 1).pct).toBeNull()
  })
  it('requires an opening baseline for pre-year positions', () => {
    expect(buildWrappedReturn(history([null, 100, 101]), START + 2 * DAY - 1, true).pct).toBeNull()
    const missingBaseline = history([100, 101])
    missingBaseline.dataPoints.shift()
    expect(buildWrappedReturn(missingBaseline, START + DAY - 1, false).pct).toBeNull()
  })
  it('allows a first index after a new wallet enters, without inventing pre-entry returns', () => {
    const result = buildWrappedReturn(history([null, null, 100, 102]), START + 3 * DAY - 1, false)
    expect(result.pct).toBeCloseTo(2)
    expect(result.baselineDate).toBe('2026-01-02')
    expect(result.points[0]!.value).toBeNull()
  })
})

const event = (day: number, shares: bigint, chainId = 1): TimelineEvent => ({
  vaultAddress: VAULT,
  chainId,
  blockNumber: 1,
  blockTimestamp: START + day * DAY,
  sharesChange: shares
})
const meta = (chainId: number): VaultMetadata => ({
  address: VAULT,
  chainId,
  version: 'v3',
  category: 'stable',
  decimals: 18,
  token: { address: VAULT, symbol: 'USDC', decimals: 6 }
})

describe('Wrapped holding spans from the existing normalized timeline', () => {
  it('seeds pre-year balances, retains quiet holdings and keeps chain identity', () => {
    const rows = summarizeWrappedPositions(
      buildPositionTimelineIndex([event(-20, 10n ** 24n), event(1, 1n, 8453)]),
      new Map([
        [`1:${VAULT}`, meta(1)],
        [`8453:${VAULT}`, meta(8453)]
      ]),
      START,
      START + 10 * DAY - 1
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ chainId: 1, heldDays: 10, longestStreakDays: 10, stillHolding: true })
    expect(rows[1]!.heldDays).toBe(9)
  })
  it('nets simultaneous self transfers and ends the span on full exit', () => {
    const rows = summarizeWrappedPositions(
      buildPositionTimelineIndex([event(-1, 100n), event(2, -100n), event(2, 100n), event(5, -100n)]),
      new Map([[`1:${VAULT}`, meta(1)]]),
      START,
      START + 10 * DAY - 1
    )
    expect(rows[0]).toMatchObject({ heldDays: 5, longestStreakDays: 5, stillHolding: false, isComplete: true })
  })
  it('does not include positions closed before the recap year', () => {
    expect(
      summarizeWrappedPositions(
        buildPositionTimelineIndex([event(-10, 10n), event(-1, -10n)]),
        new Map(),
        START,
        START + DAY - 1
      )
    ).toEqual([])
  })
  it('marks negative balances and missing metadata incomplete', () => {
    const rows = summarizeWrappedPositions(
      buildPositionTimelineIndex([event(-1, 10n), event(1, -20n), event(2, 20n)]),
      new Map(),
      START,
      START + 3 * DAY - 1
    )
    expect(rows[0]!.isComplete).toBe(false)
  })
})

describe('Wrapped uses the main holdings context', () => {
  it('honors hidden families and excludes staking flows from direct deposit counts', async () => {
    const hidden = '0x2222222222222222222222222222222222222222'
    const deposit = (family: string, timestamp: number, staking = false): TRawPnlEvent => ({
      kind: 'deposit',
      id: `${family}:${timestamp}:${staking}`,
      chainId: 1,
      vaultAddress: family,
      familyVaultAddress: family,
      isStakingVault: staking,
      blockNumber: 1,
      blockTimestamp: timestamp,
      logIndex: 1,
      transactionHash: '0x1',
      transactionFrom: VAULT,
      owner: VAULT,
      sender: VAULT,
      shares: 10n ** 24n,
      assets: 100n,
      scopes: { address: true, tx: false }
    })
    const visibleMeta = meta(1)
    const context = {
      maxTimestamp: START + DAY - 1,
      metadataFetchFailedVaults: 0,
      rawEvents: [
        deposit(hidden, START - 10 * DAY),
        deposit(VAULT, START - DAY),
        deposit(VAULT, START + 1),
        deposit(VAULT, START + 2, true)
      ],
      timeline: [event(-10, 100n), { ...event(-10, 100n), vaultAddress: hidden }],
      vaultMetadata: new Map([
        [`1:${VAULT}`, visibleMeta],
        [`1:${hidden}`, { ...visibleMeta, address: hidden, isHidden: true }]
      ])
    }
    mocks.context.mockResolvedValue(context)
    mocks.history.mockResolvedValue(history([100, 101]))
    const result = await getWrapped(VAULT)
    expect(result.firstActivity).toBe(START - DAY)
    expect(result.vaults).toHaveLength(1)
    expect(result.vaults[0]!.address).toBe(VAULT)
    expect(result.activity.deposits).toBe(1)
    expect(result.activity.monthly).toEqual([{ month: '2026-01', count: 2 }])
    expect(result.return.pct).toBeCloseTo(1)
    expect(result.coverage.chains).toEqual([{ id: 1, name: 'ethereum' }])
    expect(mocks.history).toHaveBeenCalledWith(VAULT, 'all', undefined, expect.any(Promise))
  })
})
