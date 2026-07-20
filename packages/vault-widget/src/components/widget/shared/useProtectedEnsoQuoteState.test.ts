// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  getProtectedEnsoQuoteCandidate,
  type ProtectedEnsoQuoteCandidate,
  type ProtectedEnsoQuoteRequest,
  type ProtectedEnsoTx,
  type ProtectedQuoteSnapshot,
  resolveProtectedEnsoQuoteView,
  useProtectedEnsoQuoteState
} from './useProtectedEnsoQuoteState'

const TX = {
  to: '0x0000000000000000000000000000000000000001',
  data: '0x',
  value: '0',
  from: '0x0000000000000000000000000000000000000002'
} as const

type Display = { amount: bigint; routeHasSwap: boolean }

function snapshot(amount: bigint, routeHasSwap = false): ProtectedQuoteSnapshot<Display> {
  return {
    display: { amount, routeHasSwap },
    expectedOut: amount,
    minExpectedOut: amount,
    estimatedPriceImpactPercentage: 0.3,
    worstCaseRouteImpactPercentage: 0.3
  }
}

describe('resolveProtectedEnsoQuoteView', () => {
  it('discards transaction data at the calibration boundary', () => {
    expect(getProtectedEnsoQuoteCandidate({ isEnsoRoute: true, purpose: 'calibration', tx: TX })).toEqual({
      purpose: 'calibration'
    })
  })

  it('keeps calibration quotes out of display and execution state', () => {
    const view = resolveProtectedEnsoQuoteView({
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      quotePurpose: 'calibration',
      isLoadingQuote: false,
      hasCurrentQuote: true,
      currentSnapshot: snapshot(1000n, true),
      desiredSlippage: 0.2,
      userTolerancePercentage: 0.5,
      fallbackDisplay: { amount: 0n, routeHasSwap: false },
      fallbackEstimatedPriceImpactPercentage: 0,
      fallbackWorstCaseRouteImpactPercentage: 0,
      quote: { purpose: 'calibration' }
    })

    expect(view.routeState).toBe('protecting')
    expect(view.canExecute).toBe(false)
    expect(view.executableTx).toBeUndefined()
  })

  it('blocks a completed calibration with no remaining protected tolerance', () => {
    const view = resolveProtectedEnsoQuoteView({
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      quotePurpose: 'calibration',
      isLoadingQuote: false,
      hasCurrentQuote: true,
      currentSnapshot: snapshot(1000n, true),
      desiredSlippage: 0,
      userTolerancePercentage: 0,
      fallbackDisplay: { amount: 0n, routeHasSwap: false },
      fallbackEstimatedPriceImpactPercentage: 0,
      fallbackWorstCaseRouteImpactPercentage: 0,
      quote: { purpose: 'calibration' }
    })

    expect(view.routeState).toBe('blocked')
    expect(view.blockedReason).toBe('cross-chain-minimum-slippage')
    expect(view.executableTx).toBeUndefined()
  })

  it('preserves the five-percent hard cap', () => {
    const view = resolveProtectedEnsoQuoteView({
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      quotePurpose: 'execution',
      isLoadingQuote: false,
      hasCurrentQuote: true,
      currentSnapshot: {
        ...snapshot(900n, true),
        estimatedPriceImpactPercentage: 5,
        worstCaseRouteImpactPercentage: 5
      },
      desiredSlippage: 0.5,
      userTolerancePercentage: 5,
      fallbackDisplay: { amount: 0n, routeHasSwap: false },
      fallbackEstimatedPriceImpactPercentage: 0,
      fallbackWorstCaseRouteImpactPercentage: 0,
      quote: { purpose: 'execution', tx: TX }
    })

    expect(view.routeState).toBe('blocked')
    expect(view.blockedReason).toBe('price-impact')
    expect(view.priceImpactInfo.isBlocking).toBe(true)
    expect(view.executableTx).toBeUndefined()
  })
})

describe('useProtectedEnsoQuoteState', () => {
  it('does not request pass two when positive tolerance is exhausted', () => {
    const requestExecutionQuote = vi.fn()
    const { result } = renderHook(() =>
      useProtectedEnsoQuoteState({
        stateKey: 'exhausted-cross-chain-deposit',
        isEnsoRoute: true,
        isCrossChain: true,
        amount: 1000n,
        quoteRequest: { purpose: 'calibration', slippagePercentage: 0 },
        requestExecutionQuote,
        isLoadingQuote: false,
        userTolerancePercentage: 1,
        localPriceImpactPercentage: 1,
        localWorstCasePriceImpactPercentage: 1,
        hasIncompleteUsdValuation: false,
        ensoPriceImpact: 100,
        expectedOut: 990n,
        minExpectedOut: 990n,
        quote: { purpose: 'calibration' },
        display: { amount: 990n, routeHasSwap: true }
      })
    )

    expect(result.current.blockedReason).toBe('no-protected-tolerance')
    expect(result.current.canExecute).toBe(false)
    expect(requestExecutionQuote).not.toHaveBeenCalled()
  })

  it('requests a second quote and only exposes that transaction', async () => {
    const requestExecutionQuote = vi.fn()
    const initialProps = {
      stateKey: 'cross-chain-deposit',
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      quoteRequest: { purpose: 'calibration', slippagePercentage: 0 } as ProtectedEnsoQuoteRequest,
      requestExecutionQuote,
      isLoadingQuote: false,
      userTolerancePercentage: 1,
      localPriceImpactPercentage: 0.5,
      localWorstCasePriceImpactPercentage: 0.5,
      hasIncompleteUsdValuation: false,
      ensoPriceImpact: 50,
      expectedOut: 995n,
      minExpectedOut: 990n,
      quote: { purpose: 'calibration' } as ProtectedEnsoQuoteCandidate,
      display: { amount: 990n, routeHasSwap: true }
    }
    const { result, rerender } = renderHook((props) => useProtectedEnsoQuoteState(props), { initialProps })

    expect(result.current.executableTx).toBeUndefined()
    await waitFor(() => expect(requestExecutionQuote).toHaveBeenCalledWith(0.5))

    const protectedTx: ProtectedEnsoTx = { ...TX, data: '0x1234' }
    rerender({
      ...initialProps,
      quoteRequest: { purpose: 'execution', slippagePercentage: 0.5 },
      expectedOut: 994n,
      minExpectedOut: 989n,
      quote: { purpose: 'execution', tx: protectedTx },
      display: { amount: 989n, routeHasSwap: true }
    })

    expect(result.current.routeState).toBe('ready')
    expect(result.current.executableTx).toEqual(protectedTx)
    expect(result.current.desiredSlippage).toBeLessThanOrEqual(initialProps.userTolerancePercentage)
  })
})
