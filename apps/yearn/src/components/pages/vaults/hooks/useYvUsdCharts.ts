import { useVaultChartTimeseries } from '@pages/vaults/hooks/useVaultChartTimeseries'
import {
  buildApyDataFromPpsSeries,
  buildUnderlyingLockedPpsSeries,
  mergeYvUsdTvlSeries,
  type TYvUsdSeriesPoint
} from '@pages/vaults/hooks/useYvUsdCharts.helpers'
import { transformVaultChartData } from '@pages/vaults/utils/charts'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useMemo } from 'react'

export type { TYvUsdSeriesPoint } from '@pages/vaults/hooks/useYvUsdCharts.helpers'

type TYvUsdCharts = {
  apyData?: TYvUsdSeriesPoint[]
  performanceData?: TYvUsdSeriesPoint[]
  tvlData?: TYvUsdSeriesPoint[]
  isLoading: boolean
  error?: Error
}

type TSeriesPointWithDate = {
  date: string
}

type TApyPointValue = {
  thirtyDayApy?: number | null
  sevenDayApy?: number | null
  derivedApy?: number | null
  derivedApr?: number | null
}

function getApyPointValue(point: TApyPointValue | undefined): number | null {
  return point?.thirtyDayApy ?? point?.sevenDayApy ?? point?.derivedApy ?? point?.derivedApr ?? null
}

function getNullableSeriesValue(value: number | null | undefined): number | null {
  return value ?? null
}

function mergeByDate<TUnlocked extends TSeriesPointWithDate, TLocked extends TSeriesPointWithDate>({
  unlockedSeries,
  lockedSeries,
  getUnlockedValue,
  getLockedValue
}: {
  unlockedSeries: TUnlocked[] | null
  lockedSeries: TLocked[] | null
  getUnlockedValue: (point: TUnlocked | undefined) => number | null
  getLockedValue: (point: TLocked | undefined) => number | null
}): TYvUsdSeriesPoint[] | undefined {
  const unlockedList = unlockedSeries ?? []
  const lockedList = lockedSeries ?? []
  if (unlockedList.length === 0 && lockedList.length === 0) {
    return undefined
  }

  const unlockedByDate = new Map(unlockedList.map((point) => [point.date, point]))
  const lockedByDate = new Map(lockedList.map((point) => [point.date, point]))
  const orderedDates = [
    ...new Set([...unlockedList.map((point) => point.date), ...lockedList.map((point) => point.date)])
  ]

  return orderedDates.map((date) => ({
    date,
    unlocked: getUnlockedValue(unlockedByDate.get(date)),
    locked: getLockedValue(lockedByDate.get(date))
  }))
}

export function useYvUsdCharts(): TYvUsdCharts {
  const {
    data: unlockedData,
    isLoading: isLoadingUnlocked,
    error: unlockedError
  } = useVaultChartTimeseries({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_UNLOCKED_ADDRESS
  })

  const {
    data: lockedData,
    isLoading: isLoadingLocked,
    error: lockedError
  } = useVaultChartTimeseries({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_LOCKED_ADDRESS
  })

  const unlockedTransformed = useMemo(() => transformVaultChartData(unlockedData), [unlockedData])
  const lockedTransformed = useMemo(() => transformVaultChartData(lockedData), [lockedData])
  const lockedUnderlyingPpsData = useMemo(
    () =>
      buildUnderlyingLockedPpsSeries({
        unlockedSeries: unlockedTransformed.ppsData,
        lockedSeries: lockedTransformed.ppsData
      }),
    [lockedTransformed.ppsData, unlockedTransformed.ppsData]
  )
  const lockedUnderlyingApyData = useMemo(
    () => buildApyDataFromPpsSeries(lockedUnderlyingPpsData),
    [lockedUnderlyingPpsData]
  )

  const apyData = useMemo<TYvUsdSeriesPoint[] | undefined>(() => {
    return mergeByDate({
      unlockedSeries: unlockedTransformed.aprApyData,
      lockedSeries: lockedUnderlyingApyData,
      getUnlockedValue: getApyPointValue,
      getLockedValue: getApyPointValue
    })
  }, [lockedUnderlyingApyData, unlockedTransformed.aprApyData])

  const performanceData = useMemo<TYvUsdSeriesPoint[] | undefined>(() => {
    return mergeByDate({
      unlockedSeries: unlockedTransformed.ppsData,
      lockedSeries: lockedUnderlyingPpsData,
      getUnlockedValue: (point) => getNullableSeriesValue(point?.PPS),
      getLockedValue: (point) => getNullableSeriesValue(point?.PPS)
    })
  }, [lockedUnderlyingPpsData, unlockedTransformed.ppsData])

  const tvlData = useMemo<TYvUsdSeriesPoint[] | undefined>(() => {
    return mergeYvUsdTvlSeries({
      unlockedSeries: unlockedTransformed.tvlData,
      lockedSeries: lockedTransformed.tvlData
    })
  }, [lockedTransformed.tvlData, unlockedTransformed.tvlData])

  return {
    apyData,
    performanceData,
    tvlData,
    isLoading: isLoadingUnlocked || isLoadingLocked || !apyData || !performanceData || !tvlData,
    error: (unlockedError ?? lockedError) as Error | undefined
  }
}
