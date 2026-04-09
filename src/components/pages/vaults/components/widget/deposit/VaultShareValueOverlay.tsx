'use client'

import type { FC } from 'react'
import { InfoOverlay } from '../shared/InfoOverlay'

interface VaultShareValueOverlayProps {
  isOpen: boolean
  onClose: () => void
  sharesAmount: string
  sharesLabel: string
  shareValue: string
  assetSymbol: string
  usdValue: string
  showShareConversion?: boolean
  convertedVaultSharesAmount?: string
}

export const VaultShareValueOverlay: FC<VaultShareValueOverlayProps> = ({
  isOpen,
  onClose,
  sharesAmount,
  sharesLabel,
  shareValue,
  assetSymbol,
  usdValue,
  showShareConversion = false,
  convertedVaultSharesAmount
}) => {
  const showsShareConversion = showShareConversion && !!convertedVaultSharesAmount

  return (
    <InfoOverlay isOpen={isOpen} onClose={onClose} title="Vault Share Value">
      <div className="space-y-4">
        {/* What this value means */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">What this value means</p>
          <p className="text-sm text-text-secondary">
            This is the amount of <span className="font-semibold text-text-primary">{assetSymbol}</span> you could
            redeem immediately after depositing. It represents the value of the shares you will receive converted to the
            underlying asset.
          </p>
        </div>

        {/* Current value */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">In your case:</p>
          {showsShareConversion ? (
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">
                {sharesAmount} {sharesLabel}
              </span>{' '}
              will currently unwrap to{' '}
              <span className="font-semibold text-text-primary">{convertedVaultSharesAmount} Vault shares</span>, which
              are convertible to{' '}
              <span className="font-semibold text-text-primary">
                {shareValue} {assetSymbol}
              </span>{' '}
              (${usdValue})
            </p>
          ) : (
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">
                {sharesAmount} {sharesLabel}
              </span>{' '}
              will be convertible to{' '}
              <span className="font-semibold text-text-primary">
                {shareValue} {assetSymbol}
              </span>{' '}
              (${usdValue})
            </p>
          )}
        </div>
      </div>
    </InfoOverlay>
  )
}
