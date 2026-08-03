import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { useMemo } from 'react'
import {
  portfolioProtocolReturnHistoryResponseSchema,
  type TPortfolioHistoryTimeframe,
  type TPortfolioProtocolReturnHistoryChartData,
  type TPortfolioProtocolReturnHistoryFamilySeries,
  type TPortfolioProtocolReturnHistoryResponse,
  type TPortfolioProtocolReturnHistorySummary
} from '../types/api'
import { usePortfolioHistoryLoadTracking } from './usePortfolioHistoryLoadTracking'
import { createPortfolioHistoryProgressId, usePortfolioHistoryProgress } from './usePortfolioHistoryProgress'

const PORTFOLIO_HISTORY_CACHE_DURATION = 60 * 60 * 1000

export function usePortfolioProtocolReturnHistory(timeframe: TPortfolioHistoryTimeframe = '1y', enabled = true) {
  const { address } = useWeb3()
  const progressId = useMemo(
    () => (address && enabled ? createPortfolioHistoryProgressId(['portfolio-protocol-history', timeframe]) : null),
    [address, enabled, timeframe]
  )

  const endpoint = useMemo(() => {
    if (!address || !enabled || !progressId) {
      return null
    }

    return `/api/holdings/protocol-return/history?address=${address}&timeframe=${timeframe}&fetchType=parallel&progressId=${encodeURIComponent(progressId)}`
  }, [address, enabled, progressId, timeframe])
  const cacheKey = useMemo(
    () => (address && enabled ? ['fetch', 'portfolio-protocol-history', address.toLowerCase(), timeframe] : undefined),
    [address, enabled, timeframe]
  )

  const { data, isLoading, isFetching, error } = useFetch<TPortfolioProtocolReturnHistoryResponse>({
    endpoint,
    schema: portfolioProtocolReturnHistoryResponseSchema,
    config: {
      cacheKey,
      cacheDuration: PORTFOLIO_HISTORY_CACHE_DURATION,
      gcTime: PORTFOLIO_HISTORY_CACHE_DURATION,
      keepPreviousData: false,
      maxRetries: 0,
      timeout: 5 * 60 * 1000 // Allow the first cold snapshot to finish and warm Redis.
    }
  })

  const history = useMemo<TPortfolioProtocolReturnHistoryChartData | null>(() => {
    if (!data?.dataPoints) {
      return null
    }

    return data.dataPoints.map((point) => ({
      date: point.date,
      growthWeightUsd: point.growthWeightUsd,
      growthWeightEth: point.growthWeightEth,
      protocolReturnPct: point.protocolReturnPct,
      annualizedProtocolReturnPct: point.annualizedProtocolReturnPct,
      growthIndex: point.growthIndex
    }))
  }, [data])

  const summary = useMemo<TPortfolioProtocolReturnHistorySummary | null>(() => data?.summary ?? null, [data])
  const familySeries = useMemo<TPortfolioProtocolReturnHistoryFamilySeries>(() => data?.familySeries ?? [], [data])

  const hasData = Boolean(data?.dataPoints)
  const isLoadingState = !hasData && (isLoading || isFetching)
  const errorStatus =
    (error as { response?: { status?: number }; status?: number } | null)?.response?.status ??
    (error as { status?: number } | null)?.status
  const isEmpty =
    !isLoadingState && Boolean(address) && (errorStatus === 404 || Boolean(history && history.length === 0))
  const visibleError = isEmpty ? null : error
  const progress = usePortfolioHistoryProgress(progressId, isLoadingState)
  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_PROTOCOL_RETURN_HISTORY_LOAD,
    loadKey: endpoint,
    timeframe,
    isLoading: isLoadingState,
    isEmpty,
    error,
    pointCount: data?.dataPoints.length
  })

  return {
    data: history,
    summary,
    familySeries,
    timeframe,
    isLoading: isLoadingState,
    progress,
    error: visibleError,
    isEmpty
  }
}
