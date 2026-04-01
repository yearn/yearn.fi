import type { ReactElement } from 'react'

type TPriceImpactWarningProps = {
  percentage: number
  isHigh: boolean
  isLoading: boolean
  isDebouncing: boolean
  isAmountSynced: boolean
  hasAmount: boolean
  hasAcceptedPriceImpact: boolean
  priceImpactAcceptanceKey: string
  setAcceptedPriceImpactKey: (key: string | null) => void
  actionVerb?: string
}

export function PriceImpactWarning({
  percentage,
  isHigh,
  isLoading,
  isDebouncing,
  isAmountSynced,
  hasAmount,
  hasAcceptedPriceImpact,
  priceImpactAcceptanceKey,
  setAcceptedPriceImpactKey,
  actionVerb = 'depositing'
}: TPriceImpactWarningProps): ReactElement | null {
  if (!isHigh || isLoading || isDebouncing || !isAmountSynced || !hasAmount) {
    return null
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3">
      <p className="text-sm text-red-500">
        Price impact is high ({percentage.toFixed(2)}%). Consider {actionVerb} less or waiting for better liquidity
        conditions.
      </p>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={hasAcceptedPriceImpact}
          onChange={(e) => setAcceptedPriceImpactKey(e.target.checked ? priceImpactAcceptanceKey : null)}
          className="size-4 rounded border-red-500/50 bg-transparent text-red-500 focus:ring-red-500/50"
        />
        <span className="text-sm text-red-500">I understand and wish to continue</span>
      </label>
    </div>
  )
}
