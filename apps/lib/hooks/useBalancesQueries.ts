import { type UseQueryOptions, useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { TAddress } from '../types/address'
import type { TChainTokens, TDict, TNDict, TToken } from '../types/mixed'
import { toAddress } from '../utils/tools.address'
import { isZeroAddress } from '../utils/tools.is'
import { getBalances, type TUseBalancesTokens } from './useBalances.multichains'
import { balanceQueryKeys } from './useBalancesQuery'

/*******************************************************************************
 ** Rate limiting configuration per chain
 ******************************************************************************/
const CHAIN_RATE_LIMITS: Record<number, { maxConcurrent: number; delayMs: number }> = {
  // Base - most restrictive due to rate limiting
  8453: { maxConcurrent: 2, delayMs: 500 },
  // Other chains with moderate limits
  1: { maxConcurrent: 5, delayMs: 100 },
  10: { maxConcurrent: 3, delayMs: 200 },
  56: { maxConcurrent: 3, delayMs: 200 },
  137: { maxConcurrent: 3, delayMs: 200 },
  42161: { maxConcurrent: 3, delayMs: 200 }
}

const DEFAULT_RATE_LIMIT = { maxConcurrent: 3, delayMs: 200 }

/*******************************************************************************
 ** Cache configuration per chain
 ******************************************************************************/
const CHAIN_CACHE_CONFIG: Record<number, { staleTime: number; gcTime: number }> = {
  1: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  10: { staleTime: 3 * 60 * 1000, gcTime: 7 * 60 * 1000 },
  56: { staleTime: 3 * 60 * 1000, gcTime: 7 * 60 * 1000 },
  137: { staleTime: 3 * 60 * 1000, gcTime: 7 * 60 * 1000 },
  42161: { staleTime: 3 * 60 * 1000, gcTime: 7 * 60 * 1000 },
  8453: { staleTime: 10 * 60 * 1000, gcTime: 15 * 60 * 1000 }
}

const DEFAULT_CACHE_CONFIG = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 }

function getChainConfig(chainId: number) {
  return {
    cache: CHAIN_CACHE_CONFIG[chainId] || DEFAULT_CACHE_CONFIG,
    rateLimit: CHAIN_RATE_LIMITS[chainId] || DEFAULT_RATE_LIMIT
  }
}

/*******************************************************************************
 ** Rate limited fetch function
 ******************************************************************************/
const chainQueues: Record<number, Promise<void>> = {}

export async function fetchTokenBalancesWithRateLimit(
  chainId: number,
  userAddress: TAddress | undefined,
  tokens: TUseBalancesTokens[],
  shouldForceFetch: boolean = false
): Promise<TDict<TToken>> {
  if (!userAddress || isZeroAddress(userAddress) || tokens.length === 0) {
    return {}
  }

  const config = getChainConfig(chainId).rateLimit

  // Wait for previous requests on this chain to complete with rate limiting
  // @ts-expect-error - This is checking for an existing promise
  if (chainQueues[chainId]) {
    await chainQueues[chainId]
  }

  // Create a new queue promise that resolves after the delay
  chainQueues[chainId] = new Promise((resolve) => {
    setTimeout(resolve, config.delayMs)
  })

  const validTokens = tokens.filter((token) => !isZeroAddress(token.address))

  if (validTokens.length === 0) {
    return {}
  }

  const [balances, error] = await getBalances(chainId, userAddress, validTokens, shouldForceFetch)

  if (error) {
    throw error
  }

  return balances
}

/*******************************************************************************
 ** Hook for fetching balances across multiple chains using TanStack Query
 ******************************************************************************/
export function useBalancesQueries(
  userAddress: TAddress | undefined,
  tokens: TUseBalancesTokens[],
  options?: {
    priorityChainId?: number
    enabled?: boolean
  }
): {
  data: TChainTokens
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  error: Error | null
  refetch: () => void
  chainLoadingStatus: TNDict<boolean>
  chainSuccessStatus: TNDict<boolean>
  chainErrorStatus: TNDict<boolean>
} {
  // Group tokens by chainId
  const tokensByChain = useMemo(() => {
    const grouped: TNDict<TUseBalancesTokens[]> = {}
    const uniqueTokens: TNDict<Set<TAddress>> = {}

    for (const token of tokens) {
      if (!grouped[token.chainID]) {
        grouped[token.chainID] = []
        uniqueTokens[token.chainID] = new Set()
      }

      const tokenAddress = toAddress(token.address)
      if (!uniqueTokens[token.chainID].has(tokenAddress)) {
        uniqueTokens[token.chainID].add(tokenAddress)
        grouped[token.chainID].push(token)
      }
    }

    return grouped
  }, [tokens])

  // Create queries for each chain
  const queries = useQueries({
    queries: Object.entries(tokensByChain).map(([chainIdStr, chainTokens]) => {
      const chainId = Number(chainIdStr)
      const config = getChainConfig(chainId)
      const tokenAddresses = chainTokens.map((t) => t.address)

      const queryOptions: UseQueryOptions<
        TDict<TToken>,
        Error,
        TDict<TToken>,
        ReturnType<typeof balanceQueryKeys.byTokens>
      > = {
        queryKey: balanceQueryKeys.byTokens(chainId, userAddress, tokenAddresses),
        queryFn: () => fetchTokenBalancesWithRateLimit(chainId, userAddress, chainTokens),
        enabled: Boolean(
          options?.enabled !== false && userAddress && !isZeroAddress(userAddress) && chainTokens.length > 0
        ),
        staleTime: config.cache.staleTime,
        gcTime: config.cache.gcTime,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
      }

      return queryOptions
    })
  })

  // Combine results
  const data = useMemo(() => {
    const combined: TChainTokens = {}
    const chainIds = Object.keys(tokensByChain).map(Number)

    queries.forEach((query, index) => {
      const chainId = chainIds[index]
      if (query.data) {
        combined[chainId] = query.data
      }
    })

    return combined
  }, [queries, tokensByChain])

  // Aggregate status
  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)
  const isSuccess = queries.every((q) => q.isSuccess)
  const error = queries.find((q) => q.error)?.error || null

  // Chain-specific status
  const chainLoadingStatus = useMemo(() => {
    const status: TNDict<boolean> = {}
    const chainIds = Object.keys(tokensByChain).map(Number)

    queries.forEach((query, index) => {
      const chainId = chainIds[index]
      status[chainId] = query.isLoading
    })

    return status
  }, [queries, tokensByChain])

  const chainSuccessStatus = useMemo(() => {
    const status: TNDict<boolean> = {}
    const chainIds = Object.keys(tokensByChain).map(Number)

    queries.forEach((query, index) => {
      const chainId = chainIds[index]
      status[chainId] = query.isSuccess
    })

    return status
  }, [queries, tokensByChain])

  const chainErrorStatus = useMemo(() => {
    const status: TNDict<boolean> = {}
    const chainIds = Object.keys(tokensByChain).map(Number)

    queries.forEach((query, index) => {
      const chainId = chainIds[index]
      status[chainId] = query.isError
    })

    return status
  }, [queries, tokensByChain])

  const refetch = () => {
    queries.forEach((q) => {
      q.refetch()
    })
  }
  return {
    data,
    isLoading,
    isError,
    isSuccess,
    error,
    refetch,
    chainLoadingStatus,
    chainSuccessStatus,
    chainErrorStatus
  }
}
