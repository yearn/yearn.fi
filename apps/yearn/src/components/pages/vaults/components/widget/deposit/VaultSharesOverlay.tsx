import type { FC } from 'react'
import { InfoOverlay } from '../shared/InfoOverlay'
import type { DepositRouteType } from './types'

interface VaultSharesOverlayProps {
  isOpen: boolean
  onClose: () => void

  depositTokenSymbol: string
  vaultAssetSymbol: string
  vaultSymbol: string
  stakingTokenSymbol?: string

  expectedShares: string
  stakingAddress?: `0x${string}`
  isAutoStakingEnabled: boolean
  isZap: boolean
  routeType: DepositRouteType
}

export const VaultSharesOverlay: FC<VaultSharesOverlayProps> = ({
  isOpen,
  onClose,
  depositTokenSymbol,
  vaultAssetSymbol,
  vaultSymbol,
  stakingTokenSymbol,
  expectedShares,
  stakingAddress,
  isAutoStakingEnabled,
  isZap,
  routeType
}) => {
  const isDirectStake = routeType === 'DIRECT_STAKE'
  const willAutoStake = isAutoStakingEnabled && !!stakingAddress
  const willReceiveStakedShares = isDirectStake || willAutoStake

  const receiveTokenSymbol = willReceiveStakedShares ? stakingTokenSymbol : vaultSymbol
  const title = willReceiveStakedShares ? 'Staked Shares' : 'Vault Shares'

  const renderDescription = () => {
    // Case 1: Direct stake (user already has vault shares)
    if (isDirectStake) {
      return (
        <>
          You're staking your <span className="font-semibold text-text-primary">{depositTokenSymbol}</span> vault
          shares. You'll receive{' '}
          <span className="font-semibold text-text-primary">{receiveTokenSymbol || 'staked shares'}</span> which
          represent your staked position.
        </>
      )
    }

    // Case 2: Zap + auto-stake (swap → deposit → stake)
    if (isZap && willAutoStake) {
      return (
        <>
          Your <span className="font-semibold text-text-primary">{depositTokenSymbol}</span> will be swapped to{' '}
          <span className="font-semibold text-text-primary">{vaultAssetSymbol}</span>, deposited into the vault, and
          automatically staked. You'll receive{' '}
          <span className="font-semibold text-text-primary">{receiveTokenSymbol || 'staked shares'}</span> which
          represent your staked position.
        </>
      )
    }

    // Case 3: Zap only (swap → deposit, no stake)
    if (isZap) {
      return (
        <>
          Your <span className="font-semibold text-text-primary">{depositTokenSymbol}</span> will be swapped to{' '}
          <span className="font-semibold text-text-primary">{vaultAssetSymbol}</span>, then deposited into the vault.
          You'll receive <span className="font-semibold text-text-primary">{receiveTokenSymbol}</span> shares.
        </>
      )
    }

    // Case 4: Direct deposit + auto-stake (deposit → stake)
    if (willAutoStake) {
      return (
        <>
          You're depositing <span className="font-semibold text-text-primary">{depositTokenSymbol}</span> into the
          vault, which will be automatically staked. You'll receive{' '}
          <span className="font-semibold text-text-primary">{receiveTokenSymbol || 'staked shares'}</span> which
          represent your staked position.
        </>
      )
    }

    // Case 5: Direct deposit only (no stake)
    return (
      <>
        You're depositing <span className="font-semibold text-text-primary">{depositTokenSymbol}</span> into the vault.
        You'll receive <span className="font-semibold text-text-primary">{receiveTokenSymbol}</span> shares.
      </>
    )
  }

  return (
    <InfoOverlay isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {/* What you'll receive */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">What you'll receive</p>
          <p className="text-sm text-text-secondary">{renderDescription()}</p>
        </div>

        {/* How it works */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">
            {willReceiveStakedShares ? 'How staking works' : 'How vault shares work'}
          </p>
          <p className="text-sm text-text-secondary">
            {willReceiveStakedShares ? (
              <>
                Staking your vault shares allows you to earn additional rewards on top of the vault's yield. Your staked
                shares continue to grow in value while also accumulating staking rewards. You can unstake anytime to
                receive your vault shares back.
              </>
            ) : (
              <>
                Vault shares represent your deposit. Their value grows automatically as the vault earns yield — you
                don't need to do anything. When you withdraw, your shares are exchanged back for the underlying asset
                plus any earnings.
              </>
            )}
          </p>
        </div>

        {/* Token details */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">Token details</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary ml-2">
            <li>
              You'll receive:{' '}
              <span className="font-semibold text-text-primary">
                {expectedShares} {receiveTokenSymbol || (willReceiveStakedShares ? 'staked shares' : 'shares')}
              </span>
            </li>
            {willReceiveStakedShares ? (
              <li>Unstake anytime to receive your {vaultSymbol} vault shares</li>
            ) : (
              <li>Redeemable for {vaultAssetSymbol} plus earnings anytime</li>
            )}
          </ul>
        </div>
      </div>
    </InfoOverlay>
  )
}
