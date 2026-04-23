import type { TVaultUserHistoryChartData } from '@pages/vaults/types/charts'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import { z } from 'zod'

type TVaultUserHistoryTimeframe = '30d' | '90d' | '1y' | 'all'

type TUseVaultUserHistoryParams = {
  chainId: number
  vaultAddress: string
  timeframe: TVaultUserHistoryTimeframe
  enabled?: boolean
}

const vaultUserHistoryPointSchema = z.object({
  date: z.string(),
  currentUnderlying: z.number().optional().default(0),
  growthUnderlying: z.number().optional().default(0),
  sharesFormatted: z.number().optional().default(0),
  pricePerShare: z.number().optional().default(0)
})

const vaultUserHistoryResponseSchema = z.object({
  address: z.string(),
  timeframe: z.enum(['1y', 'all']).optional().default('1y'),
  dataPoints: z.array(vaultUserHistoryPointSchema)
})

export function useVaultUserHistory({ chainId, vaultAddress, timeframe, enabled = true }: TUseVaultUserHistoryParams) {
  const { address } = useWeb3()
  const apiTimeframe = timeframe === 'all' ? 'all' : '1y'

  const endpoint = useMemo(() => {
    if (!enabled || !address || !vaultAddress || !Number.isInteger(chainId)) {
      return null
    }

    return `/api/holdings/pnl/simple-history?address=${address}&chainId=${chainId}&vault=${vaultAddress}&timeframe=${apiTimeframe}&debug=1&fetchType=parallel`
  }, [address, apiTimeframe, chainId, enabled, vaultAddress])

  const { data, isLoading, isFetching, error } = useFetch({
    endpoint,
    schema: vaultUserHistoryResponseSchema,
    config: {
      enabled,
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000
    }
  })

  const balanceData = useMemo<TVaultUserHistoryChartData | null>(() => {
    if (!data?.dataPoints) {
      return null
    }

    return data.dataPoints.map((point) => ({
      date: point.date,
      value: point.currentUnderlying
    }))
  }, [data])

  const growthData = useMemo<TVaultUserHistoryChartData | null>(() => {
    if (!data?.dataPoints) {
      return null
    }

    return data.dataPoints.map((point) => ({
      date: point.date,
      value: point.growthUnderlying
    }))
  }, [data])

  const isLoadingState = isLoading || isFetching
  const errorStatus =
    (error as { response?: { status?: number }; status?: number } | null)?.response?.status ??
    (error as { status?: number } | null)?.status
  const isEmpty =
    enabled &&
    !isLoadingState &&
    Boolean(address) &&
    (errorStatus === 404 || Boolean(balanceData && balanceData.length === 0))
  const visibleError = isEmpty ? null : error

  return {
    balanceData,
    growthData,
    isLoading: isLoadingState,
    isEmpty,
    error: visibleError
  }
}
