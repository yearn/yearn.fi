import type { TVaultUserHistoryChartData } from '@pages/vaults/types/charts'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useMemo } from 'react'
import { z } from 'zod'

type TVaultUserHistoryTimeframe = '30d' | '90d' | '1y' | 'all'

type TUseVaultUserHistoryParams = {
  chainId?: number
  vaultAddress?: string
  vaults?: Array<{ chainId: number; vaultAddress: string }>
  timeframe: TVaultUserHistoryTimeframe
  enabled?: boolean
  valueMode?: 'underlying' | 'usd'
}

const vaultUserHistoryPointSchema = z.object({
  date: z.string(),
  growthWeightUsd: z.number().optional().default(0),
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

const vaultUserBalanceHistoryPointSchema = z.object({
  date: z.string(),
  value: z.number().optional().default(0)
})

const vaultUserBalanceHistoryResponseSchema = z.object({
  address: z.string(),
  denomination: z.enum(['usd', 'eth']).optional().default('usd'),
  timeframe: z.enum(['1y', 'all']).optional().default('1y'),
  dataPoints: z.array(vaultUserBalanceHistoryPointSchema)
})

export function useVaultUserHistory({
  chainId,
  vaultAddress,
  vaults,
  timeframe,
  enabled = true,
  valueMode = 'underlying'
}: TUseVaultUserHistoryParams) {
  const { address } = useWeb3()
  const apiTimeframe = timeframe === 'all' ? 'all' : '1y'
  const vaultFilter = useMemo(() => {
    if (vaults?.length) {
      return `vaults=${vaults
        .map((vault) => `${vault.chainId}:${vault.vaultAddress}`)
        .map(encodeURIComponent)
        .join(',')}`
    }

    if (!vaultAddress || !Number.isInteger(chainId)) {
      return null
    }

    return `chainId=${chainId}&vault=${vaultAddress}`
  }, [chainId, vaultAddress, vaults])

  const pnlEndpoint = useMemo(() => {
    if (!enabled || !address || !vaultFilter) {
      return null
    }

    return `/api/holdings/protocol-return/history?address=${address}&${vaultFilter}&timeframe=${apiTimeframe}&debug=1&fetchType=parallel`
  }, [address, apiTimeframe, enabled, vaultFilter])

  const balanceEndpoint = useMemo(() => {
    if (valueMode !== 'usd' || !enabled || !address || !vaultFilter) {
      return null
    }

    return `/api/holdings/history?address=${address}&${vaultFilter}&denomination=usd&timeframe=${apiTimeframe}&debug=1&fetchType=parallel`
  }, [address, apiTimeframe, enabled, valueMode, vaultFilter])

  const {
    data: pnlData,
    isLoading: isPnlLoading,
    isFetching: isPnlFetching,
    error: pnlError
  } = useFetch({
    endpoint: pnlEndpoint,
    schema: vaultUserHistoryResponseSchema,
    config: {
      enabled,
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000
    }
  })
  const {
    data: usdBalanceData,
    isLoading: isBalanceLoading,
    isFetching: isBalanceFetching,
    error: balanceError
  } = useFetch({
    endpoint: balanceEndpoint,
    schema: vaultUserBalanceHistoryResponseSchema,
    config: {
      enabled: enabled && valueMode === 'usd',
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000
    }
  })

  const balanceData = useMemo<TVaultUserHistoryChartData | null>(() => {
    if (valueMode === 'usd') {
      if (!usdBalanceData?.dataPoints) {
        return null
      }

      return usdBalanceData.dataPoints.map((point) => ({
        date: point.date,
        value: point.value
      }))
    }

    if (!pnlData?.dataPoints) {
      return null
    }

    return pnlData.dataPoints.map((point) => ({
      date: point.date,
      value: point.currentUnderlying
    }))
  }, [pnlData, usdBalanceData, valueMode])

  const growthData = useMemo<TVaultUserHistoryChartData | null>(() => {
    if (!pnlData?.dataPoints) {
      return null
    }

    return pnlData.dataPoints.map((point) => ({
      date: point.date,
      value: valueMode === 'usd' ? point.growthWeightUsd : point.growthUnderlying
    }))
  }, [pnlData, valueMode])

  const isLoadingState =
    isPnlLoading || isPnlFetching || (valueMode === 'usd' && (isBalanceLoading || isBalanceFetching))
  const error = pnlError ?? (valueMode === 'usd' ? balanceError : null)
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
