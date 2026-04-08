import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import { portfolioBreakdownResponseSchema, type TPortfolioBreakdownResponse } from '../types/api'

export function usePortfolioBreakdown(date: string | null, enabled = true) {
  const { address } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address || !date || !enabled) {
      return null
    }

    return `/api/holdings/breakdown?address=${address}&date=${date}&debug=1&fetchType=parallel&paginationMode=all`
  }, [address, date, enabled])

  const { data, isLoading, isFetching, error } = useFetch<TPortfolioBreakdownResponse>({
    endpoint,
    schema: portfolioBreakdownResponseSchema,
    config: {
      cacheDuration: 30 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000
    }
  })

  return {
    data: data ?? null,
    isLoading: isLoading || isFetching,
    error
  }
}
