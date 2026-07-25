'use client'

import { type ComponentType, type ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { getTokenSelectorChainIds, getTokenSelectorTokens } from '../headless/tokenSelector'
import type {
  VaultWidgetMode,
  VaultWidgetToken,
  VaultWidgetTokenReference,
  VaultWidgetTokenSelectorChain
} from '../types'

type TokenSelectorOverlayProps = {
  balance?: string
  chains?: readonly VaultWidgetTokenSelectorChain[]
  defaultTokens?: readonly VaultWidgetTokenReference[]
  mode: Extract<VaultWidgetMode, 'deposit' | 'withdraw'>
  onChange: (token: VaultWidgetToken) => void
  onClose: () => void
  selectedToken: VaultWidgetToken
  TokenIcon: ComponentType<{ token: VaultWidgetToken; size: number }>
  tokens: readonly VaultWidgetToken[]
}

const DEFAULT_CHAIN_NAMES: Readonly<Record<number, string>> = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  747474: 'Katana'
}

function CloseIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  )
}

function getDefaultChain(chainId: number): VaultWidgetTokenSelectorChain {
  return {
    id: chainId,
    name: DEFAULT_CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
    logoURI: `https://assets.yearn.fi/chains/${chainId}/logo.svg`
  }
}

export function TokenSelectorOverlay({
  balance,
  chains,
  defaultTokens,
  mode,
  onChange,
  onClose,
  selectedToken,
  TokenIcon,
  tokens
}: TokenSelectorOverlayProps): ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchText, setSearchText] = useState('')
  const [selectedChainId, setSelectedChainId] = useState(selectedToken.chainId)
  const availableChainIds = useMemo(() => getTokenSelectorChainIds(tokens), [tokens])
  const availableChains = useMemo(() => {
    if (chains) {
      const configuredChainIds = new Set(chains.map((chain) => chain.id))
      return [
        ...chains,
        ...availableChainIds.filter((chainId) => !configuredChainIds.has(chainId)).map(getDefaultChain)
      ]
    }
    return availableChainIds.map(getDefaultChain)
  }, [availableChainIds, chains])
  const visibleTokens = getTokenSelectorTokens({
    tokens,
    chainId: selectedChainId,
    searchText,
    defaultTokens
  })

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleDialogKeys = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]')).filter(
        (element) =>
          element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      const activeElement = event.target instanceof HTMLElement ? event.target : document.activeElement

      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', handleDialogKeys)
    return () => dialog.removeEventListener('keydown', handleDialogKeys)
  }, [onClose])

  return (
    <div
      className="yv-widget__token-overlay"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Select ${mode} token`}
    >
      <button
        className="yv-widget__token-overlay-backdrop"
        type="button"
        aria-label="Close token selector"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="yv-widget__token-selector">
        <div className="yv-widget__token-selector-header">
          <fieldset className="yv-widget__chain-selector" aria-label="Select network">
            {availableChains.map((chain) => (
              <button
                type="button"
                key={chain.id}
                data-active={selectedChainId === chain.id}
                aria-label={chain.name}
                aria-pressed={selectedChainId === chain.id}
                onClick={() => {
                  setSelectedChainId(chain.id)
                  setSearchText('')
                }}
              >
                <img src={chain.logoURI} alt="" width={20} height={20} />
              </button>
            ))}
          </fieldset>
          <button
            className="yv-widget__token-selector-close"
            type="button"
            aria-label="Close token selector"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="yv-widget__token-search">
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            placeholder="Search by name or paste address"
            aria-label="Search tokens"
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>

        <div className="yv-widget__token-list">
          {visibleTokens.length === 0 ? (
            <p>{searchText ? 'No tokens found' : 'No tokens available'}</p>
          ) : (
            visibleTokens.map((token) => {
              const isSelected =
                token.chainId === selectedToken.chainId &&
                token.address.toLowerCase() === selectedToken.address.toLowerCase()
              return (
                <button
                  className="yv-widget__token-option"
                  data-selected={isSelected}
                  key={`${token.chainId}:${token.address}`}
                  type="button"
                  aria-label={`${token.symbol} ${token.name ?? token.symbol}`}
                  onClick={() => onChange(token)}
                >
                  <span className="yv-widget__token-option-identity">
                    <TokenIcon token={token} size={24} />
                    <span>
                      <strong>{token.symbol}</strong>
                      <small>{token.name ?? token.symbol}</small>
                    </span>
                  </span>
                  {isSelected && balance ? <span className="yv-widget__token-option-balance">{balance}</span> : null}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
