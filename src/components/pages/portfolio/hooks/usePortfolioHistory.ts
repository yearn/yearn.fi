import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import type { TPortfolioHistoryChartData, TPortfolioHistorySimpleResponse } from '../types/api'
import { portfolioHistorySimpleResponseSchema } from '../types/api'

const API_BASE_URL = 'http://localhost:3001/api/v1'

/**
 * Fetches and manages portfolio history data for the connected wallet address.
 *
 * This hook retrieves historical portfolio value data from the local API server,
 * transforming it into a format suitable for chart visualization. The data is cached
 * for 5 minutes to minimize redundant API calls.
 *
 * @returns An object containing:
 * - `data`: Array of historical portfolio data points with date and totalUsdValue, or null if unavailable
 * - `isLoading`: Boolean indicating if the data is currently being fetched
 * - `error`: Error object if the fetch failed, undefined otherwise
 *
 * @remarks
 * - Only fetches data when a wallet is connected and active
 * - Automatically refetches when the wallet address changes
 * - Data is cached for 5 minutes to improve performance
 * - Uses Zod schema validation to ensure API response integrity
 *
 * @example
 * ```tsx
 * function PortfolioChart() {
 *   const { data, isLoading, error } = usePortfolioHistory()
 *
 *   if (isLoading) return <Spinner />
 *   if (error) return <ErrorMessage error={error} />
 *   if (!data) return <EmptyState />
 *
 *   return <LineChart data={data} />
 * }
 * ```
 */
export function usePortfolioHistory() {
  const { address, isActive } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address || !isActive) {
      return null
    }
    return `${API_BASE_URL}/holdings/history/simple?address=${address}`
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
