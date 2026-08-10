import { usePortfolioHistory } from '@pages/portfolio/hooks/usePortfolioHistory'
import { usePortfolioLedgerGrowth } from '@pages/portfolio/hooks/usePortfolioLedgerGrowth'
import { usePortfolioLedgerHistory } from '@pages/portfolio/hooks/usePortfolioLedgerHistory'
import { usePortfolioLedgerSnapshot } from '@pages/portfolio/hooks/usePortfolioLedgerSnapshot'
import { usePortfolioProtocolReturnHistory } from '@pages/portfolio/hooks/usePortfolioProtocolReturnHistory'
import type {
  TPortfolioHistoryDenomination,
  TPortfolioHistoryTimeframe,
  TPortfolioLiveBalanceSnapshot
} from '@pages/portfolio/types/api'
import { useWeb3 } from '@shared/contexts/useWeb3'

export function resolvePortfolioHistoryCoordinatorState(args: {
  canLoad: boolean
  hasSnapshot: boolean
  snapshotHasError: boolean
  ledgerHasResponse: boolean
  ledgerHasError: boolean
  ledgerIsLoading: boolean
}): { shouldUseLegacy: boolean; isLedgerPending: boolean } {
  const snapshotFailed = !args.hasSnapshot && args.snapshotHasError
  const ledgerHistoryFailed = !args.ledgerHasResponse && args.ledgerHasError
  const shouldUseLegacy = args.canLoad && (snapshotFailed || ledgerHistoryFailed)
  const isLedgerPending =
    args.canLoad && !shouldUseLegacy && (!args.hasSnapshot || (!args.ledgerHasResponse && args.ledgerIsLoading))

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
  const snapshot = usePortfolioLedgerSnapshot(canLoad)
  const snapshotId = snapshot.data?.snapshotId ?? null
  const ledger = usePortfolioLedgerHistory(denomination, timeframe, snapshotId, canLoad, liveSnapshot)
  const growth = usePortfolioLedgerGrowth(snapshotId, canLoad)
  const { shouldUseLegacy, isLedgerPending } = resolvePortfolioHistoryCoordinatorState({
    canLoad,
    hasSnapshot: Boolean(snapshot.data),
    snapshotHasError: snapshot.isError,
    ledgerHasResponse: ledger.hasResponse,
    ledgerHasError: Boolean(ledger.requestError),
    ledgerIsLoading: ledger.balance.isLoading
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
    growth,
    snapshotId,
    snapshot
  }
}
