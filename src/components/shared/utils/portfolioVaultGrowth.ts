export type TPortfolioVaultGrowthChartMode = 'position' | 'index'
export type TPortfolioVaultGrowthChartSortDirection = 'desc' | 'asc'

const MIN_RELEVANCE_SCORE = 0.000001

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function getFiniteValues(points: Array<{ value: number | null }>): number[] {
  return points.flatMap((point) => (isFiniteNumber(point.value) ? [point.value] : []))
}

export type TPortfolioVaultGrowthRankableSeries = {
  positionPoints: Array<{ value: number | null }>
  indexPoints: Array<{ value: number | null }>
}

function getSeriesSortScore(
  series: TPortfolioVaultGrowthRankableSeries,
  mode: TPortfolioVaultGrowthChartMode
): number | null {
  const points = mode === 'position' ? series.positionPoints : series.indexPoints
  const finiteValues = getFiniteValues(points)

  if (finiteValues.length < 2) {
    return null
  }

  return (finiteValues.at(-1) ?? 0) - finiteValues[0]
}

export function rankPortfolioVaultGrowthChartSeries<TSeries extends TPortfolioVaultGrowthRankableSeries>(args: {
  series: TSeries[]
  mode: TPortfolioVaultGrowthChartMode
  sortDirection: TPortfolioVaultGrowthChartSortDirection
  maxVaults?: number
}): TSeries[] {
  const directionMultiplier = args.sortDirection === 'desc' ? -1 : 1
  const rankedSeries = args.series
    .map((vaultSeries, originalIndex) => ({
      vaultSeries,
      originalIndex,
      score: getSeriesSortScore(vaultSeries, args.mode)
    }))
    .filter(
      (candidate): candidate is { vaultSeries: TSeries; originalIndex: number; score: number } =>
        candidate.score !== null && Math.abs(candidate.score) > MIN_RELEVANCE_SCORE
    )
    .toSorted(
      (left, right) => (left.score - right.score) * directionMultiplier || left.originalIndex - right.originalIndex
    )

  const limit =
    typeof args.maxVaults === 'number' && Number.isFinite(args.maxVaults)
      ? Math.max(0, Math.floor(args.maxVaults))
      : rankedSeries.length

  return rankedSeries.slice(0, limit).map((candidate) => candidate.vaultSeries)
}
