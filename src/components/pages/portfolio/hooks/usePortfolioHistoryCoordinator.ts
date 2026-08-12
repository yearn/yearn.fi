import { usePortfolioHistory } from '@pages/portfolio/hooks/usePortfolioHistory'
import { usePortfolioLedgerPortfolio } from '@pages/portfolio/hooks/usePortfolioLedgerPortfolio'
import { usePortfolioProtocolReturnHistory } from '@pages/portfolio/hooks/usePortfolioProtocolReturnHistory'
import type {
  TPortfolioHistoryDenomination,
  TPortfolioHistoryTimeframe,
  TPortfolioLiveBalanceSnapshot
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'

export function shouldLoadPortfolioPositionsHistory(args: {
  activeTab: 'positions' | 'activity' | 'claim-rewards'
  isWalletConnected: boolean
}): boolean {
  return args.activeTab === 'positions' && args.isWalletConnected
}

export function resolvePortfolioHistoryCoordinatorState(args: {
  canLoad: boolean
  ledgerHasResponse: boolean
  ledgerHasError: boolean
}): { shouldUseLegacy: boolean; isLedgerPending: boolean } {
  const shouldUseLegacy = args.canLoad && !args.ledgerHasResponse && args.ledgerHasError
  const isLedgerPending = args.canLoad && !shouldUseLegacy && !args.ledgerHasResponse

  return { shouldUseLegacy, isLedgerPending }
}

export function usePortfolioHistoryCoordinator(
  denomination: TPortfolioHistoryDenomination = 'usd',
  timeframe: TPortfolioHistoryTimeframe = '1y',
  enabled = true,
  liveSnapshot: TPortfolioLiveBalanceSnapshot | null = null
) {
  const { address } = useWeb3()
  const canLoad = Boolean(address) && enabled
  const ledger = usePortfolioLedgerPortfolio(denomination, timeframe, canLoad, liveSnapshot)
  const { shouldUseLegacy, isLedgerPending } = resolvePortfolioHistoryCoordinatorState({
    canLoad,
    ledgerHasResponse: ledger.hasResponse,
    ledgerHasError: Boolean(ledger.requestError)
  })
  const legacyBalance = usePortfolioHistory(denomination, timeframe, shouldUseLegacy, liveSnapshot)
  const legacyProtocolReturn = usePortfolioProtocolReturnHistory(timeframe, shouldUseLegacy)

  const balance = shouldUseLegacy
    ? legacyBalance
    : {
        ...ledger.balance,
        isLoading: ledger.balance.isLoading || isLedgerPending
      }
  const protocolReturn = shouldUseLegacy
    ? legacyProtocolReturn
    : {
        ...ledger.protocolReturn,
        isLoading: ledger.protocolReturn.isLoading || isLedgerPending
      }

  return {
    balance,
    protocolReturn,
    source: shouldUseLegacy ? ('legacy' as const) : ('ledger' as const),
    growth: ledger.growth,
    ledger: ledger.ledger,
    snapshotId: null,
    snapshot: null
  }
}
