import { useDeepCompareMemo } from '@react-hookz/web'
import { type UseQueryOptions, useQueries } from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'
import { resolveExecutionChainId } from '@/config/tenderly'
import type { TAddress } from '../types/address'
import type { TChainTokens, TDict, TNDict, TToken } from '../types/mixed'
import { isZeroAddress } from '../utils/tools.is'
import { getChainConfig } from './balanceQueryConfig'
import { getBalances, type TUseBalancesTokens } from './useBalances.multichains'
import { mergeStagedQueryData, partitionTokensByQueryStage } from './useBalancesQueries.helpers'
import { balanceQueryKeys } from './useBalancesQuery'

type TBalanceQueryOptions = UseQueryOptions<
  TDict<TToken>,
  Error,
  TDict<TToken>,
  ReturnType<typeof balanceQueryKeys.byTokens>
>

function buildBalanceQueryOptions(
  tokensByChain: TNDict<TUseBalancesTokens[]>,
  userAddress: TAddress | undefined,
  enabled: boolean
): TBalanceQueryOptions[] {
  return Object.entries(tokensByChain).map(([chainIdStr, chainTokens]) => {
    const chainId = Number(chainIdStr)
    const executionChainId = resolveExecutionChainId(chainId)
    const config = getChainConfig(chainId)
    const tokenAddresses = chainTokens.map((t) => t.address)
    const queryKey = balanceQueryKeys.byTokens(chainId, executionChainId, userAddress, tokenAddresses)

    return {
      queryKey,
      queryFn: () => fetchTokenBalances(chainId, userAddress, chainTokens),
      enabled: Boolean(enabled && userAddress && !isZeroAddress(userAddress) && chainTokens.length > 0),
      staleTime: config.cache.staleTime,
      gcTime: config.cache.gcTime,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  })
}

/*******************************************************************************
 ** Fetch token balances for a chain
 ******************************************************************************/
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
  const { priorityTokensByChain, secondaryTokensByChain } = useDeepCompareMemo(
    () => partitionTokensByQueryStage(tokens, options?.priorityChainId),
    [tokens, options?.priorityChainId]
  )
  const isBaseEnabled = Boolean(options?.enabled !== false && userAddress && !isZeroAddress(userAddress))
  const priorityChainIds = useMemo(() => Object.keys(priorityTokensByChain).map(Number), [priorityTokensByChain])
  const secondaryChainIds = useMemo(() => Object.keys(secondaryTokensByChain).map(Number), [secondaryTokensByChain])

  const priorityQueryOptions = useDeepCompareMemo(
    () => buildBalanceQueryOptions(priorityTokensByChain, userAddress, isBaseEnabled),
    [priorityTokensByChain, userAddress, isBaseEnabled]
  )
  const priorityQueries = useQueries({
    queries: priorityQueryOptions
  })
  const hasPriorityQueries = priorityQueryOptions.length > 0
  const areSecondaryChainsEnabled =
    !hasPriorityQueries || priorityQueries.every((query) => query.isSuccess || query.isError)

  const secondaryQueryOptions = useDeepCompareMemo(
    () => buildBalanceQueryOptions(secondaryTokensByChain, userAddress, isBaseEnabled && areSecondaryChainsEnabled),
    [secondaryTokensByChain, userAddress, isBaseEnabled, areSecondaryChainsEnabled]
  )
  const secondaryQueries = useQueries({
    queries: secondaryQueryOptions
  })
  const priorityQueryData = priorityQueries.map((query) => query.data)
  const secondaryQueryData = secondaryQueries.map((query) => query.data)
  const dataRef = useRef<TChainTokens>({})

  const data = useMemo(() => {
    dataRef.current = mergeStagedQueryData({
      previousData: dataRef.current,
      priorityChainIds,
      priorityQueryData,
      secondaryChainIds,
      secondaryQueryData
    })

    return dataRef.current
  }, [priorityChainIds, priorityQueryData, secondaryChainIds, secondaryQueryData])

  const queries = useMemo(() => [...priorityQueries, ...secondaryQueries], [priorityQueries, secondaryQueries])
  const chainIds = useMemo(() => [...priorityChainIds, ...secondaryChainIds], [priorityChainIds, secondaryChainIds])

  // Aggregate status
  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)
  const isSuccess = queries.every((q) => q.isSuccess)
  const error = queries.find((q) => q.error)?.error || null

  // Chain-specific status - consolidated into single memo
  const { chainLoadingStatus, chainSuccessStatus, chainErrorStatus } = useMemo(() => {
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
  }, [chainIds, queries])

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
