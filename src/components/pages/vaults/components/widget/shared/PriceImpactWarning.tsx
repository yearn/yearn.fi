import { ZAP_SLIPPAGE_HARD_CAP } from '@shared/utils/slippage'
import type { ReactElement } from 'react'

type TPriceImpactWarningProps = {
  percentage: number
  userTolerancePercentage: number
  isBlocking: boolean
  isLoading: boolean
  isDebouncing: boolean
  isAmountSynced: boolean
  hasAmount: boolean
}

export function PriceImpactWarning({
  percentage,
  userTolerancePercentage,
  isBlocking,
  isLoading,
  isDebouncing,
  isAmountSynced,
  hasAmount
}: TPriceImpactWarningProps): ReactElement | null {
  if (
    (percentage <= userTolerancePercentage && !isBlocking) ||
    isLoading ||
    isDebouncing ||
    !isAmountSynced ||
    !hasAmount
  ) {
    return null
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
      {isBlocking ? (
        <p className="text-sm text-red-500">
          Total slippage is too high ({percentage.toFixed(2)}%). Transactions at or above{' '}
          {ZAP_SLIPPAGE_HARD_CAP.toFixed(2)}% are not supported. Try a smaller amount or use the base asset flow and
          swap elsewhere.
        </p>
      ) : (
        <p className="text-sm text-red-500">
          Total slippage is {percentage.toFixed(2)}%, above your {userTolerancePercentage.toFixed(2)}% tolerance.
          Increase your slippage tolerance in advanced settings by clicking the gear icon below if you want to continue.
        </p>
      )}
    </div>
  )
}
