import type { FC } from 'react'
import { InfoOverlay } from '../shared/InfoOverlay'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface WithdrawDetailsOverlayProps {
  isOpen: boolean
  onClose: () => void

  sourceTokenSymbol: string
  vaultAssetSymbol: string
  outputTokenSymbol: string

  withdrawAmount: string
  expectedOutput?: string
  hasInputValue: boolean

  stakingAddress?: `0x${string}`
  withdrawalSource: WithdrawalSource
  routeType: WithdrawRouteType
  isZap: boolean
  isLoadingQuote: boolean
}

export const WithdrawDetailsOverlay: FC<WithdrawDetailsOverlayProps> = ({
  isOpen,
  onClose,
  sourceTokenSymbol,
  vaultAssetSymbol,
  outputTokenSymbol,
  withdrawAmount,
  expectedOutput,
  hasInputValue,
  withdrawalSource,
  routeType,
  isZap
}) => {
  const isFromStaking = withdrawalSource === 'staking'
  const isUnstake = routeType === 'DIRECT_UNSTAKE'

  const renderReceiveValue = () => {
    // No input value - just show symbol
    if (!hasInputValue) {
      return <span className="font-semibold text-text-primary">{outputTokenSymbol}</span>
    }

    // Zap route
    if (isZap) {
      return (
        <span className="font-semibold text-text-primary">
          {expectedOutput || '0'} {outputTokenSymbol}
        </span>
      )
    }

    // Direct withdraw/unstake with value
    if (expectedOutput) {
      return (
        <span className="font-semibold text-text-primary">
          {expectedOutput} {outputTokenSymbol}
        </span>
      )
    }

    // Fallback - just symbol
    return <span className="font-semibold text-text-primary">{outputTokenSymbol}</span>
  }

  const receiveLabel = isZap && hasInputValue ? "You'll receive at least:" : "You'll receive:"

  return (
    <InfoOverlay isOpen={isOpen} onClose={onClose} title="Withdrawal Details">
      <div className="space-y-4">
        {/* What you're withdrawing */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">What you're withdrawing</p>
          <p className="text-sm text-text-secondary">
            {isZap ? (
              <>
                Your <span className="font-semibold text-text-primary">{sourceTokenSymbol}</span> shares will be
                redeemed for <span className="font-semibold text-text-primary">{vaultAssetSymbol}</span>, then swapped
                to <span className="font-semibold text-text-primary">{outputTokenSymbol}</span>.
              </>
            ) : isUnstake ? (
              <>
                Your <span className="font-semibold text-text-primary">{sourceTokenSymbol}</span> will be unstaked.
                You'll receive <span className="font-semibold text-text-primary">{outputTokenSymbol}</span>.
              </>
            ) : isFromStaking ? (
              <>
                Your <span className="font-semibold text-text-primary">{sourceTokenSymbol}</span> staked shares will be
                unstaked and redeemed for <span className="font-semibold text-text-primary">{vaultAssetSymbol}</span>.
                You'll receive <span className="font-semibold text-text-primary">{outputTokenSymbol}</span>.
              </>
            ) : (
              <>
                Your <span className="font-semibold text-text-primary">{sourceTokenSymbol}</span> shares will be
                redeemed. You'll receive <span className="font-semibold text-text-primary">{outputTokenSymbol}</span>.
              </>
            )}
          </p>
        </div>

        {/* How withdrawals work */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">How it works</p>
          <p className="text-sm text-text-secondary">
            {isZap ? (
              <>
                Your vault shares are redeemed for the underlying asset, which is then swapped to your desired token
                using Enso. The final amount may vary slightly due to market conditions.
              </>
            ) : isUnstake ? (
              <>
                Unstaking converts your staked position back to vault shares. Your vault shares continue to earn yield
                and can be redeemed for the underlying asset anytime.
              </>
            ) : isFromStaking ? (
              <>
                Your staked shares are first unstaked to vault shares, then redeemed for the underlying asset plus any
                earned yield. This happens in a single transaction.
              </>
            ) : (
              <>
                Your vault shares are redeemed for the underlying asset plus any earned yield. The value of your shares
                includes all yield earned since your deposit.
              </>
            )}
          </p>
        </div>

        {/* Details */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">Details</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary ml-2">
            {hasInputValue && (
              <li>
                Withdrawing:{' '}
                <span className="font-semibold text-text-primary">
                  {withdrawAmount} {sourceTokenSymbol}
                </span>
              </li>
            )}
            <li>
              {receiveLabel} {renderReceiveValue()}
            </li>
          </ul>
        </div>
      </div>
    </InfoOverlay>
  )
}
