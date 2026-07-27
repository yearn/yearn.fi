import {
  rankPortfolioVaultGrowthChartSeries,
  type TPortfolioVaultGrowthChartMode,
  type TPortfolioVaultGrowthChartSortDirection
} from '@shared/utils/portfolioVaultGrowth'

type TProtocolReturnFamilyPoint = {
  timestamp: number
  growthWeightUsd: number | null
  growthIndex: number | null
}

type TProtocolReturnFamilySeries = {
  dataPoints: TProtocolReturnFamilyPoint[]
}

type TCompactProtocolReturnFamilySeries<TSeries extends TProtocolReturnFamilySeries> = Omit<TSeries, 'dataPoints'> & {
  dataPoints: TProtocolReturnFamilyPoint[]
}

type TProtocolReturnFamilyWindow = '30d' | '90d' | '1y' | 'all'

const MAX_FAMILY_SERIES_PER_RANKING = 5
const FAMILY_SERIES_WINDOW_LIMITS: Record<TProtocolReturnFamilyWindow, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: Number.MAX_SAFE_INTEGER
}
const FAMILY_SERIES_WINDOWS: Record<'1y' | 'all', TProtocolReturnFamilyWindow[]> = {
  '1y': ['30d', '90d', '1y'],
  all: ['30d', '90d', '1y', 'all']
}
const FAMILY_SERIES_MODES: TPortfolioVaultGrowthChartMode[] = ['position', 'index']
const FAMILY_SERIES_SORT_DIRECTIONS: TPortfolioVaultGrowthChartSortDirection[] = ['desc', 'asc']

function normalizeTimestamp(timestamp: number): number {
  return timestamp > 1_000_000_000_000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function buildPositionRankPoints(points: TProtocolReturnFamilyPoint[]): Array<{ value: number | null }> {
  const firstFiniteIndex = points.findIndex((point) => isFiniteNumber(point.growthWeightUsd))
  if (firstFiniteIndex < 0 || points.length - firstFiniteIndex < 2) {
    return []
  }

  const firstValue = points[firstFiniteIndex]?.growthWeightUsd
  const lastValue = points.findLast((point) => isFiniteNumber(point.growthWeightUsd))?.growthWeightUsd
  if (!isFiniteNumber(firstValue) || !isFiniteNumber(lastValue)) {
    return []
  }

  return [{ value: 0 }, { value: lastValue - firstValue }]
}

function buildIndexRankPoints(points: TProtocolReturnFamilyPoint[]): Array<{ value: number | null }> {
  const baseValue = points.find((point) => isFiniteNumber(point.growthIndex))?.growthIndex

  return points.map((point) => ({
    value: baseValue && isFiniteNumber(point.growthIndex) ? (point.growthIndex / baseValue) * 100 : null
  }))
}

/**
 * Keeps every family the client could show after switching timeframe, mode, or
 * sort direction. Returning the survivors in their original order preserves
 * the client's stable tie-break while avoiding the full family-series payload.
 */
export function selectProtocolReturnFamilySeriesCandidates<TSeries extends TProtocolReturnFamilySeries>(
  familySeries: TSeries[],
  timeframe: '1y' | 'all'
): Array<TCompactProtocolReturnFamilySeries<TSeries>> {
  const preparedSeries = familySeries.map((series, originalIndex) => ({
    originalIndex,
    sortedPoints: series.dataPoints
      .map((point) => ({ ...point, timestamp: normalizeTimestamp(point.timestamp) }))
      .toSorted((left, right) => left.timestamp - right.timestamp)
  }))

  const selectedIndexes = new Set(
    FAMILY_SERIES_WINDOWS[timeframe].flatMap((window) => {
      const limit = FAMILY_SERIES_WINDOW_LIMITS[window]
      const rankableSeries = preparedSeries.map((series) => {
        const points = limit >= series.sortedPoints.length ? series.sortedPoints : series.sortedPoints.slice(-limit)
        return {
          originalIndex: series.originalIndex,
          positionPoints: buildPositionRankPoints(points),
          indexPoints: buildIndexRankPoints(points)
        }
      })

      return FAMILY_SERIES_MODES.flatMap((mode) =>
        FAMILY_SERIES_SORT_DIRECTIONS.flatMap((sortDirection) =>
          rankPortfolioVaultGrowthChartSeries({
            series: rankableSeries,
            mode,
            sortDirection,
            maxVaults: MAX_FAMILY_SERIES_PER_RANKING
          }).map((series) => series.originalIndex)
        )
      )
    })
  )

  return familySeries.flatMap((series, originalIndex) => {
    if (!selectedIndexes.has(originalIndex)) {
      return []
    }

    return [
      {
        ...series,
        dataPoints: series.dataPoints.map((point) => ({
          timestamp: point.timestamp,
          growthWeightUsd: point.growthWeightUsd,
          growthIndex: point.growthIndex
        }))
      }
    ]
  })
}
