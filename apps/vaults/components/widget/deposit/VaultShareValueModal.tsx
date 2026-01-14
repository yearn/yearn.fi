import type { FC } from 'react'
import { InfoModal } from '../shared'

interface VaultShareValueModalProps {
  isOpen: boolean
  onClose: () => void
  sharesAmount: string
  shareValue: string
  assetSymbol: string
  usdValue: string
}

export const VaultShareValueModal: FC<VaultShareValueModalProps> = ({
  isOpen,
  onClose,
  sharesAmount,
  shareValue,
  assetSymbol,
  usdValue
}) => {
  return (
    <InfoModal isOpen={isOpen} onClose={onClose} title="Vault Share Value">
      <div className="space-y-4">
        {/* What this value means */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">What this value means</p>
          <p className="text-sm text-text-secondary">
            This is the amount of <span className="font-medium text-text-primary">{assetSymbol}</span> you could redeem
            immediately after depositing. It represents the value of vault shares to be received converted to the
            underlying asset.
          </p>
        </div>

        {/* Current value */}
        <div className="space-y-2">
          <p className="font-medium text-sm text-text-primary">In your case:</p>
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{sharesAmount} Vault shares</span> will be convertible to{' '}
            <span className="font-medium text-text-primary">
              {shareValue} {assetSymbol}
            </span>{' '}
            (${usdValue})
          </p>
        </div>
      </div>
    </InfoModal>
  )
}
