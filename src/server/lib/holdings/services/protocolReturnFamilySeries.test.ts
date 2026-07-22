import { describe, expect, it } from 'vitest'
import { selectProtocolReturnFamilySeriesCandidates } from '@/server/lib/holdings/services/protocolReturnFamilySeries'

type TWindow = '30d' | '90d' | '1y' | 'all'
type TMode = 'position' | 'index'

const WINDOW_LIMITS: Record<TWindow, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: Number.MAX_SAFE_INTEGER
}
const SCORES = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]

function buildIsolatedSeries(args: { id: string; mode: TMode; window: TWindow; score: number; pointCount: number }) {
  const windowLimit = WINDOW_LIMITS[args.window]
  const windowStartIndex =
    Number.isFinite(windowLimit) && windowLimit < args.pointCount ? args.pointCount - windowLimit : 0

  return {
    chainId: 1,
    vaultAddress: args.id,
    symbol: args.id,
    status: 'ok' as const,
    dataPoints: Array.from({ length: args.pointCount }, (_, index) => ({
      date: `unused-${index}`,
      timestamp: index,
      protocolReturnPct: 123,
      growthWeightUsd: args.mode === 'position' ? (index === windowStartIndex ? 0 : args.score) : null,
      growthIndex: args.mode === 'index' ? (index === windowStartIndex ? 100 : 100 + args.score) : null
    }))
  }
}

function buildRankingGroups(windows: TWindow[], pointCount: number) {
  return (['position', 'index'] as const).flatMap((mode) =>
    windows.flatMap((window) =>
      SCORES.map((score) =>
        buildIsolatedSeries({
          id: `${mode}-${window}-${score}`,
          mode,
          window,
          score,
          pointCount
        })
      )
    )
  )
}

describe('selectProtocolReturnFamilySeriesCandidates', () => {
  it('keeps the best and worst five candidates for every 1y-response window and mode', () => {
    const familySeries = buildRankingGroups(['30d', '90d', '1y'], 365)
    const selected = selectProtocolReturnFamilySeriesCandidates(familySeries, '1y')
    const expectedIds = familySeries
      .filter((series) => Math.abs(Number(series.vaultAddress.split('-').at(-1))) >= 2)
      .map((series) => series.vaultAddress)

    expect(selected).toHaveLength(60)
    expect(selected.map((series) => series.vaultAddress)).toEqual(expectedIds)
  })

  it('also keeps candidates that are only relevant to the all-time window', () => {
    const familySeries = buildRankingGroups(['30d', '90d', '1y', 'all'], 400)
    const selected = selectProtocolReturnFamilySeriesCandidates(familySeries, 'all')
    const expectedIds = familySeries
      .filter((series) => Math.abs(Number(series.vaultAddress.split('-').at(-1))) >= 2)
      .map((series) => series.vaultAddress)

    expect(selected).toHaveLength(80)
    expect(selected.map((series) => series.vaultAddress)).toEqual(expectedIds)
  })

  it('preserves original-order tie breaks and removes unused point fields', () => {
    const familySeries = Array.from({ length: 6 }, (_, index) =>
      buildIsolatedSeries({
        id: `tie-${index}`,
        mode: 'position',
        window: '30d',
        score: 5,
        pointCount: 365
      })
    )
    const selected = selectProtocolReturnFamilySeriesCandidates(familySeries, '1y')

    expect(selected.map((series) => series.vaultAddress)).toEqual(['tie-0', 'tie-1', 'tie-2', 'tie-3', 'tie-4'])
    expect(selected[0]?.dataPoints[0]).toEqual({
      timestamp: 0,
      growthWeightUsd: 5,
      growthIndex: null
    })
  })
})
