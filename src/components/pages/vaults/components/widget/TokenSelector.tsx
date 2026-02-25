import { YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWallet } from '@shared/contexts/useWallet'
import type { TToken } from '@shared/types'
import { cl, formatTAmount, toAddress, toNormalizedBN } from '@shared/utils'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { isAddress } from 'viem'
import { CloseIcon } from './shared/Icons'

type TTokenType = 'asset' | 'vault' | 'staking' | undefined

interface TokenSelectorProps {
  value: `0x${string}` | undefined
  onChange: (address: `0x${string}`, chainId?: number) => void
  chainId: number
  limitTokens?: `0x${string}`[]
  excludeTokens?: `0x${string}`[]
  priorityTokens?: Record<number, `0x${string}`[]> // chainId -> addresses to always show
  onClose?: () => void
  assetAddress?: `0x${string}`
  vaultAddress?: `0x${string}`
  stakingAddress?: `0x${string}`
}

const getKnownPriorityTokenFallback = (address: `0x${string}`, chainId: number): TToken | undefined => {
  const normalizedAddress = toAddress(address)
  if (chainId === YVUSD_CHAIN_ID && normalizedAddress === YVUSD_UNLOCKED_ADDRESS) {
    return {
      address: normalizedAddress,
      name: 'yvUSD',
      symbol: 'yvUSD',
      decimals: 18,
      chainID: chainId,
      value: 0,
      balance: toNormalizedBN(0n, 18)
    }
  }

  return undefined
}

const TokenTypeChip: FC<{ type: TTokenType }> = ({ type }) => {
  if (!type) return null

  const config = {
    asset: { label: 'Asset', className: 'bg-blue-500/10 text-blue-600' },
    vault: { label: 'Vault', className: 'bg-green-500/10 text-green-600' },
    staking: { label: 'Staking', className: 'bg-purple-500/10 text-purple-600' }
  }

  const { label, className } = config[type]
  return <span className={cl('px-1.5 py-0.5 text-[10px] font-medium rounded', className)}>{label}</span>
}

const TokenItem: FC<{ token: TToken; selected: boolean; onSelect: () => void; tokenType?: TTokenType }> = ({
  token,
  selected,
  onSelect,
  tokenType
}) => {
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
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text-primary">{token.symbol}</span>
            <TokenTypeChip type={tokenType} />
          </div>
          <div className="text-xs text-text-secondary">{token.name}</div>
        </div>
      </div>
      {token.balance && token.balance.raw > 0n && (
        <div className="text-right">
          <div className="text-xs text-text-secondary">
            {formatTAmount({ value: token.balance.raw, decimals: token.decimals ?? 18 })}
          </div>
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
  priorityTokens,
  onClose,
  assetAddress,
  vaultAddress,
  stakingAddress
}) => {
  const [searchText, setSearchText] = useState('')
  const [customAddress, setCustomAddress] = useState<`0x${string}` | undefined>()
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

    // Include priority tokens even if they have no balance
    const chainPriorityTokens = priorityTokens?.[selectedChainId] || []
    for (const priorityAddress of chainPriorityTokens) {
      if (!tokenList.some((t) => t.address?.toLowerCase() === priorityAddress.toLowerCase())) {
        const priorityToken = getToken({ address: toAddress(priorityAddress), chainID: selectedChainId })
        if (priorityToken.symbol) {
          tokenList.push(priorityToken)
        } else {
          const fallbackToken = getKnownPriorityTokenFallback(priorityAddress, selectedChainId)
          if (fallbackToken) {
            tokenList.push(fallbackToken)
          }
        }
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
  }, [balances, selectedChainId, value, customAddress, getToken, priorityTokens])

  // Filter tokens based on search and limits
  const filteredTokens = useMemo(() => {
    const filtered = tokens
      .filter((token) => !limitTokens?.length || limitTokens.includes(token.address as `0x${string}`))
      .filter((token) => !excludeTokens?.length || !excludeTokens.includes(token.address as `0x${string}`))
      .filter((token) => {
        if (!searchText) return true
        const search = searchText.toLowerCase()
        return (
          token.symbol?.toLowerCase().includes(search) ||
          token.name?.toLowerCase().includes(search) ||
          token.address?.toLowerCase().includes(search)
        )
      })

    // Sort by balance (highest first)
    return filtered.toSorted((a, b) => {
      const aBalance = a.balance?.raw || 0n
      const bBalance = b.balance?.raw || 0n
      return bBalance > aBalance ? 1 : -1
    })
  }, [tokens, limitTokens, excludeTokens, searchText])

  // Check if search text is a valid address
  useEffect(() => {
    if (searchText && isAddress(searchText) && searchText !== customAddress) {
      setCustomAddress(searchText as `0x${string}`)
    }
  }, [searchText, customAddress])

  const handleSelect = useCallback(
    (address: `0x${string}`) => {
      onChange(address, selectedChainId)
      if (onClose) {
        onClose()
      }
    },
    [onChange, onClose, selectedChainId]
  )

  const getTokenType = useCallback(
    (tokenAddress: string | undefined): TTokenType => {
      if (!tokenAddress) return undefined
      const addr = tokenAddress.toLowerCase()
      if (stakingAddress && addr === stakingAddress.toLowerCase()) return 'staking'
      if (vaultAddress && addr === vaultAddress.toLowerCase()) return 'vault'
      if (assetAddress && addr === assetAddress.toLowerCase()) return 'asset'
      return undefined
    },
    [assetAddress, vaultAddress, stakingAddress]
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
          <CloseIcon className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* Search input */}
      <div className="p-4">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by name or paste address"
          className="w-full px-3 py-2 bg-surface text-text-primary text-sm border border-border rounded-lg"
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
                onSelect={() => handleSelect(token.address as `0x${string}`)}
                tokenType={getTokenType(token.address)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
