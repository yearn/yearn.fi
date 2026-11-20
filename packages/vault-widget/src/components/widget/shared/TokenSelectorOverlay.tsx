import { TokenSelector } from '@yearn/vault-widget/internal/components/widget/TokenSelector'
import type { TTokenSelectorMode } from '@yearn/vault-widget/internal/components/widget/tokenSelectorList.utils'
import type { TToken } from '@yearn/vault-widget/types'
import { createContext, type FC, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

/** Hosts can provide a card so asset selection covers its header as well as its amount form. */
export const TokenSelectorCardContext = createContext<HTMLElement | null>(null)

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
  const card = useContext(TokenSelectorCardContext)
  const close = useRef(onClose)
  close.current = onClose
  const [returnFocus] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  // A portaled picker must disable the covered form and restore its trigger's focus on dismissal.
  useEffect(() => {
    if (!card) return
    const content = card.querySelector<HTMLElement>('[data-erc4626-content]')
    const wasInert = content?.inert ?? false
    if (content) content.inert = true
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !card.contains(event.target)) close.current()
    }
    document.addEventListener('pointerdown', dismiss)
    return () => {
      if (content) content.inert = wasInert
      document.removeEventListener('pointerdown', dismiss)
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true })
    }
  }, [card, returnFocus])
  const selector = (
    <div
      data-token-selector-overlay={card ? '' : undefined}
      className={card ? 'absolute inset-0 z-50 overflow-hidden rounded-2xl bg-surface' : 'absolute z-50'}
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
          cardLayout={!!card}
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
  return card ? createPortal(selector, card) : selector
}
