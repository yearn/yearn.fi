import { TokenSelector } from '@pages/vaults/components/widget/TokenSelector'
import type { TTokenSelectorMode } from '@pages/vaults/components/widget/tokenSelectorList.utils'
import type { TToken } from '@shared/types'
import type { FC } from 'react'
import type { Address } from 'viem'

interface TokenSelectorOverlayProps {
  onClose: () => void
  onChange: (address: Address, chainId?: number) => void
  chainId: number
  value?: Address
  excludeTokens?: Address[]
  priorityTokens?: Record<number, Address[]>
  topTokens?: Record<number, Address[]>
  extraTokens?: TToken[]
  assetAddress?: Address
  assetChainId?: number
  vaultAddress?: Address
  stakingAddress?: Address
  allowHiddenVaultTokenSelection?: boolean
  mode?: TTokenSelectorMode
}

export const TokenSelectorOverlay: FC<TokenSelectorOverlayProps> = ({
  onClose,
  onChange,
  chainId,
  value,
  excludeTokens,
  priorityTokens,
  topTokens,
  extraTokens,
  assetAddress,
  assetChainId,
  vaultAddress,
  stakingAddress,
  allowHiddenVaultTokenSelection,
  mode
}) => {
  return (
    <div
      className="absolute z-50"
      style={{
        top: 0, // Adjust to cover the tabs
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto'
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/5 rounded-lg" onClick={onClose} />
      <div className="absolute inset-0">
        <TokenSelector
          value={value}
          onChange={onChange}
          chainId={chainId}
          excludeTokens={excludeTokens}
          priorityTokens={priorityTokens}
          topTokens={topTokens}
          extraTokens={extraTokens}
          onClose={onClose}
          assetAddress={assetAddress}
          assetChainId={assetChainId}
          vaultAddress={vaultAddress}
          stakingAddress={stakingAddress}
          allowHiddenVaultTokenSelection={allowHiddenVaultTokenSelection}
          mode={mode}
        />
      </div>
    </div>
  )
}
