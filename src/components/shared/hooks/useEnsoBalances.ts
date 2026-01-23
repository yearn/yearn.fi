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
const ENSO_SUPPORTED_CHAINS = SUPPORTED_NETWORKS.map((n) => n.id)

/*******************************************************************************
 ** Fetch balances from Enso API for a single chain via server proxy
 ******************************************************************************/
async function fetchEnsoBalancesForChain(address: TAddress, chainId: number): Promise<TEnsoBalanceResponse[]> {
  const params = new URLSearchParams({
    eoaAddress: address,
    chainId: chainId.toString()
  })

  const url = `/api/enso/balances?${params}`
  const response = await fetch(url)

  if (!response.ok) {
    console.warn(`[Enso] Chain ${chainId} failed: ${response.status}`)
    return []
  }

  return response.json()
}

/*******************************************************************************
 ** Fetch balances from Enso API for a given address
 ** Fetches all supported chains in parallel
 ******************************************************************************/
async function fetchEnsoBalances(
  address: TAddress,
  chainId?: number
): Promise<{ balances: TEnsoBalanceResponse[]; duration: number; httpRequests: number }> {
  const startTime = performance.now()

  const chainsToFetch = chainId ? [chainId] : ENSO_SUPPORTED_CHAINS

  console.log('[Enso] Fetching chains:', chainsToFetch)

  const results = await Promise.all(chainsToFetch.map((chain) => fetchEnsoBalancesForChain(address, chain)))

  const balances = results.flat()
  const duration = performance.now() - startTime
  const httpRequests = chainsToFetch.length

  return { balances, duration, httpRequests }
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
 ******************************************************************************/
export function useEnsoBalances(
  userAddress: TAddress | undefined,
  options?: {
    chainId?: number
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

  console.log('[Enso] Hook called', { userAddress, enabled, chainId: options?.chainId })

  const query = useQuery({
    queryKey: ['enso-balances', userAddress, options?.chainId ?? 'all'],
    queryFn: async () => {
      console.log('[Enso] Query function executing...')
      if (!userAddress || isZeroAddress(userAddress)) {
        console.log('[Enso] No user address, returning empty')
        return {}
      }
      try {
        const { balances, duration, httpRequests } = await fetchEnsoBalances(userAddress, options?.chainId)
        const transformed = transformEnsoResponse(balances)

        const chainCount = Object.keys(transformed).length
        const tokenCount = Object.values(transformed).reduce((acc, tokens) => acc + Object.keys(tokens).length, 0)

        console.log(
          `[Enso] Total: ${tokenCount} tokens across ${chainCount} chains in ${httpRequests} HTTP request(s), ${duration.toFixed(0)}ms (0 RPC calls)`
        )

        return transformed
      } catch (err) {
        console.error('[Enso] Fetch error:', err)
        throw err
      }
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
export async function getEnsoBalances(address: TAddress, chainId?: number): Promise<TChainTokens> {
  const { balances, duration } = await fetchEnsoBalances(address, chainId)
  const transformed = transformEnsoResponse(balances)

  const chainCount = Object.keys(transformed).length
  const tokenCount = Object.values(transformed).reduce((acc, tokens) => acc + Object.keys(tokens).length, 0)

  console.log(`[Enso] Fetched ${tokenCount} tokens across ${chainCount} chains in ${duration.toFixed(0)}ms`)

  return transformed
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
