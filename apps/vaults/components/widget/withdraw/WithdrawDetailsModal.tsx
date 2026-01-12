import type { FC } from 'react'
import type { Address } from 'viem'
import { InfoModal } from '../shared'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface WithdrawDetailsModalProps {
  isOpen: boolean
  onClose: () => void

  sourceTokenSymbol: string
  vaultAssetSymbol: string
  outputTokenSymbol: string

  withdrawAmount: string
  expectedOutput?: string
  hasInputValue: boolean

  stakingAddress?: Address
  withdrawalSource: WithdrawalSource
  routeType: WithdrawRouteType
  isZap: boolean
  isLoadingQuote: boolean
}

export const WithdrawDetailsModal: FC<WithdrawDetailsModalProps> = ({
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
      return <span className="font-medium text-text-primary">{outputTokenSymbol}</span>
    }

    // Zap route
    if (isZap) {
      return (
        <span className="font-medium text-text-primary">
          {expectedOutput || '0'} {outputTokenSymbol}
        </span>
      )
    }

    // Direct withdraw/unstake with value
    if (expectedOutput) {
      return (
        <span className="font-medium text-text-primary">
          {expectedOutput} {outputTokenSymbol}
        </span>
      )
    }

    // Fallback - just symbol
    return <span className="font-medium text-text-primary">{outputTokenSymbol}</span>
  }

  const receiveLabel = isZap && hasInputValue ? "You'll receive at least:" : "You'll receive:"

  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Withdrawal Details">
      <div className="space-y-4">
        {/* What you're withdrawing */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">What you're withdrawing</p>
          <p className="text-sm text-text-secondary">
            {isZap ? (
              <>
                Your <span className="font-medium text-text-primary">{sourceTokenSymbol}</span> shares will be redeemed
                for <span className="font-medium text-text-primary">{vaultAssetSymbol}</span>, then swapped to{' '}
                <span className="font-medium text-text-primary">{outputTokenSymbol}</span>.
              </>
            ) : isUnstake ? (
              <>
                Your <span className="font-medium text-text-primary">{sourceTokenSymbol}</span> will be unstaked. You'll
                receive <span className="font-medium text-text-primary">{outputTokenSymbol}</span>.
              </>
            ) : (
              <>
                Your <span className="font-medium text-text-primary">{sourceTokenSymbol}</span> shares will be redeemed.
                You'll receive <span className="font-medium text-text-primary">{outputTokenSymbol}</span>.
              </>
            )}
          </p>
        </div>

        {/* How withdrawals work */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">How withdrawals work</p>
          <p className="text-sm text-text-secondary">
            {isFromStaking
              ? 'Your staked shares will be unstaked and redeemed for the underlying asset plus any earned yield.'
              : 'Your vault shares will be redeemed for the underlying asset plus any earned yield.'}
          </p>
        </div>

        {/* Details */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">Details</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary ml-2">
            {hasInputValue && (
              <li>
                Withdrawing:{' '}
                <span className="font-medium text-text-primary">
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
    </InfoModal>
  )
}
