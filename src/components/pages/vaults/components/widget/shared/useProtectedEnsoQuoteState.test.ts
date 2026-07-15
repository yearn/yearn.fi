import { describe, expect, it } from 'vitest'
import { type ProtectedQuoteSnapshot, resolveProtectedEnsoQuoteView } from './useProtectedEnsoQuoteState'

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
})
