import { mapPortfolioGrowthVaults } from '@pages/portfolio/hooks/usePortfolioGrowth'
import { upsertLivePortfolioBalancePoint } from '@pages/portfolio/hooks/usePortfolioHistory.helpers'
import { usePortfolioHistoryLoadTracking } from '@pages/portfolio/hooks/usePortfolioHistoryLoadTracking'
import {
  portfolioResponseSchema,
  type TPortfolioHistoryChartData,
  type TPortfolioHistoryDenomination,
  type TPortfolioHistoryTimeframe,
  type TPortfolioLiveBalanceSnapshot,
  type TPortfolioProtocolReturnHistoryChartData,
  type TPortfolioResponse
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { useMemo } from 'react'
import { env } from '@/env'

const PORTFOLIO_HISTORY_CACHE_DURATION = 60 * 60 * 1000

export function buildPortfolioHistoryBundleEndpoint(args: {
  address: string
  denomination: TPortfolioHistoryDenomination
  timeframe: TPortfolioHistoryTimeframe
  debug?: boolean
}): string {
  const params = new URLSearchParams({
    address: args.address,
    denomination: args.denomination,
    timeframe: args.timeframe
  })
  if (args.debug) {
    params.set('debug', '1')
  }
  return `/api/holdings/portfolio?${params}`
}

function getErrorStatus(error: Error | null): number | undefined {
  const requestError = error as (Error & { response?: { status?: number }; status?: number }) | null
  return requestError?.response?.status ?? requestError?.status
}

export function usePortfolioHistoryBundle(
  denomination: TPortfolioHistoryDenomination = 'usd',
  timeframe: TPortfolioHistoryTimeframe = '1y',
  enabled = true,
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null = null
) {
  const { address } = useWeb3()
  const endpoint = useMemo(
    () =>
      address && enabled
        ? buildPortfolioHistoryBundleEndpoint({ address, denomination, timeframe, debug: env.DEV })
        : null,
    [address, denomination, enabled, timeframe]
  )
  const { data, isLoading, isFetching, error } = useFetch<TPortfolioResponse>({
    endpoint,
    schema: portfolioResponseSchema,
    config: {
      cacheDuration: PORTFOLIO_HISTORY_CACHE_DURATION,
      gcTime: PORTFOLIO_HISTORY_CACHE_DURATION,
      keepPreviousData: false,
      maxRetries: 0,
      timeout: 5 * 60 * 1000
    }
  })
  const balanceData = useMemo<TPortfolioHistoryChartData | null>(() => {
    if (!data?.balance.dataPoints) {
      return null
    }

    return upsertLivePortfolioBalancePoint({
      data: data.balance.dataPoints.map((point) => ({ date: point.date, value: point.value })),
      denomination,
      liveSnapshot
    })
  }, [data, denomination, liveSnapshot])
  const protocolReturnData = useMemo<TPortfolioProtocolReturnHistoryChartData | null>(() => {
    if (!data?.protocolReturn.dataPoints) {
      return null
    }

    return data.protocolReturn.dataPoints.map((point) => ({
      date: point.date,
      growthWeightUsd: point.growthWeightUsd,
      growthUsd: point.growthUsd,
      growthWeightEth: point.growthWeightEth,
      protocolReturnPct: point.protocolReturnPct,
      annualizedProtocolReturnPct: point.annualizedProtocolReturnPct,
      growthIndex: point.growthIndex
    }))
  }, [data])
  const growthVaults = useMemo(() => data?.growth.vaults ?? [], [data?.growth.vaults])
  const growthVaultsByKey = useMemo(() => mapPortfolioGrowthVaults(growthVaults), [growthVaults])
  const hasResponse = Boolean(data)
  const isLoadingState = !hasResponse && (isLoading || isFetching)
  const errorStatus = getErrorStatus(error)
  const balanceIsEmpty =
    !isLoadingState && Boolean(address) && (errorStatus === 404 || Boolean(balanceData && balanceData.length === 0))
  const protocolReturnIsEmpty =
    !isLoadingState &&
    Boolean(address) &&
    (errorStatus === 404 || Boolean(protocolReturnData && protocolReturnData.length === 0))

  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_BALANCE_HISTORY_LOAD,
    loadKey: endpoint ? `${endpoint}:balance` : null,
    timeframe,
    denomination,
    isLoading: isLoadingState,
    isEmpty: balanceIsEmpty,
    error,
    pointCount: data?.balance.dataPoints.length
  })
  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_PROTOCOL_RETURN_HISTORY_LOAD,
    loadKey: endpoint ? `${endpoint}:protocol-return` : null,
    timeframe,
    isLoading: isLoadingState,
    isEmpty: protocolReturnIsEmpty,
    error,
    pointCount: data?.protocolReturn.dataPoints.length
  })

  return {
    balance: {
      data: balanceData,
      denomination: data?.balance.denomination ?? denomination,
      timeframe: data?.balance.timeframe ?? timeframe,
      isLoading: isLoadingState,
      progress: null,
      error: balanceIsEmpty ? null : error,
      isEmpty: balanceIsEmpty
    },
    protocolReturn: {
      data: protocolReturnData,
      summary: data?.protocolReturn.summary ?? null,
      familySeries: data?.protocolReturn.familySeries ?? [],
      timeframe: data?.protocolReturn.timeframe ?? timeframe,
      isLoading: isLoadingState,
      progress: null,
      error: protocolReturnIsEmpty ? null : error,
      isEmpty: protocolReturnIsEmpty
    },
    growth: {
      data: data?.growth ?? null,
      summary: data?.growth.summary ?? null,
      vaults: growthVaults,
      vaultsByKey: growthVaultsByKey,
      isLoading: isLoadingState,
      error,
      isEmpty: !isLoadingState && !error && hasResponse && growthVaults.length === 0
    },
    hasResponse,
    requestError: error,
    rawData: data ?? null
  }
}
