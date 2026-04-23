import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  portfolioActivityResponseSchema,
  type TPortfolioActivityEntry,
  type TPortfolioActivityResponse
} from '../types/api'

export function usePortfolioActivity(limit = 10, enabled = true) {
  const { address } = useWeb3()
  const isEnabled = Boolean(address) && enabled

  const query = useInfiniteQuery<TPortfolioActivityResponse, Error>({
    queryKey: ['portfolio-activity', address, limit],
    enabled: isEnabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchWithSchema(
        `/api/holdings/activity?address=${address}&limit=${limit}&offset=${Number(pageParam) || 0}`,
        portfolioActivityResponseSchema,
        { timeout: 30 * 1000 }
      ),
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
