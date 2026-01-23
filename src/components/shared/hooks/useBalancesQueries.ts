import { useDeepCompareMemo } from '@react-hookz/web'
import { type UseQueryOptions, useQueries } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { TAddress } from '../types/address'
import type { TChainTokens, TDict, TNDict, TToken } from '../types/mixed'
import { toAddress } from '../utils/tools.address'
import { isZeroAddress } from '../utils/tools.is'
import { getChainConfig } from './balanceQueryConfig'
import { getBalances, type TUseBalancesTokens } from './useBalances.multichains'
import { balanceQueryKeys } from './useBalancesQuery'

/*******************************************************************************
 ** Fetch token balances for a chain
 ******************************************************************************/
export type TFetchTokenBalancesResult = {
  balances: TDict<TToken>
  rpcCalls: number
  contractCalls: number
}

export async function fetchTokenBalances(
  chainId: number,
  userAddress: TAddress | undefined,
  tokens: TUseBalancesTokens[],
  shouldForceFetch: boolean = false
): Promise<TDict<TToken>> {
  if (!userAddress || isZeroAddress(userAddress) || tokens.length === 0) {
    return {}
  }

  const validTokens = tokens.filter((token) => !isZeroAddress(token.address))
  if (validTokens.length === 0) {
    return {}
  }

  const startTime = performance.now()
  const [balances, error, stats] = await getBalances(chainId, userAddress, validTokens, shouldForceFetch)
  const duration = performance.now() - startTime

  if (error) {
    throw error
  }

  const tokenCount = Object.keys(balances).length
  const rpcCalls = stats?.rpcCalls ?? 1
  const contractCalls = stats?.contractCalls ?? 0
  console.log(
    `[Multicall] Chain ${chainId}: ${tokenCount} tokens, ${contractCalls} calls in ${rpcCalls} RPC request(s), ${duration.toFixed(0)}ms`
  )

  // Store stats for aggregation
  ;(fetchTokenBalances as any).__lastStats = {
    ...(fetchTokenBalances as any).__lastStats,
    [chainId]: { rpcCalls, contractCalls }
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
  // Group tokens by chainId - use deep comparison to prevent unnecessary recalculation
  const tokensByChain = useDeepCompareMemo(() => {
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

  // Memoize the queries array to prevent recreation
  const queryOptions = useDeepCompareMemo(() => {
    return Object.entries(tokensByChain).map(([chainIdStr, chainTokens]) => {
      const chainId = Number(chainIdStr)
      const config = getChainConfig(chainId)
      const tokenAddresses = chainTokens.map((t) => t.address)
      const queryKey = balanceQueryKeys.byTokens(chainId, userAddress, tokenAddresses)

      const queryOption: UseQueryOptions<
        TDict<TToken>,
        Error,
        TDict<TToken>,
        ReturnType<typeof balanceQueryKeys.byTokens>
      > = {
        queryKey,
        queryFn: () => fetchTokenBalances(chainId, userAddress, chainTokens),
        enabled: Boolean(
          options?.enabled !== false && userAddress && !isZeroAddress(userAddress) && chainTokens.length > 0
        ),
        staleTime: config.cache.staleTime,
        gcTime: config.cache.gcTime,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false, // Don't refetch on mount if data exists
        refetchOnReconnect: false, // Don't refetch on reconnect
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
      }

      return queryOption
    })
  }, [tokensByChain, userAddress, options?.enabled])

  // Create queries for each chain
  const queries = useQueries({
    queries: queryOptions
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

  // Performance logging
  const fetchStartTime = useRef<number | null>(null)
  const hasLoggedSummary = useRef(false)

  useEffect(() => {
    if (isLoading && fetchStartTime.current === null) {
      fetchStartTime.current = performance.now()
      hasLoggedSummary.current = false
      ;(fetchTokenBalances as any).__lastStats = {}
    }

    if (isSuccess && !hasLoggedSummary.current && fetchStartTime.current !== null) {
      const duration = performance.now() - fetchStartTime.current
      const chainCount = Object.keys(data).length
      const tokenCount = Object.values(data).reduce((acc, tokens) => acc + Object.keys(tokens).length, 0)

      const stats = (fetchTokenBalances as any).__lastStats || {}
      const totalRpcCalls = Object.values(stats).reduce((acc: number, s: any) => acc + (s?.rpcCalls || 0), 0)
      const totalContractCalls = Object.values(stats).reduce((acc: number, s: any) => acc + (s?.contractCalls || 0), 0)

      console.log(
        `[Multicall] Total: ${tokenCount} tokens across ${chainCount} chains, ${totalContractCalls} calls in ${totalRpcCalls} RPC request(s), ${duration.toFixed(0)}ms`
      )

      hasLoggedSummary.current = true
      fetchStartTime.current = null
    }
  }, [isLoading, isSuccess, data])

  // Chain-specific status - consolidated into single memo
  const { chainLoadingStatus, chainSuccessStatus, chainErrorStatus } = useMemo(() => {
    const chainIds = Object.keys(tokensByChain).map(Number)
    const loading: TNDict<boolean> = {}
    const success: TNDict<boolean> = {}
    const error: TNDict<boolean> = {}

    queries.forEach((query, index) => {
      const chainId = chainIds[index]
      loading[chainId] = query.isLoading
      success[chainId] = query.isSuccess
      error[chainId] = query.isError
    })

    return { chainLoadingStatus: loading, chainSuccessStatus: success, chainErrorStatus: error }
  }, [queries, tokensByChain])

  const refetch = useCallback(() => {
    queries.forEach((q) => {
      q.refetch()
    })
  }, [queries])

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
