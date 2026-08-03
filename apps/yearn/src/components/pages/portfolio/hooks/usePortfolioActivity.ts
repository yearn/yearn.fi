import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  portfolioActivityFacetsResponseSchema,
  portfolioActivityResponseSchema,
  type TPortfolioActivityEntry,
  type TPortfolioActivityTypeFilter
} from '../types/api'

type TPortfolioActivityFilters = {
  type?: TPortfolioActivityTypeFilter
  chainId?: number | null
  startTimestamp?: number | null
  endTimestamp?: number | null
}

const MAX_ACTIVITY_RETRIES = 3
const DEFAULT_ACTIVITY_RETRY_DELAY = 1000

export function usePortfolioActivity(limit = 10, enabled = true, filters: TPortfolioActivityFilters = {}) {
  const { address } = useWeb3()
  const isEnabled = Boolean(address) && enabled
  const type = filters.type ?? 'all'
  const chainId = filters.chainId ?? null
  const startTimestamp = filters.startTimestamp ?? null
  const endTimestamp = filters.endTimestamp ?? null
  const shouldFetchFacets = type === 'all' && chainId === null && startTimestamp === null && endTimestamp === null

  const shouldRetryActivityRequest = (failureCount: number, error: unknown): boolean => {
    const status = (error as { response?: { status?: number }; status?: number })?.response?.status
    const fallbackStatus = (error as { status?: number })?.status
    const responseStatus = status ?? fallbackStatus

    if (responseStatus === 429) {
      return failureCount < MAX_ACTIVITY_RETRIES
    }

    if (typeof responseStatus === 'number' && responseStatus < 500) {
      return false
    }

    return failureCount < MAX_ACTIVITY_RETRIES
  }

  const getActivityRetryDelay = (failureCount: number, error: unknown): number => {
    const retryAfterMs = (error as { retryAfterMs?: number })?.retryAfterMs
    if (typeof retryAfterMs === 'number') {
      return retryAfterMs
    }

    return Math.min(DEFAULT_ACTIVITY_RETRY_DELAY * 2 ** failureCount, 30000)
  }

  const query = useInfiniteQuery({
    queryKey: ['portfolio-activity', address, limit, type, chainId, startTimestamp, endTimestamp],
    enabled: isEnabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        address: address ?? '',
        limit: String(limit),
        offset: String(Number(pageParam) || 0),
        type
      })

      if (chainId !== null) {
        params.set('chainId', String(chainId))
      }

      if (startTimestamp !== null) {
        params.set('startTimestamp', String(startTimestamp))
      }

      if (endTimestamp !== null) {
        params.set('endTimestamp', String(endTimestamp))
      }

      return fetchWithSchema(`/api/holdings/activity?${params}`, portfolioActivityResponseSchema, {
        timeout: 30 * 1000
      })
    },
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextOffset ?? undefined,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: shouldRetryActivityRequest,
    retryDelay: getActivityRetryDelay
  })

  const facetsQuery = useQuery({
    queryKey: ['portfolio-activity-facets', address, 'all'],
    enabled: isEnabled && shouldFetchFacets,
    queryFn: () => {
      const params = new URLSearchParams({
        address: address ?? '',
        version: 'all'
      })

      return fetchWithSchema(`/api/holdings/activity-facets?${params}`, portfolioActivityFacetsResponseSchema, {
        timeout: 30 * 1000
      })
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: shouldRetryActivityRequest,
    retryDelay: getActivityRetryDelay
  })

  const entries: TPortfolioActivityEntry[] = useMemo(
    () => query.data?.pages.flatMap((page) => page.entries) ?? [],
    [query.data]
  )
  const availableChainIds = useMemo(() => {
    const facetChainIds = facetsQuery.data?.facets.chainIds

    if (facetChainIds) {
      return facetChainIds
    }

    return shouldFetchFacets && query.data
      ? Array.from(new Set(entries.map((entry) => entry.chainId))).sort(
          (firstChainId, secondChainId) => firstChainId - secondChainId
        )
      : null
  }, [entries, facetsQuery.data, query.data, shouldFetchFacets])
  const isInitialLoading = query.isLoading || (query.isFetching && entries.length === 0)
  const isEmpty = !isInitialLoading && !query.error && Boolean(address) && entries.length === 0
  const error = query.error instanceof Error ? query.error : query.error ? new Error('Failed to fetch activity') : null

  return {
    data: entries,
    availableChainIds,
    isLoading: isInitialLoading,
    isLoadingMore: query.isFetchingNextPage,
    error,
    isEmpty,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage()
  }
}
