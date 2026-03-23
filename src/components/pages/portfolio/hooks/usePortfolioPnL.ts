import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import { portfolioPnlResponseSchema, type TPortfolioPnlSummary } from '../types/api'

export function usePortfolioPnL() {
  const { address } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address) {
      return null
    }

    return `/api/holdings/pnl?address=${address}&debug=1&fetchType=parallel&paginationMode=all`
  }, [address])

  const { data, isLoading, isFetching, error } = useFetch({
    endpoint,
    schema: portfolioPnlResponseSchema,
    config: {
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false
    }
  })

  return {
    data: (data?.summary ?? null) as TPortfolioPnlSummary | null,
    isLoading: isLoading || isFetching,
    error
  }
}
