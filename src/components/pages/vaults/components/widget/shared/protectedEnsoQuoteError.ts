import type { ProtectedEnsoBlockedReason } from './useProtectedEnsoQuoteState'

export function getProtectedEnsoQuoteError({
  blockedReason,
  hasUnpricedQuoteError,
  isDebouncing,
  flow
}: {
  blockedReason?: ProtectedEnsoBlockedReason
  hasUnpricedQuoteError: boolean
  isDebouncing: boolean
  flow: 'deposit' | 'withdraw'
}): string | null {
  if (isDebouncing) {
    return null
  }

  if (blockedReason === 'cross-chain-minimum-slippage') {
    return 'Cross-chain routes require at least 0.01% slippage.'
  }

  if (blockedReason === 'no-protected-tolerance') {
    return flow === 'deposit'
      ? 'No protected slippage remains after estimated price impact. Increase your tolerance or use the base asset flow.'
      : 'No protected slippage remains after estimated price impact. Increase your tolerance or withdraw the base asset.'
  }

  if (hasUnpricedQuoteError) {
    return flow === 'deposit'
      ? 'Unable to estimate zap price impact for the selected token. Use the base asset flow or swap elsewhere.'
      : 'Unable to estimate zap price impact for the selected token. Withdraw the base asset or swap elsewhere.'
  }

  return null
}
