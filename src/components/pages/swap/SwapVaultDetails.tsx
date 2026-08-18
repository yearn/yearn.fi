import { formatWidgetValue } from '@pages/vaults/components/widget/shared/valueDisplay'
import { formatUSD } from '@shared/utils/format'
import type { ReactElement } from 'react'
import type { TSwapVaultEstimate } from './swapVaultEstimate'

function formatMinimumUnderlying({ estimate, symbol }: { estimate: TSwapVaultEstimate; symbol: string }): string {
  if (estimate.minimumUnderlying === null) {
    return 'Unavailable'
  }

  const tokenValue = `${formatWidgetValue(estimate.minimumUnderlying)} ${symbol}`
  if (estimate.minimumUnderlyingUsd === null) {
    return tokenValue
  }

  return `${tokenValue} (${formatUSD(estimate.minimumUnderlyingUsd)})`
}

export function SwapVaultWorthRow({
  estimate,
  underlyingSymbol,
  isLoading
}: {
  estimate: TSwapVaultEstimate
  underlyingSymbol: string
  isLoading: boolean
}): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-text-secondary">Worth at least:</span>
      <span className="max-w-[68%] text-right font-semibold text-text-primary">
        {isLoading ? 'Finding route...' : formatMinimumUnderlying({ estimate, symbol: underlyingSymbol })}
      </span>
    </div>
  )
}

export function SwapVaultAnnualReturnRow({
  estimate,
  underlyingSymbol,
  annualRate,
  isLoading
}: {
  estimate: TSwapVaultEstimate
  underlyingSymbol: string
  annualRate?: number
  isLoading: boolean
}): ReactElement {
  const annualReturn =
    estimate.estimatedAnnualReturn === null
      ? 'Unavailable'
      : `${formatWidgetValue(estimate.estimatedAnnualReturn)} ${underlyingSymbol}${
          estimate.estimatedAnnualReturnUsd === null ? '' : ` (${formatUSD(estimate.estimatedAnnualReturnUsd)})`
        }`

  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-text-secondary">Est. Annual Return</span>
      <span className="text-right font-semibold text-text-primary">
        {isLoading ? 'Finding route...' : annualReturn}
        {!isLoading && annualRate !== undefined ? (
          <span className="ml-1 font-normal text-text-secondary">({(annualRate * 100).toFixed(2)}% APR)</span>
        ) : null}
      </span>
    </div>
  )
}
