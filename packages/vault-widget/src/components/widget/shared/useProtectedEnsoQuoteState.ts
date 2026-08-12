import {
  calculateRemainingEnsoSlippagePercentage,
  MIN_CROSS_CHAIN_ENSO_SLIPPAGE_BPS,
  optionalBasisPointsToPercentage,
  toBasisPoints,
  ZAP_SLIPPAGE_HARD_CAP
} from '@yearn/vault-widget/internal/utils/slippage'
import type { TAddress } from '@yearn/vault-widget/types'
import { useEffect, useMemo, useRef } from 'react'
import type { Hex } from 'viem'

export type ProtectedEnsoRouteState = 'idle' | 'loading' | 'protecting' | 'ready' | 'blocked'
export type ProtectedEnsoBlockedReason = 'cross-chain-minimum-slippage' | 'no-protected-tolerance' | 'price-impact'

export type ProtectedEnsoTx = {
  to: TAddress
  data: Hex
  value: string
  from: TAddress
}

export type ProtectedEnsoQuoteRequest =
  | { purpose: 'calibration'; slippagePercentage: 0 }
  | { purpose: 'execution'; slippagePercentage: number }

export type ProtectedEnsoQuoteCandidate =
  | { purpose: 'calibration' }
  | { purpose: 'execution'; tx: ProtectedEnsoTx }
  | { purpose: 'unavailable' }

export function getProtectedEnsoQuoteCandidate(params: {
  isEnsoRoute: boolean
  purpose: ProtectedEnsoQuoteRequest['purpose']
  tx?: ProtectedEnsoTx
}): ProtectedEnsoQuoteCandidate {
  if (!params.isEnsoRoute) return { purpose: 'unavailable' }
  if (params.purpose === 'calibration') return { purpose: 'calibration' }
  return params.tx ? { purpose: 'execution', tx: params.tx } : { purpose: 'unavailable' }
}

export type ProtectedQuoteSnapshot<TDisplay> = {
  display: TDisplay
  expectedOut: bigint
  minExpectedOut: bigint
  estimatedPriceImpactPercentage: number
  worstCaseRouteImpactPercentage: number
}

type UseProtectedEnsoQuoteStateParams<TDisplay> = {
  stateKey: string
  isEnsoRoute: boolean
  isCrossChain: boolean
  amount: bigint
  quoteRequest: ProtectedEnsoQuoteRequest
  requestExecutionQuote: (slippagePercentage: number) => void
  isLoadingQuote: boolean
  userTolerancePercentage: number
  localPriceImpactPercentage: number
  localWorstCasePriceImpactPercentage: number
  hasIncompleteUsdValuation: boolean
  ensoPriceImpact?: number | null
  expectedOut: bigint
  minExpectedOut: bigint
  quote: ProtectedEnsoQuoteCandidate
  display: TDisplay
}

export function resolveProtectedEnsoQuoteView<TDisplay>({
  isEnsoRoute,
  isCrossChain,
  amount,
  quotePurpose,
  isLoadingQuote,
  hasCurrentQuote,
  currentSnapshot,
  cachedSnapshot,
  desiredSlippage,
  userTolerancePercentage,
  fallbackDisplay,
  fallbackEstimatedPriceImpactPercentage,
  fallbackWorstCaseRouteImpactPercentage,
  quote
}: {
  isEnsoRoute: boolean
  isCrossChain: boolean
  amount: bigint
  quotePurpose: ProtectedEnsoQuoteRequest['purpose']
  isLoadingQuote: boolean
  hasCurrentQuote: boolean
  currentSnapshot: ProtectedQuoteSnapshot<TDisplay>
  cachedSnapshot?: ProtectedQuoteSnapshot<TDisplay>
  desiredSlippage: number
  userTolerancePercentage: number
  fallbackDisplay: TDisplay
  fallbackEstimatedPriceImpactPercentage: number
  fallbackWorstCaseRouteImpactPercentage: number
  quote: ProtectedEnsoQuoteCandidate
}) {
  const isCalibrationQuote = isEnsoRoute && quotePurpose === 'calibration'
  const hasCompletedCalibration = isCalibrationQuote && hasCurrentQuote && !isLoadingQuote
  const hasNoProtectedTolerance = hasCompletedCalibration && desiredSlippage === 0
  const hasInsufficientCrossChainTolerance =
    isCrossChain && toBasisPoints(userTolerancePercentage) < MIN_CROSS_CHAIN_ENSO_SLIPPAGE_BPS
  const isWaitingForProtectedQuote =
    isEnsoRoute &&
    amount > 0n &&
    ((quotePurpose === 'calibration' && hasCurrentQuote && desiredSlippage > 0) ||
      (quotePurpose === 'execution' && isLoadingQuote))
  const canDisplayCurrentQuote =
    hasCurrentQuote && !isCalibrationQuote && !isWaitingForProtectedQuote && !isLoadingQuote
  const snapshot = canDisplayCurrentQuote ? currentSnapshot : cachedSnapshot
  const isPreparing = isLoadingQuote || isWaitingForProtectedQuote
  const isDisplayLoading = isEnsoRoute && amount > 0n && isPreparing
  const displayedEstimatedPriceImpactPercentage =
    snapshot?.estimatedPriceImpactPercentage ?? fallbackEstimatedPriceImpactPercentage
  const displayedWorstCaseRouteImpactPercentage =
    snapshot?.worstCaseRouteImpactPercentage ?? fallbackWorstCaseRouteImpactPercentage

  const priceImpactInfo = !isEnsoRoute
    ? {
        percentage: 0,
        isAboveTolerance: false,
        isBlocking: false
      }
    : {
        percentage: displayedWorstCaseRouteImpactPercentage,
        isAboveTolerance: displayedWorstCaseRouteImpactPercentage > userTolerancePercentage,
        isBlocking: displayedWorstCaseRouteImpactPercentage >= ZAP_SLIPPAGE_HARD_CAP
      }

  const routeState: ProtectedEnsoRouteState =
    !isEnsoRoute || amount === 0n
      ? 'idle'
      : hasNoProtectedTolerance
        ? 'blocked'
        : isWaitingForProtectedQuote
          ? 'protecting'
          : isDisplayLoading
            ? 'loading'
            : priceImpactInfo.isBlocking || priceImpactInfo.isAboveTolerance
              ? 'blocked'
              : hasCurrentQuote && (!isEnsoRoute || quote.purpose === 'execution')
                ? 'ready'
                : 'loading'

  const blockedReason: ProtectedEnsoBlockedReason | undefined = hasNoProtectedTolerance
    ? hasInsufficientCrossChainTolerance
      ? 'cross-chain-minimum-slippage'
      : 'no-protected-tolerance'
    : priceImpactInfo.isBlocking || priceImpactInfo.isAboveTolerance
      ? 'price-impact'
      : undefined
  const canExecute = !isEnsoRoute || routeState === 'ready'

  return {
    routeState,
    blockedReason,
    canExecute,
    display: snapshot?.display ?? fallbackDisplay,
    isPreparing,
    isDisplayLoading,
    isWaitingForProtectedQuote,
    canDisplayCurrentQuote,
    estimatedPriceImpactPercentage: displayedEstimatedPriceImpactPercentage,
    worstCaseRouteImpactPercentage: displayedWorstCaseRouteImpactPercentage,
    priceImpactInfo,
    executableTx: canExecute && quote.purpose === 'execution' ? quote.tx : undefined
  }
}

export function useProtectedEnsoQuoteState<TDisplay>({
  stateKey,
  isEnsoRoute,
  isCrossChain,
  amount,
  quoteRequest,
  requestExecutionQuote,
  isLoadingQuote,
  userTolerancePercentage,
  localPriceImpactPercentage,
  localWorstCasePriceImpactPercentage,
  hasIncompleteUsdValuation,
  ensoPriceImpact,
  expectedOut,
  minExpectedOut,
  quote,
  display
}: UseProtectedEnsoQuoteStateParams<TDisplay>) {
  const resetKey = isEnsoRoute && amount > 0n ? stateKey : 'inactive'
  const resetKeyRef = useRef(resetKey)
  const snapshotRef = useRef<ProtectedQuoteSnapshot<TDisplay> | undefined>(undefined)

  if (resetKeyRef.current !== resetKey) {
    resetKeyRef.current = resetKey
    snapshotRef.current = undefined
  }

  const ensoPriceImpactPercentage = isEnsoRoute ? optionalBasisPointsToPercentage(ensoPriceImpact) : undefined
  const estimatedPriceImpactPercentage =
    isEnsoRoute && ensoPriceImpactPercentage !== undefined
      ? Math.max(localPriceImpactPercentage, ensoPriceImpactPercentage)
      : localPriceImpactPercentage
  const worstCaseRouteImpactPercentage =
    isEnsoRoute && ensoPriceImpactPercentage !== undefined
      ? Math.max(localWorstCasePriceImpactPercentage, ensoPriceImpactPercentage)
      : localWorstCasePriceImpactPercentage

  const desiredSlippage = useMemo(
    () =>
      isEnsoRoute
        ? hasIncompleteUsdValuation && ensoPriceImpactPercentage === undefined
          ? 0
          : calculateRemainingEnsoSlippagePercentage({
              userTolerancePercentage,
              quoteImpactPercentage: estimatedPriceImpactPercentage
            })
        : 0,
    [
      ensoPriceImpactPercentage,
      estimatedPriceImpactPercentage,
      hasIncompleteUsdValuation,
      isEnsoRoute,
      userTolerancePercentage
    ]
  )

  const hasCurrentQuote = isEnsoRoute && amount > 0n && expectedOut > 0n
  const currentSnapshot = useMemo(
    (): ProtectedQuoteSnapshot<TDisplay> => ({
      display,
      expectedOut,
      minExpectedOut,
      estimatedPriceImpactPercentage,
      worstCaseRouteImpactPercentage
    }),
    [display, estimatedPriceImpactPercentage, expectedOut, minExpectedOut, worstCaseRouteImpactPercentage]
  )

  useEffect(() => {
    if (!isEnsoRoute || quoteRequest.purpose !== 'calibration' || amount === 0n || isLoadingQuote || !hasCurrentQuote) {
      return
    }

    if (desiredSlippage > 0) {
      requestExecutionQuote(desiredSlippage)
    }
  }, [
    amount,
    desiredSlippage,
    hasCurrentQuote,
    isEnsoRoute,
    isLoadingQuote,
    quoteRequest.purpose,
    requestExecutionQuote
  ])

  const view = resolveProtectedEnsoQuoteView({
    isEnsoRoute,
    isCrossChain,
    amount,
    quotePurpose: quoteRequest.purpose,
    isLoadingQuote,
    hasCurrentQuote,
    currentSnapshot,
    cachedSnapshot: snapshotRef.current,
    desiredSlippage,
    userTolerancePercentage,
    fallbackDisplay: display,
    fallbackEstimatedPriceImpactPercentage: estimatedPriceImpactPercentage,
    fallbackWorstCaseRouteImpactPercentage: worstCaseRouteImpactPercentage,
    quote
  })

  useEffect(() => {
    if (view.canDisplayCurrentQuote) {
      snapshotRef.current = currentSnapshot
    }
  }, [currentSnapshot, view.canDisplayCurrentQuote])

  return {
    ...view,
    desiredSlippage,
    ensoPriceImpactPercentage,
    hasUnpricedQuoteError:
      isEnsoRoute &&
      ensoPriceImpactPercentage === undefined &&
      hasIncompleteUsdValuation &&
      amount > 0n &&
      !view.isPreparing
  }
}
