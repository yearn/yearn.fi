import type { TAddress } from '@shared/types'
import {
  calculateRemainingEnsoSlippagePercentage,
  MIN_CROSS_CHAIN_ENSO_SLIPPAGE_BPS,
  optionalBasisPointsToPercentage,
  toBasisPoints,
  ZAP_SLIPPAGE_HARD_CAP
} from '@shared/utils/slippage'
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
  requestedSlippage: number
  setRequestedSlippage: (value: number) => void
  isLoadingQuote: boolean
  userTolerancePercentage: number
  localPriceImpactPercentage: number
  localWorstCasePriceImpactPercentage: number
  hasIncompleteUsdValuation: boolean
  ensoPriceImpact?: number | null
  expectedOut: bigint
  minExpectedOut: bigint
  tx?: ProtectedEnsoTx
  display: TDisplay
}

export function resolveProtectedEnsoQuoteView<TDisplay>({
  isEnsoRoute,
  isCrossChain,
  amount,
  requestedSlippage,
  isLoadingQuote,
  hasCurrentQuote,
  currentSnapshot,
  cachedSnapshot,
  desiredSlippage,
  userTolerancePercentage,
  fallbackDisplay,
  fallbackEstimatedPriceImpactPercentage,
  fallbackWorstCaseRouteImpactPercentage,
  tx
}: {
  isEnsoRoute: boolean
  isCrossChain: boolean
  amount: bigint
  requestedSlippage: number
  isLoadingQuote: boolean
  hasCurrentQuote: boolean
  currentSnapshot: ProtectedQuoteSnapshot<TDisplay>
  cachedSnapshot?: ProtectedQuoteSnapshot<TDisplay>
  desiredSlippage: number
  userTolerancePercentage: number
  fallbackDisplay: TDisplay
  fallbackEstimatedPriceImpactPercentage: number
  fallbackWorstCaseRouteImpactPercentage: number
  tx?: ProtectedEnsoTx
}) {
  const isCalibrationQuote = isEnsoRoute && requestedSlippage === 0
  const hasCompletedCalibration = isCalibrationQuote && hasCurrentQuote && !isLoadingQuote
  const hasNoProtectedTolerance = hasCompletedCalibration && desiredSlippage === 0
  const hasInsufficientCrossChainTolerance =
    isCrossChain && toBasisPoints(userTolerancePercentage) < MIN_CROSS_CHAIN_ENSO_SLIPPAGE_BPS
  const isWaitingForProtectedQuote =
    isEnsoRoute &&
    amount > 0n &&
    ((requestedSlippage === 0 && hasCurrentQuote && desiredSlippage > 0) || (requestedSlippage > 0 && isLoadingQuote))
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
              : hasCurrentQuote
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
    executableTx: canExecute ? tx : undefined
  }
}

export function useProtectedEnsoQuoteState<TDisplay>({
  stateKey,
  isEnsoRoute,
  isCrossChain,
  amount,
  requestedSlippage,
  setRequestedSlippage,
  isLoadingQuote,
  userTolerancePercentage,
  localPriceImpactPercentage,
  localWorstCasePriceImpactPercentage,
  hasIncompleteUsdValuation,
  ensoPriceImpact,
  expectedOut,
  minExpectedOut,
  tx,
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
    if (!isEnsoRoute || requestedSlippage !== 0 || amount === 0n || isLoadingQuote || !hasCurrentQuote) {
      return
    }

    if (desiredSlippage > 0) {
      setRequestedSlippage(desiredSlippage)
    }
  }, [amount, desiredSlippage, hasCurrentQuote, isEnsoRoute, isLoadingQuote, requestedSlippage, setRequestedSlippage])

  const view = resolveProtectedEnsoQuoteView({
    isEnsoRoute,
    isCrossChain,
    amount,
    requestedSlippage,
    isLoadingQuote,
    hasCurrentQuote,
    currentSnapshot,
    cachedSnapshot: snapshotRef.current,
    desiredSlippage,
    userTolerancePercentage,
    fallbackDisplay: display,
    fallbackEstimatedPriceImpactPercentage: estimatedPriceImpactPercentage,
    fallbackWorstCaseRouteImpactPercentage: worstCaseRouteImpactPercentage,
    tx
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
