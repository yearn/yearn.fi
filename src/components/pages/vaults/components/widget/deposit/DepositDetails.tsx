import { formatTAmount } from '@shared/utils'
import type { FC } from 'react'
import { maxUint256 } from 'viem'
import { CollapsibleDetails } from '../shared/CollapsibleDetails'
import type { DepositRouteType } from './types'

interface DepositDetailsProps {
  depositAmountBn: bigint
  inputTokenSymbol?: string
  inputTokenDecimals: number
  routeType: DepositRouteType
  isSwap: boolean
  isLoadingQuote: boolean
  expectedOutInAsset: bigint
  assetTokenSymbol?: string
  assetTokenDecimals: number
  expectedVaultShares: bigint
  vaultDecimals: number
  sharesDisplayDecimals: number
  pricePerShare: bigint
  assetUsdPrice: number
  willReceiveStakedShares: boolean
  onShowVaultSharesModal: () => void
  onShowVaultShareValueModal: () => void
  estimatedAnnualReturn: string
  onShowAnnualReturnModal: () => void
  allowance?: bigint
  allowanceTokenDecimals?: number
  allowanceTokenSymbol?: string
  approvalSpenderName?: string
  onAllowanceClick?: () => void
  onShowApprovalOverlay?: () => void
}

export const DepositDetails: FC<DepositDetailsProps> = ({
  depositAmountBn,
  inputTokenSymbol,
  inputTokenDecimals,
  routeType,
  isSwap,
  isLoadingQuote,
  expectedOutInAsset,
  assetTokenSymbol,
  assetTokenDecimals,
  expectedVaultShares,
  vaultDecimals,
  sharesDisplayDecimals,
  pricePerShare,
  assetUsdPrice,
  willReceiveStakedShares,
  onShowVaultSharesModal,
  onShowVaultShareValueModal,
  estimatedAnnualReturn,
  onShowAnnualReturnModal,
  allowance,
  allowanceTokenDecimals,
  allowanceTokenSymbol,
  approvalSpenderName,
  onAllowanceClick,
  onShowApprovalOverlay
}) => {
  const isStake = routeType === 'DIRECT_STAKE'
  const sharesLabel = willReceiveStakedShares ? 'Staked shares' : 'Vault shares'
  const actionVerb = isStake ? 'stake' : isSwap ? 'swap' : 'deposit'

  const allowanceDisplay =
    allowance === undefined || allowanceTokenDecimals === undefined
      ? null
      : allowance >= maxUint256 / 2n
        ? 'Unlimited'
        : formatTAmount({ value: allowance, decimals: allowanceTokenDecimals })

  return (
    <CollapsibleDetails
      variant="deposit"
      pricePerShare={pricePerShare}
      vaultDecimals={vaultDecimals}
      assetTokenSymbol={assetTokenSymbol}
      assetUsdPrice={assetUsdPrice}
      onSummaryClick={onShowVaultShareValueModal}
    >
      <div className="flex items-center justify-between h-5">
        <p className="text-sm text-text-secondary">{`You will ${actionVerb}`}</p>
        <p className="text-sm text-text-primary">
          <span className="font-semibold">
            {depositAmountBn > 0n
              ? formatTAmount({
                  value: depositAmountBn,
                  decimals: inputTokenDecimals,
                  options: { maximumFractionDigits: 6 }
                })
              : '0'}
          </span>{' '}
          <span className="font-normal">{inputTokenSymbol}</span>
        </p>
      </div>

      {isSwap && !isStake && (
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">For at least</p>
          <p className="text-sm text-text-primary">
            {isLoadingQuote ? (
              <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
            ) : (
              <>
                <span className="font-semibold">
                  {expectedOutInAsset > 0n
                    ? formatTAmount({ value: expectedOutInAsset, decimals: assetTokenDecimals })
                    : '0'}
                </span>{' '}
                <span className="font-normal">{assetTokenSymbol || 'tokens'}</span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between h-5">
        <button
          type="button"
          onClick={onShowVaultSharesModal}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors yearn--link-dots"
        >
          You will receive
        </button>
        <p className="text-sm text-text-primary">
          {isLoadingQuote ? (
            <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
          ) : (
            <>
              <span className="font-semibold">
                {depositAmountBn > 0n && expectedVaultShares > 0n
                  ? formatTAmount({
                      value: expectedVaultShares,
                      decimals: sharesDisplayDecimals,
                      options: { maximumFractionDigits: 4 }
                    })
                  : '0'}
              </span>{' '}
              <span className="font-normal">{sharesLabel}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center justify-between h-5">
        <button
          type="button"
          onClick={onShowAnnualReturnModal}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors yearn--link-dots"
        >
          Est. annual return
        </button>
        <p className="text-sm text-text-primary">
          <span className="font-normal">{depositAmountBn > 0n ? '~' : ''}</span>
          <span className="font-semibold">{depositAmountBn > 0n ? estimatedAnnualReturn : '0'}</span>{' '}
          <span className="font-normal">{inputTokenSymbol}</span>
        </p>
      </div>

      {allowanceDisplay && (
        <div className="flex items-center justify-between h-5">
          {onShowApprovalOverlay ? (
            <button
              type="button"
              onClick={onShowApprovalOverlay}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors yearn--link-dots"
            >
              Existing approval{approvalSpenderName ? ` (${approvalSpenderName})` : ''}
            </button>
          ) : (
            <p className="text-sm text-text-secondary">
              Existing approval{approvalSpenderName ? ` (${approvalSpenderName})` : ''}
            </p>
          )}
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
