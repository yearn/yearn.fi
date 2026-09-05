import { mapPortfolioGrowthVaults } from '@pages/portfolio/hooks/usePortfolioGrowth'
import { upsertLivePortfolioBalancePoint } from '@pages/portfolio/hooks/usePortfolioHistory.helpers'
import { usePortfolioHistoryLoadTracking } from '@pages/portfolio/hooks/usePortfolioHistoryLoadTracking'
import {
  createPortfolioHistoryProgressId,
  usePortfolioHistoryProgress
} from '@pages/portfolio/hooks/usePortfolioHistoryProgress'
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
  progressId?: string
}): string {
  const params = new URLSearchParams({
    address: args.address,
    denomination: args.denomination,
    timeframe: args.timeframe
  })
  if (args.progressId) {
    params.set('progressId', args.progressId)
  }
  if (args.debug) {
    params.set('debug', '1')
  }
  return `/api/holdings/portfolio?${params}`
}

export function buildPortfolioHistoryBundleCacheKey(args: {
  address: string
  denomination: TPortfolioHistoryDenomination
  timeframe: TPortfolioHistoryTimeframe
}): readonly string[] {
  return ['fetch', 'portfolio-history-bundle', args.address.toLowerCase(), args.denomination, args.timeframe]
}

function getErrorStatus(error: Error | null): number | undefined {
  const requestError = error as (Error & { response?: { status?: number }; status?: number }) | null
  return requestError?.response?.status ?? requestError?.status
}

export function resolvePortfolioHistoryBundleData(args: {
  address?: string
  data?: TPortfolioResponse
  isPlaceholderData: boolean
}): { currentData: TPortfolioResponse | null; retainedData: TPortfolioResponse | null } {
  const normalizedAddress = args.address?.toLowerCase()
  const retainedData = normalizedAddress && args.data?.address.toLowerCase() === normalizedAddress ? args.data : null

  return {
    currentData: args.isPlaceholderData ? null : retainedData,
    retainedData
  }
}

export function resolvePortfolioHistoryBundleLoading(args: {
  hasCurrentData: boolean
  hasRetainedGrowth: boolean
  isFetching: boolean
  isLoading: boolean
  isPlaceholderData: boolean
}): { historyIsLoading: boolean; growthIsLoading: boolean } {
  const requestIsPending = args.isLoading || args.isFetching || args.isPlaceholderData

  return {
    historyIsLoading: !args.hasCurrentData && requestIsPending,
    growthIsLoading: !args.hasRetainedGrowth && requestIsPending
  }
}

export function usePortfolioHistoryBundle(
  denomination: TPortfolioHistoryDenomination = 'usd',
  timeframe: TPortfolioHistoryTimeframe = '1y',
  enabled = true,
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null = null
) {
  const { address } = useWeb3()
  const progressId = useMemo(
    () =>
      address && enabled
        ? createPortfolioHistoryProgressId(['portfolio-history-bundle', denomination, timeframe])
        : null,
    [address, denomination, enabled, timeframe]
  )
  const endpoint = useMemo(
    () =>
      address && enabled && progressId
        ? buildPortfolioHistoryBundleEndpoint({ address, denomination, timeframe, progressId, debug: env.DEV })
        : null,
    [address, denomination, enabled, progressId, timeframe]
  )
  const cacheKey = useMemo(
    () => (address && enabled ? buildPortfolioHistoryBundleCacheKey({ address, denomination, timeframe }) : undefined),
    [address, denomination, enabled, timeframe]
  )
  const { data, isLoading, isFetching, isPlaceholderData, error } = useFetch<TPortfolioResponse>({
    endpoint,
    schema: portfolioResponseSchema,
    config: {
      cacheKey,
      cacheDuration: PORTFOLIO_HISTORY_CACHE_DURATION,
      gcTime: PORTFOLIO_HISTORY_CACHE_DURATION,
      keepPreviousData: true,
      maxRetries: 0,
      timeout: 5 * 60 * 1000
    }
  })
  const { currentData, retainedData } = resolvePortfolioHistoryBundleData({
    address,
    data,
    isPlaceholderData
  })
  const balanceData = useMemo<TPortfolioHistoryChartData | null>(() => {
    if (!currentData?.balance.dataPoints) {
      return null
    }

    return upsertLivePortfolioBalancePoint({
      data: currentData.balance.dataPoints.map((point) => ({ date: point.date, value: point.value })),
      denomination,
      liveSnapshot
    })
  }, [currentData, denomination, liveSnapshot])
  const protocolReturnData = useMemo<TPortfolioProtocolReturnHistoryChartData | null>(() => {
    if (!retainedData?.protocolReturn.dataPoints) {
      return null
    }

    return retainedData.protocolReturn.dataPoints.map((point) => ({
      date: point.date,
      growthWeightUsd: point.growthWeightUsd,
      growthUsd: point.growthUsd,
      growthUsdEstimated: point.growthUsdEstimated,
      growthWeightEth: point.growthWeightEth,
      protocolReturnPct: point.protocolReturnPct,
      annualizedProtocolReturnPct: point.annualizedProtocolReturnPct,
      growthIndex: point.growthIndex
    }))
  }, [retainedData])
  const growthVaults = useMemo(() => retainedData?.growth.vaults ?? [], [retainedData?.growth.vaults])
  const growthVaultsByKey = useMemo(() => mapPortfolioGrowthVaults(growthVaults), [growthVaults])
  const hasResponse = Boolean(currentData)
  const hasRetainedGrowth = Boolean(retainedData?.growth)
  const { historyIsLoading, growthIsLoading } = resolvePortfolioHistoryBundleLoading({
    hasCurrentData: hasResponse,
    hasRetainedGrowth,
    isFetching,
    isLoading,
    isPlaceholderData
  })
  const progress = usePortfolioHistoryProgress(progressId, historyIsLoading, false)
  const errorStatus = getErrorStatus(error)
  const balanceIsEmpty =
    !historyIsLoading && Boolean(address) && (errorStatus === 404 || Boolean(balanceData && balanceData.length === 0))
  const protocolReturnIsEmpty =
    !historyIsLoading &&
    Boolean(address) &&
    (errorStatus === 404 || Boolean(protocolReturnData && protocolReturnData.length === 0))

  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_BALANCE_HISTORY_LOAD,
    loadKey: endpoint ? `${endpoint}:balance` : null,
    timeframe,
    denomination,
    isLoading: historyIsLoading,
    isEmpty: balanceIsEmpty,
    error,
    pointCount: currentData?.balance.dataPoints.length
  })
  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_PROTOCOL_RETURN_HISTORY_LOAD,
    loadKey: endpoint ? `${endpoint}:protocol-return` : null,
    timeframe,
    isLoading: historyIsLoading,
    isEmpty: protocolReturnIsEmpty,
    error,
    pointCount: currentData?.protocolReturn.dataPoints.length
  })

  return {
    balance: {
      data: balanceData,
      denomination: currentData?.balance.denomination ?? denomination,
      timeframe: currentData?.balance.timeframe ?? timeframe,
      isLoading: historyIsLoading,
      progress,
      error: balanceIsEmpty ? null : error,
      isEmpty: balanceIsEmpty
    },
    protocolReturn: {
      data: protocolReturnData,
      summary: retainedData?.protocolReturn.summary ?? null,
      familySeries: retainedData?.protocolReturn.familySeries ?? [],
      timeframe: currentData?.protocolReturn.timeframe ?? timeframe,
      isLoading: historyIsLoading,
      progress,
      error: protocolReturnIsEmpty ? null : error,
      isEmpty: protocolReturnIsEmpty
    },
    growth: {
      data: retainedData?.growth ?? null,
      summary: retainedData?.growth.summary ?? null,
      vaults: growthVaults,
      vaultsByKey: growthVaultsByKey,
      isLoading: growthIsLoading,
      error: hasRetainedGrowth ? null : error,
      isEmpty: !growthIsLoading && !error && hasResponse && growthVaults.length === 0
    },
    hasResponse
  }
}
