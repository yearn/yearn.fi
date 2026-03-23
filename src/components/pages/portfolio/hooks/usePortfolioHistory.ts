import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import type { TPortfolioHistoryChartData, TPortfolioHistorySimpleResponse } from '../types/api'
import { portfolioHistorySimpleResponseSchema } from '../types/api'

export function usePortfolioHistory() {
  const { address } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address) {
      return null
    }
    return `/api/holdings/history?address=${address}&debug=1&fetchType=parallel&paginationMode=all`
  }, [address])

  const {
    data: rawData,
    isLoading,
    isFetching,
    error
  } = useFetch<TPortfolioHistorySimpleResponse>({
    endpoint,
    schema: portfolioHistorySimpleResponseSchema,
    config: {
      cacheDuration: 4 * 60 * 60 * 1000, // 4 hours
      keepPreviousData: false
    }
  })

  const data = useMemo<TPortfolioHistoryChartData | null>(() => {
    if (!rawData?.dataPoints) {
      return null
    }
    return rawData.dataPoints.map((point) => ({
      date: point.date,
      totalUsdValue: point.value
    }))
  }, [rawData])

  const isLoadingState = isLoading || isFetching

  return {
    data,
    isLoading: isLoadingState,
    error
  }
}
