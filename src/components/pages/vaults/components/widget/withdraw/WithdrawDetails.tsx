import { formatCounterValue } from '@shared/utils/format'
import type { ReactElement } from 'react'
import { formatUnits } from 'viem'
import { formatWidgetAllowance, formatWidgetValue } from '../shared/valueDisplay'
import type { WithdrawRouteType } from './types'
import { calculateWithdrawValueInfo } from './valuation'

interface WithdrawDetailsProps {
  // Action label
  actionLabel: string
  // Required shares
  requiredShares: bigint
  sharesDecimals: number
  isLoadingQuote: boolean
  isQuoteStale: boolean
  // Output info
  expectedOut: bigint
  outputDecimals: number
  outputSymbol?: string
  // Optional swap info
  showSwapRow: boolean
  withdrawAmountSimple: string
  withdrawAmountBn: bigint
  assetDecimals: number
  assetUsdPrice: number
  assetSymbol?: string
  // Output USD price for slippage calculation
  outputUsdPrice: number
  // Route type for "at least" text
  routeType: WithdrawRouteType
  // Modal trigger
  onShowDetailsModal: () => void
  // Approval info (for zap withdrawals)
  allowance?: bigint
  allowanceTokenDecimals?: number
  allowanceTokenSymbol?: string
  approvalSpenderName?: string
  onAllowanceClick?: () => void
  onShowApprovalOverlay?: () => void
}

function getApprovalLabel(approvalSpenderName?: string): string {
  return approvalSpenderName ? `Existing Approval (${approvalSpenderName})` : 'Existing Approval'
}

export function WithdrawDetails({
  actionLabel,
  requiredShares,
  sharesDecimals,
  isLoadingQuote,
  isQuoteStale,
  expectedOut,
  outputDecimals,
  outputSymbol,
  showSwapRow,
  withdrawAmountSimple,
  withdrawAmountBn,
  assetDecimals,
  assetUsdPrice,
  assetSymbol,
  outputUsdPrice,
  routeType,
  onShowDetailsModal,
  allowance,
  allowanceTokenDecimals,
  allowanceTokenSymbol,
  approvalSpenderName,
  onAllowanceClick,
  onShowApprovalOverlay
}: WithdrawDetailsProps): ReactElement {
  const allowanceDisplay = formatWidgetAllowance(allowance, allowanceTokenDecimals)
  const approvalLabel = getApprovalLabel(approvalSpenderName)
  const withdrawValueInfo = calculateWithdrawValueInfo({
    withdrawAmountBn,
    assetTokenDecimals: assetDecimals,
    assetUsdPrice,
    expectedOut,
    outputDecimals,
    outputUsdPrice
  })
  const hasHighPriceImpact = !isQuoteStale && !isLoadingQuote && withdrawValueInfo.isHighPriceImpact
  const withdrawUsdDisplay = formatCounterValue(formatUnits(withdrawAmountBn, assetDecimals), assetUsdPrice)
  const expectedOutUsdDisplay = formatCounterValue(formatUnits(expectedOut, outputDecimals), outputUsdPrice)
  const shouldShowWithdrawUsdBadge = showSwapRow && assetUsdPrice > 0 && withdrawAmountBn > 0n
  const shouldShowExpectedOutUsdBadge = routeType === 'ENSO' && outputUsdPrice > 0 && expectedOut > 0n
  return (
    <div>
      <div className="flex flex-col gap-2">
        {/* You will unstake/redeem */}
        <div className="flex items-center justify-between h-5">
          <button
            type="button"
            onClick={onShowDetailsModal}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors yearn--link-dots"
          >
            {actionLabel}
          </button>
          {isLoadingQuote ? (
            <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
          ) : (
            <p className="text-sm text-text-primary">
              <span className="font-semibold">
                {requiredShares > 0n ? formatWidgetValue(requiredShares, sharesDecimals) : '0'}
              </span>{' '}
              <span className="font-normal">{'Vault shares'}</span>
            </p>
          )}
        </div>

        {/* You will swap (only shown when zapping) */}
        {showSwapRow && (
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">You will swap</p>
            <div className="flex items-center gap-1">
              <p className="text-sm text-text-primary">
                <span className="font-semibold">{withdrawAmountSimple}</span>{' '}
                <span className="font-normal">{assetSymbol}</span>
                {shouldShowWithdrawUsdBadge ? <span className="font-normal">{` (${withdrawUsdDisplay})`}</span> : null}
              </p>
            </div>
          </div>
        )}

        {/* You will receive */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">You will receive{routeType === 'ENSO' ? ' at least' : ''}</p>
          <div className="flex items-center gap-1">
            <p className={`text-sm ${hasHighPriceImpact ? 'text-red-500' : 'text-text-primary'}`}>
              {isLoadingQuote ? (
                <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
              ) : expectedOut > 0n ? (
                <>
                  <span className="font-semibold">{formatWidgetValue(expectedOut, outputDecimals)}</span>{' '}
                  <span className="font-normal">{outputSymbol}</span>
                  {hasHighPriceImpact && (
                    <span className="font-semibold">
                      {` (-${withdrawValueInfo.priceImpactPercentage.toFixed(2)}%)`}
                    </span>
                  )}
                  {shouldShowExpectedOutUsdBadge ? (
                    <span className="font-normal">{` (${expectedOutUsdDisplay})`}</span>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="font-semibold">{'0'}</span>{' '}
                  <span className="font-normal">{outputSymbol || 'tokens'}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Approved allowance (for zap withdrawals) */}
        {allowanceDisplay && (
          <div className="flex items-center justify-between h-5">
            {onShowApprovalOverlay ? (
              <button
                type="button"
                onClick={onShowApprovalOverlay}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors yearn--link-dots"
              >
                {approvalLabel}
              </button>
            ) : (
              <p className="text-sm text-text-secondary">{approvalLabel}</p>
            )}
            {onAllowanceClick && allowanceDisplay !== 'Unlimited' ? (
              <button
                type="button"
                onClick={onAllowanceClick}
                className="text-sm text-text-primary hover:text-blue-500 transition-colors cursor-pointer"
              >
                <span className="font-semibold">
                  {allowanceDisplay}
                  {allowanceDisplay !== 'Unlimited' && allowanceTokenSymbol ? ` ${allowanceTokenSymbol}` : ''}
                </span>
              </button>
            ) : (
              <p className="text-sm text-text-primary">
                <span className="font-semibold">
                  {allowanceDisplay}
                  {allowanceDisplay !== 'Unlimited' && allowanceTokenSymbol ? ` ${allowanceTokenSymbol}` : ''}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
