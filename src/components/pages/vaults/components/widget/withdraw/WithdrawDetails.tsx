import { formatTAmount } from '@shared/utils'
import type { FC } from 'react'
import { maxUint256 } from 'viem'
import { CollapsibleDetails } from '../shared/CollapsibleDetails'
import type { WithdrawRouteType } from './types'

interface WithdrawDetailsProps {
  actionLabel: string
  requiredShares: bigint
  sharesDecimals: number
  isLoadingQuote: boolean
  expectedOut: bigint
  outputDecimals: number
  outputSymbol?: string
  showSwapRow: boolean
  withdrawAmountSimple: string
  assetSymbol?: string
  pricePerShare: bigint
  vaultDecimals: number
  assetTokenSymbol?: string
  assetUsdPrice: number
  routeType: WithdrawRouteType
  onShowDetailsModal: () => void
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
  pricePerShare,
  vaultDecimals,
  assetTokenSymbol,
  assetUsdPrice,
  routeType,
  onShowDetailsModal,
  allowance,
  allowanceTokenDecimals,
  allowanceTokenSymbol,
  onAllowanceClick
}) => {
  const allowanceDisplay =
    allowance === undefined || allowanceTokenDecimals === undefined
      ? null
      : allowance >= maxUint256 / 2n
        ? 'Unlimited'
        : formatTAmount({ value: allowance, decimals: allowanceTokenDecimals })

  const outputFormatted =
    expectedOut > 0n
      ? formatTAmount({ value: expectedOut, decimals: outputDecimals, options: { maximumFractionDigits: 6 } })
      : '0'

  return (
    <CollapsibleDetails
      variant="withdraw"
      pricePerShare={pricePerShare}
      vaultDecimals={vaultDecimals}
      assetTokenSymbol={assetTokenSymbol}
      assetUsdPrice={assetUsdPrice}
      onSummaryClick={onShowDetailsModal}
    >
      <div className="flex items-center justify-between h-5">
        <p className="text-sm text-text-secondary">{actionLabel}</p>
        {isLoadingQuote ? (
          <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
        ) : (
          <p className="text-sm text-text-primary">
            <span className="font-semibold">
              {requiredShares > 0n
                ? formatTAmount({
                    value: requiredShares,
                    decimals: sharesDecimals
                  })
                : '0'}
            </span>{' '}
            <span className="font-normal">Vault shares</span>
          </p>
        )}
      </div>

      {showSwapRow && (
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">You will swap</p>
          <p className="text-sm text-text-primary">
            <span className="font-semibold">{withdrawAmountSimple}</span>{' '}
            <span className="font-normal">{assetSymbol}</span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between h-5">
        <p className="text-sm text-text-secondary">You will receive{routeType === 'ENSO' ? ' at least' : ''}</p>
        <p className="text-sm text-text-primary">
          {isLoadingQuote ? (
            <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
          ) : (
            <>
              <span className="font-semibold">{outputFormatted}</span>{' '}
              <span className="font-normal">{outputSymbol || 'tokens'}</span>
            </>
          )}
        </p>
      </div>

      {allowanceDisplay && (
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">Existing approval</p>
          {onAllowanceClick && allowanceDisplay !== 'Unlimited' ? (
            <button
              type="button"
              onClick={onAllowanceClick}
              className="text-sm text-text-primary hover:text-blue-500 transition-colors cursor-pointer"
            >
              <span className="font-semibold">{allowanceDisplay}</span> {allowanceTokenSymbol || ''}
            </button>
          ) : (
            <p className="text-sm text-text-primary">
              <span className="font-semibold">{allowanceDisplay}</span> {allowanceTokenSymbol || ''}
            </p>
          )}
        </div>
      )}
    </CollapsibleDetails>
  )
}
