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
    async (tokenList: TUseBalancesTokens[], shouldForceFetch?: boolean) => {
      const validTokens = tokenList.filter(({ address }) => !isZeroAddress(address))
      if (validTokens.length === 0) return
      console.info('onUpdateSome')
      // Group tokens by chain
      const tokensByChain: Record<number, TUseBalancesTokens[]> = {}
      for (const token of validTokens) {
        if (!tokensByChain[token.chainID]) {
          tokensByChain[token.chainID] = []
        }
        tokensByChain[token.chainID].push(token)
      }

      for (const [chainIdStr, chainTokens] of Object.entries(tokensByChain)) {
        const chainId = Number(chainIdStr)

        const freshBalances = await fetchTokenBalancesWithRateLimit(chainId, userAddress, chainTokens, shouldForceFetch)

        const allChainTokens = tokens.filter((t) => t.chainID === chainId)
        const fullKey = balanceQueryKeys.byTokens(
          chainId,
          userAddress,
          allChainTokens.map((t) => t.address)
        )

        queryClient.setQueryData<TDict<TToken>>(fullKey, (oldBalances = {}) => ({
          ...oldBalances,
          ...freshBalances
        }))
      }
    },
    [queryClient, userAddress, tokens]
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
