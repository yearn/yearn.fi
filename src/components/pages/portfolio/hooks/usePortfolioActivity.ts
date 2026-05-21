import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import type { TNotification } from '@shared/types/notifications'
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

type TPortfolioActivityFacetState = {
  address: string | null
  offsetPerSource: number
  discoveredChainIds: number[] | null
  isScanComplete: boolean
}

const ACTIVITY_FACET_LIMIT_PER_SOURCE = 500
const MAX_ACTIVITY_RETRIES = 3
const DEFAULT_ACTIVITY_RETRY_DELAY = 1000

function normalizeWalletAddress(address: string | null | undefined): string | null {
  return typeof address === 'string' && address ? address.toLowerCase() : null
}

function getInitialFacetState(address: string | null): TPortfolioActivityFacetState {
  return {
    address,
    offsetPerSource: 0,
    discoveredChainIds: null,
    isScanComplete: false
  }
}

export function getActivePortfolioActivityFacetState(
  facetState: TPortfolioActivityFacetState,
  address: string | null
): TPortfolioActivityFacetState {
  return facetState.address === address ? facetState : getInitialFacetState(address)
}

export function mergePortfolioActivityFacetState(
  previous: TPortfolioActivityFacetState,
  address: string | null,
  chainIds: number[],
  nextOffsetPerSource: number | null
): TPortfolioActivityFacetState {
  const currentState = getActivePortfolioActivityFacetState(previous, address)
  const discoveredChainIds = Array.from(new Set([...(currentState.discoveredChainIds ?? []), ...chainIds])).sort(
    (firstChainId, secondChainId) => firstChainId - secondChainId
  )

  return {
    ...currentState,
    discoveredChainIds,
    offsetPerSource: nextOffsetPerSource ?? currentState.offsetPerSource,
    isScanComplete: nextOffsetPerSource === null
  }
}

export function getUnresolvedLocalActivityEntries(
  cachedEntries: TNotification[],
  activeAddress: string | null | undefined
): TNotification[] {
  const normalizedActiveAddress = normalizeWalletAddress(activeAddress)

  if (normalizedActiveAddress === null) {
    return []
  }

  return cachedEntries
    .filter(
      (entry) =>
        entry.status !== 'success' &&
        normalizeWalletAddress(entry.address as string | null | undefined) === normalizedActiveAddress
    )
    .toSorted((a, b) => (b.timeFinished ?? 0) - (a.timeFinished ?? 0))
}

export function usePortfolioActivity(limit = 10, enabled = true, filters: TPortfolioActivityFilters = {}) {
  const { address } = useWeb3()
  const normalizedAddress = normalizeWalletAddress(address)
  const isEnabled = Boolean(address) && enabled
  const type = filters.type ?? 'all'
  const chainId = filters.chainId ?? null
  const startTimestamp = filters.startTimestamp ?? null
  const endTimestamp = filters.endTimestamp ?? null
  const shouldFetchFacets = type === 'all' && chainId === null && startTimestamp === null && endTimestamp === null
  const [facetState, setFacetState] = useState<TPortfolioActivityFacetState>(() =>
    getInitialFacetState(normalizedAddress)
  )
  const activeFacetState = getActivePortfolioActivityFacetState(facetState, normalizedAddress)
  const facetOffsetPerSource = activeFacetState.offsetPerSource
  const discoveredFacetChainIds = activeFacetState.discoveredChainIds
  const isFacetScanComplete = activeFacetState.isScanComplete

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
  const hasLoadedFirstActivityPage = Boolean(query.data?.pages[0])

  const facetsQuery = useQuery({
    queryKey: ['portfolio-activity-facets', address, 'all', facetOffsetPerSource],
    enabled: isEnabled && shouldFetchFacets && hasLoadedFirstActivityPage && !isFacetScanComplete,
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
    refetchOnWindowFocus: false,
    retry: shouldRetryActivityRequest,
    retryDelay: getActivityRetryDelay
  })

  useEffect(() => {
    const page = facetsQuery.data
    if (!page || !shouldFetchFacets) {
      return
    }

    setFacetState((previous) =>
      mergePortfolioActivityFacetState(
        previous,
        normalizedAddress,
        page.facets.chainIds,
        page.pageInfo.nextOffsetPerSource
      )
    )
  }, [facetsQuery.data, normalizedAddress, shouldFetchFacets])

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
