import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import {
  portfolioProtocolReturnResponseSchema,
  type TPortfolioProtocolReturnResponse,
  type TPortfolioProtocolReturnSummary
} from '../types/api'

export function usePortfolioProtocolReturn() {
  const { address } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address) {
      return null
    }

    return `/api/holdings/pnl/simple?address=${address}&debug=1&fetchType=parallel&paginationMode=all`
  }, [address])

  const { data, isLoading, isFetching, error } = useFetch<TPortfolioProtocolReturnResponse>({
    endpoint,
    schema: portfolioProtocolReturnResponseSchema,
    config: {
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000
    }
  })

  return {
    data: (data?.summary ?? null) as TPortfolioProtocolReturnSummary | null,
    isLoading: isLoading || isFetching,
    error
  }
}
