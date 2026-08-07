// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
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

type Display = {
  amount: bigint
  routeHasSwap: boolean
}

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
  it('keeps bootstrap quotes out of display and execution state while protecting', () => {
    const view = resolveProtectedEnsoQuoteView({
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      requestedSlippage: 0,
      isLoadingQuote: false,
      hasCurrentQuote: true,
      currentSnapshot: snapshot(1000n, true),
      desiredSlippage: 0.2,
      userTolerancePercentage: 0.5,
      fallbackDisplay: { amount: 0n, routeHasSwap: false },
      fallbackEstimatedPriceImpactPercentage: 0,
      fallbackWorstCaseRouteImpactPercentage: 0,
      tx: TX
    })

    expect(view.routeState).toBe('protecting')
    expect(view.isPreparing).toBe(true)
    expect(view.isDisplayLoading).toBe(true)
    expect(view.display.amount).toBe(0n)
    expect(view.display.routeHasSwap).toBe(false)
    expect(view.executableTx).toBeUndefined()
  })

  it('keeps the quote view loading while a protected quote refetches, even with a cached display', () => {
    const view = resolveProtectedEnsoQuoteView({
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      requestedSlippage: 0.2,
      isLoadingQuote: true,
      hasCurrentQuote: false,
      currentSnapshot: snapshot(0n),
      cachedSnapshot: snapshot(995n, true),
      desiredSlippage: 0.2,
      userTolerancePercentage: 0.5,
      fallbackDisplay: { amount: 0n, routeHasSwap: false },
      fallbackEstimatedPriceImpactPercentage: 0,
      fallbackWorstCaseRouteImpactPercentage: 0,
      tx: TX
    })

    expect(view.routeState).toBe('protecting')
    expect(view.isPreparing).toBe(true)
    expect(view.isDisplayLoading).toBe(true)
    expect(view.display.amount).toBe(995n)
    expect(view.display.routeHasSwap).toBe(true)
    expect(view.executableTx).toBeUndefined()
  })

  it('blocks a completed calibration with no remaining protected tolerance', () => {
    const view = resolveProtectedEnsoQuoteView({
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      requestedSlippage: 0,
      isLoadingQuote: false,
      hasCurrentQuote: true,
      currentSnapshot: snapshot(1000n, true),
      desiredSlippage: 0,
      userTolerancePercentage: 0,
      fallbackDisplay: { amount: 0n, routeHasSwap: false },
      fallbackEstimatedPriceImpactPercentage: 0,
      fallbackWorstCaseRouteImpactPercentage: 0,
      tx: TX
    })

    expect(view.routeState).toBe('blocked')
    expect(view.blockedReason).toBe('cross-chain-minimum-slippage')
    expect(view.isPreparing).toBe(false)
    expect(view.executableTx).toBeUndefined()
  })

  it('preserves existing price-impact and hard-cap blocking', () => {
    const view = resolveProtectedEnsoQuoteView({
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      requestedSlippage: 0.5,
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
      tx: TX
    })

    expect(view.routeState).toBe('blocked')
    expect(view.blockedReason).toBe('price-impact')
    expect(view.priceImpactInfo.isBlocking).toBe(true)
    expect(view.executableTx).toBeUndefined()
  })
})

describe('useProtectedEnsoQuoteState', () => {
  it('requests a second protected quote and only exposes its transaction', async () => {
    const setRequestedSlippage = vi.fn()
    const initialProps = {
      stateKey: 'cross-chain-deposit',
      isEnsoRoute: true,
      isCrossChain: true,
      amount: 1000n,
      requestedSlippage: 0,
      setRequestedSlippage,
      isLoadingQuote: false,
      userTolerancePercentage: 1,
      localPriceImpactPercentage: 0.5,
      localWorstCasePriceImpactPercentage: 0.5,
      hasIncompleteUsdValuation: false,
      ensoPriceImpact: 50,
      expectedOut: 995n,
      minExpectedOut: 990n,
      tx: TX as ProtectedEnsoTx,
      display: { amount: 990n, routeHasSwap: true }
    }
    const { result, rerender } = renderHook((props) => useProtectedEnsoQuoteState(props), {
      initialProps
    })

    expect(result.current.executableTx).toBeUndefined()
    await waitFor(() => expect(setRequestedSlippage).toHaveBeenCalledWith(0.5))

    const protectedTx: ProtectedEnsoTx = { ...TX, data: '0x1234' }
    rerender({
      ...initialProps,
      requestedSlippage: 0.5,
      expectedOut: 994n,
      minExpectedOut: 989n,
      tx: protectedTx,
      display: { amount: 989n, routeHasSwap: true }
    })

    expect(result.current.routeState).toBe('ready')
    expect(result.current.executableTx).toEqual(protectedTx)
    expect(result.current.desiredSlippage).toBeLessThanOrEqual(initialProps.userTolerancePercentage)
  })
})
