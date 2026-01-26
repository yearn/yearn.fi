import { TokenSelector } from '@pages/vaults/components/widget/TokenSelector'
import { cl } from '@shared/utils'
import type { FC } from 'react'
import type { Address } from 'viem'

interface TokenSelectorOverlayProps {
  isOpen: boolean
  onClose: () => void
  onChange: (address: Address, chainId?: number) => void
  chainId: number
  value?: Address
  excludeTokens?: Address[]
  priorityTokens?: Record<number, Address[]>
  assetAddress?: Address
  vaultAddress?: Address
  stakingAddress?: Address
}

export const TokenSelectorOverlay: FC<TokenSelectorOverlayProps> = ({
  isOpen,
  onClose,
  onChange,
  chainId,
  value,
  excludeTokens,
  priorityTokens,
  assetAddress,
  vaultAddress,
  stakingAddress
}) => {
  return (
    <div
      className="absolute z-50"
      style={{
        top: '-48px', // Adjust to cover the tabs
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      {/* Semi-transparent backdrop with fade animation */}
      <div
        className={cl(
          'absolute inset-0 bg-black/5 rounded-xl transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      {/* Token selector overlay with slide and fade animation */}
      <div
        className={cl(
          'absolute inset-0 transition-all duration-300 ease-out',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        )}
      >
        <TokenSelector
          value={value}
          onChange={onChange}
          chainId={chainId}
          excludeTokens={excludeTokens}
          priorityTokens={priorityTokens}
          onClose={onClose}
          assetAddress={assetAddress}
          vaultAddress={vaultAddress}
          stakingAddress={stakingAddress}
        />
      </div>
    </div>
  )
}
