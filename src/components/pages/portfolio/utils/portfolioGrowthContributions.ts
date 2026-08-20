const DEFAULT_MAX_VAULTS = 4
const ZERO_EPSILON = 1e-9

export type TPortfolioGrowthContributionFamily = {
  chainId: number
  vaultAddress: string
  label: string
  dataPoints: Array<{
    timestamp: number
    growthUsd: number | null
  }>
}

export type TPortfolioGrowthContributionSeries = {
  key: string
  label: string
  chainId: number | null
  vaultAddress: string | null
  isOther: boolean
  terminalValue: number
}

export type TPortfolioGrowthContributionChartPoint = {
  date: string
  portfolioGrowth: number
  [key: string]: string | number
}

export type TPortfolioGrowthContributionChart = {
  data: TPortfolioGrowthContributionChartPoint[]
  series: TPortfolioGrowthContributionSeries[]
}

type TPreparedFamily = TPortfolioGrowthContributionFamily & {
  originalIndex: number
  values: number[]
  terminalValue: number
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

function normalizeZero(value: number): number {
  return Math.abs(value) <= ZERO_EPSILON ? 0 : value
}

function buildRebasedFamilyValues(points: TPortfolioGrowthContributionFamily['dataPoints'], dates: string[]): number[] {
  const sortedPoints = points
    .flatMap((point) => {
      const date = timestampToUtcDate(point.timestamp)
      return date ? [{ date, value: point.growthUsd }] : []
    })
    .toSorted((left, right) => left.date.localeCompare(right.date))

  let pointIndex = 0
  let baselineValue: number | null = null
  let lastValue: number | null = null

  return dates.map((date) => {
    while (pointIndex < sortedPoints.length && sortedPoints[pointIndex]!.date <= date) {
      const nextValue = sortedPoints[pointIndex]!.value
      if (isFiniteNumber(nextValue)) {
        lastValue = nextValue
      }
      pointIndex += 1
    }

    if (baselineValue === null && lastValue !== null) {
      baselineValue = lastValue
    }

    return baselineValue !== null && lastValue !== null ? normalizeZero(lastValue - baselineValue) : 0
  })
}

function prepareFamilies(familySeries: TPortfolioGrowthContributionFamily[], dates: string[]): TPreparedFamily[] {
  return familySeries
    .map((family, originalIndex) => {
      const values = buildRebasedFamilyValues(family.dataPoints, dates)
      return {
        ...family,
        originalIndex,
        values,
        terminalValue: values.at(-1) ?? 0
      }
    })
    .filter((family) => Math.abs(family.terminalValue) > ZERO_EPSILON)
    .toSorted(
      (left, right) =>
        Math.abs(right.terminalValue) - Math.abs(left.terminalValue) || left.originalIndex - right.originalIndex
    )
}

export function buildPortfolioGrowthContributionChart(args: {
  totalPoints: Array<{ date: string; value: number | null }>
  familySeries: TPortfolioGrowthContributionFamily[]
  maxVaults?: number
}): TPortfolioGrowthContributionChart {
  const dates = args.totalPoints.map((point) => point.date)
  const requestedMaxVaults = args.maxVaults ?? DEFAULT_MAX_VAULTS
  const maxVaults = Number.isFinite(requestedMaxVaults)
    ? Math.max(0, Math.floor(requestedMaxVaults))
    : DEFAULT_MAX_VAULTS
  const selectedFamilies = prepareFamilies(args.familySeries, dates).slice(0, maxVaults)
  const namedSeries: TPortfolioGrowthContributionSeries[] = selectedFamilies.map((family, index) => ({
    key: `vault_${index}`,
    label: family.label,
    chainId: family.chainId,
    vaultAddress: family.vaultAddress,
    isOther: false,
    terminalValue: family.terminalValue
  }))

  const data = args.totalPoints.map<TPortfolioGrowthContributionChartPoint>((totalPoint, pointIndex) => {
    const portfolioGrowth = isFiniteNumber(totalPoint.value) ? totalPoint.value : 0
    const row: TPortfolioGrowthContributionChartPoint = {
      date: totalPoint.date,
      portfolioGrowth
    }
    let displayedGrowth = 0

    selectedFamilies.forEach((family, familyIndex) => {
      const value = family.values[pointIndex] ?? 0
      row[`vault_${familyIndex}`] = value
      displayedGrowth += value
    })

    row.other = normalizeZero(portfolioGrowth - displayedGrowth)
    return row
  })
  const otherTerminalValue = Number(data.at(-1)?.other ?? 0)

  return {
    data,
    series: [
      ...namedSeries,
      {
        key: 'other',
        label: 'Other',
        chainId: null,
        vaultAddress: null,
        isOther: true,
        terminalValue: otherTerminalValue
      }
    ]
  }
}
