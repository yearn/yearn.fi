import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useWeb3 } from '../contexts/useWeb3'
import type { TChainTokens, TDict, TToken } from '../types/mixed'
import { isZeroAddress } from '../utils/tools.is'
import type { TChainStatus, TUseBalancesReq, TUseBalancesRes, TUseBalancesTokens } from './useBalances.multichains'
import { fetchTokenBalancesWithRateLimit, useBalancesQueries } from './useBalancesQueries'
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
        refetch()
      }

      return balances
    },
    [balances, refetch]
  )

  /***************************************************************************
   ** onUpdateSome takes a list of tokens and updates only those balances
   **************************************************************************/
  // const onUpdateSome = useCallback(
  //   async (tokenList: TUseBalancesTokens[], shouldForceFetch?: boolean) => {
  //     const validTokens = tokenList.filter(({ address }) => !isZeroAddress(address))
  //     if (validTokens.length === 0) return
  //     const tokensByChain: Record<number, TUseBalancesTokens[]> = {}
  //     for (const token of validTokens) {
  //       if (!tokensByChain[token.chainID]) {
  //         tokensByChain[token.chainID] = []
  //       }
  //       tokensByChain[token.chainID].push(token)
  //     }
  //     for (const [chainIdStr, chainTokens] of Object.entries(tokensByChain)) {
  //       const chainId = Number(chainIdStr)
  //       const tokenAddresses = chainTokens.map((t) => t.address)
  //       const freshBalances = await fetchTokenBalancesWithRateLimit(chainId, userAddress, chainTokens, shouldForceFetch)
  //       console.log('freshBalances', freshBalances)
  //       // Merge into cache
  //       const setQueryData = queryClient.setQueryData<TDict<TToken>>(
  //         balanceQueryKeys.byTokens(chainId, userAddress, tokenAddresses),
  //         (oldBalances = {}) => ({
  //           ...oldBalances,
  //           ...freshBalances
  //         })
  //       )
  //       console.log('setQueryData', setQueryData)
  //       // Optionally invalidate broader cache if needed
  //       const data = queryClient.invalidateQueries({
  //         queryKey: balanceQueryKeys.byChainAndUser(chainId, userAddress),
  //         exact: false
  //       })
  //       console.log('data', await data)
  //     }
  //   },
  //   [queryClient, userAddress]
  // )

  const onUpdateSome = useCallback(
    async (tokenList: TUseBalancesTokens[], shouldForceFetch?: boolean): Promise<TChainTokens> => {
      const validTokens = tokenList.filter(({ address }) => !isZeroAddress(address))
      if (validTokens.length === 0) return {}
      console.info('onUpdateSome called with:', {
        tokenList: tokenList.map(t => ({ address: t.address, chainID: t.chainID, symbol: t.symbol })),
        shouldForceFetch,
        userAddress
      })
      
      // Group tokens by chain
      const tokensByChain: Record<number, TUseBalancesTokens[]> = {}
      for (const token of validTokens) {
        if (!tokensByChain[token.chainID]) {
          tokensByChain[token.chainID] = []
        }
        tokensByChain[token.chainID].push(token)
      }
      
      const updatedBalances: TChainTokens = {}

      // Process each chain's tokens
      for (const [chainIdStr, chainTokens] of Object.entries(tokensByChain)) {
        const chainId = Number(chainIdStr)
        console.info(`Fetching balances for chain ${chainId}, tokens:`, chainTokens.map(t => t.symbol))
        
        // Fetch fresh balances for the requested tokens
        const freshBalances = await fetchTokenBalancesWithRateLimit(chainId, userAddress, chainTokens, true)
        console.info('Fresh balances received:', Object.keys(freshBalances).length, 'tokens')
        
        // Update ALL possible query keys that might contain these tokens
        const allQueries = queryClient.getQueriesData<TDict<TToken>>({ 
          queryKey: balanceQueryKeys.byChainAndUser(chainId, userAddress),
          exact: false
        })
        
        console.info(`Found ${allQueries.length} queries to update for chain ${chainId}`)
        
        allQueries.forEach(([queryKey, queryData]) => {
          if (queryData) {
            const updated = { ...queryData, ...freshBalances }
            queryClient.setQueryData(queryKey, updated)
            console.info('Updated query:', queryKey, 'with', Object.keys(freshBalances).length, 'fresh balances')
          }
        })
        
        // Store the updated balances for this chain
        updatedBalances[chainId] = freshBalances
      }
      
      console.info('All updates complete, returning updatedBalances')
      return updatedBalances
    },
    [queryClient, userAddress]
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
