import type { FC } from 'react'
import { formatWidgetAllowance, formatWidgetValue } from '../shared/valueDisplay'
import type { WithdrawRouteType } from './types'

interface WithdrawDetailsProps {
  // Action label
  actionLabel: string
  // Required shares
  requiredShares: bigint
  sharesDecimals: number
  isLoadingQuote: boolean
  // Output info
  expectedOut: bigint
  outputDecimals: number
  outputSymbol?: string
  // Optional swap info
  showSwapRow: boolean
  withdrawAmountSimple: string
  assetSymbol?: string
  // Route type for "at least" text
  routeType: WithdrawRouteType
  // Modal trigger
  onShowDetailsModal: () => void
  // Approval info (for zap withdrawals)
  allowance?: bigint
  allowanceTokenDecimals?: number
  allowanceTokenSymbol?: string
  onAllowanceClick?: () => void
}

export const WithdrawDetails: FC<WithdrawDetailsProps> = ({
  actionLabel,
  requiredShares,
  sharesDecimals,
  isLoadingQuote,
  expectedOut,
  outputDecimals,
  outputSymbol,
  showSwapRow,
  withdrawAmountSimple,
  assetSymbol,
  routeType,
  onShowDetailsModal,
  allowance,
  allowanceTokenDecimals,
  allowanceTokenSymbol,
  onAllowanceClick
}) => {
  const allowanceDisplay = formatWidgetAllowance(allowance, allowanceTokenDecimals)
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
              </p>
            </div>
          </div>
        )}

        {/* You will receive */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">You will receive{routeType === 'ENSO' ? ' at least' : ''}</p>
          <div className="flex items-center gap-1">
            <p className="text-sm text-text-primary">
              {isLoadingQuote ? (
                <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
              ) : expectedOut > 0n ? (
                <>
                  <span className="font-semibold">{formatWidgetValue(expectedOut, outputDecimals)}</span>{' '}
                  <span className="font-normal">{outputSymbol}</span>
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
            <p className="text-sm text-text-secondary">Existing Approval</p>
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
