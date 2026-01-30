import { formatTAmount } from '@shared/utils'
import type { FC } from 'react'
import { formatUnits, maxUint256 } from 'viem'
import type { DepositRouteType } from './types'

interface DepositDetailsProps {
  // Deposit amount info
  depositAmountBn: bigint
  inputTokenSymbol?: string
  inputTokenDecimals: number
  // Route info
  routeType: DepositRouteType
  isSwap: boolean
  isLoadingQuote: boolean
  expectedOutInAsset: bigint
  assetTokenSymbol?: string
  assetTokenDecimals: number
  // Vault/Staking shares info
  expectedVaultShares: bigint
  vaultDecimals: number // For pricePerShare calculations (always vault's decimals)
  sharesDisplayDecimals: number // For displaying share amounts (vault or staking decimals)
  pricePerShare: bigint
  assetUsdPrice: number
  willReceiveStakedShares: boolean
  onShowVaultSharesModal: () => void
  onShowVaultShareValueModal: () => void
  // Annual return info
  estimatedAnnualReturn: string
  onShowAnnualReturnModal: () => void
  // Approval info
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

  // Determine action verb based on route type
  const getActionVerb = () => {
    if (isStake) return 'stake'
    if (isSwap) return 'swap'
    return 'deposit'
  }
  // Format allowance display
  const formatAllowance = () => {
    if (allowance === undefined || allowanceTokenDecimals === undefined) return null
    if (allowance >= maxUint256 / 2n) return 'Unlimited'
    return `${formatTAmount({ value: allowance, decimals: allowanceTokenDecimals })} ${allowanceTokenSymbol || ''}`
  }

  const allowanceDisplay = formatAllowance()

  // Calculate vault share value in underlying asset terms (use vault decimals for pricePerShare)
  const vaultShareValueInAsset =
    expectedVaultShares > 0n && pricePerShare > 0n
      ? (expectedVaultShares * pricePerShare) / 10n ** BigInt(vaultDecimals)
      : 0n
  const vaultShareValueFormatted = formatTAmount({
    value: vaultShareValueInAsset,
    decimals: assetTokenDecimals,
    options: { maximumFractionDigits: 6 }
  })
  const vaultShareValueUsd = (Number(formatUnits(vaultShareValueInAsset, assetTokenDecimals)) * assetUsdPrice).toFixed(
    2
  )
  return (
    <div>
      <div className="flex flex-col gap-2">
        {/* You will deposit/swap/stake */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">{'You will ' + getActionVerb()}</p>
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

        {/* For at least (only shown when swapping via ENSO) */}
        {isSwap && !isStake && (
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">{'For at least'}</p>
            <p className="text-sm text-text-primary">
              {isLoadingQuote ? (
                <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
              ) : expectedOutInAsset > 0n ? (
                <>
                  <span className="font-semibold">
                    {formatTAmount({
                      value: expectedOutInAsset,
                      decimals: assetTokenDecimals
                    })}
                  </span>{' '}
                  <span className="font-normal">{assetTokenSymbol || 'tokens'}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{'0'}</span>{' '}
                  <span className="font-normal">{assetTokenSymbol || 'tokens'}</span>
                </>
              )}
            </p>
          </div>
        )}

        {/* You will receive (vault shares or staked shares) */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">You will receive</p>
          {isLoadingQuote ? (
            <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
          ) : (
            <button
              type="button"
              onClick={onShowVaultSharesModal}
              className="text-sm text-text-primary underline decoration-text-tertiary underline-offset-2 hover:decoration-text-secondary transition-colors"
            >
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
            </button>
          )}
        </div>

        {/* Vault share value in underlying asset */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">Vault share value</p>
          {isLoadingQuote ? (
            <span className="inline-block h-4 w-24 bg-surface-secondary rounded animate-pulse" />
          ) : (
            <button
              type="button"
              onClick={onShowVaultShareValueModal}
              className="text-sm text-text-primary underline decoration-text-tertiary underline-offset-2 hover:decoration-text-secondary transition-colors"
            >
              <span className="font-semibold">{vaultShareValueFormatted}</span>{' '}
              <span className="font-normal">{`${assetTokenSymbol || ''} (`}</span>
              <span className="font-semibold">{`$${vaultShareValueUsd}`}</span>
              <span className="font-normal">{')'}</span>
            </button>
          )}
        </div>

        {/* Est. Annual Return */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">Est. Annual Return</p>
          <button
            type="button"
            onClick={onShowAnnualReturnModal}
            className="text-sm text-text-primary underline decoration-text-tertiary underline-offset-2 hover:decoration-text-secondary transition-colors"
          >
            <span className="font-semibold">{depositAmountBn > 0n ? `~${estimatedAnnualReturn}` : '0'}</span>{' '}
            <span className="font-normal">{inputTokenSymbol}</span>
          </button>
        </div>

        {/* Approved allowance */}
        {allowanceDisplay && (
          <div className="flex items-center justify-between h-5">
            {onShowApprovalOverlay ? (
              <button
                type="button"
                onClick={onShowApprovalOverlay}
                className="text-sm text-text-secondary underline decoration-text-tertiary underline-offset-2 hover:text-text-primary hover:decoration-text-secondary transition-colors"
              >
                Existing Approval{approvalSpenderName ? ` (${approvalSpenderName})` : ''}
              </button>
            ) : (
              <p className="text-sm text-text-secondary">
                Existing Approval{approvalSpenderName ? ` (${approvalSpenderName})` : ''}
              </p>
            )}
            {onAllowanceClick && allowanceDisplay !== 'Unlimited' ? (
              <button
                type="button"
                onClick={onAllowanceClick}
                className="text-sm text-text-primary hover:text-blue-500 transition-colors cursor-pointer"
              >
                <span className="font-semibold">{allowanceDisplay}</span>
              </button>
            ) : (
              <p className="text-sm text-text-primary">
                <span className="font-semibold">{allowanceDisplay}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
