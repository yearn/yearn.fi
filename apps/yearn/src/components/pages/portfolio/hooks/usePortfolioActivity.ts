import {
  getBundleActivityPage,
  initialBundleActivityCursor,
  mapActivityWallets
} from '@pages/portfolio/hooks/bundleActivity'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Address } from 'viem'
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

export function usePortfolioActivity(
  limit = 10,
  enabled = true,
  filters: TPortfolioActivityFilters = {},
  savedWallets?: readonly Address[]
) {
  const { address } = useWeb3()
  const wallets = useMemo(() => savedWallets?.toSorted() ?? (address ? [address] : []), [address, savedWallets])
  const isEnabled = wallets.length > 0 && enabled
  const initialPageParam: number | ReturnType<typeof initialBundleActivityCursor> =
    wallets.length > 1 ? initialBundleActivityCursor(wallets) : 0
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
    queryKey: ['portfolio-activity', wallets, limit, type, chainId, startTimestamp, endTimestamp],
    enabled: isEnabled,
    initialPageParam,
    queryFn: async ({ pageParam, signal }) => {
      async function fetchPage(wallet: Address, offset: number) {
        signal.throwIfAborted()
        const params = new URLSearchParams({ address: wallet, limit: String(limit), offset: String(offset), type })

        if (chainId !== null) params.set('chainId', String(chainId))
        if (startTimestamp !== null) params.set('startTimestamp', String(startTimestamp))
        if (endTimestamp !== null) params.set('endTimestamp', String(endTimestamp))

        const page = await fetchWithSchema(`/api/holdings/activity?${params}`, portfolioActivityResponseSchema, {
          timeout: 30 * 1000
        })
        if (page.address.toLowerCase() !== wallet.toLowerCase())
          throw new Error('Activity scope did not match the wallet.')
        return page
      }

      if (typeof pageParam !== 'number') return getBundleActivityPage(pageParam, limit, fetchPage)

      const wallet = wallets[0]
      if (!wallet) throw new Error('No wallet selected.')
      const page = await fetchPage(wallet, pageParam)
      return { entries: page.entries, nextPage: page.pageInfo.nextOffset ?? undefined }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: shouldRetryActivityRequest,
    retryDelay: getActivityRetryDelay
  })

  const facetsQuery = useQuery({
    queryKey: ['portfolio-activity-facets', wallets],
    enabled: isEnabled && shouldFetchFacets,
    queryFn: async ({ signal }) => {
      const facets = await mapActivityWallets(wallets, (wallet) => {
        signal.throwIfAborted()
        const params = new URLSearchParams({ address: wallet })
        return fetchWithSchema(`/api/holdings/activity-facets?${params}`, portfolioActivityFacetsResponseSchema, {
          timeout: 30 * 1000
        })
      })
      return [...new Set(facets.flatMap(({ facets }) => facets.chainIds))].sort((a, b) => a - b)
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
    const facetChainIds = facetsQuery.data

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
  const isEmpty = isEnabled && !isInitialLoading && !query.error && entries.length === 0
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
