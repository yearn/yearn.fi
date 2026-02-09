import { IconChevron } from '@shared/icons/IconChevron'
import { cl, formatTAmount, formatUSD } from '@shared/utils'
import { type FC, useState } from 'react'
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
  const [isExpanded, setIsExpanded] = useState(false)
  const isStake = routeType === 'DIRECT_STAKE'
  const sharesLabel = willReceiveStakedShares ? 'Staked shares' : 'Vault shares'

  const getActionVerb = () => {
    if (isStake) return 'stake'
    if (isSwap) return 'swap'
    return 'deposit'
  }

  const formatAllowance = () => {
    if (allowance === undefined || allowanceTokenDecimals === undefined) return null
    if (allowance >= maxUint256 / 2n) return 'Unlimited'
    return `${formatTAmount({ value: allowance, decimals: allowanceTokenDecimals })}`
  }

  const allowanceDisplay = formatAllowance()

  // Calculate vault share value in underlying asset terms (use vault decimals for pricePerShare)
  const vaultShareValueInAsset =
    expectedVaultShares > 0n && pricePerShare > 0n
      ? (expectedVaultShares * pricePerShare) / 10n ** BigInt(vaultDecimals)
      : 0n
  const vaultShareValueUsdNum = Number(formatUnits(vaultShareValueInAsset, assetTokenDecimals)) * assetUsdPrice
  const vaultShareValueUsd = formatUSD(vaultShareValueUsdNum)

  // Exchange rate: 1 asset = X vault shares
  const sharesPerToken =
    pricePerShare > 0n
      ? formatTAmount({
          value: 10n ** BigInt(vaultDecimals * 2) / pricePerShare,
          decimals: vaultDecimals,
          options: { maximumFractionDigits: 4 }
        })
      : '0'

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

        {/* Expandable exchange rate summary */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between h-5 w-full group"
        >
          <span
            onClick={(e) => {
              e.stopPropagation()
              onShowVaultShareValueModal()
            }}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors yearn--link-dots"
          >
            {`1 ${assetTokenSymbol || 'token'} = ${sharesPerToken} vault shares${vaultShareValueUsdNum > 0 ? ` (${vaultShareValueUsd})` : ''}`}
          </span>
          <IconChevron
            size={14}
            className={cl(
              'text-text-secondary group-hover:text-text-primary transition-transform duration-200',
              isExpanded ? 'rotate-180' : ''
            )}
          />
        </button>

        {/* Expandable section */}
        <div
          className={cl(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2">
              {/* Est. annual return */}
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

              {/* Existing approval */}
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
                      <span className="font-normal">
                        <span className="font-semibold">{allowanceDisplay} </span>{' '}
                        <span> {allowanceTokenSymbol || ''}</span>
                      </span>
                    </button>
                  ) : (
                    <p className="text-sm text-text-primary">
                      <span className="font-normal">
                        <span className="font-semibold">{allowanceDisplay} </span>{' '}
                        <span> {allowanceTokenSymbol || ''}</span>
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
