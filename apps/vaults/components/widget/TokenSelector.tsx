import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { TokenLogo } from '@lib/components/TokenLogo'
import { useWallet } from '@lib/contexts/useWallet'
import type { TToken } from '@lib/types'
import { cl, toAddress } from '@lib/utils'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, isAddress } from 'viem'

interface TokenSelectorProps {
  value: Address | undefined
  onChange: (address: Address, chainId?: number) => void
  chainId: number
  limitTokens?: Address[]
  excludeTokens?: Address[]
  onClose?: () => void
}

const TokenItem: FC<{ token: TToken; selected: boolean; onSelect: () => void }> = ({ token, selected, onSelect }) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cl(
        'flex items-center justify-between w-full px-3 py-2 rounded-lg transition-all active:scale-[0.98]',
        selected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-surface-secondary'
      )}
    >
      <div className="flex items-center gap-2">
        <TokenLogo
          src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${token.chainID}/${token.address?.toLowerCase()}/logo-32.png`}
          tokenSymbol={token.symbol}
          tokenName={token.name}
          width={24}
          height={24}
          className="rounded-full"
        />
        <div className="text-left">
          <div className="text-sm font-medium text-text-primary">{token.symbol}</div>
          <div className="text-xs text-text-secondary">{token.name}</div>
        </div>
      </div>
      {token.balance && (
        <div className="text-right">
          <div className="text-xs text-text-secondary">{token.balance.normalized.toFixed(4)}</div>
        </div>
      )}
    </button>
  )
}

export const TokenSelector: FC<TokenSelectorProps> = ({
  value,
  onChange,
  chainId,
  limitTokens,
  excludeTokens,
  onClose
}) => {
  const [searchText, setSearchText] = useState('')
  const [customAddress, setCustomAddress] = useState<Address | undefined>()
  const [selectedChainId, setSelectedChainId] = useState(chainId)
  const { getToken, isLoading, balances } = useWallet()

  // Available chains - you can expand this list as needed
  const availableChains = useMemo(
    () => [
      { id: 1, name: 'Ethereum' },
      { id: 10, name: 'Optimism' },
      { id: 137, name: 'Polygon' },
      { id: 42161, name: 'Arbitrum' },
      { id: 8453, name: 'Base' },
      { id: 747474, name: 'Katana' }
    ],
    []
  )

  // Get all tokens with balances from wallet context
  const tokens = useMemo(() => {
    const chainBalances = balances[selectedChainId] || {}
    const tokenList: TToken[] = []

    // Add all tokens from wallet balances
    Object.entries(chainBalances).forEach(([address, token]) => {
      if (token.chainID === 137 && toAddress(address) === '0x0000000000000000000000000000000000001010') {
        return // Skip MATIC
      }

      if (token.balance.raw > 0n) {
        tokenList.push(token)
      }
    })

    // Also include the currently selected token even if it has no balance
    if (value && !tokenList.some((t) => t.address?.toLowerCase() === value.toLowerCase())) {
      const selectedToken = getToken({ address: toAddress(value), chainID: selectedChainId })
      if (selectedToken.symbol) {
        tokenList.push(selectedToken)
      }
    }

    // Include custom address if valid
    if (
      customAddress &&
      isAddress(customAddress) &&
      !tokenList.some((t) => t.address?.toLowerCase() === customAddress.toLowerCase())
    ) {
      const customToken = getToken({ address: toAddress(customAddress), chainID: selectedChainId })
      if (customToken.symbol) {
        tokenList.push(customToken)
      }
    }

    return tokenList
  }, [balances, selectedChainId, value, customAddress, getToken])

  // Filter tokens based on search and limits
  const filteredTokens = useMemo(() => {
    let filtered = tokens

    // Apply limitTokens filter
    if (limitTokens && limitTokens.length > 0) {
      filtered = filtered.filter((token) => limitTokens.includes(token.address as Address))
    }

    // Apply excludeTokens filter
    if (excludeTokens && excludeTokens.length > 0) {
      filtered = filtered.filter((token) => !excludeTokens.includes(token.address as Address))
    }

    // Apply search filter
    if (searchText) {
      const search = searchText.toLowerCase()
      filtered = filtered.filter(
        (token) =>
          token.symbol?.toLowerCase().includes(search) ||
          token.name?.toLowerCase().includes(search) ||
          token.address?.toLowerCase().includes(search)
      )
    }

    // Sort by balance (highest first)
    return filtered.sort((a, b) => {
      const aBalance = a.balance?.raw || 0n
      const bBalance = b.balance?.raw || 0n
      return bBalance > aBalance ? 1 : -1
    })
  }, [tokens, limitTokens, excludeTokens, searchText])

  // Check if search text is a valid address
  useEffect(() => {
    if (searchText && isAddress(searchText) && searchText !== customAddress) {
      setCustomAddress(searchText as Address)
    }
  }, [searchText, customAddress])

  const handleSelect = useCallback(
    (address: Address) => {
      // Pass the selected chain ID when it's different from the original chain
      onChange(address, selectedChainId !== chainId ? selectedChainId : undefined)
      if (onClose) {
        onClose()
      }
    },
    [onChange, onClose, selectedChainId, chainId]
  )
  return (
    <div
      className="absolute inset-0 bg-surface rounded-lg z-50 flex flex-col shadow-xl overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header with chain selector and close button */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner">
          {availableChains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => setSelectedChainId(chain.id)}
              className={cl(
                'size-9 flex items-center justify-center rounded-md transition-all',
                selectedChainId === chain.id ? 'bg-surface shadow-sm' : 'bg-transparent hover:bg-surface/50'
              )}
              type="button"
            >
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${chain.id}/logo.svg`}
                alt={chain.name}
                width={20}
                height={20}
                className="rounded-full"
              />
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-surface-secondary rounded-lg transition-colors" type="button">
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <div className="p-4">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by name or paste address"
          className="w-full px-3 py-2 bg-surface text-text-primary text-sm border border-border rounded-lg focus:outline-none focus:border-border-focus"
        />
      </div>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 overscroll-contain">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">
            {searchText ? 'No tokens found' : 'No tokens available'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTokens.map((token) => (
              <TokenItem
                key={token.address}
                token={token}
                selected={token.address === value}
                onSelect={() => handleSelect(token.address as Address)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
