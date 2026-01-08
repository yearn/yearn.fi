import { cl } from '@lib/utils'
import type { FC } from 'react'
import type { Address } from 'viem'
import { InfoModal } from '../shared'

interface VaultSharesModalProps {
  isOpen: boolean
  onClose: () => void
  vaultSymbol: string
  expectedShares: string
  stakingAddress?: Address
  isAutoStakingEnabled: boolean
}

export const VaultSharesModal: FC<VaultSharesModalProps> = ({
  isOpen,
  onClose,
  vaultSymbol,
  expectedShares,
  stakingAddress,
  isAutoStakingEnabled
}) => {
  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Vault Shares">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          After depositing into the vault, you will receive{' '}
          {isAutoStakingEnabled && stakingAddress ? 'staked vault' : 'vault'} tokens which serve as proof that you have
          deposited into the vault.
        </p>
        <div className="space-y-3">
          <p className="font-medium text-sm text-text-primary">Token details:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-text-secondary ml-2">
            <li>Symbol: {vaultSymbol}</li>
            <li>
              Your shares: {expectedShares} {vaultSymbol}
            </li>
            <li>Redeemable for your deposited assets plus earnings</li>
            {stakingAddress && (
              <li className={cl(isAutoStakingEnabled ? '' : 'line-through')}>Automatically staked for maximum APY</li>
            )}
          </ul>
        </div>
        <p className="text-xs text-text-secondary mt-4">
          You can use these tokens to withdraw your deposit and any accrued returns at any time.
        </p>
      </div>
    </InfoModal>
  )
}
