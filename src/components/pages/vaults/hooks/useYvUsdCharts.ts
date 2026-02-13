import { transformVaultChartData } from '@pages/vaults/utils/charts'
import { useMemo } from 'react'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '../utils/yvUsd'
import { useVaultChartTimeseries } from './useVaultChartTimeseries'

export type TYvUsdSeriesPoint = {
  date: string
  unlocked: number | null
  locked: number | null
}

type TYvUsdCharts = {
  apyData: TYvUsdSeriesPoint[] | null
  performanceData: TYvUsdSeriesPoint[] | null
  tvlData: TYvUsdSeriesPoint[] | null
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

const getApyPointValue = (point: TApyPointValue | undefined): number | null =>
  point?.thirtyDayApy ?? point?.sevenDayApy ?? point?.derivedApy ?? point?.derivedApr ?? null

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
}): TYvUsdSeriesPoint[] | null {
  const unlockedList = unlockedSeries ?? []
  const lockedList = lockedSeries ?? []
  if (unlockedList.length === 0 && lockedList.length === 0) {
    return null
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

  const apyData = useMemo<TYvUsdSeriesPoint[] | null>(() => {
    return mergeByDate({
      unlockedSeries: unlockedTransformed.aprApyData,
      lockedSeries: lockedTransformed.aprApyData,
      getUnlockedValue: getApyPointValue,
      getLockedValue: getApyPointValue
    })
  }, [lockedTransformed.aprApyData, unlockedTransformed.aprApyData])

  const performanceData = useMemo<TYvUsdSeriesPoint[] | null>(() => {
    return mergeByDate({
      unlockedSeries: unlockedTransformed.ppsData,
      lockedSeries: lockedTransformed.ppsData,
      getUnlockedValue: (point) => point?.PPS ?? null,
      getLockedValue: (point) => point?.PPS ?? null
    })
  }, [lockedTransformed.ppsData, unlockedTransformed.ppsData])

  const tvlData = useMemo<TYvUsdSeriesPoint[] | null>(() => {
    return mergeByDate({
      unlockedSeries: unlockedTransformed.tvlData,
      lockedSeries: lockedTransformed.tvlData,
      getUnlockedValue: (point) => point?.TVL ?? null,
      getLockedValue: (point) => point?.TVL ?? null
    })
  }, [lockedTransformed.tvlData, unlockedTransformed.tvlData])

  const hasAllSeries = Boolean(apyData && performanceData && tvlData)

  return {
    apyData,
    performanceData,
    tvlData,
    isLoading: isLoadingUnlocked || isLoadingLocked || !hasAllSeries,
    error: (unlockedError ?? lockedError) as Error | undefined
  }
}
