import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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

const ACTIVITY_FACET_LIMIT_PER_SOURCE = 250

export function usePortfolioActivity(limit = 10, enabled = true, filters: TPortfolioActivityFilters = {}) {
  const { address } = useWeb3()
  const isEnabled = Boolean(address) && enabled
  const type = filters.type ?? 'all'
  const chainId = filters.chainId ?? null
  const startTimestamp = filters.startTimestamp ?? null
  const endTimestamp = filters.endTimestamp ?? null
  const shouldFetchFacets = type === 'all' && chainId === null && startTimestamp === null && endTimestamp === null
  const [facetOffsetPerSource, setFacetOffsetPerSource] = useState(0)
  const [discoveredFacetChainIds, setDiscoveredFacetChainIds] = useState<number[] | null>(null)
  const [isFacetScanComplete, setIsFacetScanComplete] = useState(false)

  useEffect(() => {
    setFacetOffsetPerSource(0)
    setDiscoveredFacetChainIds(null)
    setIsFacetScanComplete(false)
  }, [address])

  const facetsQuery = useQuery({
    queryKey: ['portfolio-activity-facets', address, 'all', facetOffsetPerSource],
    enabled: isEnabled && shouldFetchFacets && !isFacetScanComplete,
    queryFn: () => {
      const params = new URLSearchParams({
        address: address ?? '',
        version: 'all',
        limitPerSource: String(ACTIVITY_FACET_LIMIT_PER_SOURCE),
        offsetPerSource: String(facetOffsetPerSource)
      })

      return fetchWithSchema(`/api/holdings/activity-facets?${params}`, portfolioActivityFacetsResponseSchema, {
        timeout: 30 * 1000
      })
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  useEffect(() => {
    const page = facetsQuery.data
    if (!page || !shouldFetchFacets) {
      return
    }

    setDiscoveredFacetChainIds((previousChainIds) =>
      Array.from(new Set([...(previousChainIds ?? []), ...page.facets.chainIds])).sort(
        (firstChainId, secondChainId) => firstChainId - secondChainId
      )
    )

    if (page.pageInfo.nextOffsetPerSource !== null) {
      setFacetOffsetPerSource(page.pageInfo.nextOffsetPerSource)
      return
    }

    setIsFacetScanComplete(true)
  }, [facetsQuery.data, shouldFetchFacets])

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
    refetchOnWindowFocus: false
  })

  const entries: TPortfolioActivityEntry[] = query.data?.pages.flatMap((page) => page.entries) ?? []
  const facetChainIds = discoveredFacetChainIds
  const availableChainIds =
    facetChainIds ??
    (shouldFetchFacets && query.data
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
