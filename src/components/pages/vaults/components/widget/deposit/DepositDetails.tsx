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
          <p className="text-sm font-semibold text-text-primary">
            {depositAmountBn > 0n
              ? formatTAmount({
                  value: depositAmountBn,
                  decimals: inputTokenDecimals,
                  options: { maximumFractionDigits: 6 }
                })
              : '0'}{' '}
            {inputTokenSymbol}
          </p>
        </div>

        {/* For at least (only shown when swapping via ENSO) */}
        {isSwap && !isStake && (
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">{'For at least'}</p>
            <p className="text-sm font-semibold text-text-primary">
              {isLoadingQuote ? (
                <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
              ) : expectedOutInAsset > 0n ? (
                `${formatTAmount({
                  value: expectedOutInAsset,
                  decimals: assetTokenDecimals
                })} ${assetTokenSymbol || 'tokens'}`
              ) : (
                `0 ${assetTokenSymbol || 'tokens'}`
              )}
            </p>
          </div>
        )}

        {/* You will receive (vault shares or staked shares) */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">You will receive</p>
          <div className="flex items-center gap-1">
            <button
              onClick={onShowVaultSharesModal}
              className="inline-flex items-center justify-center hover:bg-surface-secondary rounded-full p-0.5 transition-colors"
            >
              <svg
                className="h-3.5 w-3.5 text-text-tertiary hover:text-text-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <p className="text-sm font-semibold text-text-primary">
              {isLoadingQuote ? (
                <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
              ) : depositAmountBn > 0n && expectedVaultShares > 0n ? (
                `${formatTAmount({ value: expectedVaultShares, decimals: sharesDisplayDecimals, options: { maximumFractionDigits: 4 } })} ${sharesLabel}`
              ) : (
                `0 ${sharesLabel}`
              )}
            </p>
          </div>
        </div>

        {/* Vault share value in underlying asset */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">Vault share value</p>
          <div className="flex items-center gap-1">
            <button
              onClick={onShowVaultShareValueModal}
              className="inline-flex items-center justify-center hover:bg-surface-secondary rounded-full p-0.5 transition-colors"
            >
              <svg
                className="h-3.5 w-3.5 text-text-tertiary hover:text-text-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <p className="text-sm font-semibold text-text-primary">
              {isLoadingQuote ? (
                <span className="inline-block h-4 w-24 bg-surface-secondary rounded animate-pulse" />
              ) : (
                `${vaultShareValueFormatted} ${assetTokenSymbol || ''} ($${vaultShareValueUsd})`
              )}
            </p>
          </div>
        </div>

        {/* Est. Annual Return */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">Est. Annual Return</p>
          <div className="flex items-center gap-1">
            <button
              onClick={onShowAnnualReturnModal}
              className="inline-flex items-center justify-center hover:bg-surface-secondary rounded-full p-0.5 transition-colors"
            >
              <svg
                className="h-3.5 w-3.5 text-text-tertiary hover:text-text-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <p className="text-sm font-semibold text-text-primary">
              {depositAmountBn > 0n ? `~${estimatedAnnualReturn}` : '0'} {inputTokenSymbol}
            </p>
          </div>
        </div>

        {/* Approved allowance */}
        {allowanceDisplay && (
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">
              Existing Approval{approvalSpenderName ? ` (${approvalSpenderName})` : ''}
            </p>
            <div className="flex items-center gap-1">
              {onShowApprovalOverlay && (
                <button
                  onClick={onShowApprovalOverlay}
                  className="inline-flex items-center justify-center hover:bg-surface-secondary rounded-full p-0.5 transition-colors"
                >
                  <svg
                    className="h-3.5 w-3.5 text-text-tertiary hover:text-text-secondary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              )}
              {onAllowanceClick && allowanceDisplay !== 'Unlimited' ? (
                <button
                  type="button"
                  onClick={onAllowanceClick}
                  className="text-sm font-semibold text-text-primary hover:text-blue-500 transition-colors cursor-pointer"
                >
                  {allowanceDisplay}
                </button>
              ) : (
                <p className="text-sm font-semibold text-text-primary">{allowanceDisplay}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
