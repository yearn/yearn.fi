import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { TAddress } from '../types/address'
import type { TChainTokens, TNDict } from '../types/mixed'
import { toNormalizedBN } from '../utils/format'
import { toAddress } from '../utils/tools.address'
import { isZeroAddress } from '../utils/tools.is'
import { getBalanceQueryRefetchConfig } from './balanceQueryConfig'

/*******************************************************************************
 ** Enso API response types
 ******************************************************************************/
type TEnsoBalanceResponse = {
  token: TAddress
  amount: string
  chainId: number
  decimals: number
  price: string
  name: string
  symbol: string
  logoUri: string
}

/*******************************************************************************
 ** Enso API configuration - uses server proxy to handle auth
 ******************************************************************************/
export const ENSO_UNSUPPORTED_NETWORKS = [250]

/*******************************************************************************
 ** Fetch balances from Enso API for a given address
 ** Uses chainId=all to fetch all chains in a single request
 ******************************************************************************/
async function fetchEnsoBalances(address: TAddress): Promise<TEnsoBalanceResponse[]> {
  const params = new URLSearchParams({ eoaAddress: address })
  const url = `/api/enso/balances?${params}`
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    let details = ''
    try {
      details = await response.text()
    } catch {
      // ignore body parsing errors
    }
    const suffix = details ? `: ${details}` : ''
    throw new Error(`Enso balances request failed (${response.status})${suffix}`)
  }

  const balances: TEnsoBalanceResponse[] = await response.json()

  // Filter out unsupported networks (e.g., Fantom)
  return balances.filter((balance) => !ENSO_UNSUPPORTED_NETWORKS.includes(balance.chainId))
}

/*******************************************************************************
 ** Transform Enso response to TChainTokens format
 ******************************************************************************/
function transformEnsoResponse(balances: TEnsoBalanceResponse[]): TChainTokens {
  const result: TChainTokens = {}

  for (const balance of balances) {
    const chainId = balance.chainId
    const tokenAddress = toAddress(balance.token)

    if (!result[chainId]) {
      result[chainId] = {}
    }

    const rawAmount = BigInt(balance.amount)
    const price = parseFloat(balance.price) || 0
    const normalizedBalance = toNormalizedBN(rawAmount, balance.decimals)

    result[chainId][tokenAddress] = {
      address: tokenAddress,
      name: balance.name,
      symbol: balance.symbol,
      decimals: balance.decimals,
      chainID: chainId,
      logoURI: balance.logoUri,
      value: normalizedBalance.normalized * price,
      balance: normalizedBalance
    }
  }

  return result
}

/*******************************************************************************
 ** Hook for fetching balances via Enso API
 ** Returns balances in the same TChainTokens format as useBalancesQueries
 ** Fetches all supported chains in a single request using chainId=all
 ******************************************************************************/
export function useEnsoBalances(
  userAddress: TAddress | undefined,
  options?: {
    enabled?: boolean
    staleTime?: number
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
  const enabled = Boolean(options?.enabled !== false && userAddress && !isZeroAddress(userAddress))
  const refetchConfig = getBalanceQueryRefetchConfig()

  const query = useQuery({
    queryKey: ['enso-balances', userAddress],
    queryFn: async () => {
      if (!userAddress || isZeroAddress(userAddress)) {
        return {}
      }
      const balances = await fetchEnsoBalances(userAddress)
      return transformEnsoResponse(balances)
    },
    enabled,
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...refetchConfig,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  })

  const chainIds = useMemo(() => {
    return Object.keys(query.data || {}).map(Number)
  }, [query.data])

  const chainLoadingStatus = useMemo(() => {
    const status: TNDict<boolean> = {}
    for (const chainId of chainIds) {
      status[chainId] = query.isLoading
    }
    return status
  }, [chainIds, query.isLoading])

  const chainSuccessStatus = useMemo(() => {
    const status: TNDict<boolean> = {}
    for (const chainId of chainIds) {
      status[chainId] = query.isSuccess
    }
    return status
  }, [chainIds, query.isSuccess])

  const chainErrorStatus = useMemo(() => {
    const status: TNDict<boolean> = {}
    for (const chainId of chainIds) {
      status[chainId] = query.isError
    }
    return status
  }, [chainIds, query.isError])

  return {
    data: query.data || {},
    isLoading: query.isLoading,
    isError: query.isError,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch: query.refetch,
    chainLoadingStatus,
    chainSuccessStatus,
    chainErrorStatus
  }
}
