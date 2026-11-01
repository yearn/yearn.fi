'use client'

import { getChain, SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import {
  useIndexedVaults,
  useWalletVaults,
  useYearnVaultChoices,
  useYearnVaultMetadata
} from '@erc4626/lib/useVaultDiscovery'
import { useVaultPickerBalances, walletTokenKey } from '@erc4626/lib/useVaultPickerBalances'
import { sortVaultChoices, type TVaultChoice } from '@erc4626/lib/vaultDiscovery'
import { parseVaultSelection } from '@erc4626/lib/vaultSelection'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import { getErc4626ReadMessage, readErc4626Vault } from '@yearn/vault-widget/erc4626/reader'
import { CloseIcon } from '@yearn/vault-widget/icons'
import { ImageWithFallback } from '@yearn/vault-widget/internal/components/shared/ImageWithFallback'
import { TokenLogoV2 } from '@yearn/vault-widget/internal/components/shared/TokenLogoV2'
import { useVaultWidgetSpotPrices } from '@yearn/vault-widget/internal/hooks/useVaultWidgetSpotPrices'
import { IconChevron } from '@yearn/vault-widget/internal/icons/IconChevron'
import { cl } from '@yearn/vault-widget/internal/utils'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import { WidgetActionType } from '@yearn/vault-widget/types'
import { useEffect, useRef, useState } from 'react'
import { type Address, formatUnits } from 'viem'
import { useAccount, useConfig } from 'wagmi'

type TSelection = { address: Address; chainId: number; retired?: boolean }

export function VaultPicker({
  chainId,
  mode = WidgetActionType.Deposit,
  selected,
  onSelect,
  onClose
}: {
  chainId: number
  mode?: WidgetActionType
  selected?: TSelection
  onSelect: (vault: TSelection) => void
  onClose: () => void
}) {
  const { assets } = useVaultWidgetRuntime()
  const config = useConfig()
  const { address: owner } = useAccount()
  const queryClient = useQueryClient()
  const root = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'yearn' | 'all'>('yearn')
  const [product, setProduct] = useState<'single' | 'lp'>('single')
  const [network, setNetwork] = useState('all')
  const [search, setSearch] = useState('')
  const [addressNetwork, setAddressNetwork] = useState(String(chainId))
  const [showRetired, setShowRetired] = useState(false)
  const [showStrategies, setShowStrategies] = useState(false)
  const [showLegacy, setShowLegacy] = useState(false)
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [category, setCategory] = useState('all')
  const [limit, setLimit] = useState(60)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const yearn = useYearnVaultChoices(tab === 'yearn')
  const yearnMetadata = useYearnVaultMetadata(true)
  const indexed = useIndexedVaults(tab === 'all')
  const wallet = useWalletVaults(owner, !!owner)
  const query = tab === 'yearn' ? yearn : indexed
  const searchValue = search.trim().toLowerCase()
  const direct = parseVaultSelection(addressNetwork, search)
  const heldVaults = new Set(wallet.data?.vaults.map((vault) => `${vault.chainId}:${vault.address.toLowerCase()}`))
  const isHeld = (vault: TVaultChoice) => heldVaults.has(`${vault.chainId}:${vault.address.toLowerCase()}`)
  const filtered = sortVaultChoices(
    (query.data ?? []).filter(
      (vault) =>
        (network === 'all' || vault.chainId === Number(network)) &&
        (tab === 'all' || showRetired || !vault.retired) &&
        (tab === 'all' ||
          (product === 'single'
            ? vault.product === 'single' && (showStrategies || !vault.strategy)
            : vault.product === 'lp' || (showLegacy && vault.product === 'legacy'))) &&
        (tab === 'all' || category === 'all' || vault.category === category) &&
        (tab === 'all' || !ownedOnly || isHeld(vault)) &&
        `${vault.name} ${vault.symbol} ${vault.assetSymbol ?? ''} ${vault.address}`.toLowerCase().includes(searchValue)
    ),
    wallet.data?.vaults
  )
  const visibleVaults = filtered.slice(0, limit)
  const balances = useVaultPickerBalances(visibleVaults)
  const { getUsdPrice } = useVaultWidgetSpotPrices(
    mode === WidgetActionType.Withdraw
      ? visibleVaults.filter(
          (vault) => (balances.data?.balances[walletTokenKey(vault.chainId, vault.address)] ?? 0n) > 0n
        )
      : []
  )
  const walletVaults = visibleVaults.filter(isHeld)
  const otherVaults = visibleVaults.filter((vault) => !isHeld(vault))
  const sections = [
    { title: 'Your vaults', vaults: walletVaults, owned: true },
    { title: walletVaults.length > 0 ? 'Other vaults' : 'Vaults', vaults: otherVaults, owned: false }
  ].filter((section) => section.vaults.length > 0)
  const validation = useMutation({
    mutationFn: async (selection: TSelection) => {
      const client = getPublicClient(config, { chainId: selection.chainId })
      if (!client) throw new Error('This network is not configured.')
      const factory = yearnMetadata.data?.some(
        (vault) =>
          vault.factory &&
          vault.chainId === selection.chainId &&
          vault.address.toLowerCase() === selection.address.toLowerCase()
      )
      const contractKind = factory ? 'yearn-v2' : 'erc4626'
      const snapshot = await readErc4626Vault({ client, ...selection, account: owner, contractKind })
      queryClient.setQueryData(
        [
          'erc4626-vault',
          selection.chainId,
          selection.chainId,
          selection.address.toLowerCase(),
          owner?.toLowerCase(),
          contractKind
        ],
        snapshot
      )
      return selection
    }
  })
  const select = (vault: TSelection) => validation.mutate(vault, { onSuccess: onSelect })
  // The card dropdown owns keyboard focus while open; restore focus to its trigger on dismissal.
  useEffect(() => {
    root.current?.focus({ preventScroll: true })
    return () =>
      queueMicrotask(() => document.querySelector<HTMLButtonElement>('[data-vault-selector-trigger]')?.focus())
  }, [])
  // Dismiss the non-modal card dropdown when a pointer interaction happens outside its card.
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const card = root.current?.closest('[data-erc4626-card]')
      if (card && event.target instanceof Node && !card.contains(event.target)) onClose()
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [onClose])
  const filterCount =
    Number(showRetired) +
    (tab === 'yearn' ? Number(showStrategies) + Number(showLegacy) : 0) +
    Number(ownedOnly) +
    Number(category !== 'all')
  return (
    <div
      ref={root}
      role="dialog"
      tabIndex={-1}
      aria-label="Select vault"
      className="flex h-full min-h-0 flex-col text-text-primary"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
        if (event.key !== 'Tab') return
        const controls = Array.from(
          root.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select, summary, a[href]'
          ) ?? []
        ).filter((element) => element.getClientRects().length > 0)
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
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="text-lg font-medium">Select a vault</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close vault picker"
          className="shrink-0 rounded-lg p-1 hover:bg-surface-secondary"
        >
          <CloseIcon className="size-5 text-text-secondary" />
        </button>
      </div>
      <div className="shrink-0 space-y-3 px-4 pb-3">
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
            aria-label="Search vaults or paste a vault address"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setLimit(60)
              validation.reset()
            }}
            placeholder="Search vaults or paste address"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none focus:outline-none"
          />
          <details className="group/network shrink-0">
            <summary
              aria-label="Filter by network"
              className="flex cursor-pointer list-none items-center gap-1 rounded-lg p-1.5 hover:bg-surface [&::-webkit-details-marker]:hidden"
            >
              {network === 'all' ? (
                <span className="grid grid-cols-2 gap-0.5" aria-label="All networks">
                  {SUPPORTED_CHAINS.slice(0, 4).map((chain) => (
                    <ImageWithFallback
                      key={chain.id}
                      src={assets.getChainLogoUrl(chain.id)}
                      alt=""
                      width={9}
                      height={9}
                      className="rounded-full"
                    />
                  ))}
                </span>
              ) : (
                <ImageWithFallback
                  src={assets.getChainLogoUrl(Number(network))}
                  alt={getChain(Number(network))?.name ?? 'Selected network'}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              )}
              <IconChevron className="size-4 text-text-secondary group-open/network:rotate-180" />
            </summary>
            <div
              className="absolute right-0 top-full z-40 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-lg"
              aria-label="Networks"
            >
              {[
                { id: 'all', name: 'All networks' },
                ...SUPPORTED_CHAINS.map((chain) => ({ id: String(chain.id), name: chain.name }))
              ].map((chain) => (
                <button
                  key={chain.id}
                  type="button"
                  aria-pressed={network === chain.id}
                  onClick={(event) => {
                    setNetwork(chain.id)
                    if (chain.id !== 'all') setAddressNetwork(chain.id)
                    setLimit(60)
                    validation.reset()
                    event.currentTarget.closest('details')?.removeAttribute('open')
                  }}
                  className={cl(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
                    network === chain.id ? 'bg-surface-secondary' : 'hover:bg-surface-secondary'
                  )}
                >
                  {chain.id === 'all' ? (
                    <span className="flex size-5 items-center justify-center text-xs">All</span>
                  ) : (
                    <ImageWithFallback
                      src={assets.getChainLogoUrl(Number(chain.id))}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                  )}
                  <span className="flex-1">{chain.name}</span>
                  {network === chain.id && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </details>
        </div>
        <div
          className="relative flex gap-1 rounded-lg border border-border bg-surface-secondary p-1"
          aria-label="Vault source"
          data-selector-toggle
        >
          <span
            aria-hidden="true"
            className={cl(
              'pointer-events-none absolute bottom-1 left-1 top-1 w-[calc((100%-0.75rem)/2)] rounded-md border border-border bg-surface shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none',
              tab === 'all' ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-0'
            )}
          />
          {(['yearn', 'all'] as const).map((source) => (
            <button
              key={source}
              type="button"
              aria-pressed={tab === source}
              onClick={() => {
                setTab(source)
                setFiltersOpen(false)
                setLimit(60)
                validation.reset()
              }}
              className={cl(
                'relative flex-1 rounded-md border border-transparent px-3 py-2 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
                tab === source ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {source === 'yearn' ? 'Yearn Vaults' : 'All Vaults'}
            </button>
          ))}
        </div>
        {tab === 'yearn' && (
          <div className="flex flex-wrap items-stretch justify-between gap-2">
            <fieldset
              aria-label="Vault type"
              data-selector-toggle
              className="relative flex flex-1 gap-1 rounded-lg border border-border bg-surface-secondary p-1"
            >
              <span
                aria-hidden="true"
                className={cl(
                  'pointer-events-none absolute bottom-1 left-1 top-1 w-[calc((100%-0.75rem)/2)] rounded-md border border-border bg-surface shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none',
                  product === 'lp' ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-0'
                )}
              />
              {(['single', 'lp'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={product === type}
                  onClick={() => {
                    setProduct(type)
                    setLimit(60)
                  }}
                  className={cl(
                    'relative flex-1 whitespace-nowrap rounded-md border border-transparent px-2 py-2 text-[11px] font-medium transition-colors duration-200 motion-reduce:transition-none sm:text-xs',
                    product === type ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {type === 'single' ? 'Single Asset' : 'LP Token'}
                </button>
              ))}
            </fieldset>
            <div className="relative ml-auto flex">
              <button
                type="button"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                <svg
                  aria-hidden="true"
                  className="size-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 5H22" />
                  <path d="M6 12H18" />
                  <path d="M9 19H15" />
                </svg>
                More filters{filterCount > 0 ? ` (${filterCount})` : ''}
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 w-64 space-y-3 rounded-xl border border-border bg-surface p-4 text-xs shadow-lg">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showRetired}
                      onChange={(event) => {
                        setShowRetired(event.target.checked)
                        setLimit(60)
                      }}
                    />
                    Show retired vaults
                  </label>
                  {tab === 'yearn' && (
                    <>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showStrategies}
                          onChange={(event) => {
                            setShowStrategies(event.target.checked)
                            setLimit(60)
                          }}
                        />
                        Show single asset strategies
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showLegacy}
                          onChange={(event) => {
                            setShowLegacy(event.target.checked)
                            setLimit(60)
                          }}
                        />
                        Show legacy vaults
                      </label>
                    </>
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={!owner}
                      checked={ownedOnly}
                      onChange={(event) => {
                        setOwnedOnly(event.target.checked)
                        setLimit(60)
                      }}
                    />
                    In my wallet
                  </label>
                  {!owner && <p className="text-text-secondary">Connect a wallet to filter your holdings.</p>}
                  <label className="block space-y-1">
                    <span>Asset category</span>
                    <select
                      value={category}
                      onChange={(event) => {
                        setCategory(event.target.value)
                        setLimit(60)
                      }}
                      className="w-full rounded border border-border bg-surface p-2"
                    >
                      <option value="all">All categories</option>
                      <option value="Stablecoin">Stablecoin</option>
                      <option value="Volatile">Volatile</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3" data-vault-picker-list>
        {searchValue.startsWith('0x') && (
          <form
            className="mb-3 space-y-2 rounded-lg bg-surface-secondary p-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (direct.ok) select(direct)
            }}
          >
            <label className="block text-xs" htmlFor="address-network">
              Vault network
            </label>
            <select
              id="address-network"
              value={addressNetwork}
              onChange={(event) => {
                setAddressNetwork(event.target.value)
                validation.reset()
              }}
              className="w-full rounded border border-border bg-surface p-2 text-sm"
            >
              {SUPPORTED_CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
            {!direct.ok && <p className="text-xs text-text-secondary">{direct.error}</p>}
            <button
              type="submit"
              disabled={!direct.ok || validation.isPending}
              className="w-full rounded-lg bg-text-primary p-2 text-sm text-surface disabled:opacity-50"
            >
              Use address
            </button>
          </form>
        )}
        {validation.error && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {getErc4626ReadMessage(validation.error)}
          </p>
        )}
        {(query.isFetching || (owner && wallet.isFetching)) && (
          <p role="status" className="mb-3 text-sm text-text-secondary">
            {query.isFetching ? 'Loading vaults…' : 'Checking wallet holdings…'}
          </p>
        )}
        {query.isError && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {query.error.message}{' '}
            <button type="button" onClick={() => void query.refetch()} className="underline">
              Retry
            </button>
          </p>
        )}
        {balances.data && balances.data.unreadable > 0 && (
          <p role="status" className="mb-3 text-xs text-text-secondary">
            Some wallet balances are unavailable.
          </p>
        )}
        {owner && wallet.isError && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            Wallet holdings are unavailable. {ownedOnly ? '' : 'Sorting by TVL.'}{' '}
            <button type="button" onClick={() => void wallet.refetch()} className="underline">
              Retry
            </button>
          </p>
        )}
        {owner &&
          wallet.data &&
          (wallet.data.unreadable > 0 || wallet.data.omitted > 0 || wallet.visibilityUnavailable) && (
            <p role="status" className="mb-3 text-xs text-text-secondary">
              Wallet coverage is incomplete. Some holdings may be missing.{' '}
              <button type="button" className="underline" onClick={() => void wallet.refetch()}>
                Retry
              </button>
            </p>
          )}
        {query.isSuccess &&
          !query.isFetching &&
          !wallet.isFetching &&
          (!ownedOnly || wallet.isSuccess) &&
          filtered.length === 0 && (
            <p className="py-5 text-center text-sm text-text-secondary">
              No matching vaults. Try another filter or paste an address.
            </p>
          )}
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.title} aria-label={section.title}>
              <h3 className="mb-2 flex items-center gap-2 px-3 text-xs font-normal text-text-secondary">
                <svg
                  aria-hidden="true"
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {section.owned ? (
                    <>
                      <path d="M20 7V4H5a2 2 0 0 0 0 4h16v12H5a2 2 0 0 1-2-2V6" />
                      <path d="M21 12h-6v4h6" />
                    </>
                  ) : (
                    <>
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </>
                  )}
                </svg>
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.vaults.map((vault) => (
                  <VaultRow
                    key={`${vault.chainId}:${vault.address}`}
                    vault={vault}
                    selected={
                      selected?.chainId === vault.chainId &&
                      selected.address.toLowerCase() === vault.address.toLowerCase()
                    }
                    disabled={validation.isPending}
                    mode={mode}
                    balance={
                      balances.data?.balances[
                        walletTokenKey(
                          vault.chainId,
                          mode === WidgetActionType.Deposit ? (vault.assetAddress ?? '') : vault.address
                        )
                      ]
                    }
                    usdPrice={mode === WidgetActionType.Withdraw ? getUsdPrice(vault) : undefined}
                    onSelect={() => select(vault)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {filtered.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((value) => value + 60)}
            className="mt-3 w-full rounded-lg bg-surface-secondary py-2 text-xs"
          >
            Load more · {limit} of {filtered.length}
          </button>
        )}
      </div>
      <div aria-hidden="true" className="relative z-10 h-9 shrink-0 bg-surface" />
    </div>
  )
}

function VaultRow({
  vault,
  disabled,
  selected,
  mode,
  balance,
  usdPrice,
  onSelect
}: {
  vault: TVaultChoice
  disabled: boolean
  selected: boolean
  mode: WidgetActionType
  balance?: bigint
  usdPrice?: number
  onSelect: () => void
}) {
  const { assets } = useVaultWidgetRuntime()
  const deposit = mode === WidgetActionType.Deposit
  const decimals = deposit ? vault.assetDecimals : vault.decimals
  const amount =
    balance !== undefined && balance > 0n && decimals !== undefined ? Number(formatUnits(balance, decimals)) : undefined
  const value = amount !== undefined && usdPrice !== undefined && usdPrice > 0 ? amount * usdPrice : undefined
  return (
    <li>
      <button
        type="button"
        disabled={disabled || (vault.legacy && !vault.factory)}
        onClick={onSelect}
        aria-pressed={selected}
        title={`${getChain(vault.chainId)?.name} · ${vault.address}${vault.legacy && !vault.factory ? ' · Requires the Yearn app' : ''}`}
        className={cl(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50',
          selected ? 'bg-primary/10' : 'hover:bg-surface-secondary/30'
        )}
      >
        <span className="relative size-6 shrink-0" data-vault-row-logo>
          <TokenLogoV2
            src={assets.getTokenLogoUrl({
              address: vault.assetAddress ?? vault.address,
              chainId: vault.chainId,
              size: 32
            })}
            tokenSymbol={vault.symbol}
            tokenName={vault.name}
            width={24}
            height={24}
            className="rounded-full"
          />
          <span
            className="absolute -bottom-0.5 -left-0.5 flex size-3 items-center justify-center rounded-full border border-border bg-surface"
            data-vault-row-chain
          >
            <TokenLogoV2
              src={assets.getChainLogoUrl(vault.chainId)}
              tokenSymbol={getChain(vault.chainId)?.name}
              width={12}
              height={12}
            />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{vault.name}</span>
        </span>
        {amount !== undefined && Number.isFinite(amount) && (
          <span className="shrink-0 text-right" data-vault-wallet-balance>
            <span className="block text-sm tabular-nums">
              {amount < 0.000001
                ? '<0.000001'
                : new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(amount)}{' '}
              {deposit ? (vault.assetSymbol ?? 'tokens') : 'shares'}
            </span>
            {!deposit && (
              <span className="mt-0.5 block text-xs tabular-nums text-text-secondary">
                {value !== undefined && Number.isFinite(value)
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
                  : 'USD unavailable'}
              </span>
            )}
          </span>
        )}
        {vault.legacy && !vault.factory ? (
          <span className="text-[10px] text-text-secondary">Legacy</span>
        ) : vault.retired ? (
          <span className="text-[10px] text-text-secondary">Retired</span>
        ) : null}
      </button>
    </li>
  )
}
