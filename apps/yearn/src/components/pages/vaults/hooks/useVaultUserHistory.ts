import type { TVaultUserHistoryChartData } from '@pages/vaults/types/charts'
import type { TUserHistoryVault } from '@pages/vaults/utils/vaultUserHistoryVaults'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { z } from 'zod'

type TVaultUserHistoryTimeframe = '30d' | '90d' | '1y' | 'all'

export type TSavedVaultPosition = {
  wallets: readonly Address[]
  vault: TUserHistoryVault
}

type TUseVaultUserHistoryParams = {
  chainId?: number
  vaultAddress?: string
  vaults?: Array<{ chainId: number; vaultAddress: string }>
  timeframe: TVaultUserHistoryTimeframe
  enabled?: boolean
  valueMode?: 'underlying' | 'usd'
  savedPosition?: TSavedVaultPosition
}

const vaultUserHistoryPointSchema = z.object({
  date: z.string(),
  growthWeightUsd: z.number().nullable().optional().default(null),
  currentUnderlying: z.number().nullable().optional().default(null),
  growthUnderlying: z.number().nullable().optional().default(null),
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

const savedVaultHistoryResponseSchema = z.object({
  addresses: z.array(z.string()),
  protocolReturn: vaultUserHistoryResponseSchema,
  balanceData: z.array(z.object({ date: z.string(), value: z.number().nullable() })).optional()
})

export function useVaultUserHistory({
  chainId,
  vaultAddress,
  vaults,
  timeframe,
  enabled = true,
  valueMode = 'underlying',
  savedPosition
}: TUseVaultUserHistoryParams) {
  const { address } = useWeb3()
  const apiTimeframe = timeframe === 'all' ? 'all' : '1y'
  const useConnectedWallet = enabled && !savedPosition
  const members = [...new Set(savedPosition?.wallets.map((wallet) => wallet.toLowerCase()))].sort()
  const requestedVault = savedPosition?.vault
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
    if (!useConnectedWallet || !address || !vaultFilter) {
      return null
    }

    return `/api/holdings/protocol-return/history?address=${address}&${vaultFilter}&timeframe=${apiTimeframe}`
  }, [address, apiTimeframe, useConnectedWallet, vaultFilter])

  const balanceEndpoint = useMemo(() => {
    if (valueMode !== 'usd' || !useConnectedWallet || !address || !vaultFilter) {
      return null
    }

    return `/api/holdings/history?address=${address}&${vaultFilter}&denomination=usd&timeframe=${apiTimeframe}`
  }, [address, apiTimeframe, useConnectedWallet, valueMode, vaultFilter])

  const {
    data: connectedPnlData,
    isLoading: isPnlLoading,
    isFetching: isPnlFetching,
    error: pnlError
  } = useFetch({
    endpoint: pnlEndpoint,
    schema: vaultUserHistoryResponseSchema,
    config: {
      enabled: useConnectedWallet,
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
      enabled: useConnectedWallet && valueMode === 'usd',
      cacheDuration: 5 * 60 * 1000,
      keepPreviousData: false,
      timeout: 2 * 60 * 1000
    }
  })

  const savedHistory = useQuery({
    queryKey: ['saved-vault-history', members, requestedVault, apiTimeframe, valueMode],
    enabled: enabled && Boolean(requestedVault) && members.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/holdings/bundle-growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: members, timeframe: apiTimeframe, vault: { ...requestedVault, valueMode } }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(2 * 60 * 1000)])
      })
      if (!response.ok) throw new Error('Saved vault history is temporarily unavailable.')
      const data = savedVaultHistoryResponseSchema.parse(await response.json())
      if (
        data.addresses.join(',') !== members.join(',') ||
        data.protocolReturn.timeframe !== apiTimeframe ||
        (valueMode === 'usd' && !data.balanceData)
      ) {
        throw new Error('Saved vault history did not match the requested position.')
      }
      return data
    }
  })
  const pnlData = savedPosition ? savedHistory.data?.protocolReturn : connectedPnlData
  const savedBalanceData = savedHistory.data?.balanceData

  const balanceData = useMemo<TVaultUserHistoryChartData | null>(() => {
    if (valueMode === 'usd') {
      return savedPosition ? (savedBalanceData ?? null) : (usdBalanceData?.dataPoints ?? null)
    }

    if (!pnlData?.dataPoints) {
      return null
    }

    return pnlData.dataPoints.map((point) => ({
      date: point.date,
      value: point.currentUnderlying
    }))
  }, [pnlData, savedBalanceData, savedPosition, usdBalanceData, valueMode])

  const growthData = useMemo<TVaultUserHistoryChartData | null>(() => {
    if (!pnlData?.dataPoints) {
      return null
    }

    return pnlData.dataPoints.map((point) => ({
      date: point.date,
      value: valueMode === 'usd' ? point.growthWeightUsd : point.growthUnderlying
    }))
  }, [pnlData, valueMode])

  const isLoadingState = savedPosition
    ? savedHistory.isFetching
    : isPnlLoading || isPnlFetching || (valueMode === 'usd' && (isBalanceLoading || isBalanceFetching))
  const error = savedPosition ? savedHistory.error : (pnlError ?? (valueMode === 'usd' ? balanceError : null))
  const errorStatus =
    (error as { response?: { status?: number }; status?: number } | null)?.response?.status ??
    (error as { status?: number } | null)?.status
  const isEmpty =
    enabled &&
    !isLoadingState &&
    (savedPosition
      ? savedHistory.isSuccess &&
        !balanceData?.some(({ value }) => value !== null) &&
        !growthData?.some(({ value }) => value !== null)
      : Boolean(address) && (errorStatus === 404 || Boolean(balanceData && balanceData.length === 0)))
  const visibleError = isEmpty ? null : error

  return {
    balanceData,
    growthData,
    isLoading: isLoadingState,
    isEmpty,
    error: visibleError
  }
}
