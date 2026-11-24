import { ImageWithFallback } from '@yearn/vault-widget/internal/components/shared/ImageWithFallback'
import { TokenLogoV2 } from '@yearn/vault-widget/internal/components/shared/TokenLogoV2'
import { CloseIcon } from '@yearn/vault-widget/internal/components/widget/shared/Icons'
import {
  getKnownVaultTokenLogoMetaByAddress,
  getTokenLogoSources,
  type TTokenLogoSourceToken
} from '@yearn/vault-widget/internal/components/widget/tokenLogo.utils'
import {
  filterAndSortTokenSelectorTokens,
  getDepositMinValueExemptTokenAddresses,
  getDerivedTokenUsdValue,
  getExplicitTokenAddresses,
  getYearnKnownTokenAddresses,
  type TTokenSelectorMode
} from '@yearn/vault-widget/internal/components/widget/tokenSelectorList.utils'
import { IconChevron } from '@yearn/vault-widget/internal/icons/IconChevron'
import { cl, formatTAmount } from '@yearn/vault-widget/internal/utils'
import { useVaultWidgetRuntime, type VaultWidgetToken } from '@yearn/vault-widget/runtime'
import type { Token } from '@yearn/vault-widget/types'
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Address, formatUnits, isAddress } from 'viem'

type TTokenType = 'asset' | 'vault' | 'staking' | undefined

const AVAILABLE_CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 10, name: 'Optimism' },
  { id: 137, name: 'Polygon' },
  { id: 42161, name: 'Arbitrum' },
  { id: 8453, name: 'Base' },
  { id: 747474, name: 'Katana' },
  { id: 4663, name: 'Robinhood' }
] as const

const LEGACY_SELECTOR_TOKEN_ADDRESSES_BY_CHAIN: Record<number, `0x${string}`[]> = {
  1: ['0x85E30b8b263bC64d94b827ed450F2EdFEE8579dA'] // Legacy USDaf
}

function toSelectorToken(token: VaultWidgetToken): Token {
  const display = formatUnits(token.balanceRaw, token.decimals)
  return {
    address: token.address,
    balance: {
      raw: token.balanceRaw,
      normalized: Number(display),
      display,
      decimals: token.decimals
    },
    chainId: token.chainId,
    decimals: token.decimals,
    logoURI: token.logoUri,
    name: token.name,
    symbol: token.symbol,
    value: token.usdValue
  }
}

interface TokenSelectorProps {
  value: `0x${string}` | undefined
  onChange: (address: `0x${string}`, chainId?: number) => void
  chainId: number
  limitTokens?: `0x${string}`[]
  excludeTokens?: `0x${string}`[]
  priorityTokens?: Record<number, `0x${string}`[]> // chainId -> addresses to always show
  topTokens?: Record<number, `0x${string}`[]>
  extraTokens?: Token[]
  onClose?: () => void
  assetAddress?: `0x${string}`
  assetChainId?: number
  vaultAddress?: `0x${string}`
  stakingAddress?: `0x${string}`
  allowHiddenVaultTokenSelection?: boolean
  mode?: TTokenSelectorMode
  cardLayout?: boolean
}

const TokenTypeChip: FC<{ type: TTokenType }> = ({ type }) => {
  if (!type) return null

  const config = {
    asset: { label: 'Asset', className: 'bg-blue-500/10 text-blue-600' },
    vault: { label: 'Vault', className: 'bg-green-500/10 text-green-600' },
    staking: { label: 'Gauge', className: 'bg-purple-500/10 text-purple-600' }
  }

  const { label, className } = config[type]
  return <span className={cl('px-1.5 py-0.5 text-[10px] font-medium rounded', className)}>{label}</span>
}

const TokenItem: FC<{
  token: Token
  selected: boolean
  onSelect: () => void
  tokenType?: TTokenType
  logoToken?: TTokenLogoSourceToken
  cardLayout?: boolean
}> = ({ token, selected, onSelect, tokenType, logoToken, cardLayout }) => {
  const { assets } = useVaultWidgetRuntime()
  const logoSources = getTokenLogoSources({
    address: logoToken?.address ?? token.address,
    assets,
    chainId: logoToken?.chainId ?? token.chainId,
    logoURI: logoToken ? logoToken.logoURI : token.logoURI,
    size: 32
  })
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cl(
        'flex items-center justify-between gap-3 w-full px-3 py-2 rounded-lg',
        cardLayout ? 'transition-colors duration-150 motion-reduce:transition-none' : undefined,
        selected
          ? cardLayout
            ? 'bg-primary/10'
            : 'bg-primary/10 hover:bg-primary/15'
          : cardLayout
            ? 'hover:bg-surface-secondary/30'
            : 'hover:bg-surface-secondary'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <TokenLogoV2
          src={logoSources.src}
          altSrc={logoSources.altSrc}
          tokenSymbol={token.symbol}
          tokenName={token.name}
          chainId={cardLayout ? token.chainId : undefined}
          width={24}
          height={24}
          className="rounded-full"
        />
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text-primary">{token.symbol}</span>
            <TokenTypeChip type={tokenType} />
          </div>
          <div className="truncate text-xs text-text-secondary">{token.name}</div>
        </div>
      </div>
      {token.balance && token.balance.raw > 0n && (
        <div className="shrink-0 text-right" data-token-wallet-balance>
          <div className={cardLayout ? 'text-sm tabular-nums' : 'text-xs text-text-secondary'}>
            {formatTAmount({ value: token.balance.raw, decimals: token.decimals })}
          </div>
          {cardLayout && (
            <div className="mt-0.5 text-xs tabular-nums text-text-secondary">
              {typeof token.value === 'number' && Number.isFinite(token.value) && token.value > 0
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(token.value)
                : 'USD unavailable'}
            </div>
          )}
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
  topTokens,
  extraTokens,
  onClose,
  assetAddress,
  assetChainId = chainId,
  vaultAddress,
  stakingAddress,
  allowHiddenVaultTokenSelection,
  mode = 'default',
  cardLayout = false
}) => {
  const [searchText, setSearchText] = useState('')
  const [selectedChainId, setSelectedChainId] = useState(chainId)
  const { assets, catalog, prices, wallet, routing } = useVaultWidgetRuntime()
  const root = useRef<HTMLDivElement>(null)
  // Card pickers take keyboard focus without opening the search keyboard on mobile.
  useEffect(() => {
    if (cardLayout) root.current?.focus({ preventScroll: true })
  }, [cardLayout])
  const allowedChainIds =
    mode === 'withdraw'
      ? (routing.withdrawalTokenSelectionChainIds ?? routing.tokenSelectionChainIds)
      : routing.tokenSelectionChainIds
  const chains = AVAILABLE_CHAINS.filter((chain) => !allowedChainIds || allowedChainIds.includes(chain.id))
  const { isLoading, tokensByChain: balances } = wallet
  const { knownVaults: allVaults, tokenListsByChain: tokenLists } = catalog
  const getToken = useCallback(
    ({ address, chainId: tokenChainId }: { address: Address; chainId: number }): Token | undefined => {
      const token = wallet.getToken({ address, chainId: tokenChainId })
      return token ? toSelectorToken(token) : undefined
    },
    [wallet]
  )
  const customAddress = useMemo(
    () => (searchText && isAddress(searchText) ? (searchText as `0x${string}`) : undefined),
    [searchText]
  )

  const priorityTokenAddresses = useMemo(
    () => priorityTokens?.[selectedChainId] || [],
    [priorityTokens, selectedChainId]
  )
  const topTokenAddresses = useMemo(() => topTokens?.[selectedChainId] || [], [selectedChainId, topTokens])

  const chainExtraTokens = useMemo(
    () => (extraTokens || []).filter((token) => token.chainId === selectedChainId),
    [extraTokens, selectedChainId]
  )
  const hiddenVaultTokenAddresses = useMemo(() => {
    const hiddenAddresses = new Set<`0x${string}`>()

    allVaults.forEach((vault) => {
      if (!vault.hidden || vault.chainId !== selectedChainId) {
        return
      }

      hiddenAddresses.add(vault.address)

      if (vault.stakingAddress) {
        hiddenAddresses.add(vault.stakingAddress)
      }
    })

    return [...hiddenAddresses]
  }, [allVaults, selectedChainId])
  const hiddenVaultExemptAddresses = useMemo(
    () =>
      mode === 'withdraw' && allowHiddenVaultTokenSelection && selectedChainId === chainId && vaultAddress
        ? [vaultAddress]
        : [],
    [allowHiddenVaultTokenSelection, chainId, mode, selectedChainId, vaultAddress]
  )
  const combinedExcludeTokens = useMemo(
    () => [
      ...new Set(
        [
          ...(excludeTokens || []),
          ...hiddenVaultTokenAddresses.filter((address) => !hiddenVaultExemptAddresses.includes(address)),
          ...(LEGACY_SELECTOR_TOKEN_ADDRESSES_BY_CHAIN[selectedChainId] || [])
        ].map((address) => address.toLowerCase() as Address)
      )
    ],
    [excludeTokens, hiddenVaultExemptAddresses, hiddenVaultTokenAddresses, selectedChainId]
  )
  const assetLogoToken = useMemo<TTokenLogoSourceToken | undefined>(() => {
    if (selectedChainId !== assetChainId || !assetAddress) {
      return undefined
    }

    const resolvedAssetToken = getToken({ address: assetAddress, chainId: assetChainId })
    const resolvedAssetLogoURI =
      resolvedAssetToken?.address.toLowerCase() === assetAddress.toLowerCase() ? resolvedAssetToken.logoURI : undefined

    return {
      address: assetAddress,
      chainId: assetChainId,
      logoURI: resolvedAssetLogoURI
    }
  }, [assetAddress, assetChainId, getToken, selectedChainId])
  const knownVaultTokenMetaByAddress = useMemo(
    () => getKnownVaultTokenLogoMetaByAddress({ allVaults, chainId: selectedChainId }),
    [allVaults, selectedChainId]
  )

  // Get all tokens with balances from wallet context
  const tokens = useMemo(() => {
    const chainBalances = balances[selectedChainId] || {}
    const tokenMap = new Map<string, Token>()

    const setIfMissing = (token?: Token): void => {
      if (!token) {
        return
      }

      const key = token.address.toLowerCase()
      if (!tokenMap.has(key)) {
        tokenMap.set(key, token)
      }
    }

    const setOverride = (token?: Token): void => {
      if (!token) {
        return
      }

      const key = token.address.toLowerCase()
      const existing = tokenMap.get(key)
      if (!existing) {
        tokenMap.set(key, token)
        return
      }

      const shouldPreserveExistingBalance = existing.balance.raw > 0n && token.balance.raw === 0n
      const shouldPreserveExistingValue =
        typeof existing.value === 'number' &&
        Number.isFinite(existing.value) &&
        existing.value > 0 &&
        (typeof token.value !== 'number' || !Number.isFinite(token.value) || token.value <= 0)

      tokenMap.set(key, {
        ...existing,
        ...token,
        balance: shouldPreserveExistingBalance ? existing.balance : token.balance,
        value: shouldPreserveExistingValue ? existing.value : token.value
      })
    }

    // Add all tokens from wallet balances
    Object.entries(chainBalances).forEach(([address, token]) => {
      if (token.chainId === 137 && address.toLowerCase() === '0x0000000000000000000000000000000000001010') {
        return // Skip MATIC
      }

      if (token.balanceRaw > 0n) {
        setIfMissing(toSelectorToken(token))
      }
    })

    // Also include the currently selected token even if it has no balance
    if (value && !tokenMap.has(value.toLowerCase())) {
      const selectedToken = getToken({ address: value, chainId: selectedChainId })
      if (selectedToken?.symbol) {
        setIfMissing(selectedToken)
      }
    }

    // Include priority tokens even if they have no balance
    priorityTokenAddresses.forEach((priorityAddress) => {
      if (!tokenMap.has(priorityAddress.toLowerCase())) {
        const priorityToken = getToken({ address: priorityAddress, chainId: selectedChainId })
        if (priorityToken?.symbol) {
          setIfMissing(priorityToken)
        }
      }
    })

    // Include custom address if valid
    if (customAddress && isAddress(customAddress) && !tokenMap.has(customAddress.toLowerCase())) {
      const customToken = getToken({ address: customAddress, chainId: selectedChainId })
      if (customToken?.symbol) {
        setIfMissing(customToken)
      }
    }

    // Explicit extra tokens should override selector metadata for matching addresses
    // without wiping wallet-derived balance/value with zero-value placeholders.
    chainExtraTokens.forEach(setOverride)

    return [...tokenMap.values()]
  }, [balances, selectedChainId, value, customAddress, getToken, priorityTokenAddresses, chainExtraTokens])

  const yearnKnownTokenAddresses = useMemo(
    () =>
      getYearnKnownTokenAddresses({
        chainId: selectedChainId,
        chainTokenList: tokenLists[selectedChainId],
        allVaults
      }),
    [allVaults, selectedChainId, tokenLists]
  )

  const explicitTokenAddresses = useMemo(
    () =>
      getExplicitTokenAddresses({
        value,
        priorityTokenAddresses: mode === 'deposit' ? [] : priorityTokenAddresses,
        chainExtraTokens,
        currentTokenAddresses:
          mode === 'deposit' || selectedChainId !== chainId ? [] : [assetAddress, vaultAddress, stakingAddress],
        customAddress
      }),
    [
      assetAddress,
      chainExtraTokens,
      chainId,
      customAddress,
      mode,
      priorityTokenAddresses,
      selectedChainId,
      stakingAddress,
      value,
      vaultAddress
    ]
  )
  const minValueExemptTokenAddresses = useMemo(
    () =>
      mode === 'deposit'
        ? getDepositMinValueExemptTokenAddresses({
            value,
            chainExtraTokens,
            assetAddress,
            assetChainId,
            selectedChainId,
            customAddress
          })
        : explicitTokenAddresses,
    [assetAddress, assetChainId, chainExtraTokens, customAddress, explicitTokenAddresses, mode, selectedChainId, value]
  )

  const getTokenUsdValue = useCallback(
    (token: Token) =>
      getDerivedTokenUsdValue({
        token,
        getPrice: prices.getUsdPrice
      }),
    [prices]
  )

  // Filter tokens based on search and limits
  const filteredTokens = useMemo(() => {
    return filterAndSortTokenSelectorTokens({
      tokens,
      mode,
      limitTokens,
      excludeTokens: combinedExcludeTokens,
      searchText,
      yearnKnownTokenAddresses,
      explicitTokenAddresses,
      minValueExemptTokenAddresses,
      topTokenAddresses,
      getTokenUsdValue
    })
  }, [
    tokens,
    mode,
    limitTokens,
    combinedExcludeTokens,
    searchText,
    yearnKnownTokenAddresses,
    explicitTokenAddresses,
    minValueExemptTokenAddresses,
    topTokenAddresses,
    getTokenUsdValue
  ])

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
      return knownVaultTokenMetaByAddress[addr]?.tokenType
    },
    [assetAddress, knownVaultTokenMetaByAddress, vaultAddress, stakingAddress]
  )
  const renderToken = (token: Token) => {
    const knownVaultTokenMeta = knownVaultTokenMetaByAddress[token.address.toLowerCase()]
    const tokenType = getTokenType(token.address)
    const shouldUseAssetLogoFallback = tokenType === 'vault' || tokenType === 'staking'
    return (
      <TokenItem
        key={token.address}
        token={token}
        selected={token.address.toLowerCase() === value?.toLowerCase()}
        onSelect={() => handleSelect(token.address)}
        tokenType={tokenType}
        cardLayout={cardLayout}
        logoToken={knownVaultTokenMeta?.logoToken ?? (shouldUseAssetLogoFallback ? assetLogoToken : undefined)}
      />
    )
  }
  const groups = [
    { title: 'Your tokens', tokens: filteredTokens.filter((token) => token.balance.raw > 0n) },
    {
      title: mode === 'withdraw' && !searchText.trim() ? 'Popular tokens' : 'Other tokens',
      tokens: filteredTokens.filter((token) => token.balance.raw === 0n)
    }
  ].filter((group) => group.tokens.length > 0)
  return (
    <div
      ref={root}
      role={cardLayout ? 'dialog' : undefined}
      aria-label={cardLayout ? 'Select token' : undefined}
      tabIndex={cardLayout ? -1 : undefined}
      className={cl(
        'absolute inset-0 bg-surface z-50 flex min-h-0 flex-col overscroll-contain',
        cardLayout ? 'text-text-primary' : 'rounded-lg shadow-xl'
      )}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(event) => {
        if (!cardLayout) return
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose?.()
          return
        }
        if (event.key !== 'Tab') return
        const controls = Array.from(
          root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary') ?? []
        ).filter((el) => el.getClientRects().length > 0)
        const next =
          event.shiftKey && document.activeElement === controls[0]
            ? controls.at(-1)
            : !event.shiftKey && document.activeElement === controls.at(-1)
              ? controls[0]
              : undefined
        if (next) {
          event.preventDefault()
          next.focus()
        }
      }}
    >
      {cardLayout ? (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-3">
            <h2 className="text-lg font-medium">Select a token</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close token picker"
              className="shrink-0 rounded-lg p-1 hover:bg-surface-secondary"
            >
              <CloseIcon className="size-5 text-text-secondary" />
            </button>
          </div>
          <div className="shrink-0 px-4 pb-3">
            <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
              <svg
                aria-hidden="true"
                className="size-4 shrink-0 text-text-secondary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                type="search"
                aria-label="Search tokens or paste a token address"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search tokens or paste address"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none focus:outline-none"
              />
              <details className="group/network shrink-0">
                <summary
                  aria-label="Filter by network"
                  className="flex cursor-pointer list-none items-center gap-1 rounded-lg p-1.5 hover:bg-surface [&::-webkit-details-marker]:hidden"
                >
                  <ImageWithFallback
                    src={assets.getChainLogoUrl(selectedChainId)}
                    alt={chains.find((chain) => chain.id === selectedChainId)?.name ?? 'Selected network'}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                  <IconChevron className="size-4 text-text-secondary group-open/network:rotate-180" />
                </summary>
                <div
                  aria-label="Networks"
                  className="absolute right-0 top-full z-40 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-lg"
                >
                  {chains.map((chain) => (
                    <button
                      key={chain.id}
                      type="button"
                      aria-pressed={selectedChainId === chain.id}
                      onClick={(event) => {
                        setSelectedChainId(chain.id)
                        event.currentTarget.closest('details')?.removeAttribute('open')
                      }}
                      className={cl(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
                        selectedChainId === chain.id ? 'bg-surface-secondary' : 'hover:bg-surface-secondary'
                      )}
                    >
                      <ImageWithFallback
                        src={assets.getChainLogoUrl(chain.id)}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                      <span className="flex-1">{chain.name}</span>
                      {selectedChainId === chain.id && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Header with chain selector and close button */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner">
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChainId(chain.id)}
                  className={cl(
                    'size-9 flex items-center justify-center rounded-md',
                    selectedChainId === chain.id ? 'bg-surface shadow-sm' : 'bg-transparent hover:bg-surface/50'
                  )}
                  type="button"
                >
                  <ImageWithFallback
                    src={assets.getChainLogoUrl(chain.id)}
                    alt={chain.name}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-secondary rounded-lg" type="button">
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
        </>
      )}

      {/* Token list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 overscroll-contain" data-token-picker-list>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">
            {searchText ? 'No tokens found' : 'No tokens available'}
          </div>
        ) : cardLayout ? (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.title} aria-label={group.title}>
                <h3 className="mb-2 flex items-center gap-2 px-3 text-xs font-normal text-text-secondary">
                  {group.title}
                </h3>
                <div className="space-y-1">{group.tokens.map(renderToken)}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-1">{filteredTokens.map(renderToken)}</div>
        )}
      </div>
      {cardLayout && <div aria-hidden="true" className="relative z-10 h-9 shrink-0 bg-surface" />}
    </div>
  )
}
