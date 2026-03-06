import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import type { TPortfolioPnLResponse, TPortfolioPnLSummary } from '../types/api'
import { portfolioPnLResponseSchema } from '../types/api'

export function usePortfolioPnL() {
  const { address } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address) {
      return null
    }
    return `/api/holdings/pnl?address=${address}`
  }, [address])

  const {
    data: rawData,
    isLoading,
    isFetching,
    error
  } = useFetch<TPortfolioPnLResponse>({
    endpoint,
    schema: portfolioPnLResponseSchema,
    config: {
      cacheDuration: 5 * 60 * 1000 // 5 minutes
    }
  })

  const summary = useMemo<TPortfolioPnLSummary | null>(() => {
    if (!rawData?.summary) {
      return null
    }
    return rawData.summary
  }, [rawData])

  const isLoadingState = isLoading || isFetching

  return {
    summary,
    isLoading: isLoadingState,
    error
  }
}
