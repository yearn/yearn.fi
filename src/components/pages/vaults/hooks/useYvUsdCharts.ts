import { transformVaultChartData } from '@pages/vaults/utils/charts'
import { useMemo } from 'react'
import {
  YVUSD_BASELINE_VAULT_ADDRESS,
  YVUSD_CHAIN_ID,
  YVUSD_LOCK_BONUS_APY,
  YVUSD_LOCK_TVL_MULTIPLIER
} from '../utils/yvUsd'
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

export function useYvUsdCharts(): TYvUsdCharts {
  const { data, isLoading, error } = useVaultChartTimeseries({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_BASELINE_VAULT_ADDRESS
  })

  const transformed = useMemo(() => transformVaultChartData(data), [data])

  const apyData = useMemo<TYvUsdSeriesPoint[] | null>(() => {
    if (!transformed.aprApyData) return null
    return transformed.aprApyData.map((point) => {
      const baseValue = point.thirtyDayApy ?? point.sevenDayApy ?? point.derivedApy ?? point.derivedApr ?? null
      const lockedValue = baseValue !== null ? baseValue + YVUSD_LOCK_BONUS_APY * 100 : null
      return {
        date: point.date,
        unlocked: baseValue,
        locked: lockedValue
      }
    })
  }, [transformed.aprApyData])

  const performanceData = useMemo<TYvUsdSeriesPoint[] | null>(() => {
    if (!transformed.ppsData) return null
    return transformed.ppsData.map((point) => ({
      date: point.date,
      unlocked: point.PPS ?? null,
      locked: point.PPS !== null ? point.PPS * YVUSD_LOCK_TVL_MULTIPLIER : null
    }))
  }, [transformed.ppsData])

  const tvlData = useMemo<TYvUsdSeriesPoint[] | null>(() => {
    if (!transformed.tvlData) return null
    return transformed.tvlData.map((point) => ({
      date: point.date,
      unlocked: point.TVL ?? null,
      locked: point.TVL !== null ? point.TVL * YVUSD_LOCK_TVL_MULTIPLIER : null
    }))
  }, [transformed.tvlData])

  return {
    apyData,
    performanceData,
    tvlData,
    isLoading: isLoading || !transformed.aprApyData || !transformed.ppsData || !transformed.tvlData,
    error: error as Error | undefined
  }
}
