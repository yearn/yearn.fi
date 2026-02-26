import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useWeb3 } from '../contexts/useWeb3'
import type { TChainTokens, TDict, TNDict, TToken } from '../types/mixed'
import { toAddress } from '../utils/tools.address'
import { isZeroAddress } from '../utils/tools.is'
import type { TChainStatus, TUseBalancesReq, TUseBalancesRes, TUseBalancesTokens } from './useBalances.multichains'
import { fetchTokenBalances, useBalancesQueries } from './useBalancesQueries'
import { balanceQueryKeys } from './useBalancesQuery'
import { ENSO_UNSUPPORTED_NETWORKS, useEnsoBalances } from './useEnsoBalances'

/*******************************************************************************
 ** Combined balance hook that uses Enso API for supported chains
 ** and falls back to multicall (RPC) for unsupported chains like Fantom
 **
 ** Benefits:
 ** - Enso API for fast bulk fetches on supported chains
 ** - Multicall fallback ensures all chains work
 ** - Includes USD prices from Enso where available
 ** - Reduces RPC load on supported chains
 ******************************************************************************/
export function useBalancesCombined(props?: TUseBalancesReq): TUseBalancesRes {
  const { address: userAddress } = useWeb3()
  const queryClient = useQueryClient()

  const tokens = useMemo(() => (userAddress ? props?.tokens || [] : []), [props?.tokens, userAddress])

  // Split tokens into Enso-supported and multicall-required groups
  const { ensoTokens, multicallTokens } = useMemo(() => {
    const enso: TUseBalancesTokens[] = []
    const multicall: TUseBalancesTokens[] = []

    for (const token of tokens) {
      const isStakingPositionToken = token.for === 'staking'
      if (isStakingPositionToken || ENSO_UNSUPPORTED_NETWORKS.includes(token.chainID)) {
        multicall.push(token)
      } else {
        enso.push(token)
      }
    }

    return { ensoTokens: enso, multicallTokens: multicall }
  }, [tokens])

  // Fetch from Enso for supported chains
  const {
    data: ensoBalances,
    isLoading: ensoLoading,
    isError: ensoError,
    isSuccess: ensoSuccess,
    error: ensoErrorObj,
    refetch: ensoRefetch,
    chainLoadingStatus: ensoChainLoading,
    chainSuccessStatus: ensoChainSuccess,
    chainErrorStatus: ensoChainError
  } = useEnsoBalances(userAddress, {
    enabled: ensoTokens.length > 0
  })

  // Fallback to multicall for unsupported chains and tokens missing from Enso results.
  const fallbackTokens = useMemo(() => {
    const fallback: TUseBalancesTokens[] = [...multicallTokens]

    if (ensoError) {
      fallback.push(...ensoTokens)
      return fallback
    }

    if (!ensoBalances) {
      return fallback
    }

    for (const token of ensoTokens) {
      const chainId = token.chainID
      const tokenAddress = toAddress(token.address)
      if (!ensoBalances[chainId]?.[tokenAddress]) {
        fallback.push(token)
      }
    }

    return fallback
  }, [multicallTokens, ensoError, ensoTokens, ensoBalances])

  // Fetch fallback balances via multicall RPC.
  const {
    data: multicallBalances,
    isLoading: multicallLoading,
    isError: multicallError,
    isSuccess: multicallSuccess,
    error: multicallErrorObj,
    refetch: multicallRefetch,
    chainLoadingStatus: multicallChainLoading,
    chainSuccessStatus: multicallChainSuccess,
    chainErrorStatus: multicallChainError
  } = useBalancesQueries(userAddress, fallbackTokens, {
    enabled: fallbackTokens.length > 0
  })

  // Merge balances from both sources
  const balances = useMemo(() => {
    const hasEnsoData = ensoTokens.length > 0
    const hasMulticallData = fallbackTokens.length > 0

    const result: TChainTokens = {}

    // Process Enso-supported tokens
    if (hasEnsoData && ensoBalances) {
      for (const token of ensoTokens) {
        const chainId = token.chainID
        const tokenAddress = toAddress(token.address)

        if (!result[chainId]) {
          result[chainId] = {}
        }

        const ensoToken = ensoBalances[chainId]?.[tokenAddress]
        if (ensoToken) {
          result[chainId][tokenAddress] = ensoToken
        }
      }
    }

    // Process multicall fallback tokens (unsupported chains + Enso misses)
    if (hasMulticallData && multicallBalances) {
      for (const token of fallbackTokens) {
        const chainId = token.chainID
        const tokenAddress = toAddress(token.address)

        if (!result[chainId]) {
          result[chainId] = {}
        }

        const multicallToken = multicallBalances[chainId]?.[tokenAddress]
        if (multicallToken) {
          result[chainId][tokenAddress] = multicallToken
        }
      }
    }

    return result
  }, [ensoBalances, multicallBalances, ensoTokens, fallbackTokens])

  // Combine loading/error/success states
  const isLoading = useMemo(() => {
    const ensoRelevant = ensoTokens.length > 0
    const multicallRelevant = fallbackTokens.length > 0
    return (ensoRelevant && ensoLoading) || (multicallRelevant && multicallLoading)
  }, [ensoTokens.length, fallbackTokens.length, ensoLoading, multicallLoading])

  const isError = useMemo(() => {
    const ensoRelevant = ensoTokens.length > 0
    const multicallRelevant = fallbackTokens.length > 0
    // Only error if both sources that are relevant have errors
    const ensoFailed = ensoRelevant && ensoError
    const multicallFailed = multicallRelevant && multicallError
    // If both are relevant, both must fail. If only one is relevant, that one must fail.
    if (ensoRelevant && multicallRelevant) return ensoFailed && multicallFailed
    return ensoFailed || multicallFailed
  }, [ensoTokens.length, fallbackTokens.length, ensoError, multicallError])

  const isSuccess = useMemo(() => {
    const ensoRelevant = ensoTokens.length > 0
    const multicallRelevant = fallbackTokens.length > 0
    // Success if at least one relevant source succeeds
    const ensoOk = !ensoRelevant || ensoSuccess
    const multicallOk = !multicallRelevant || multicallSuccess
    return ensoOk && multicallOk
  }, [ensoTokens.length, fallbackTokens.length, ensoSuccess, multicallSuccess])

  const error = ensoErrorObj || multicallErrorObj || null

  // Merge chain status maps
  const chainLoadingStatus = useMemo((): TNDict<boolean> => {
    return { ...ensoChainLoading, ...multicallChainLoading }
  }, [ensoChainLoading, multicallChainLoading])

  const chainSuccessStatus = useMemo((): TNDict<boolean> => {
    return { ...ensoChainSuccess, ...multicallChainSuccess }
  }, [ensoChainSuccess, multicallChainSuccess])

  const chainErrorStatus = useMemo((): TNDict<boolean> => {
    return { ...ensoChainError, ...multicallChainError }
  }, [ensoChainError, multicallChainError])

  const refetch = useCallback(() => {
    if (ensoTokens.length > 0) ensoRefetch()
    if (fallbackTokens.length > 0) multicallRefetch()
  }, [ensoTokens.length, fallbackTokens.length, ensoRefetch, multicallRefetch])

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

        // Update multicall query cache
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

      // Also update Enso cache if we're using Enso for these chains
      const ensoQueryKey = ['enso-balances', userAddress]
      const currentEnsoData = queryClient.getQueryData<TChainTokens>(ensoQueryKey)

      if (currentEnsoData) {
        const mergedEnsoData = { ...currentEnsoData }
        for (const [chainIdStr, tokens] of Object.entries(updatedBalances)) {
          const chainId = Number(chainIdStr)
          if (!ENSO_UNSUPPORTED_NETWORKS.includes(chainId)) {
            if (!mergedEnsoData[chainId]) {
              mergedEnsoData[chainId] = {}
            }
            mergedEnsoData[chainId] = { ...mergedEnsoData[chainId], ...tokens }
          }
        }
        queryClient.setQueryData(ensoQueryKey, mergedEnsoData)
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
