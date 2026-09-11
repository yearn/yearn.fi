import { usePortfolioHistory } from '@pages/portfolio/hooks/usePortfolioHistory'
import { usePortfolioHistoryBundle } from '@pages/portfolio/hooks/usePortfolioHistoryBundle'
import { usePortfolioProtocolReturnHistory } from '@pages/portfolio/hooks/usePortfolioProtocolReturnHistory'
import type {
  TPortfolioHistoryDenomination,
  TPortfolioHistoryTimeframe,
  TPortfolioLiveBalanceSnapshot
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'

export function resolvePortfolioHistorySource(args: {
  canLoad: boolean
  hasCombinedResponse: boolean
  combinedError: Error | null
}): { shouldUseLegacy: boolean; isCombinedPending: boolean } {
  const shouldUseLegacy = args.canLoad && !args.hasCombinedResponse && Boolean(args.combinedError)
  return {
    shouldUseLegacy,
    isCombinedPending: args.canLoad && !shouldUseLegacy && !args.hasCombinedResponse
  }
}

export function shouldLoadPortfolioHistory(args: {
  isActive: boolean
  isHoldingsLoading: boolean
  isPositionsTab: boolean
}): boolean {
  // History is server-derived, so wallet balance discovery does not gate it.
  return args.isActive && args.isPositionsTab
}

export function usePortfolioHistoryCoordinator(
  denomination: TPortfolioHistoryDenomination = 'usd',
  timeframe: TPortfolioHistoryTimeframe = '1y',
  enabled = true,
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null = null
) {
  const { address } = useWeb3()
  const canLoad = Boolean(address) && enabled
  const combined = usePortfolioHistoryBundle(denomination, timeframe, canLoad, liveSnapshot)
  const { shouldUseLegacy, isCombinedPending } = resolvePortfolioHistorySource({
    canLoad,
    hasCombinedResponse: combined.hasResponse,
    combinedError: combined.requestError
  })
  const legacyBalance = usePortfolioHistory(denomination, timeframe, shouldUseLegacy, liveSnapshot)
  const legacyProtocolReturn = usePortfolioProtocolReturnHistory(timeframe, shouldUseLegacy)

  return {
    balance: shouldUseLegacy
      ? legacyBalance
      : { ...combined.balance, isLoading: combined.balance.isLoading || isCombinedPending },
    protocolReturn: shouldUseLegacy
      ? legacyProtocolReturn
      : { ...combined.protocolReturn, isLoading: combined.protocolReturn.isLoading || isCombinedPending },
    growth: combined.growth,
    source: shouldUseLegacy ? ('legacy' as const) : ('combined' as const)
  }
}
