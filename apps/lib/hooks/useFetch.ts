/************************************************************************************************
 * Enhanced useFetch hook with improved caching capabilities
 * Uses TanStack Query for caching, deduplication, and background revalidation
 * Supports Zod schema validation with comprehensive error handling
 ************************************************************************************************/

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { z } from 'zod'
import { baseFetcher } from '../utils/fetchers'

type TUseFetchConfig = {
  /** Cache duration in milliseconds (default: 2 minutes) */
  cacheDuration?: number
  /** Enable background revalidation on interval (default: false) */
  shouldEnableRefreshInterval?: boolean
  /** Refresh interval in milliseconds (default: 30 seconds) */
  refreshInterval?: number
  /** Maximum number of retries on error (default: 3) */
  maxRetries?: number
  /** Enable the query (default: true when endpoint is provided) */
  enabled?: boolean
  /** Keep previous data while refetching (default: true) */
  keepPreviousData?: boolean
}

type TUseZodProps<T> = {
  endpoint: string | null
  schema: z.Schema<T>
  config?: TUseFetchConfig
}

export const getFetchQueryKey = (endpoint: string) => ['fetch', endpoint] as const

export function useFetch<T>({ endpoint, schema, config }: TUseZodProps<T>) {
  const queryClient = useQueryClient()
  const {
    cacheDuration = 2 * 60 * 1000, // 2 minutes
    shouldEnableRefreshInterval = false,
    refreshInterval = 30 * 1000, // 30 seconds
    maxRetries = 3,
    enabled = true,
    keepPreviousData: shouldKeepPreviousData = true
  } = config ?? {}

  const queryKey = endpoint ? getFetchQueryKey(endpoint) : ['fetch', 'disabled']

  const queryResult = useQuery({
    queryKey,
    enabled: Boolean(endpoint) && enabled,
    staleTime: cacheDuration,
    refetchInterval: shouldEnableRefreshInterval ? refreshInterval : false,
    placeholderData: shouldKeepPreviousData ? keepPreviousData : undefined,
    queryFn: async () => {
      if (!endpoint) {
        throw new Error('Missing endpoint')
      }
      const data = await baseFetcher(endpoint)
      const parsed = schema.safeParse(data)
      if (!parsed.success) {
        console.error(`[useFetch] Schema validation failed for ${endpoint}:`, parsed.error)
        throw parsed.error
      }
      return parsed.data
    },
    retry: (failureCount, err) => {
      if (failureCount >= maxRetries) {
        return false
      }
      const anyErr = err as any
      const status = anyErr?.response?.status as number | undefined
      const code = anyErr?.code as string | undefined
      const isNetworkLike = code === 'ERR_NETWORK' || (!anyErr?.response && anyErr?.request)
      if (isNetworkLike) return false
      if (typeof status === 'number' && status >= 400 && status < 500) return false
      return true
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000)
  })

  if (queryResult.error) {
    console.error(`[useFetch] Error fetching ${endpoint}:`, queryResult.error)
  }

  const mutate = useCallback(async () => {
    if (!endpoint) {
      return queryClient.getQueryData<T>(queryKey)
    }
    const result = await queryResult.refetch()
    return result.data as T | undefined
  }, [endpoint, queryClient, queryKey, queryResult])

  return {
    data: queryResult.data as T | undefined,
    error: queryResult.error,
    isLoading: queryResult.isLoading,
    isValidating: queryResult.isFetching,
    isSuccess: queryResult.isSuccess,
    mutate
  }
}
