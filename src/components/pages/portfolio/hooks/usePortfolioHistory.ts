import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import type {
  TPortfolioHistoryChartData,
  TPortfolioHistoryDenomination,
  TPortfolioHistorySimpleResponse,
  TPortfolioHistoryTimeframe
} from '../types/api'
import { portfolioHistorySimpleResponseSchema } from '../types/api'

export function usePortfolioHistory(
  denomination: TPortfolioHistoryDenomination = 'usd',
  timeframe: TPortfolioHistoryTimeframe = '1y',
  enabled = true
) {
  const { address } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address || !enabled) {
      return null
    }
    return `/api/holdings/history?address=${address}&denomination=${denomination}&timeframe=${timeframe}&fetchType=parallel`
  }, [address, denomination, enabled, timeframe])

  const {
    data: rawData,
    isLoading,
    isFetching,
    error
  } = useFetch<TPortfolioHistorySimpleResponse>({
    endpoint,
    schema: portfolioHistorySimpleResponseSchema,
    config: {
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000 // 2 minutes for large holdings requests
    }
  })

  const data = useMemo<TPortfolioHistoryChartData | null>(() => {
    if (!rawData?.dataPoints) {
      return null
    }
    return rawData.dataPoints.map((point) => ({
      date: point.date,
      value: point.value
    }))
  }, [rawData])

  const isLoadingState = isLoading || isFetching
  const errorStatus =
    (error as { response?: { status?: number }; status?: number } | null)?.response?.status ??
    (error as { status?: number } | null)?.status
  const isEmpty = !isLoadingState && Boolean(address) && (errorStatus === 404 || Boolean(data && data.length === 0))
  const visibleError = isEmpty ? null : error

  return {
    data,
    denomination,
    timeframe,
    isLoading: isLoadingState,
    error: visibleError,
    isEmpty
  }
}
