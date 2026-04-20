import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import {
  portfolioProtocolReturnHistoryResponseSchema,
  type TPortfolioHistoryTimeframe,
  type TPortfolioProtocolReturnHistoryChartData,
  type TPortfolioProtocolReturnHistoryFamilySeries,
  type TPortfolioProtocolReturnHistoryResponse,
  type TPortfolioProtocolReturnHistorySummary
} from '../types/api'

export function usePortfolioProtocolReturnHistory(timeframe: TPortfolioHistoryTimeframe = '1y') {
  const { address } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address) {
      return null
    }

    return `/api/holdings/pnl/simple-history?address=${address}&timeframe=${timeframe}&debug=1&fetchType=parallel&paginationMode=all`
  }, [address, timeframe])

  const { data, isLoading, isFetching, error } = useFetch<TPortfolioProtocolReturnHistoryResponse>({
    endpoint,
    schema: portfolioProtocolReturnHistoryResponseSchema,
    config: {
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000
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

  const isLoadingState = isLoading || isFetching
  const errorStatus =
    (error as { response?: { status?: number }; status?: number } | null)?.response?.status ??
    (error as { status?: number } | null)?.status
  const isEmpty =
    !isLoadingState && Boolean(address) && (errorStatus === 404 || Boolean(history && history.length === 0))
  const visibleError = isEmpty ? null : error

  return {
    data: history,
    summary,
    familySeries,
    timeframe,
    isLoading: isLoadingState,
    error: visibleError,
    isEmpty
  }
}
