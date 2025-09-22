import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useWeb3 } from '../contexts/useWeb3'
import type { TChainTokens } from '../types/mixed'
import { isZeroAddress } from '../utils/tools.is'
import type { TChainStatus, TUseBalancesReq, TUseBalancesRes, TUseBalancesTokens } from './useBalances.multichains'
import { getBalances } from './useBalances.multichains'
import { useBalancesQueries } from './useBalancesQueries'
import { balanceQueryKeys } from './useBalancesQuery'

/*******************************************************************************
 ** This hook provides the same interface as useBalances but uses TanStack Query
 ** under the hood for better caching and request management.
 ******************************************************************************/
export function useBalancesWithQuery(props?: TUseBalancesReq): TUseBalancesRes {
  const { address: userAddress } = useWeb3()
  const queryClient = useQueryClient()

  const tokens = useMemo(() => props?.tokens || [], [props?.tokens])

  // Use the new TanStack Query hook
  const {
    data: balances,
    isLoading,
    isError,
    isSuccess,
    error,
    refetch,
    chainLoadingStatus,
    chainSuccessStatus,
    chainErrorStatus
  } = useBalancesQueries(userAddress, tokens, {
    priorityChainId: props?.priorityChainID,
    enabled: tokens.length > 0
  })

  /***************************************************************************
   ** onUpdate will refetch all balances, with optional force refresh
   **************************************************************************/
  const onUpdate = useCallback(
    async (shouldForceFetch?: boolean): Promise<TChainTokens> => {
      if (shouldForceFetch) {
        // Invalidate all balance queries to force a fresh fetch
        await queryClient.invalidateQueries({
          queryKey: balanceQueryKeys.byChainAndUser(1, userAddress),
          exact: false
        })
      }

      refetch()
      return balances
    },
    [queryClient, userAddress, refetch, balances]
  )

  /***************************************************************************
   ** onUpdateSome takes a list of tokens and updates only those balances
   **************************************************************************/
  const onUpdateSome = useCallback(
    async (tokenList: TUseBalancesTokens[], shouldForceFetch?: boolean): Promise<TChainTokens> => {
      const validTokens = tokenList.filter(({ address }) => !isZeroAddress(address))

      if (validTokens.length === 0) {
        return balances
      }

      // Group tokens by chain
      const tokensByChain: Record<number, TUseBalancesTokens[]> = {}
      for (const token of validTokens) {
        if (!tokensByChain[token.chainID]) {
          tokensByChain[token.chainID] = []
        }
        tokensByChain[token.chainID].push(token)
      }

      // Create a copy of current balances to update
      const updatedBalances: TChainTokens = { ...balances }

      // Fetch updated balances for each chain
      for (const [chainIdStr, chainTokens] of Object.entries(tokensByChain)) {
        const chainId = Number(chainIdStr)
        const tokenAddresses = chainTokens.map((t) => t.address)

        if (shouldForceFetch) {
          await queryClient.invalidateQueries({
            queryKey: balanceQueryKeys.byTokens(chainId, userAddress, tokenAddresses),
            exact: true
          })
        }

        // Fetch fresh balances for this chain's tokens
        const freshBalances = await queryClient.fetchQuery({
          queryKey: balanceQueryKeys.byTokens(chainId, userAddress, tokenAddresses),
          queryFn: async () => {
            const [fetchedBalances, error] = await getBalances(chainId, userAddress, chainTokens, false)
            console.log('fetchedBalances', fetchedBalances)
            console.log('error', error)
            if (error) {
              throw error
            }
            return fetchedBalances
          },
          staleTime: 0 // Force fresh fetch
        })
        console.log('freshBalances', freshBalances)
        // Update the balances for this chain
        updatedBalances[chainId] = {
          ...(updatedBalances[chainId] || {}),
          ...freshBalances
        }

        // IMPORTANT: Invalidate all balance queries for this chain and user
        // This is more reliable than trying to manually update cache keys
        // React Query will automatically refetch the invalidated queries
        await queryClient.invalidateQueries({
          queryKey: balanceQueryKeys.byChainAndUser(chainId, userAddress),
          exact: false
        })
      }
      console.log('updatedBalances', updatedBalances)
      return updatedBalances
    },
    [queryClient, userAddress, balances, tokens]
  )

  // Determine overall status
  const status = useMemo((): 'error' | 'loading' | 'success' | 'unknown' => {
    if (isError) return 'error'
    if (isLoading) return 'loading'
    if (isSuccess) return 'success'
    return 'unknown'
  }, [isError, isLoading, isSuccess])

  // Build chain status object
  const chainStatus = useMemo(
    (): TChainStatus => ({
      chainLoadingStatus,
      chainSuccessStatus,
      chainErrorStatus
    }),
    [chainLoadingStatus, chainSuccessStatus, chainErrorStatus]
  )

  // Return the same interface as useBalances
  return {
    data: balances,
    onUpdate,
    onUpdateSome,
    error: error || undefined,
    status,
    isLoading,
    isSuccess,
    isError,
    ...chainStatus
  }
}
