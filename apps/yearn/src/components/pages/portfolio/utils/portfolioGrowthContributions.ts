const DEFAULT_MAX_VAULTS = 4
const ZERO_EPSILON = 1e-9

export type TPortfolioGrowthContributionFamily = {
  chainId: number
  vaultAddress: string
  label: string
  dataPoints: Array<{
    timestamp: number
    growthUsd: number | null
    growthUsdEstimated?: boolean
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
  portfolioGrowthEstimated?: boolean
  [key: string]: string | number | boolean | undefined
}

export type TPortfolioGrowthContributionChart = {
  data: TPortfolioGrowthContributionChartPoint[]
  series: TPortfolioGrowthContributionSeries[]
}

type TPreparedFamily = TPortfolioGrowthContributionFamily & {
  originalIndex: number
  values: number[]
  estimatedValues: boolean[]
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

function buildRebasedFamilyValues(
  points: TPortfolioGrowthContributionFamily['dataPoints'],
  dates: string[]
): { values: number[]; estimatedValues: boolean[] } {
  const sortedPoints = points
    .flatMap((point) => {
      const date = timestampToUtcDate(point.timestamp)
      return date ? [{ date, value: point.growthUsd, isEstimated: point.growthUsdEstimated ?? false }] : []
    })
    .toSorted((left, right) => left.date.localeCompare(right.date))

  const initialState = {
    pointIndex: 0,
    baselineValue: null as number | null,
    baselineEstimated: false,
    lastValue: null as number | null,
    lastEstimated: false,
    values: [] as number[],
    estimatedValues: [] as boolean[]
  }

  return dates.reduce<typeof initialState>((state, date) => {
    while (state.pointIndex < sortedPoints.length && sortedPoints[state.pointIndex]!.date <= date) {
      const nextValue = sortedPoints[state.pointIndex]!.value
      if (isFiniteNumber(nextValue)) {
        state.lastValue = nextValue
        state.lastEstimated = sortedPoints[state.pointIndex]!.isEstimated
      }
      state.pointIndex += 1
    }

    if (state.baselineValue === null && state.lastValue !== null) {
      state.baselineValue = state.lastValue
      state.baselineEstimated = state.lastEstimated
    }

    state.values.push(
      state.baselineValue !== null && state.lastValue !== null
        ? normalizeZero(state.lastValue - state.baselineValue)
        : 0
    )
    state.estimatedValues.push(
      state.baselineValue !== null && state.lastValue !== null ? state.baselineEstimated || state.lastEstimated : false
    )
    return state
  }, initialState)
}

function prepareFamilies(familySeries: TPortfolioGrowthContributionFamily[], dates: string[]): TPreparedFamily[] {
  return familySeries
    .map((family, originalIndex) => {
      const { values, estimatedValues } = buildRebasedFamilyValues(family.dataPoints, dates)
      return {
        ...family,
        originalIndex,
        values,
        estimatedValues,
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
  totalPoints: Array<{ date: string; value: number | null; isEstimated?: boolean }>
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
      portfolioGrowth,
      ...(totalPoint.isEstimated ? { portfolioGrowthEstimated: true } : {})
    }
    let displayedGrowth = 0

    selectedFamilies.forEach((family, familyIndex) => {
      const value = family.values[pointIndex] ?? 0
      row[`vault_${familyIndex}`] = value
      if (family.estimatedValues[pointIndex]) {
        row[`vault_${familyIndex}Estimated`] = true
      }
      displayedGrowth += value
    })

    row.other = normalizeZero(portfolioGrowth - displayedGrowth)
    if (totalPoint.isEstimated || selectedFamilies.some((family) => family.estimatedValues[pointIndex])) {
      row.otherEstimated = true
    }
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
