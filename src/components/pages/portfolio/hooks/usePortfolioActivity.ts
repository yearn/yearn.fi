import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const isEnabled = Boolean(address) && enabled
  const type = filters.type ?? 'all'
  const chainId = filters.chainId ?? null
  const startTimestamp = filters.startTimestamp ?? null
  const endTimestamp = filters.endTimestamp ?? null
  const shouldIncludeFacets = type === 'all' && chainId === null && startTimestamp === null && endTimestamp === null
  const cachedUnfilteredPages =
    queryClient.getQueryData<InfiniteData<TPortfolioActivityResponse>>([
      'portfolio-activity',
      address,
      limit,
      'all',
      null,
      null,
      null
    ])?.pages ?? []

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
      if (Number(pageParam) === 0 && shouldIncludeFacets) {
        params.set('includeFacets', 'true')
      }

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
  const facetChainIds =
    query.data?.pages.find((page) => page.facets?.chainIds)?.facets?.chainIds ??
    cachedUnfilteredPages.find((page) => page.facets?.chainIds)?.facets?.chainIds ??
    null
  const availableChainIds =
    facetChainIds ??
    (shouldIncludeFacets && query.data
      ? Array.from(new Set(entries.map((entry) => entry.chainId))).sort(
          (firstChainId, secondChainId) => firstChainId - secondChainId
        )
      : null)
  const isInitialLoading = query.isLoading || (query.isFetching && entries.length === 0)
  const isEmpty = !isInitialLoading && !query.error && Boolean(address) && entries.length === 0

  return {
    data: entries,
    availableChainIds,
    isLoading: isInitialLoading,
    isLoadingMore: query.isFetchingNextPage,
    error: query.error,
    isEmpty,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage()
  }
}
