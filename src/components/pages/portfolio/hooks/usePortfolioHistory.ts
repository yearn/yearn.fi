import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { useMemo } from 'react'
import type {
  TPortfolioHistoryChartData,
  TPortfolioHistoryDenomination,
  TPortfolioHistorySimpleResponse,
  TPortfolioHistoryTimeframe,
  TPortfolioLiveBalanceSnapshot
} from '../types/api'
import { portfolioHistorySimpleResponseSchema } from '../types/api'
import { upsertLivePortfolioBalancePoint } from './usePortfolioHistory.helpers'
import { usePortfolioHistoryLoadTracking } from './usePortfolioHistoryLoadTracking'
import { createPortfolioHistoryProgressId, usePortfolioHistoryProgress } from './usePortfolioHistoryProgress'

const PORTFOLIO_HISTORY_CACHE_DURATION = 60 * 60 * 1000

export function usePortfolioHistory(
  denomination: TPortfolioHistoryDenomination = 'usd',
  timeframe: TPortfolioHistoryTimeframe = '1y',
  enabled = true,
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null = null
) {
  const { address } = useWeb3()
  const progressId = useMemo(
    () =>
      address && enabled ? createPortfolioHistoryProgressId(['portfolio-history', denomination, timeframe]) : null,
    [address, denomination, enabled, timeframe]
  )

  const endpoint = useMemo(() => {
    if (!address || !enabled || !progressId) {
      return null
    }
    return `/api/holdings/history?address=${address}&denomination=${denomination}&timeframe=${timeframe}&fetchType=parallel&progressId=${encodeURIComponent(progressId)}`
  }, [address, denomination, enabled, progressId, timeframe])
  const cacheKey = useMemo(
    () =>
      address && enabled ? ['fetch', 'portfolio-history', address.toLowerCase(), denomination, timeframe] : undefined,
    [address, denomination, enabled, timeframe]
  )

  const {
    data: rawData,
    isLoading,
    isFetching,
    error
  } = useFetch<TPortfolioHistorySimpleResponse>({
    endpoint,
    schema: portfolioHistorySimpleResponseSchema,
    config: {
      cacheKey,
      cacheDuration: PORTFOLIO_HISTORY_CACHE_DURATION,
      gcTime: PORTFOLIO_HISTORY_CACHE_DURATION,
      keepPreviousData: false,
      maxRetries: 0,
      timeout: 2 * 60 * 1000 // 2 minutes for large holdings requests
    }
  })

  const data = useMemo<TPortfolioHistoryChartData | null>(() => {
    if (!rawData?.dataPoints) {
      return null
    }

    const historicalData = rawData.dataPoints.map((point) => ({
      date: point.date,
      value: point.value
    }))
    return upsertLivePortfolioBalancePoint({ data: historicalData, denomination, liveSnapshot })
  }, [denomination, liveSnapshot, rawData])

  const hasData = Boolean(rawData?.dataPoints)
  const isLoadingState = !hasData && (isLoading || isFetching)
  const errorStatus =
    (error as { response?: { status?: number }; status?: number } | null)?.response?.status ??
    (error as { status?: number } | null)?.status
  const isEmpty = !isLoadingState && Boolean(address) && (errorStatus === 404 || Boolean(data && data.length === 0))
  const visibleError = isEmpty ? null : error
  const progress = usePortfolioHistoryProgress(progressId, isLoadingState)
  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_BALANCE_HISTORY_LOAD,
    loadKey: endpoint,
    timeframe,
    denomination,
    isLoading: isLoadingState,
    isEmpty,
    error,
    pointCount: rawData?.dataPoints.length
  })

  return {
    data,
    denomination,
    timeframe,
    isLoading: isLoadingState,
    progress,
    error: visibleError,
    isEmpty
  }
}
