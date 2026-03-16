import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { getTenderlyBackedCanonicalChainIds } from '@/config/tenderly'
import { useWeb3 } from '../contexts/useWeb3'
import type { TChainTokens, TDict, TNDict, TToken } from '../types/mixed'
import { toAddress } from '../utils/tools.address'
import { isZeroAddress } from '../utils/tools.is'
import { shouldUseDiscoveryFallbackToken } from './balanceDiscoveryFallback'
import {
  hasPositiveCachedBalance,
  type TChainStatus,
  type TUseBalancesReq,
  type TUseBalancesRes,
  type TUseBalancesTokens
} from './useBalances.multichains'
import { fetchTokenBalances, useBalancesQueries } from './useBalancesQueries'
import { balanceQueryKeys } from './useBalancesQuery'
import { partitionTokensByBalanceSource } from './useBalancesRouting'
import { ENSO_UNSUPPORTED_NETWORKS, useEnsoBalances } from './useEnsoBalances'

function mergeChainStatusMaps(...maps: TNDict<boolean>[]): TNDict<boolean> {
  const merged: TNDict<boolean> = {}

  maps.forEach((map) => {
    Object.entries(map).forEach(([chainId, value]) => {
      merged[Number(chainId)] = Boolean(merged[Number(chainId)] || value)
    })
  })

  return merged
}

function mergeBalanceSources(...sources: TChainTokens[]): TChainTokens {
  const merged: TChainTokens = {}

  sources.forEach((source) => {
    Object.entries(source).forEach(([chainIdStr, tokens]) => {
      const chainId = Number(chainIdStr)
      merged[chainId] = {
        ...(merged[chainId] || {}),
        ...tokens
      }
    })
  })

  return merged
}

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
  const ensoUnsupportedNetworks = useMemo(
    () => [...new Set([...ENSO_UNSUPPORTED_NETWORKS, ...getTenderlyBackedCanonicalChainIds()])],
    []
  )

  const tokens = useMemo(() => (userAddress ? props?.tokens || [] : []), [props?.tokens, userAddress])

  // Split tokens into Enso-supported and multicall-required groups
  const { ensoTokens, multicallTokens: requiredMulticallTokens } = useMemo(() => {
    return partitionTokensByBalanceSource(tokens, ensoUnsupportedNetworks)
  }, [ensoUnsupportedNetworks, tokens])

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

  const discoveryFallbackTokens = useMemo((): TUseBalancesTokens[] => {
    if (ensoTokens.length === 0) {
      return []
    }
    if (!userAddress) {
      return []
    }
    if (!ensoError && (!ensoSuccess || !ensoBalances)) {
      return []
    }

    return ensoTokens.filter((token) => {
      const tokenAddress = toAddress(token.address)
      const hasEnsoBalance = Boolean(ensoBalances?.[token.chainID]?.[tokenAddress])
      if (hasEnsoBalance) {
        return false
      }

      return shouldUseDiscoveryFallbackToken({
        token,
        hasPositiveBalanceCache: hasPositiveCachedBalance(token.chainID, tokenAddress, userAddress)
      })
    })
  }, [ensoBalances, ensoError, ensoSuccess, ensoTokens, userAddress])

  const {
    data: requiredMulticallBalances,
    isLoading: requiredMulticallLoading,
    isError: requiredMulticallError,
    isSuccess: requiredMulticallSuccess,
    error: requiredMulticallErrorObj,
    refetch: requiredMulticallRefetch,
    chainLoadingStatus: requiredMulticallChainLoading,
    chainSuccessStatus: requiredMulticallChainSuccess,
    chainErrorStatus: requiredMulticallChainError
  } = useBalancesQueries(userAddress, requiredMulticallTokens, {
    priorityChainId: props?.priorityChainID,
    enabled: requiredMulticallTokens.length > 0
  })

  const {
    data: discoveryFallbackBalances,
    isLoading: discoveryFallbackLoading,
    isError: discoveryFallbackError,
    isSuccess: discoveryFallbackSuccess,
    error: discoveryFallbackErrorObj,
    refetch: discoveryFallbackRefetch,
    chainLoadingStatus: discoveryFallbackChainLoading,
    chainSuccessStatus: discoveryFallbackChainSuccess,
    chainErrorStatus: discoveryFallbackChainError
  } = useBalancesQueries(userAddress, discoveryFallbackTokens, {
    priorityChainId: props?.priorityChainID,
    enabled: discoveryFallbackTokens.length > 0
  })

  // Merge balances from both sources
  const balances = useMemo(() => {
    return mergeBalanceSources(ensoBalances, requiredMulticallBalances, discoveryFallbackBalances)
  }, [discoveryFallbackBalances, ensoBalances, requiredMulticallBalances])

  // Combine loading/error/success states
  const isLoading = useMemo(() => {
    const ensoRelevant = ensoTokens.length > 0
    const requiredMulticallRelevant = requiredMulticallTokens.length > 0
    const discoveryRelevant = discoveryFallbackTokens.length > 0
    return (
      (ensoRelevant && ensoLoading) ||
      (requiredMulticallRelevant && requiredMulticallLoading) ||
      (discoveryRelevant && discoveryFallbackLoading)
    )
  }, [
    discoveryFallbackLoading,
    discoveryFallbackTokens.length,
    ensoLoading,
    ensoTokens.length,
    requiredMulticallLoading,
    requiredMulticallTokens.length
  ])

  const isError = useMemo(() => {
    const ensoRelevant = ensoTokens.length > 0
    const requiredMulticallRelevant = requiredMulticallTokens.length > 0
    const discoveryRelevant = discoveryFallbackTokens.length > 0
    return (
      (ensoRelevant && ensoError) ||
      (requiredMulticallRelevant && requiredMulticallError) ||
      (discoveryRelevant && discoveryFallbackError)
    )
  }, [
    discoveryFallbackError,
    discoveryFallbackTokens.length,
    ensoError,
    ensoTokens.length,
    requiredMulticallError,
    requiredMulticallTokens.length
  ])

  const isSuccess = useMemo(() => {
    const ensoRelevant = ensoTokens.length > 0
    const requiredMulticallRelevant = requiredMulticallTokens.length > 0
    const discoveryRelevant = discoveryFallbackTokens.length > 0
    const ensoOk = !ensoRelevant || ensoSuccess
    const requiredMulticallOk = !requiredMulticallRelevant || requiredMulticallSuccess
    const discoveryOk = !discoveryRelevant || discoveryFallbackSuccess
    return ensoOk && requiredMulticallOk && discoveryOk
  }, [
    discoveryFallbackSuccess,
    discoveryFallbackTokens.length,
    ensoSuccess,
    ensoTokens.length,
    requiredMulticallSuccess,
    requiredMulticallTokens.length
  ])

  const error = discoveryFallbackErrorObj || requiredMulticallErrorObj || ensoErrorObj || null

  // Merge chain status maps
  const chainLoadingStatus = useMemo((): TNDict<boolean> => {
    return mergeChainStatusMaps(ensoChainLoading, requiredMulticallChainLoading, discoveryFallbackChainLoading)
  }, [discoveryFallbackChainLoading, ensoChainLoading, requiredMulticallChainLoading])

  const chainSuccessStatus = useMemo((): TNDict<boolean> => {
    return mergeChainStatusMaps(ensoChainSuccess, requiredMulticallChainSuccess, discoveryFallbackChainSuccess)
  }, [discoveryFallbackChainSuccess, ensoChainSuccess, requiredMulticallChainSuccess])

  const chainErrorStatus = useMemo((): TNDict<boolean> => {
    return mergeChainStatusMaps(ensoChainError, requiredMulticallChainError, discoveryFallbackChainError)
  }, [discoveryFallbackChainError, ensoChainError, requiredMulticallChainError])

  const refetch = useCallback(() => {
    if (ensoTokens.length > 0) ensoRefetch()
    if (requiredMulticallTokens.length > 0) requiredMulticallRefetch()
    if (discoveryFallbackTokens.length > 0) discoveryFallbackRefetch()
  }, [
    discoveryFallbackRefetch,
    discoveryFallbackTokens.length,
    ensoRefetch,
    ensoTokens.length,
    requiredMulticallRefetch,
    requiredMulticallTokens.length
  ])

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
          if (!ensoUnsupportedNetworks.includes(chainId)) {
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
    [ensoUnsupportedNetworks, queryClient, userAddress]
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
