import type { FC } from 'react'
import { InfoOverlay } from '../shared/InfoOverlay'

interface VaultSharesOverlayProps {
  isOpen: boolean
  onClose: () => void

  depositTokenSymbol: string
  vaultAssetSymbol: string
  vaultSymbol: string
  stakingTokenSymbol?: string

  stakingAddress?: `0x${string}`
  isAutoStakingEnabled: boolean
  isZap: boolean
}

export const VaultSharesOverlay: FC<VaultSharesOverlayProps> = ({
  isOpen,
  onClose,
  depositTokenSymbol,
  vaultAssetSymbol,
  vaultSymbol,
  stakingTokenSymbol,
  stakingAddress,
  isAutoStakingEnabled,
  isZap
}) => {
  const receiveTokenSymbol = isAutoStakingEnabled && stakingAddress ? stakingTokenSymbol : vaultSymbol

  return (
    <InfoOverlay isOpen={isOpen} onClose={onClose} title="Vault Shares">
      <div className="space-y-4">
        {/* What you'll receive */}
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">
            {isZap ? (
              <>
                <div>
                  Your <span className="font-semibold text-text-primary">{depositTokenSymbol}</span> will be swapped to{' '}
                  <span className="font-semibold text-text-primary">{vaultAssetSymbol}</span>, then deposited into the
                  vault.
                </div>
                <div>
                  You'll receive <span className="font-semibold text-text-primary">{receiveTokenSymbol}</span> shares,
                  which are redeemable for <span className="font-semibold text-text-primary">{vaultAssetSymbol}</span>{' '}
                  plus earnings anytime
                </div>
              </>
            ) : (
              <>
                <div>
                  You're depositing <span className="font-semibold text-text-primary">{depositTokenSymbol}</span> into
                  the vault.{' '}
                </div>
                <div>
                  You'll receive <span className="font-semibold text-text-primary">{vaultSymbol}</span> shares, which
                  are redeemable for <span className="font-semibold text-text-primary">{vaultAssetSymbol}</span> plus
                  earnings anytime
                </div>
              </>
            )}
          </p>
        </div>

        {/* How vault shares work */}
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">
            Vault shares represent your deposit. Their value grows automatically as the vault earns yield — you don't
            need to do anything. When you withdraw, your shares are exchanged back for the underlying asset plus any
            earnings.
          </p>
        </div>
      </div>
    </InfoOverlay>
  )
}
