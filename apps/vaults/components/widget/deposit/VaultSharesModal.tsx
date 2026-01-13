import type { FC } from 'react'
import type { Address } from 'viem'
import { InfoModal } from '../shared'

interface VaultSharesModalProps {
  isOpen: boolean
  onClose: () => void

  depositTokenSymbol: string
  vaultAssetSymbol: string
  vaultSymbol: string
  stakingTokenSymbol?: string

  expectedShares: string
  stakingAddress?: Address
  isAutoStakingEnabled: boolean
  isZap: boolean
}

export const VaultSharesModal: FC<VaultSharesModalProps> = ({
  isOpen,
  onClose,
  depositTokenSymbol,
  vaultAssetSymbol,
  vaultSymbol,
  stakingTokenSymbol,
  expectedShares,
  stakingAddress,
  isAutoStakingEnabled,
  isZap
}) => {
  const receiveTokenSymbol = isAutoStakingEnabled && stakingAddress ? stakingTokenSymbol : vaultSymbol

  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Vault Shares">
      <div className="space-y-4">
        {/* What you'll receive */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">What you'll receive</p>
          <p className="text-sm text-text-secondary">
            {isZap ? (
              <>
                Your <span className="font-medium text-text-primary">{depositTokenSymbol}</span> will be swapped to{' '}
                <span className="font-medium text-text-primary">{vaultAssetSymbol}</span>, then deposited into the
                vault. You'll receive <span className="font-medium text-text-primary">{receiveTokenSymbol}</span>{' '}
                shares.
              </>
            ) : (
              <>
                You're depositing <span className="font-medium text-text-primary">{depositTokenSymbol}</span> into the
                vault. You'll receive <span className="font-medium text-text-primary">{receiveTokenSymbol}</span>{' '}
                shares.
              </>
            )}
          </p>
        </div>

        {/* How vault shares work */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">How vault shares work</p>
          <p className="text-sm text-text-secondary">
            Vault shares represent your deposit. Their value grows automatically as the vault earns yield — you don't
            need to do anything. When you withdraw, your shares are exchanged back for the underlying asset plus any
            earnings.
          </p>
        </div>

        {/* Token details */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">Token details</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary ml-2">
            <li>
              You'll receive:{' '}
              <span className="font-medium text-text-primary">
                {expectedShares} {receiveTokenSymbol}
              </span>
            </li>
            <li>Redeemable for {vaultAssetSymbol} plus earnings anytime</li>
          </ul>
        </div>
      </div>
    </InfoModal>
  )
}
