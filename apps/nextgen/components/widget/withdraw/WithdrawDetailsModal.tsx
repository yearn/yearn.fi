import type { FC } from 'react'
import type { Address } from 'viem'
import { InfoModal } from '../shared'
import type { WithdrawalSource } from './types'

interface WithdrawDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  vaultSymbol: string
  withdrawAmount: string
  stakingAddress?: Address
  withdrawalSource: WithdrawalSource
  stakingTokenSymbol?: string
}

export const WithdrawDetailsModal: FC<WithdrawDetailsModalProps> = ({
  isOpen,
  onClose,
  vaultSymbol,
  withdrawAmount,
  stakingAddress,
  withdrawalSource,
  stakingTokenSymbol
}) => {
  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Withdrawal Details">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          You are withdrawing {withdrawAmount}{' '}
          {withdrawalSource === 'staking' && stakingTokenSymbol ? stakingTokenSymbol : vaultSymbol} from the{' '}
          {withdrawalSource === 'staking' ? 'staking contract' : 'vault'}.
          {stakingAddress && withdrawalSource === 'staking' && ' Your tokens will be automatically unstaked.'}
        </p>
        <div className="space-y-3">
          <p className="font-medium text-sm text-text-primary">Withdrawal notes:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-text-secondary ml-2">
            <li>You will receive your underlying assets</li>
            <li>Any earned yield will be included</li>
            <li>The transaction cannot be reversed</li>
          </ul>
        </div>
        <p className="text-xs text-text-secondary mt-4">
          Make sure you have enough gas to complete the withdrawal transaction.
        </p>
      </div>
    </InfoModal>
  )
}
