import { resolvePortfolioHistoryCoordinatorState } from '@pages/portfolio/hooks/usePortfolioHistoryCoordinator'
import { describe, expect, it } from 'vitest'

describe('resolvePortfolioHistoryCoordinatorState', () => {
  it('keeps legacy disabled while the combined request is pending', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: true,
        ledgerHasResponse: false,
        ledgerHasError: false
      })
    ).toEqual({ shouldUseLegacy: false, isLedgerPending: true })
  })

  it('enables legacy after a cold terminal combined-request failure', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: true,
        ledgerHasResponse: false,
        ledgerHasError: true
      })
    ).toEqual({ shouldUseLegacy: true, isLedgerPending: false })
  })

  it('keeps using a successful combined ledger response', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: true,
        ledgerHasResponse: true,
        ledgerHasError: false
      })
    ).toEqual({ shouldUseLegacy: false, isLedgerPending: false })
  })

  it('keeps stale combined data instead of falling back after a background refresh failure', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: true,
        ledgerHasResponse: true,
        ledgerHasError: true
      })
    ).toEqual({ shouldUseLegacy: false, isLedgerPending: false })
  })

  it('does not report loading or start fallback while disconnected', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: false,
        ledgerHasResponse: false,
        ledgerHasError: false
      })
    ).toEqual({ shouldUseLegacy: false, isLedgerPending: false })
  })
})
