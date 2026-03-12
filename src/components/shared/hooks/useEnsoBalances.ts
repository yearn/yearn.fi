import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { TAddress } from '../types/address'
import type { TChainTokens, TNDict } from '../types/mixed'
import { SUPPORTED_NETWORKS } from '../utils/constants'
import { toNormalizedBN } from '../utils/format'
import { toAddress } from '../utils/tools.address'
import { isZeroAddress } from '../utils/tools.is'

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
export const ENSO_UNSUPPORTED_NETWORKS = [250] // Fantom not supported by Enso
export const ENSO_SUPPORTED_CHAINS = SUPPORTED_NETWORKS.map((n) => n.id).filter(
  (id) => !ENSO_UNSUPPORTED_NETWORKS.includes(id)
)

/*******************************************************************************
 ** Fetch balances from Enso API for a given address
 ** Uses chainId=all to fetch all chains in a single request
 ******************************************************************************/
async function fetchEnsoBalances(address: TAddress): Promise<TEnsoBalanceResponse[]> {
  const params = new URLSearchParams({ eoaAddress: address })
  const url = `/api/enso/balances?${params}`
  const response = await fetch(url)

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
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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

/*******************************************************************************
 ** Standalone fetch function for use outside of React components
 ******************************************************************************/
export async function getEnsoBalances(address: TAddress): Promise<TChainTokens> {
  const balances = await fetchEnsoBalances(address)
  return transformEnsoResponse(balances)
}

/*******************************************************************************
 ** Merge Enso balances with existing balances
 ** Enso data takes precedence for tokens it has data for
 ******************************************************************************/
export function mergeBalances(existing: TChainTokens, ensoBalances: TChainTokens): TChainTokens {
  const result: TChainTokens = { ...existing }

  for (const [chainIdStr, tokens] of Object.entries(ensoBalances)) {
    const chainId = Number(chainIdStr)
    if (!result[chainId]) {
      result[chainId] = {}
    }
    result[chainId] = { ...result[chainId], ...tokens }
  }

  return result
}
