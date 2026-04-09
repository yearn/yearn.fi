import { Tooltip } from '@shared/components/Tooltip'
import { IconInfo } from '@shared/icons/IconInfo'
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

  const tooltipContent = isBlocking ? (
    <div className="max-w-72 space-y-2 rounded-lg bg-surface-secondary px-3 py-2 text-xs text-text-primary shadow-sm">
      <p>Your price impact tolerance is {userTolerancePercentage.toFixed(2)}%.</p>
      <p>
        Transactions at or above {ZAP_SLIPPAGE_HARD_CAP.toFixed(2)}% are not supported. Try a smaller amount or use the
        base asset flow and swap elsewhere.
      </p>
    </div>
  ) : (
    <div className="max-w-72 space-y-2 rounded-lg bg-surface-secondary px-3 py-2 text-xs text-text-primary shadow-sm">
      <p>Your price impact tolerance is {userTolerancePercentage.toFixed(2)}%.</p>
      <p>
        Increase your price impact tolerance in advanced settings by clicking the gear icon below if you want to
        continue.
      </p>
    </div>
  )

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-red-500">
          Total price impact is <span className="font-semibold">{percentage.toFixed(2)}%</span>.
        </p>
        <Tooltip
          className="h-auto shrink-0 gap-0"
          openDelayMs={150}
          toggleOnClick
          align="right"
          tooltip={tooltipContent}
        >
          <button
            type="button"
            aria-label="Price impact details"
            className="text-red-500 transition-colors hover:text-red-400"
          >
            <IconInfo className="size-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
