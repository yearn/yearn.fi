import { formatAmount, formatTAmount } from '@lib/utils'
import type { FC } from 'react'
import { formatUnits } from 'viem'
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
  onShowDetailsModal
}) => {
  return (
    <div className="px-6">
      <div className="flex flex-col gap-2">
        {/* You will unstake/redeem */}
        <div className="flex items-center justify-between h-5">
          <p className="text-sm text-text-secondary">{actionLabel}</p>
          <div className="flex items-center gap-1">
            <button
              onClick={onShowDetailsModal}
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
              ) : (
                <>
                  {requiredShares > 0n
                    ? formatTAmount({
                        value: requiredShares,
                        decimals: sharesDecimals
                      })
                    : '0'}{' '}
                  {'Vault shares'}
                </>
              )}
            </p>
          </div>
        </div>

        {/* You will swap (only shown when zapping) */}
        {showSwapRow && (
          <div className="flex items-center justify-between h-5">
            <p className="text-sm text-text-secondary">You will swap</p>
            <div className="flex items-center gap-1">
              <p className="text-sm text-text-primary">
                {withdrawAmountSimple} {assetSymbol}
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
                `${formatAmount(Number(formatUnits(expectedOut, outputDecimals)), 3, 6)} ${outputSymbol}`
              ) : (
                `0 ${outputSymbol || 'tokens'}`
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
