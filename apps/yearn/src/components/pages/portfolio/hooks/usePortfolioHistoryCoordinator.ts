import { usePortfolioHistoryBundle } from '@pages/portfolio/hooks/usePortfolioHistoryBundle'
import type {
  TPortfolioHistoryDenomination,
  TPortfolioHistoryTimeframe,
  TPortfolioLiveBalanceSnapshot
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'

export function shouldLoadPortfolioHistory(args: { isActive: boolean; isPositionsTab: boolean }): boolean {
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

  return {
    balance: combined.balance,
    protocolReturn: combined.protocolReturn,
    growth: combined.growth
  }
}
