import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useWeb3 } from '../contexts/useWeb3'
import type { TChainTokens, TDict, TToken } from '../types/mixed'
import { toAddress } from '../utils/tools.address'
import { isZeroAddress } from '../utils/tools.is'
import type { TChainStatus, TUseBalancesReq, TUseBalancesRes, TUseBalancesTokens } from './useBalances.multichains'
import { fetchTokenBalances } from './useBalancesQueries'
import { balanceQueryKeys } from './useBalancesQuery'
import { useEnsoBalances } from './useEnsoBalances'

/*******************************************************************************
 ** Combined balance hook that uses Enso API as primary source
 ** and falls back to multicall for specific token updates
 **
 ** Benefits:
 ** - Single API call for all chains vs multiple RPC multicalls
 ** - Includes USD prices from Enso
 ** - Reduces RPC load significantly
 ** - Falls back to multicall for tokens Enso doesn't track
 ******************************************************************************/
export function useBalancesCombined(props?: TUseBalancesReq): TUseBalancesRes {
  const { address: userAddress } = useWeb3()
  const queryClient = useQueryClient()

  const tokens = useMemo(() => (userAddress ? props?.tokens || [] : []), [props?.tokens, userAddress])

  const {
    data: ensoBalances,
    isLoading,
    isError,
    isSuccess,
    error,
    refetch,
    chainLoadingStatus,
    chainSuccessStatus,
    chainErrorStatus
  } = useEnsoBalances(userAddress, {
    // Don't pass chainId - fetch all chains at once
    enabled: tokens.length > 0
  })

  const balances = useMemo(() => {
    console.log('[Combined] Computing balances', {
      ensoBalancesKeys: Object.keys(ensoBalances || {}),
      tokensCount: tokens.length,
      isLoading,
      isSuccess,
      isError
    })

    if (!ensoBalances || Object.keys(ensoBalances).length === 0) {
      console.log('[Combined] No enso balances yet, returning empty')
      return {}
    }

    const result: TChainTokens = {}
    let matchCount = 0

    for (const token of tokens) {
      const chainId = token.chainID
      const tokenAddress = toAddress(token.address)

      if (!result[chainId]) {
        result[chainId] = {}
      }

      const ensoToken = ensoBalances[chainId]?.[tokenAddress]
      if (ensoToken) {
        result[chainId][tokenAddress] = ensoToken
        matchCount++
      }
    }

    console.log('[Combined] Matched', matchCount, 'of', tokens.length, 'requested tokens')

    return result
  }, [ensoBalances, tokens, isLoading, isSuccess, isError])

  const onUpdate = useCallback(
    async (shouldForceFetch?: boolean): Promise<TChainTokens> => {
      if (shouldForceFetch) {
        refetch()
      }
      return balances
    },
    [balances, refetch]
  )

  const onUpdateSome = useCallback(
    async (tokenList: TUseBalancesTokens[]): Promise<TChainTokens> => {
      const validTokens = tokenList.filter(({ address }) => !isZeroAddress(address))
      if (validTokens.length === 0) return {}

      const tokensByChain: Record<number, TUseBalancesTokens[]> = {}
      for (const token of validTokens) {
        if (!tokensByChain[token.chainID]) {
          tokensByChain[token.chainID] = []
        }
        tokensByChain[token.chainID].push(token)
      }

      const updatedBalances: TChainTokens = {}

      for (const [chainIdStr, chainTokens] of Object.entries(tokensByChain)) {
        const chainId = Number(chainIdStr)

        const freshBalances = await fetchTokenBalances(chainId, userAddress, chainTokens, true)

        const allQueries = queryClient.getQueriesData<TDict<TToken>>({
          queryKey: balanceQueryKeys.byChainAndUser(chainId, userAddress),
          exact: false
        })

        allQueries.forEach(([queryKey, queryData]) => {
          if (queryData) {
            const updated = { ...queryData, ...freshBalances }
            queryClient.setQueryData(queryKey, updated)
          }
        })

        updatedBalances[chainId] = freshBalances
      }

      return updatedBalances
    },
    [queryClient, userAddress]
  )

  const status = useMemo((): 'error' | 'loading' | 'success' | 'unknown' => {
    if (isError) return 'error'
    if (isLoading) return 'loading'
    if (isSuccess) return 'success'
    return 'unknown'
  }, [isError, isLoading, isSuccess])

  const chainStatus = useMemo(
    (): TChainStatus => ({
      chainLoadingStatus,
      chainSuccessStatus,
      chainErrorStatus
    }),
    [chainLoadingStatus, chainSuccessStatus, chainErrorStatus]
  )

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
