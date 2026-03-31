import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import { IconChevron } from '@shared/icons/IconChevron'
import type { TToken } from '@shared/types'
import { cl, formatTAmount, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import { type FC, useCallback, useMemo, useState } from 'react'
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
  extraTokens?: TToken[]
  onClose?: () => void
  assetAddress?: `0x${string}`
  vaultAddress?: `0x${string}`
  stakingAddress?: `0x${string}`
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
  extraTokens,
  onClose,
  assetAddress,
  vaultAddress,
  stakingAddress
}) => {
  const [searchText, setSearchText] = useState('')
  const [selectedChainId, setSelectedChainId] = useState(chainId)
  const [showUnlisted, setShowUnlisted] = useState(false)
  const { getToken, isLoading, balances } = useWallet()

  // Derived: treat valid address input as custom token
  const customAddress = searchText && isAddress(searchText) ? (searchText as `0x${string}`) : undefined

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

    // Wallet tokens with a balance
    const walletTokens = Object.entries(chainBalances)
      .filter(
        ([address, token]) =>
          token.balance.raw > 0n &&
          !(token.chainID === 137 && toAddress(address) === '0x0000000000000000000000000000000000001010')
      )
      .map(([, token]) => token)

    // Priority tokens (shown even without balance)
    const priorityResolved = (priorityTokens?.[selectedChainId] || [])
      .map((addr) => getToken({ address: toAddress(addr), chainID: selectedChainId }))
      .filter((t) => Boolean(t.symbol))

    // Currently selected token (shown even without balance)
    const selectedResolved = value
      ? [getToken({ address: toAddress(value), chainID: selectedChainId })].filter((t) => Boolean(t.symbol))
      : []

    // Custom address from search input
    const customResolved =
      customAddress && isAddress(customAddress)
        ? [getToken({ address: toAddress(customAddress), chainID: selectedChainId })].filter((t) => Boolean(t.symbol))
        : []

    // Extra tokens for custom widget flows
    const chainExtraTokens = (extraTokens || []).filter((token) => token.chainID === selectedChainId)

    // Merge all sources, deduplicate by address (first occurrence wins)
    const seen = new Set<string>()
    return [...walletTokens, ...selectedResolved, ...priorityResolved, ...customResolved, ...chainExtraTokens].filter(
      (token) => {
        const addr = token.address?.toLowerCase() ?? ''
        if (seen.has(addr)) return false
        seen.add(addr)
        return true
      }
    )
  }, [balances, selectedChainId, value, customAddress, getToken, priorityTokens, extraTokens])

  // Build a map of vault underlying asset addresses → total TVL for ranking.
  // Native ETH is always treated as known (ranked via highest-TVL vault asset).
  const { vaults } = useYearn()
  const assetTvlByChain = useMemo(() => {
    const chainVaults = Object.values(vaults).filter(
      (vault) => vault.chainId === selectedChainId && vault.asset?.address
    )
    const entries = chainVaults.map((vault) => vault.asset!.address.toLowerCase())
    const uniqueAddrs = [...new Set(entries)]
    const tvlMap = Object.fromEntries(
      uniqueAddrs.map((addr) => [
        addr,
        chainVaults.filter((v) => v.asset!.address.toLowerCase() === addr).reduce((sum, v) => sum + (v.tvl || 0), 0)
      ])
    )

    // Include native ETH as known with Infinity ranking so it sorts to the top
    const ethAddr = ETH_TOKEN_ADDRESS.toLowerCase()
    if (tvlMap[ethAddr] === undefined) {
      return { ...tvlMap, [ethAddr]: Number.POSITIVE_INFINITY }
    }
    return tvlMap
  }, [vaults, selectedChainId])

  // Filter tokens based on search and limits, then split into known/unlisted
  const { knownTokens, unlistedTokens } = useMemo(() => {
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

    const isKnownAsset = (token: TToken): boolean => assetTvlByChain[token.address?.toLowerCase() ?? ''] !== undefined
    const known = filtered.filter(isKnownAsset)
    const unlisted = filtered.filter((token) => !isKnownAsset(token))

    // Sort known assets by TVL rank (highest TVL first), then by balance
    const sortedKnown = known.toSorted((a, b) => {
      const aTvl = assetTvlByChain[a.address?.toLowerCase() ?? ''] || 0
      const bTvl = assetTvlByChain[b.address?.toLowerCase() ?? ''] || 0
      if (bTvl !== aTvl) return bTvl - aTvl
      const aBalance = a.balance?.raw || 0n
      const bBalance = b.balance?.raw || 0n
      return bBalance > aBalance ? 1 : -1
    })

    // Sort unlisted by balance (highest first)
    const sortedUnlisted = unlisted.toSorted((a, b) => {
      const aBalance = a.balance?.raw || 0n
      const bBalance = b.balance?.raw || 0n
      return bBalance > aBalance ? 1 : -1
    })

    return { knownTokens: sortedKnown, unlistedTokens: sortedUnlisted }
  }, [tokens, limitTokens, excludeTokens, searchText, assetTvlByChain])

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
        ) : knownTokens.length === 0 && unlistedTokens.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">
            {searchText ? 'No tokens found' : 'No tokens available'}
          </div>
        ) : (
          <div className="space-y-1">
            {knownTokens.map((token) => (
              <TokenItem
                key={token.address}
                token={token}
                selected={token.address === value}
                onSelect={() => handleSelect(token.address as `0x${string}`)}
                tokenType={getTokenType(token.address)}
              />
            ))}
            {unlistedTokens.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowUnlisted((prev) => !prev)}
                  className="flex items-center gap-1.5 w-full px-3 py-2 mt-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  <IconChevron
                    className={cl('size-3 transition-transform', showUnlisted ? 'rotate-0' : '-rotate-90')}
                  />
                  <span>Unlisted Tokens ({unlistedTokens.length})</span>
                </button>
                {showUnlisted &&
                  unlistedTokens.map((token) => (
                    <TokenItem
                      key={token.address}
                      token={token}
                      selected={token.address === value}
                      onSelect={() => handleSelect(token.address as `0x${string}`)}
                      tokenType={getTokenType(token.address)}
                    />
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
