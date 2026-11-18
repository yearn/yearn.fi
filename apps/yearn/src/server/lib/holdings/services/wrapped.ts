import type { TWrapped } from '@yearn/wrapped-contract'
import { buildPositionTimelineIndex } from '@/server/lib/holdings/services/holdings'
import type { HoldingsPnLSimpleHistoryResponse } from '@/server/lib/holdings/services/pnlSimple'
import { getHoldingsProtocolReturnHistory } from '@/server/lib/holdings/services/pnlSimple'
import { getSettledAddressScopedContext, selectEvents } from '@/server/lib/holdings/services/settledHoldingsContext'
import { summarizeWrappedPositions } from '@/server/lib/holdings/services/wrappedPositions'
import { SUPPORTED_CHAINS } from '@/server/lib/holdings/types'

const START = Date.UTC(2026, 0, 1) / 1000
const YEAR_END = Date.UTC(2027, 0, 1) / 1000 - 1
const date = (ts: number): string => new Date(ts * 1000).toISOString().slice(0, 10)

export function buildWrappedReturn(
  history: HoldingsPnLSimpleHistoryResponse,
  end: number,
  hasOpeningPosition = true
): TWrapped['return'] {
  const points = history.dataPoints.filter((point) => point.timestamp <= end)
  const baseline = points.findLast((point) => point.date === '2025-12-31')
  const yearPoints = points.filter((point) => point.timestamp >= START)
  // A wallet entering during the year has no exposed capital before its first index.
  // Use that first observation only if the pre-year index is null (no exposure).
  const base =
    baseline?.growthIndex != null
      ? baseline
      : !hasOpeningPosition && baseline?.growthIndex === null
        ? yearPoints.find((point) => point.growthIndex !== null)
        : undefined
  const last = yearPoints.at(-1)
  const complete =
    history.summary.isComplete &&
    !history.summary.growthIsPartial?.index &&
    baseline !== undefined &&
    yearPoints.length > 0 &&
    yearPoints.length === Math.floor((end - START + 1) / 86400) &&
    base?.growthIndex != null &&
    base.growthIndex > 0 &&
    last?.growthIndex != null &&
    yearPoints.filter((point) => point.timestamp >= base.timestamp).every((point) => point.growthIndex !== null)
  return {
    pct: complete ? (last!.growthIndex! / base!.growthIndex! - 1) * 100 : null,
    baselineDate: base?.date ?? null,
    isComplete: Boolean(complete),
    points: yearPoints.map((point) => ({
      date: point.date,
      value: complete && point.growthIndex !== null ? (point.growthIndex / base!.growthIndex!) * 100 : null
    }))
  }
}

export async function getWrapped(address: string): Promise<TWrapped> {
  const contextRequest = getSettledAddressScopedContext({ userAddress: address })
  // The existing engine shares the context request and its event/PPS/price caches.
  const [context, history] = await Promise.all([
    contextRequest,
    getHoldingsProtocolReturnHistory(address, 'all', undefined, contextRequest)
  ])
  const end = Math.min(context.maxTimestamp, YEAR_END)
  if (end < START) throw new Error('The recap year has no settled days')
  const visible = selectEvents(context).events.filter((event) => event.blockTimestamp <= end)
  const timeline = context.timeline.filter(
    (event) => !context.vaultMetadata.get(`${event.chainId}:${event.vaultAddress}`)?.isHidden
  )
  const index = buildPositionTimelineIndex(timeline)
  const vaults = summarizeWrappedPositions(index, context.vaultMetadata, START, end)
  const periodEvents = visible.filter((event) => event.blockTimestamp >= START)
  const hasOpeningPosition = Array.from(index.values()).some((entry) => {
    const before = entry.timestamps.findLastIndex((ts) => ts < START)
    return before >= 0 && entry.balances[before]! > 0n
  })
  const returns = buildWrappedReturn(history, end, hasOpeningPosition)
  const usedChains = new Set(vaults.map((vault) => vault.chainId))
  const issues = [
    ...(!returns.isComplete ? ['Calendar-year return is unavailable because index coverage is incomplete.'] : []),
    ...(context.metadataFetchFailedVaults > 0 ? ['Some vault metadata is unavailable.'] : []),
    ...(vaults.some((vault) => !vault.isComplete) ? ['Some share histories are incomplete.'] : [])
  ]
  return {
    version: 2,
    address: address.toLowerCase(),
    generatedAt: new Date().toISOString(),
    source: 'yearn-holdings',
    period: { year: 2026, start: date(START), end: date(end), partial: end < YEAR_END },
    coverage: {
      isComplete: issues.length === 0,
      issues,
      chains: SUPPORTED_CHAINS.filter((chain) => usedChains.has(chain.id)).map(({ id, name }) => ({ id, name }))
    },
    firstActivity: visible.reduce<number | null>(
      (first, event) => (first === null ? event.blockTimestamp : Math.min(first, event.blockTimestamp)),
      null
    ),
    return: returns,
    vaults,
    activity: {
      deposits: periodEvents.filter((event) => event.kind === 'deposit' && !event.isStakingVault).length,
      withdrawals: periodEvents.filter((event) => event.kind === 'withdrawal' && !event.isStakingVault).length,
      transfers: periodEvents.filter((event) => event.kind === 'transfer').length,
      monthly: Array.from({ length: new Date(end * 1000).getUTCMonth() + 1 }, (_, month) => ({
        month: `2026-${String(month + 1).padStart(2, '0')}`,
        count: periodEvents.filter((event) => new Date(event.blockTimestamp * 1000).getUTCMonth() === month).length
      })),
      hours: Array.from(
        { length: 24 },
        (_, hour) => periodEvents.filter((event) => new Date(event.blockTimestamp * 1000).getUTCHours() === hour).length
      )
    }
  }
}
