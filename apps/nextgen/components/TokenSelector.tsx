import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { cl } from '@lib/utils'
import { type Token, useTokens } from '@nextgen/hooks/useTokens'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, isAddress } from 'viem'

interface TokenWithBalance extends Token {
  costUsd?: number
}

interface TokenSelectorProps {
  value: Address | undefined
  onChange: (address: Address) => void
  chainId: number
  limitTokens?: Address[]
  excludeTokens?: Address[]
  onClose?: () => void
}

const TokenItem: FC<{ token: TokenWithBalance; selected: boolean; onSelect: () => void }> = ({
  token,
  selected,
  onSelect
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cl(
        'flex items-center justify-between w-full px-3 py-2 rounded-lg transition-colors',
        selected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
      )}
    >
      <div className="flex items-center gap-2">
        <ImageWithFallback
          src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${token.chainID}/${token.address?.toLowerCase()}/logo-32.png`}
          alt={token.symbol ?? ''}
          width={24}
          height={24}
        />
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900">{token.symbol}</div>
          <div className="text-xs text-gray-500">{token.name}</div>
        </div>
      </div>
      {token.balance && (
        <div className="text-right">
          <div className="text-xs text-gray-600">{token.balance.normalized.toFixed(4)}</div>
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

  // Fetch common tokens based on chainId
  const commonTokenAddresses = useMemo(() => {
    const tokensByChain: Record<number, Address[]> = {
      1: [
        // Ethereum mainnet
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' // WBTC
      ],
      10: [
        // Optimism
        '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
        '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
        '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
        '0x4200000000000000000000000000000000000006' // WETH
      ],
      137: [
        // Polygon
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // WMATIC
      ],
      42161: [
        // Arbitrum
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
        '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
        '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
        '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // WETH
      ]
    }
    return tokensByChain[chainId] || []
  }, [chainId])

  // Fetch all tokens including custom address if valid
  const allAddresses = useMemo(() => {
    const addresses = [...commonTokenAddresses]
    if (customAddress && isAddress(customAddress)) {
      addresses.push(customAddress)
    }
    if (value && !addresses.includes(value)) {
      addresses.push(value)
    }
    return addresses.filter(Boolean) as Address[]
  }, [commonTokenAddresses, customAddress, value])

  const { tokens, isLoading } = useTokens(allAddresses, chainId)

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
      onChange(address)
      if (onClose) {
        onClose()
      }
    },
    [onChange, onClose]
  )

  return (
    <div className="absolute inset-0 bg-white rounded-lg z-50 flex flex-col shadow-xl">
      {/* Header with close button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold">Select Token</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors" type="button">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
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
