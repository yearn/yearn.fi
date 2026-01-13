import { formatAmount, formatTAmount } from '@lib/utils'
import type { FC } from 'react'
import { formatUnits } from 'viem'

interface DepositDetailsProps {
  // Deposit amount info
  depositAmountBn: bigint
  inputTokenSymbol?: string
  inputTokenDecimals: number
  // Swap info (when token !== asset)
  isSwap: boolean
  isLoadingQuote: boolean
  expectedOutInAsset: bigint
  assetTokenSymbol?: string
  assetTokenDecimals: number
  // Vault shares info
  expectedVaultShares: bigint
  vaultDecimals: number
  onShowVaultSharesModal: () => void
  // Annual return info
  estimatedAnnualReturn: string
  onShowAnnualReturnModal: () => void
}

export const DepositDetails: FC<DepositDetailsProps> = ({
  depositAmountBn,
  inputTokenSymbol,
  inputTokenDecimals,
  isSwap,
  isLoadingQuote,
  expectedOutInAsset,
  assetTokenSymbol,
  assetTokenDecimals,
  expectedVaultShares,
  vaultDecimals,
  onShowVaultSharesModal,
  estimatedAnnualReturn,
  onShowAnnualReturnModal
}) => {
  return (
    <div className="px-6">
      <div className="flex flex-col gap-2">
        {/* You will deposit/swap */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">{'You will ' + (isSwap ? 'swap' : 'deposit')}</p>
          <p className="text-sm text-text-primary">
            {depositAmountBn > 0n
              ? formatTAmount({
                  value: depositAmountBn,
                  decimals: inputTokenDecimals
                })
              : '0'}{' '}
            {inputTokenSymbol}
          </p>
        </div>

        {/* For at least (only shown when swapping) */}
        {isSwap && (
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">{'For at least'}</p>
            <p className="text-sm text-text-primary">
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

        {/* You will receive (vault shares) */}
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
            <p className="text-sm text-text-primary">
              {isLoadingQuote ? (
                <span className="inline-block h-4 w-20 bg-surface-secondary rounded animate-pulse" />
              ) : depositAmountBn > 0n && expectedVaultShares > 0n ? (
                `${formatAmount(Number(formatUnits(expectedVaultShares, vaultDecimals)))} Vault shares`
              ) : (
                `0 Vault shares`
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
            <p className="text-sm text-text-primary">
              {depositAmountBn > 0n ? `~${estimatedAnnualReturn}` : '0'} {inputTokenSymbol}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
