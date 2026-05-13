type TPortfolioHistoryDisplayStateParams = {
  isActive: boolean
  isHoldingsLoading: boolean
  hasHoldings: boolean
  balanceHistoryIsLoading: boolean
  balanceHistoryIsEmpty: boolean
  protocolReturnHistoryIsLoading: boolean
  protocolReturnHistoryIsEmpty: boolean
}

export type TPortfolioHistoryDisplayState = {
  hasResolvedNoYearnPositions: boolean
  shouldDeferHistoryChart: boolean
}

export function getPortfolioHistoryDisplayState({
  isActive,
  isHoldingsLoading,
  hasHoldings,
  balanceHistoryIsLoading,
  balanceHistoryIsEmpty,
  protocolReturnHistoryIsLoading,
  protocolReturnHistoryIsEmpty
}: TPortfolioHistoryDisplayStateParams): TPortfolioHistoryDisplayState {
  const hasResolvedNoYearnPositions =
    isActive &&
    !isHoldingsLoading &&
    !hasHoldings &&
    !balanceHistoryIsLoading &&
    !protocolReturnHistoryIsLoading &&
    balanceHistoryIsEmpty &&
    protocolReturnHistoryIsEmpty

  const isAwaitingNoPositionsConfirmation =
    !hasHoldings &&
    !hasResolvedNoYearnPositions &&
    (balanceHistoryIsLoading || protocolReturnHistoryIsLoading || balanceHistoryIsEmpty || protocolReturnHistoryIsEmpty)
  const shouldWaitForPositionStats = hasHoldings && protocolReturnHistoryIsLoading
  const shouldDeferHistoryChart =
    isActive &&
    !hasResolvedNoYearnPositions &&
    (isHoldingsLoading || isAwaitingNoPositionsConfirmation || shouldWaitForPositionStats)

  return {
    hasResolvedNoYearnPositions,
    shouldDeferHistoryChart
  }
}
