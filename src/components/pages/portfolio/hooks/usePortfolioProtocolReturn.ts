import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useEffect, useMemo } from 'react'
import {
  portfolioProtocolReturnResponseSchema,
  type TPortfolioProtocolReturnResponse,
  type TPortfolioProtocolReturnSummary,
  type TPortfolioProtocolReturnVault
} from '../types/api'

export function usePortfolioProtocolReturn() {
  const { address } = useWeb3()

  const endpoint = useMemo(() => {
    if (!address) {
      return null
    }

    return `/api/holdings/pnl/simple?address=${address}&debug=1&fetchType=parallel&paginationMode=all`
  }, [address])

  const { data, isLoading, isFetching, error } = useFetch<TPortfolioProtocolReturnResponse>({
    endpoint,
    schema: portfolioProtocolReturnResponseSchema,
    config: {
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000
    }
  })

  useEffect(() => {
    if (!data || data.summary.isComplete) {
      return
    }

    const partialVaults = data.vaults
      .filter((vault) => vault.status !== 'ok')
      .map((vault: TPortfolioProtocolReturnVault) => ({
        chainId: vault.chainId,
        vaultAddress: vault.vaultAddress,
        symbol: vault.metadata.symbol,
        tokenAddress: vault.metadata.tokenAddress,
        status: vault.status,
        issues: vault.issues
      }))

    if (partialVaults.length === 0) {
      return
    }

    console.groupCollapsed(
      `[Portfolio] Protocol return incomplete for ${partialVaults.length} vault${partialVaults.length === 1 ? '' : 's'}`
    )
    console.table(partialVaults)
    console.groupEnd()
  }, [data])

  return {
    data: (data?.summary ?? null) as TPortfolioProtocolReturnSummary | null,
    vaults: data?.vaults ?? [],
    isLoading: isLoading || isFetching,
    error
  }
}
