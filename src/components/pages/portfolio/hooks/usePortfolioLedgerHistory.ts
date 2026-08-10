import { upsertLivePortfolioBalancePoint } from '@pages/portfolio/hooks/usePortfolioHistory.helpers'
import { usePortfolioHistoryLoadTracking } from '@pages/portfolio/hooks/usePortfolioHistoryLoadTracking'
import {
  portfolioLedgerHistoryResponseSchema,
  type TPortfolioHistoryChartData,
  type TPortfolioHistoryDenomination,
  type TPortfolioHistoryTimeframe,
  type TPortfolioLedgerHistoryResponse,
  type TPortfolioLiveBalanceSnapshot,
  type TPortfolioProtocolReturnHistoryChartData,
  type TPortfolioProtocolReturnHistoryFamilySeries,
  type TPortfolioProtocolReturnHistorySummary
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useFetch } from '@shared/hooks/useFetch'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { useMemo } from 'react'

const PORTFOLIO_LEDGER_HISTORY_CACHE_DURATION = 60 * 60 * 1000

export function buildPortfolioLedgerHistoryEndpoint(args: {
  address: string
  snapshotId: string
  denomination: TPortfolioHistoryDenomination
  timeframe: TPortfolioHistoryTimeframe
}): string {
  const params = new URLSearchParams({
    address: args.address,
    snapshotId: args.snapshotId,
    denomination: args.denomination,
    timeframe: args.timeframe
  })
  return `/api/holdings/ledger/portfolio-history?${params}`
}

export function getPortfolioLedgerHistoryCacheKey(endpoint: string, snapshotId: string) {
  return ['fetch', endpoint, 'portfolio-ledger-history', snapshotId] as const
}

export function transformPortfolioLedgerHistoryResponse(args: {
  rawData: TPortfolioLedgerHistoryResponse | undefined
  denomination: TPortfolioHistoryDenomination
  timeframe: TPortfolioHistoryTimeframe
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null
}): {
  balanceData: TPortfolioHistoryChartData | null
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
  protocolReturnSummary: TPortfolioProtocolReturnHistorySummary | null
  protocolReturnFamilySeries: TPortfolioProtocolReturnHistoryFamilySeries
} {
  const balanceData = args.rawData?.balance.dataPoints
    ? upsertLivePortfolioBalancePoint({
        data: args.rawData.balance.dataPoints.map((point) => ({ date: point.date, value: point.value })),
        denomination: args.denomination,
        liveSnapshot: args.liveSnapshot
      })
    : null
  const protocolReturnData = args.rawData?.protocolReturn.dataPoints
    ? args.rawData.protocolReturn.dataPoints.map((point) => ({
        date: point.date,
        growthWeightUsd: point.growthWeightUsd,
        growthWeightEth: point.growthWeightEth,
        protocolReturnPct: point.protocolReturnPct,
        annualizedProtocolReturnPct: point.annualizedProtocolReturnPct,
        growthIndex: point.growthIndex
      }))
    : null

  return {
    balanceData,
    protocolReturnData,
    protocolReturnSummary: args.rawData?.protocolReturn.summary ?? null,
    protocolReturnFamilySeries: args.rawData?.protocolReturn.familySeries ?? []
  }
}

export function usePortfolioLedgerHistory(
  denomination: TPortfolioHistoryDenomination = 'usd',
  timeframe: TPortfolioHistoryTimeframe = '1y',
  snapshotId: string | null = null,
  enabled = true,
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null = null
) {
  const { address } = useWeb3()
  const endpoint = useMemo(
    () =>
      address && snapshotId && enabled
        ? buildPortfolioLedgerHistoryEndpoint({ address, snapshotId, denomination, timeframe })
        : null,
    [address, denomination, enabled, snapshotId, timeframe]
  )
  const cacheKey = useMemo(
    () => (endpoint && snapshotId ? getPortfolioLedgerHistoryCacheKey(endpoint, snapshotId) : undefined),
    [endpoint, snapshotId]
  )

  const {
    data: rawData,
    isLoading,
    isFetching,
    error
  } = useFetch<TPortfolioLedgerHistoryResponse>({
    endpoint,
    schema: portfolioLedgerHistoryResponseSchema,
    config: {
      cacheKey,
      cacheDuration: PORTFOLIO_LEDGER_HISTORY_CACHE_DURATION,
      gcTime: PORTFOLIO_LEDGER_HISTORY_CACHE_DURATION,
      keepPreviousData: false,
      maxRetries: 0,
      timeout: 5 * 60 * 1000
    }
  })

  const { balanceData, protocolReturnData, protocolReturnSummary, protocolReturnFamilySeries } = useMemo(
    () => transformPortfolioLedgerHistoryResponse({ rawData, denomination, timeframe, liveSnapshot }),
    [denomination, liveSnapshot, rawData, timeframe]
  )

  const hasResponse = Boolean(rawData)
  const isLoadingState = !hasResponse && (isLoading || isFetching)
  const errorStatus =
    (error as { response?: { status?: number }; status?: number } | null)?.response?.status ??
    (error as { status?: number } | null)?.status
  const balanceIsEmpty =
    !isLoadingState && Boolean(address) && (errorStatus === 404 || Boolean(balanceData && balanceData.length === 0))
  const protocolReturnIsEmpty =
    !isLoadingState &&
    Boolean(address) &&
    (errorStatus === 404 || Boolean(protocolReturnData && protocolReturnData.length === 0))
  const balanceError = balanceIsEmpty ? null : error
  const protocolReturnError = protocolReturnIsEmpty ? null : error

  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_BALANCE_HISTORY_LOAD,
    loadKey: endpoint ? `${endpoint}:balance` : null,
    timeframe,
    denomination,
    isLoading: isLoadingState,
    isEmpty: balanceIsEmpty,
    error,
    pointCount: rawData?.balance.dataPoints.length
  })
  usePortfolioHistoryLoadTracking({
    eventName: PLAUSIBLE_EVENTS.PORTFOLIO_PROTOCOL_RETURN_HISTORY_LOAD,
    loadKey: endpoint ? `${endpoint}:protocol-return` : null,
    timeframe,
    isLoading: isLoadingState,
    isEmpty: protocolReturnIsEmpty,
    error,
    pointCount: rawData?.protocolReturn.dataPoints.length
  })

  return {
    balance: {
      data: balanceData,
      denomination: rawData?.balance.denomination ?? denomination,
      timeframe: rawData?.balance.timeframe ?? timeframe,
      isLoading: isLoadingState,
      progress: null,
      error: balanceError,
      isEmpty: balanceIsEmpty
    },
    protocolReturn: {
      data: protocolReturnData,
      summary: protocolReturnSummary,
      familySeries: protocolReturnFamilySeries,
      timeframe: rawData?.protocolReturn.timeframe ?? timeframe,
      isLoading: isLoadingState,
      progress: null,
      error: protocolReturnError,
      isEmpty: protocolReturnIsEmpty
    },
    hasResponse,
    requestError: error,
    rawData
  }
}
