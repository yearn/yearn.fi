import { type UseQueryOptions, useQuery } from '@tanstack/react-query'
import type { TAddress } from '../types/address'
import type { TToken } from '../types/mixed'
import { toAddress } from '../utils/tools.address'
import { isZeroAddress } from '../utils/tools.is'
import { getBalances, type TUseBalancesTokens } from './useBalances.multichains'
import { getChainCacheConfig } from './balanceQueryConfig'

/*******************************************************************************
 ** Query key factory for consistent cache key generation
 ******************************************************************************/
export const balanceQueryKeys = {
  all: ['balances'] as const,
  byChain: (chainId: number) => [...balanceQueryKeys.all, 'chain', chainId] as const,
  byChainAndUser: (chainId: number, userAddress?: TAddress) =>
    [...balanceQueryKeys.byChain(chainId), 'user', toAddress(userAddress)] as const,
  byToken: (chainId: number, userAddress: TAddress | undefined, tokenAddress: TAddress) =>
    [...balanceQueryKeys.byChainAndUser(chainId, userAddress), 'token', toAddress(tokenAddress)] as const,
  byTokens: (chainId: number, userAddress: TAddress | undefined, tokenAddresses: TAddress[]) =>
    [
      ...balanceQueryKeys.byChainAndUser(chainId, userAddress),
      'tokens',
      tokenAddresses.map(toAddress).toSorted().join(',')
    ] as const
}

/*******************************************************************************
 ** Query function for fetching a single token balance
 ******************************************************************************/
async function fetchTokenBalance(
  chainId: number,
  userAddress: TAddress | undefined,
  token: TUseBalancesTokens
): Promise<TToken | null> {
  if (!userAddress || isZeroAddress(userAddress) || isZeroAddress(token.address)) {
    return null
  }
  const [balances, error] = await getBalances(chainId, userAddress, [token], false)

  if (error) {
    throw error
  }

  return balances[toAddress(token.address)] || null
}

/*******************************************************************************
 ** Hook for fetching a single token balance using TanStack Query
 ******************************************************************************/
export function useBalanceQuery(
  chainId: number,
  userAddress: TAddress | undefined,
  token: TUseBalancesTokens,
  options?: Omit<
    UseQueryOptions<TToken | null, Error, TToken | null, ReturnType<typeof balanceQueryKeys.byToken>>,
    'queryKey' | 'queryFn'
  >
) {
  const cacheConfig = getChainCacheConfig(chainId)

  return useQuery({
    queryKey: balanceQueryKeys.byToken(chainId, userAddress, token.address),
    queryFn: () => fetchTokenBalance(chainId, userAddress, token),
    enabled: Boolean(userAddress && !isZeroAddress(userAddress) && !isZeroAddress(token.address)),
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options
  })
}

/*******************************************************************************
 ** Query function for fetching multiple token balances
 ******************************************************************************/
async function fetchTokenBalances(
  chainId: number,
  userAddress: TAddress | undefined,
  tokens: TUseBalancesTokens[]
): Promise<Record<TAddress, TToken>> {
  if (!userAddress || isZeroAddress(userAddress) || tokens.length === 0) {
    return {}
  }

  const validTokens = tokens.filter((token) => !isZeroAddress(token.address))

  if (validTokens.length === 0) {
    return {}
  }
  const [balances, error] = await getBalances(chainId, userAddress, validTokens, false)

  if (error) {
    throw error
  }

  return balances
}

/*******************************************************************************
 ** Hook for fetching multiple token balances using TanStack Query
 ******************************************************************************/
export function useBalancesQuery(
  chainId: number,
  userAddress: TAddress | undefined,
  tokens: TUseBalancesTokens[],
  options?: Omit<
    UseQueryOptions<
      Record<TAddress, TToken>,
      Error,
      Record<TAddress, TToken>,
      ReturnType<typeof balanceQueryKeys.byTokens>
    >,
    'queryKey' | 'queryFn'
  >
) {
  const cacheConfig = getChainCacheConfig(chainId)
  const tokenAddresses = tokens.map((t) => t.address)

  return useQuery({
    queryKey: balanceQueryKeys.byTokens(chainId, userAddress, tokenAddresses),
    queryFn: () => fetchTokenBalances(chainId, userAddress, tokens),
    enabled: Boolean(userAddress && !isZeroAddress(userAddress) && tokens.length > 0),
    staleTime: cacheConfig.staleTime,
    gcTime: cacheConfig.gcTime,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options
  })
}
