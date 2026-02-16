import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import type { TPortfolioHistoryChartData, TPortfolioHistorySimpleResponse } from '../types/api'
import { portfolioHistorySimpleResponseSchema } from '../types/api'

export function usePortfolioHistory() {
  const { address, isActive } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address || !isActive) {
      return null
    }
    return `/api/holdings/history?address=${address}`
  }, [address, isActive])

  const {
    data: rawData,
    isLoading,
    error
  } = useFetch<TPortfolioHistorySimpleResponse>({
    endpoint,
    schema: portfolioHistorySimpleResponseSchema,
    config: {
      cacheDuration: 5 * 60 * 1000 // 5 minutes
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

  return {
    data,
    isLoading,
    error
  }
}
