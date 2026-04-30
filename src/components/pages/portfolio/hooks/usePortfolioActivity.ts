import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  portfolioActivityResponseSchema,
  type TPortfolioActivityEntry,
  type TPortfolioActivityResponse,
  type TPortfolioActivityTypeFilter
} from '../types/api'

type TPortfolioActivityFilters = {
  type?: TPortfolioActivityTypeFilter
  chainId?: number | null
  startTimestamp?: number | null
  endTimestamp?: number | null
}

export function usePortfolioActivity(limit = 10, enabled = true, filters: TPortfolioActivityFilters = {}) {
  const { address } = useWeb3()
  const isEnabled = Boolean(address) && enabled
  const type = filters.type ?? 'all'
  const chainId = filters.chainId ?? null
  const startTimestamp = filters.startTimestamp ?? null
  const endTimestamp = filters.endTimestamp ?? null

  const query = useInfiniteQuery<TPortfolioActivityResponse, Error>({
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
    refetchOnWindowFocus: false
  })

  const entries: TPortfolioActivityEntry[] = query.data?.pages.flatMap((page) => page.entries) ?? []
  const isInitialLoading = query.isLoading || (query.isFetching && entries.length === 0)
  const isEmpty = !isInitialLoading && !query.error && Boolean(address) && entries.length === 0

  return {
    data: entries,
    isLoading: isInitialLoading,
    isLoadingMore: query.isFetchingNextPage,
    error: query.error,
    isEmpty,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage()
  }
}
