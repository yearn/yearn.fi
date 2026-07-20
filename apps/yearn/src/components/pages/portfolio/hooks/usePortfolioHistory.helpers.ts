import type {
  TPortfolioHistoryChartData,
  TPortfolioHistoryDenomination,
  TPortfolioLiveBalanceSnapshot
} from '../types/api'

export function upsertLivePortfolioBalancePoint({
  data,
  denomination,
  liveSnapshot
}: {
  data: TPortfolioHistoryChartData | null
  denomination: TPortfolioHistoryDenomination
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null
}): TPortfolioHistoryChartData | null {
  if (!data || !liveSnapshot) {
    return data
  }

  const liveValue = denomination === 'eth' ? liveSnapshot.totalEth : liveSnapshot.totalUsd
  if (typeof liveValue !== 'number' || !Number.isFinite(liveValue)) {
    return data
  }

  const livePoint = { date: liveSnapshot.date, value: liveValue, isLive: true }
  const existingIndex = data.findIndex((point) => point.date === liveSnapshot.date)
  if (existingIndex === -1) {
    return [...data, livePoint]
  }

  return data.map((point, index) => (index === existingIndex ? livePoint : point))
}
