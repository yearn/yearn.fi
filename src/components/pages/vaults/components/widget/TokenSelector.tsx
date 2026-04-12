import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultStaking
} from '@pages/vaults/domain/kongVaultSelectors'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenList } from '@shared/contexts/WithTokenList'
import type { TToken } from '@shared/types'
import { cl, formatTAmount, isZeroAddress, toAddress } from '@shared/utils'
import { type FC, useCallback, useMemo, useState } from 'react'
import { isAddress } from 'viem'
import { CloseIcon } from './shared/Icons'
import { getTokenLogoSources } from './tokenLogo.utils'
import { TOKEN_SELECTOR_AVAILABLE_CHAINS } from './tokenSelectorChains'
import {
  filterAndSortTokenSelectorTokens,
  getDepositMinValueExemptTokenAddresses,
  getDerivedTokenUsdValue,
  getExplicitTokenAddresses,
  getYearnKnownTokenAddresses,
  type TTokenSelectorMode
} from './tokenSelectorList.utils'

type TTokenType = 'asset' | 'vault' | 'staking' | undefined

const LEGACY_SELECTOR_TOKEN_ADDRESSES_BY_CHAIN: Record<number, `0x${string}`[]> = {
  1: ['0x85E30b8b263bC64d94b827ed450F2EdFEE8579dA'] // Legacy USDaf
}

interface TokenSelectorProps {
  value: `0x${string}` | undefined
  onChange: (address: `0x${string}`, chainId?: number) => void
  chainId: number
  allowedChainIds?: number[]
  limitTokens?: `0x${string}`[]
  excludeTokens?: `0x${string}`[]
  priorityTokens?: Record<number, `0x${string}`[]> // chainId -> addresses to always show
  topTokens?: Record<number, `0x${string}`[]>
  extraTokens?: TToken[]
  onClose?: () => void
  assetAddress?: `0x${string}`
  assetChainId?: number
  vaultAddress?: `0x${string}`
  stakingAddress?: `0x${string}`
  allowHiddenVaultTokenSelection?: boolean
  mode?: TTokenSelectorMode
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

const TokenItem: FC<{
  token: TToken
  selected: boolean
  onSelect: () => void
  tokenType?: TTokenType
  logoToken?: Pick<TToken, 'address' | 'chainID' | 'logoURI'>
}> = ({ token, selected, onSelect, tokenType, logoToken }) => {
  const logoSources = getTokenLogoSources({
    address: logoToken?.address ?? token.address,
    chainId: logoToken?.chainID ?? token.chainID,
    logoURI: logoToken?.logoURI ?? token.logoURI,
    size: 32
  })

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
          src={logoSources.src}
          altSrc={logoSources.altSrc}
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
  allowedChainIds,
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
  mode = 'default'
}) => {
  const [searchText, setSearchText] = useState('')
  const [selectedChainId, setSelectedChainId] = useState(chainId)
  const { getToken, isLoading, balances } = useWallet()
  const { tokenLists } = useTokenList()
  const { allVaults, getPrice } = useYearn()
  const availableChains = useMemo(
    () =>
      TOKEN_SELECTOR_AVAILABLE_CHAINS.filter((chain) =>
        allowedChainIds && allowedChainIds.length > 0 ? allowedChainIds.includes(chain.id) : true
      ),
    [allowedChainIds]
  )
  const activeChainId = useMemo(() => {
    if (availableChains.some((chain) => chain.id === selectedChainId)) {
      return selectedChainId
    }

    return availableChains[0]?.id ?? chainId
  }, [availableChains, chainId, selectedChainId])
  const shouldShowChainSelector = availableChains.length > 1
  const customAddress = useMemo(
    () => (searchText && isAddress(searchText) ? (searchText as `0x${string}`) : undefined),
    [searchText]
  )

  const priorityTokenAddresses = useMemo(
    () => (priorityTokens?.[activeChainId] || []).map((address) => toAddress(address) as `0x${string}`),
    [activeChainId, priorityTokens]
  )
  const topTokenAddresses = useMemo(
    () => (topTokens?.[activeChainId] || []).map((address) => toAddress(address) as `0x${string}`),
    [activeChainId, topTokens]
  )

  const chainExtraTokens = useMemo(
    () => (extraTokens || []).filter((token) => token.chainID === activeChainId),
    [activeChainId, extraTokens]
  )
  const hiddenVaultTokenAddresses = useMemo(() => {
    const hiddenAddresses = new Set<`0x${string}`>()

    Object.values(allVaults).forEach((vault) => {
      const isHidden = getVaultInfo(vault).isHidden
      if (!isHidden || getVaultChainID(vault) !== activeChainId) {
        return
      }

      hiddenAddresses.add(toAddress(getVaultAddress(vault)) as `0x${string}`)

      const staking = getVaultStaking(vault)
      const stakingAddress = toAddress(staking.address)
      if (!isZeroAddress(stakingAddress)) {
        hiddenAddresses.add(stakingAddress as `0x${string}`)
      }
    })

    return [...hiddenAddresses]
  }, [activeChainId, allVaults])
  const hiddenVaultExemptAddresses = useMemo(
    () =>
      mode === 'withdraw' && allowHiddenVaultTokenSelection && activeChainId === chainId && vaultAddress
        ? [toAddress(vaultAddress) as `0x${string}`]
        : [],
    [activeChainId, allowHiddenVaultTokenSelection, chainId, mode, vaultAddress]
  )
  const combinedExcludeTokens = useMemo(
    () => [
      ...new Set(
        [
          ...(excludeTokens || []),
          ...hiddenVaultTokenAddresses.filter(
            (address) => !hiddenVaultExemptAddresses.includes(toAddress(address) as `0x${string}`)
          ),
          ...(LEGACY_SELECTOR_TOKEN_ADDRESSES_BY_CHAIN[activeChainId] || [])
        ].map((address) => toAddress(address))
      )
    ],
    [activeChainId, excludeTokens, hiddenVaultExemptAddresses, hiddenVaultTokenAddresses]
  )
  const assetLogoToken = useMemo(() => {
    if (activeChainId !== assetChainId || !assetAddress) {
      return undefined
    }

    return getToken({ address: toAddress(assetAddress), chainID: assetChainId })
  }, [activeChainId, assetAddress, assetChainId, getToken])

  // Get all tokens with balances from wallet context
  const tokens = useMemo(() => {
    const chainBalances = balances[activeChainId] || {}
    const tokenMap = new Map<string, TToken>()

    const setIfMissing = (token?: TToken): void => {
      if (!token?.address) {
        return
      }

      const key = toAddress(token.address).toLowerCase()
      if (!tokenMap.has(key)) {
        tokenMap.set(key, token)
      }
    }

    const setOverride = (token?: TToken): void => {
      if (!token?.address) {
        return
      }

      const key = toAddress(token.address).toLowerCase()
      const existing = tokenMap.get(key)
      if (!existing) {
        tokenMap.set(key, token)
        return
      }

      const shouldPreserveExistingBalance = existing.balance.raw > 0n && token.balance.raw === 0n
      const shouldPreserveExistingValue =
        Number.isFinite(existing.value) && existing.value > 0 && (!Number.isFinite(token.value) || token.value <= 0)

      tokenMap.set(key, {
        ...existing,
        ...token,
        balance: shouldPreserveExistingBalance ? existing.balance : token.balance,
        value: shouldPreserveExistingValue ? existing.value : token.value
      })
    }

    // Add all tokens from wallet balances
    Object.entries(chainBalances).forEach(([address, token]) => {
      if (token.chainID === 137 && toAddress(address) === '0x0000000000000000000000000000000000001010') {
        return // Skip MATIC
      }

      if (token.balance.raw > 0n) {
        setIfMissing(token)
      }
    })

    // Also include the currently selected token even if it has no balance
    if (value && !tokenMap.has(value.toLowerCase())) {
      const selectedToken = getToken({ address: toAddress(value), chainID: activeChainId })
      if (selectedToken.symbol) {
        setIfMissing(selectedToken)
      }
    }

    // Include priority tokens even if they have no balance
    for (const priorityAddress of priorityTokenAddresses) {
      if (!tokenMap.has(priorityAddress.toLowerCase())) {
        const priorityToken = getToken({ address: toAddress(priorityAddress), chainID: activeChainId })
        if (priorityToken.symbol) {
          setIfMissing(priorityToken)
        }
      }
    }

    // Include custom address if valid
    if (customAddress && isAddress(customAddress) && !tokenMap.has(customAddress.toLowerCase())) {
      const customToken = getToken({ address: toAddress(customAddress), chainID: activeChainId })
      if (customToken.symbol) {
        setIfMissing(customToken)
      }
    }

    // Explicit extra tokens should override selector metadata for matching addresses
    // without wiping wallet-derived balance/value with zero-value placeholders.
    for (const extraToken of chainExtraTokens) {
      setOverride(extraToken)
    }

    return [...tokenMap.values()]
  }, [balances, activeChainId, value, customAddress, getToken, priorityTokenAddresses, chainExtraTokens])

  const yearnKnownTokenAddresses = useMemo(
    () =>
      getYearnKnownTokenAddresses({
        chainId: activeChainId,
        chainTokenList: tokenLists[activeChainId],
        allVaults
      }),
    [activeChainId, allVaults, tokenLists]
  )

  const explicitTokenAddresses = useMemo(
    () =>
      getExplicitTokenAddresses({
        value,
        priorityTokenAddresses: mode === 'deposit' ? [] : priorityTokenAddresses,
        chainExtraTokens,
        currentTokenAddresses:
          mode === 'deposit' || activeChainId !== chainId ? [] : [assetAddress, vaultAddress, stakingAddress],
        customAddress
      }),
    [
      activeChainId,
      assetAddress,
      chainExtraTokens,
      chainId,
      customAddress,
      mode,
      priorityTokenAddresses,
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
            selectedChainId: activeChainId,
            customAddress
          })
        : explicitTokenAddresses,
    [activeChainId, assetAddress, assetChainId, chainExtraTokens, customAddress, explicitTokenAddresses, mode, value]
  )

  const getTokenUsdValue = useCallback(
    (token: TToken) =>
      getDerivedTokenUsdValue({
        token,
        getPrice
      }),
    [getPrice]
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
      onChange(address, activeChainId)
      if (onClose) {
        onClose()
      }
    },
    [activeChainId, onChange, onClose]
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
        {shouldShowChainSelector ? (
          <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner">
            {availableChains.map((chain) => (
              <button
                key={chain.id}
                onClick={() => setSelectedChainId(chain.id)}
                className={cl(
                  'size-9 flex items-center justify-center rounded-md transition-all',
                  activeChainId === chain.id ? 'bg-surface shadow-sm' : 'bg-transparent hover:bg-surface/50'
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
        ) : (
          <div />
        )}
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
                logoToken={
                  getTokenType(token.address) === 'vault' || getTokenType(token.address) === 'staking'
                    ? assetLogoToken
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
