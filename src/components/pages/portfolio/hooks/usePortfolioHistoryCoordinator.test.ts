import { resolvePortfolioHistoryCoordinatorState } from '@pages/portfolio/hooks/usePortfolioHistoryCoordinator'
import { describe, expect, it } from 'vitest'

describe('resolvePortfolioHistoryCoordinatorState', () => {
  it('keeps legacy disabled while the primary snapshot is pending', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: true,
        hasSnapshot: false,
        snapshotHasError: false,
        ledgerHasResponse: false,
        ledgerHasError: false,
        ledgerIsLoading: false
      })
    ).toEqual({ shouldUseLegacy: false, isLedgerPending: true })
  })

  it('enables legacy after a terminal snapshot failure such as 404 or 503', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: true,
        hasSnapshot: false,
        snapshotHasError: true,
        ledgerHasResponse: false,
        ledgerHasError: false,
        ledgerIsLoading: false
      })
    ).toEqual({ shouldUseLegacy: true, isLedgerPending: false })
  })

  it('keeps using a successful combined ledger response', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: true,
        hasSnapshot: true,
        snapshotHasError: false,
        ledgerHasResponse: true,
        ledgerHasError: false,
        ledgerIsLoading: false
      })
    ).toEqual({ shouldUseLegacy: false, isLedgerPending: false })
  })

  it('falls back when the combined ledger request fails before returning data', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: true,
        hasSnapshot: true,
        snapshotHasError: false,
        ledgerHasResponse: false,
        ledgerHasError: true,
        ledgerIsLoading: false
      })
    ).toEqual({ shouldUseLegacy: true, isLedgerPending: false })
  })

  it('does not report loading or start fallback while disconnected', () => {
    expect(
      resolvePortfolioHistoryCoordinatorState({
        canLoad: false,
        hasSnapshot: false,
        snapshotHasError: false,
        ledgerHasResponse: false,
        ledgerHasError: false,
        ledgerIsLoading: false
      })
    ).toEqual({ shouldUseLegacy: false, isLedgerPending: false })
  })
})
