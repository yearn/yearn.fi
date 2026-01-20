import type {
  TAprApyChartData,
  TChartTimeseriesResponse,
  TPpsChartData,
  TTimeseriesPoint,
  TTransformedChartData,
  TTvlChartData
} from '@pages/vaults/types/charts'

const DAY_IN_SECONDS = 86_400
const DEFAULT_LIMIT = Number.MAX_SAFE_INTEGER
const TIMEFRAME_LIMITS: Record<string, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: DEFAULT_LIMIT
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: '2-digit'
})
const padTwo = (value: number) => String(value).padStart(2, '0')
const tooltipDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric'
})

export function formatUnixTimestamp(value: number | string): string {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) {
    return 'Invalid date'
  }
  return dateFormatter.format(new Date(timestamp * 1000))
}

function parseChartDateParts(value: string): { month: number; day: number; year: number } | null {
  if (typeof value !== 'string') {
    return null
  }

  const [monthPart, dayPart, yearPart] = value.split('/')
  const month = Number(monthPart)
  const day = Number(dayPart)
  const year = Number(yearPart)
  if (
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isFinite(day) ||
    day < 1 ||
    day > 31 ||
    !Number.isFinite(year)
  ) {
    return null
  }

  return {
    month,
    day,
    year: year < 100 ? 2000 + year : year
  }
}

export function formatChartMonthYearLabel(value: string | number): string {
  if (typeof value !== 'string') {
    return String(value ?? '')
  }

  const parts = parseChartDateParts(value)
  if (!parts) {
    return value
  }

  return `${padTwo(parts.month)}/${padTwo(parts.year % 100)}`
}

export function formatChartWeekLabel(value: string | number): string {
  if (typeof value !== 'string') {
    return String(value ?? '')
  }

  const parts = parseChartDateParts(value)
  if (!parts) {
    return value
  }

  return `${padTwo(parts.month)}/${padTwo(parts.day)}/${padTwo(parts.year % 100)}`
}

export function formatChartTooltipDate(value: string | number): string {
  if (typeof value !== 'string') {
    return String(value ?? '')
  }

  const parts = parseChartDateParts(value)
  if (!parts) {
    return value
  }

  return tooltipDateFormatter.format(new Date(parts.year, parts.month - 1, parts.day))
}

export function getChartMonthlyTicks<T extends { date: string }>(data: T[], omitFirst = false): string[] {
  const ticks = data.reduce<{ ticks: string[]; lastKey: string }>(
    (acc, point) => {
      const parts = parseChartDateParts(point.date)
      if (!parts) return acc

      const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`
      if (key !== acc.lastKey) {
        return { ticks: [...acc.ticks, point.date], lastKey: key }
      }
      return acc
    },
    { ticks: [], lastKey: '' }
  ).ticks

  return omitFirst ? ticks.slice(1) : ticks
}

export function getChartWeeklyTicks<T extends { date: string }>(data: T[], omitFirst = false): string[] {
  const ticks = data.reduce<{ ticks: string[]; lastKey: string }>(
    (acc, point) => {
      const parts = parseChartDateParts(point.date)
      if (!parts) return acc

      const date = new Date(parts.year, parts.month - 1, parts.day)
      const dayOfWeek = date.getDay()
      const diffToMonday = (dayOfWeek + 6) % 7
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - diffToMonday)

      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(weekStart.getDate()).padStart(2, '0')}`

      if (key !== acc.lastKey) {
        return { ticks: [...acc.ticks, point.date], lastKey: key }
      }
      return acc
    },
    { ticks: [], lastKey: '' }
  ).ticks

  return omitFirst ? ticks.slice(1) : ticks
}

export function getTimeframeLimit(timeframe: string): number {
  return TIMEFRAME_LIMITS[timeframe] ?? DEFAULT_LIMIT
}

function normalizeSeries(series?: TChartTimeseriesResponse[keyof TChartTimeseriesResponse]): TTimeseriesPoint[] {
  if (!Array.isArray(series)) {
    return []
  }
  return series
    .map((point) => {
      const nextTime = Number(point.time)
      if (!Number.isFinite(nextTime)) {
        return null
      }

      const normalizedValue =
        point.value === null || typeof point.value === 'number' ? point.value : Number(point.value)

      return {
        ...point,
        time: nextTime,
        value: Number.isFinite(normalizedValue ?? NaN) ? (normalizedValue as number) : null
      }
    })
    .filter((point): point is TTimeseriesPoint => Boolean(point))
    .toSorted((a, b) => a.time - b.time)
}

function findTimestampBounds(series: TTimeseriesPoint[][]): { earliest: number; latest: number } | null {
  const timestamps = series
    .flat()
    .map((point) => point.time)
    .filter((time) => Number.isFinite(time))

  if (!timestamps.length) {
    return null
  }

  return {
    earliest: Math.floor(Math.min(...timestamps) / DAY_IN_SECONDS) * DAY_IN_SECONDS,
    latest: Math.floor(Math.max(...timestamps) / DAY_IN_SECONDS) * DAY_IN_SECONDS
  }
}

export function fillMissingDailyData(series: TTimeseriesPoint[], earliest: number, latest: number): TTimeseriesPoint[] {
  if (!series.length) {
    return []
  }

  const template = series[0]
  const indexed = new Map<number, TTimeseriesPoint>()
  series.forEach((point) => {
    indexed.set(Math.floor(point.time / DAY_IN_SECONDS) * DAY_IN_SECONDS, point)
  })

  const dayCount = Math.floor((latest - earliest) / DAY_IN_SECONDS) + 1
  const filled: TTimeseriesPoint[] = Array.from({ length: dayCount }, (_, i) => {
    const current = earliest + i * DAY_IN_SECONDS
    const existing = indexed.get(current)
    return existing ?? { ...template, time: current, value: null }
  })

  return filled
}

export function calculateAprFromPps(series: TTimeseriesPoint[], smoothingWindowDays = 1): TTimeseriesPoint[] {
  if (!series.length) {
    return []
  }

  const window = Math.max(1, Math.floor(smoothingWindowDays))

  const smoothedValues = series.map((_, index) => {
    const windowStart = Math.max(0, index - window + 1)
    const windowSlice = series.slice(windowStart, index + 1)
    const { sum, count } = windowSlice.reduce(
      (acc, item) => {
        if (item.value !== null) {
          return { sum: acc.sum + item.value, count: acc.count + 1 }
        }
        return acc
      },
      { sum: 0, count: 0 }
    )
    return count > 0 ? sum / count : null
  })

  const aprSeries: TTimeseriesPoint[] = series.map((current, i) => {
    if (i === 0) {
      return { ...current, value: null }
    }

    const currentSmoothed = smoothedValues[i]
    const previous = series[i - 1]
    const previousSmoothed = smoothedValues[i - 1]

    if (current.value === null || previous.value === null || currentSmoothed === null || previousSmoothed === null) {
      return { ...current, value: null }
    }

    const deltaDays = (current.time - previous.time) / DAY_IN_SECONDS
    if (deltaDays <= 0) {
      return { ...current, value: null }
    }

    const periodReturn = (currentSmoothed - previousSmoothed) / previousSmoothed
    const apr = periodReturn * (365 / deltaDays)
    return { ...current, value: apr }
  })

  return aprSeries
}

export function calculateApyFromApr(series: TTimeseriesPoint[], compoundingPeriodDays = 7): TTimeseriesPoint[] {
  if (!series.length) {
    return []
  }

  const periodDays = Math.max(1, compoundingPeriodDays)
  const periodsPerYear = 365 / periodDays

  return series.map((point) => {
    if (point.value === null) {
      return { ...point, value: null }
    }

    const apr = point.value
    const apy = (1 + apr / periodsPerYear) ** periodsPerYear - 1
    return { ...point, value: apy }
  })
}

export function transformVaultChartData(timeseries?: TChartTimeseriesResponse | null): TTransformedChartData {
  if (!timeseries || typeof timeseries !== 'object') {
    return {
      aprApyData: null,
      tvlData: null,
      ppsData: null
    }
  }

  const apyWeekly = normalizeSeries(timeseries.apyWeekly)
  const apyMonthly = normalizeSeries(timeseries.apyMonthly)
  const tvl = normalizeSeries(timeseries.tvl)
  const pps = normalizeSeries(timeseries.pps)

  const bounds = findTimestampBounds([apyWeekly, apyMonthly, tvl, pps])
  if (!bounds) {
    return {
      aprApyData: null,
      tvlData: null,
      ppsData: null
    }
  }

  const apyWeeklyFilled = fillMissingDailyData(apyWeekly, bounds.earliest, bounds.latest)
  const apyMonthlyFilled = fillMissingDailyData(apyMonthly, bounds.earliest, bounds.latest)
  const tvlFilled = fillMissingDailyData(tvl, bounds.earliest, bounds.latest)
  const ppsFilled = fillMissingDailyData(pps, bounds.earliest, bounds.latest)

  const aprFilled = calculateAprFromPps(ppsFilled)
  const aprAsApyFilled = calculateApyFromApr(aprFilled)

  const tvlData: TTvlChartData = tvlFilled.map((point) => ({
    date: formatUnixTimestamp(point.time),
    TVL: point.value ?? null
  }))

  const ppsData: TPpsChartData = ppsFilled.map((point) => ({
    date: formatUnixTimestamp(point.time),
    PPS: point.value ?? null
  }))

  const aprApyData: TAprApyChartData = aprFilled.map((point, index) => ({
    date: formatUnixTimestamp(point.time),
    sevenDayApy:
      apyWeeklyFilled[index]?.value !== null && apyWeeklyFilled[index]?.value !== undefined
        ? Number(apyWeeklyFilled[index]?.value) * 100
        : null,
    thirtyDayApy:
      apyMonthlyFilled[index]?.value !== null && apyMonthlyFilled[index]?.value !== undefined
        ? Number(apyMonthlyFilled[index]?.value) * 100
        : null,
    derivedApr: point.value !== null ? point.value * 100 : null,
    derivedApy:
      aprAsApyFilled[index]?.value !== null && aprAsApyFilled[index]?.value !== undefined
        ? Number(aprAsApyFilled[index]?.value) * 100
        : null
  }))

  return {
    aprApyData,
    tvlData,
    ppsData
  }
}
