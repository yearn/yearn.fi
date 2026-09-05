const DEFAULT_MAX_VAULTS = 4
const ZERO_EPSILON = 1e-9

export type TPortfolioGrowthContributionFamily = {
  chainId: number
  vaultAddress: string
  label: string
  dataPoints: Array<{
    timestamp: number
    value: number | null
    isEstimated?: boolean
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
  portfolioGrowth: number | null
  portfolioGrowthEstimated?: boolean
  [key: string]: string | number | boolean | null | undefined
}

export type TPortfolioGrowthContributionChart = {
  data: TPortfolioGrowthContributionChartPoint[]
  series: TPortfolioGrowthContributionSeries[]
}

export function toPortfolioGrowthContributionPoint(
  point: {
    timestamp: number
    growthUsd: number | null
    growthUsdEstimated: boolean
    growthWeightUsd: number | null
    growthWeightEth: number | null
  },
  mode: 'usd' | 'eth'
): TPortfolioGrowthContributionFamily['dataPoints'][number] {
  return {
    timestamp: point.timestamp,
    value: mode === 'eth' ? point.growthWeightEth : point.growthWeightUsd
  }
}

type TPreparedFamily = TPortfolioGrowthContributionFamily & {
  originalIndex: number
  values: Array<number | null>
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
  dates: string[],
  preserveNullValues: boolean
): { values: Array<number | null>; estimatedValues: boolean[] } {
  const sortedPoints = points
    .flatMap((point) => {
      const date = timestampToUtcDate(point.timestamp)
      return date ? [{ date, value: point.value, isEstimated: point.isEstimated ?? false }] : []
    })
    .toSorted((left, right) => left.date.localeCompare(right.date))

  const initialState = {
    pointIndex: 0,
    baselineValue: null as number | null,
    baselineEstimated: false,
    lastValue: null as number | null,
    lastEstimated: false,
    values: [] as Array<number | null>,
    estimatedValues: [] as boolean[]
  }

  return dates.reduce<typeof initialState>((state, date) => {
    while (state.pointIndex < sortedPoints.length && sortedPoints[state.pointIndex]!.date <= date) {
      const nextValue = sortedPoints[state.pointIndex]!.value
      if (isFiniteNumber(nextValue)) {
        state.lastValue = nextValue
        state.lastEstimated = sortedPoints[state.pointIndex]!.isEstimated
      } else if (preserveNullValues) {
        state.lastValue = null
        state.lastEstimated = false
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
        : preserveNullValues
          ? null
          : 0
    )
    state.estimatedValues.push(
      state.baselineValue !== null && state.lastValue !== null ? state.baselineEstimated || state.lastEstimated : false
    )
    return state
  }, initialState)
}

function prepareFamilies(
  familySeries: TPortfolioGrowthContributionFamily[],
  dates: string[],
  preserveNullValues: boolean
): TPreparedFamily[] {
  return familySeries
    .map((family, originalIndex) => {
      const { values, estimatedValues } = buildRebasedFamilyValues(family.dataPoints, dates, preserveNullValues)
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
  preserveNullValues?: boolean
}): TPortfolioGrowthContributionChart {
  const dates = args.totalPoints.map((point) => point.date)
  const requestedMaxVaults = args.maxVaults ?? DEFAULT_MAX_VAULTS
  const maxVaults = Number.isFinite(requestedMaxVaults)
    ? Math.max(0, Math.floor(requestedMaxVaults))
    : DEFAULT_MAX_VAULTS
  const preserveNullValues = args.preserveNullValues ?? false
  const selectedFamilies = prepareFamilies(args.familySeries, dates, preserveNullValues).slice(0, maxVaults)
  const namedSeries: TPortfolioGrowthContributionSeries[] = selectedFamilies.map((family, index) => ({
    key: `vault_${index}`,
    label: family.label,
    chainId: family.chainId,
    vaultAddress: family.vaultAddress,
    isOther: false,
    terminalValue: family.terminalValue
  }))

  const data = args.totalPoints.map<TPortfolioGrowthContributionChartPoint>((totalPoint, pointIndex) => {
    if (!isFiniteNumber(totalPoint.value)) {
      return {
        date: totalPoint.date,
        portfolioGrowth: null,
        ...Object.fromEntries([...selectedFamilies.map((_, index) => [`vault_${index}`, null]), ['other', null]])
      }
    }

    const portfolioGrowth = totalPoint.value
    const row: TPortfolioGrowthContributionChartPoint = {
      date: totalPoint.date,
      portfolioGrowth,
      ...(totalPoint.isEstimated ? { portfolioGrowthEstimated: true } : {})
    }

    selectedFamilies.forEach((family, familyIndex) => {
      const value = family.values[pointIndex]
      row[`vault_${familyIndex}`] = value
      if (isFiniteNumber(value) && family.estimatedValues[pointIndex]) {
        row[`vault_${familyIndex}Estimated`] = true
      }
    })

    const displayedGrowth = selectedFamilies.reduce((total, family) => {
      const value = family.values[pointIndex]
      return total + (isFiniteNumber(value) ? value : 0)
    }, 0)
    row.other = normalizeZero(portfolioGrowth - displayedGrowth)
    if (totalPoint.isEstimated || selectedFamilies.some((family) => family.estimatedValues[pointIndex])) {
      row.otherEstimated = true
    }
    return row
  })
  const otherTerminalValue = data.map((point) => point.other).findLast(isFiniteNumber) ?? 0

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
