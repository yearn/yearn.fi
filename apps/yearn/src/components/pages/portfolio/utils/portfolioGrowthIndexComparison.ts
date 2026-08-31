const DEFAULT_MAX_VAULTS = 4

export type TPortfolioGrowthIndexFamily = {
  chainId: number
  vaultAddress: string
  label: string
  dataPoints: Array<{
    timestamp: number
    value: number | null
  }>
}

export type TPortfolioGrowthIndexSeries = {
  key: string
  label: string
  chainId: number
  vaultAddress: string
  terminalValue: number
  values: Array<number | null>
}

export type TPortfolioGrowthIndexChartPoint = {
  date: string
  portfolioIndex: number | null
  [key: string]: string | number | null
}

export type TPortfolioGrowthIndexComparison = {
  data: TPortfolioGrowthIndexChartPoint[]
  series: TPortfolioGrowthIndexSeries[]
}

type TPreparedFamily = TPortfolioGrowthIndexFamily & {
  originalIndex: number
  terminalValue: number
  values: Array<number | null>
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeTimestamp(timestamp: number): number {
  return timestamp > 1_000_000_000_000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp)
}

function timestampToUtcDate(timestamp: number): string | null {
  const normalizedTimestamp = normalizeTimestamp(timestamp)
  if (!Number.isFinite(normalizedTimestamp)) {
    return null
  }

  return new Date(normalizedTimestamp * 1000).toISOString().slice(0, 10)
}

function buildNormalizedFamilyValues(
  points: TPortfolioGrowthIndexFamily['dataPoints'],
  dates: string[]
): Array<number | null> {
  const valueByDate = points.reduce<Map<string, number | null>>((values, point) => {
    const date = timestampToUtcDate(point.timestamp)
    if (date) {
      values.set(date, point.value)
    }
    return values
  }, new Map())
  const baseValue = dates.map((date) => valueByDate.get(date) ?? null).find(isFiniteNumber)

  if (!baseValue) {
    return dates.map(() => null)
  }

  return dates.map((date) => {
    const value = valueByDate.get(date)
    return isFiniteNumber(value) ? (value / baseValue) * 100 : null
  })
}

function prepareFamilies(familySeries: TPortfolioGrowthIndexFamily[], dates: string[]): TPreparedFamily[] {
  return familySeries
    .map((family, originalIndex) => {
      const values = buildNormalizedFamilyValues(family.dataPoints, dates)
      return {
        ...family,
        originalIndex,
        values,
        terminalValue: values.findLast(isFiniteNumber) ?? 100
      }
    })
    .filter((family) => family.values.some(isFiniteNumber))
    .toSorted(
      (left, right) =>
        Math.abs(right.terminalValue - 100) - Math.abs(left.terminalValue - 100) ||
        left.originalIndex - right.originalIndex
    )
}

export function buildPortfolioGrowthIndexComparison(args: {
  totalPoints: Array<{ date: string; value: number | null }>
  familySeries: TPortfolioGrowthIndexFamily[]
  maxVaults?: number
}): TPortfolioGrowthIndexComparison {
  const dates = args.totalPoints.map((point) => point.date)
  const requestedMaxVaults = args.maxVaults ?? DEFAULT_MAX_VAULTS
  const maxVaults = Number.isFinite(requestedMaxVaults)
    ? Math.max(0, Math.floor(requestedMaxVaults))
    : DEFAULT_MAX_VAULTS
  const series = prepareFamilies(args.familySeries, dates)
    .slice(0, maxVaults)
    .map<TPortfolioGrowthIndexSeries>((family, index) => ({
      key: `vault_${index}`,
      label: family.label,
      chainId: family.chainId,
      vaultAddress: family.vaultAddress,
      terminalValue: family.terminalValue,
      values: family.values
    }))
  const data = args.totalPoints.map<TPortfolioGrowthIndexChartPoint>((point, pointIndex) => ({
    date: point.date,
    portfolioIndex: point.value,
    ...Object.fromEntries(series.map((family) => [family.key, family.values[pointIndex] ?? null]))
  }))

  return { data, series }
}
