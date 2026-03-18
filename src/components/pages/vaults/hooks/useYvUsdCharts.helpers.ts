import { getYvUsdTvlBreakdown } from '@pages/vaults/hooks/useYvUsdVaults.helpers'
import type { TTvlChartData } from '@pages/vaults/types/charts'

export type TYvUsdSeriesPoint = {
  date: string
  unlocked: number | null
  locked: number | null
}

function getFiniteTvlValue(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isPositiveTvlValue(value: number | null): value is number {
  return value !== null && value > 0
}

function getNormalizedLockedTvlValues(series: TTvlChartData): Map<string, number | null> {
  return new Map(
    series.map((point, index) => {
      const currentValue = getFiniteTvlValue(point.TVL)
      if (currentValue === null || currentValue > 0) {
        return [point.date, currentValue]
      }

      const hasPreviousPositiveValue = series
        .slice(0, index)
        .some((previousPoint) => isPositiveTvlValue(getFiniteTvlValue(previousPoint.TVL)))
      if (!hasPreviousPositiveValue) {
        return [point.date, currentValue]
      }

      const nextPositiveValue =
        series
          .slice(index + 1)
          .map((nextPoint) => getFiniteTvlValue(nextPoint.TVL))
          .find((value) => isPositiveTvlValue(value)) ?? currentValue

      return [point.date, nextPositiveValue]
    })
  )
}

export function mergeYvUsdTvlSeries({
  unlockedSeries,
  lockedSeries
}: {
  unlockedSeries: TTvlChartData | null
  lockedSeries: TTvlChartData | null
}): TYvUsdSeriesPoint[] | undefined {
  const unlockedList = unlockedSeries ?? []
  const lockedList = lockedSeries ?? []
  if (unlockedList.length === 0 && lockedList.length === 0) {
    return undefined
  }

  const unlockedByDate = new Map(unlockedList.map((point) => [point.date, point]))
  const lockedByDate = new Map(lockedList.map((point) => [point.date, point]))
  const normalizedLockedValues = getNormalizedLockedTvlValues(lockedList)
  const orderedDates = [
    ...new Set([...unlockedList.map((point) => point.date), ...lockedList.map((point) => point.date)])
  ]

  return orderedDates.map((date) => {
    const unlockedPoint = unlockedByDate.get(date)
    const lockedPoint = lockedByDate.get(date)
    const lockedValue = lockedPoint ? (normalizedLockedValues.get(date) ?? null) : null

    if (!unlockedPoint) {
      return {
        date,
        unlocked: null,
        locked: lockedValue
      }
    }

    const totalTvl = getFiniteTvlValue(unlockedPoint.TVL)
    if (totalTvl === null) {
      return {
        date,
        unlocked: null,
        locked: lockedValue
      }
    }

    if (!lockedPoint) {
      return {
        date,
        unlocked: getYvUsdTvlBreakdown({ totalTvl, lockedTvl: 0 }).unlockedTvl,
        locked: null
      }
    }

    if (lockedValue === null) {
      return {
        date,
        unlocked: null,
        locked: null
      }
    }

    return {
      date,
      unlocked: getYvUsdTvlBreakdown({ totalTvl, lockedTvl: lockedValue }).unlockedTvl,
      locked: lockedValue
    }
  })
}
