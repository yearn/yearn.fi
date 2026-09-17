'use client'

import { getChain, SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { useWalletVaults, useYearnAllocators } from '@erc4626/lib/useVaultDiscovery'
import type { TVaultChoice } from '@erc4626/lib/vaultDiscovery'
import { parseVaultSelection } from '@erc4626/lib/vaultSelection'
import { wagmiConfig } from '@erc4626/lib/wagmiConfig'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import { getErc4626ReadMessage, readErc4626Vault } from '@yearn/vault-widget/erc4626/reader'
import { CloseIcon } from '@yearn/vault-widget/icons'
import { ImageWithFallback } from '@yearn/vault-widget/internal/components/shared/ImageWithFallback'
import { TokenLogoV2 } from '@yearn/vault-widget/internal/components/shared/TokenLogoV2'
import { cl, formatTAmount } from '@yearn/vault-widget/internal/utils'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import { useEffect, useRef, useState } from 'react'
import { type Address, formatUnits } from 'viem'
import { useAccount } from 'wagmi'

type TSelection = { address: Address; chainId: number; retired?: boolean }
export function VaultPicker({
  chainId,
  selected,
  onSelect,
  onClose
}: {
  chainId: number
  selected?: TSelection
  onSelect: (vault: TSelection) => void
  onClose: () => void
}) {
  const { assets } = useVaultWidgetRuntime()
  const dialog = useRef<HTMLDialogElement>(null)
  const { address: owner } = useAccount()
  const { openConnectModal } = useConnectModal()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'wallet' | 'yearn'>('wallet')
  const [search, setSearch] = useState('')
  const [network, setNetwork] = useState('all')
  const [addressNetwork, setAddressNetwork] = useState(String(chainId))
  const [showRetired, setShowRetired] = useState(false)
  const wallet = useWalletVaults(owner, tab === 'wallet')
  const yearn = useYearnAllocators(tab === 'yearn')
  const query = tab === 'wallet' ? wallet : yearn
  const choices = tab === 'wallet' ? wallet.data?.vaults : yearn.data
  const searchValue = search.trim().toLowerCase()
  const isAddressSearch = searchValue.startsWith('0x')
  const filtered = (choices ?? []).filter(
    (vault) =>
      (network === 'all' || vault.chainId === Number(network)) &&
      (tab === 'wallet' || showRetired || !vault.retired) &&
      `${vault.name} ${vault.symbol} ${vault.assetSymbol ?? ''} ${vault.address}`.toLowerCase().includes(searchValue)
  )
  const validation = useMutation({
    mutationFn: async (selection: TSelection) => {
      const client = getPublicClient(wagmiConfig, { chainId: selection.chainId })
      if (!client) throw new Error('This network is not configured.')
      const snapshot = await readErc4626Vault({ client, ...selection, account: owner })
      queryClient.setQueryData(
        ['erc4626-vault', selection.chainId, selection.chainId, selection.address.toLowerCase(), owner?.toLowerCase()],
        snapshot
      )
      return selection
    }
  })
  const select = (vault: TSelection) => validation.mutate(vault, { onSuccess: onSelect })
  const direct = parseVaultSelection(addressNetwork, search)
  // Native dialog focus trapping and top-layer placement require the browser lifecycle API.
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const listAvailable = tab === 'yearn' || !!owner
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-label="Select vault"
      className="m-auto h-[min(600px,85dvh)] max-h-[85dvh] w-[calc(100%-2rem)] max-w-[404px] overflow-hidden rounded-lg border border-border bg-surface p-0 text-text-primary shadow-xl backdrop:bg-black/50"
    >
      <div className="flex h-full min-h-0 flex-col overscroll-contain">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-4">
          <div
            className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner"
            aria-label="Filter by network"
          >
            {[
              { id: 'all', name: 'All networks' },
              ...SUPPORTED_CHAINS.map((chain) => ({ id: String(chain.id), name: chain.name }))
            ].map((chain) => (
              <button
                key={chain.id}
                type="button"
                aria-label={chain.name}
                title={chain.name}
                aria-pressed={network === chain.id}
                onClick={() => {
                  setNetwork(chain.id)
                  if (chain.id !== 'all') setAddressNetwork(chain.id)
                  validation.reset()
                }}
                className={cl(
                  'flex size-8 shrink-0 items-center justify-center rounded-md sm:size-9',
                  network === chain.id ? 'bg-surface shadow-sm' : 'bg-transparent hover:bg-surface/50'
                )}
              >
                {chain.id === 'all' ? (
                  <span className="text-xs font-medium">All</span>
                ) : (
                  <ImageWithFallback
                    src={assets.getChainLogoUrl(Number(chain.id))}
                    alt={chain.name}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close vault picker"
            className="shrink-0 rounded-lg p-1 hover:bg-surface-secondary"
          >
            <CloseIcon className="size-5 text-text-secondary" />
          </button>
        </div>
        <div className="shrink-0 space-y-3 p-4">
          <input
            id="vault-search"
            aria-label="Search vaults or paste a vault address"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              validation.reset()
            }}
            placeholder="Search by name or paste address"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
          <div className="flex gap-1 rounded-lg bg-surface-secondary p-1" aria-label="Vault source">
            {(['wallet', 'yearn'] as const).map((source) => (
              <button
                type="button"
                key={source}
                aria-pressed={tab === source}
                onClick={() => setTab(source)}
                className={cl(
                  'flex-1 rounded-md px-3 py-2 text-xs font-medium',
                  tab === source
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {source === 'wallet' ? 'In your wallet' : 'Yearn vaults'}
              </button>
            ))}
          </div>
          {tab === 'yearn' && (
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input type="checkbox" checked={showRetired} onChange={(event) => setShowRetired(event.target.checked)} />
              Show retired vaults
            </label>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4" data-vault-picker-list>
          {isAddressSearch && (
            <form
              className="mb-3 space-y-3 rounded-lg bg-surface-secondary p-3"
              onSubmit={(event) => {
                event.preventDefault()
                if (direct.ok) select(direct)
              }}
            >
              <label htmlFor="address-network" className="block text-sm">
                Vault network
              </label>
              <select
                id="address-network"
                value={addressNetwork}
                onChange={(event) => {
                  setAddressNetwork(event.target.value)
                  validation.reset()
                }}
                className="w-full rounded border border-border bg-surface p-2"
              >
                {SUPPORTED_CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
              {!direct.ok && <p className="text-sm text-text-secondary">{direct.error}</p>}
              <button
                type="submit"
                disabled={!direct.ok || validation.isPending}
                className="w-full rounded-lg bg-text-primary p-3 text-surface disabled:opacity-50"
              >
                Use address
              </button>
            </form>
          )}
          {validation.isPending && (
            <p role="status" className="mb-3 text-sm">
              Checking vault on-chain…
            </p>
          )}
          {validation.error && (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {getErc4626ReadMessage(validation.error)}
            </p>
          )}
          {tab === 'wallet' && !owner && (
            <div className="py-5 text-center">
              <p className="mb-4 text-sm text-text-secondary">Connect your wallet to find vaults you hold.</p>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  openConnectModal?.()
                }}
                className="rounded-lg bg-text-primary px-4 py-3 text-surface"
              >
                Connect wallet
              </button>
            </div>
          )}
          {listAvailable && (
            <>
              {query.isFetching && (
                <p role="status" className="mb-3 text-sm text-text-secondary">
                  {tab === 'wallet' ? 'Checking wallet vaults…' : 'Loading Yearn vaults…'}
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
              {tab === 'wallet' && wallet.data && (wallet.data.unreadable > 0 || wallet.data.omitted > 0) && (
                <p role="status" className="mb-3 text-sm text-text-secondary">
                  Discovery is incomplete: {wallet.data.unreadable} token checks failed; {wallet.data.omitted} tokens
                  exceeded the scan limit.{' '}
                  <button type="button" onClick={() => void wallet.refetch()} className="underline">
                    Retry
                  </button>
                </p>
              )}
              {query.isSuccess && !query.isFetching && filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-text-secondary">
                  No matching vaults found. You can paste a vault address above.
                </p>
              )}
              <ul className="space-y-1">
                {filtered.map((vault) => (
                  <VaultRow
                    key={`${vault.chainId}:${vault.address}`}
                    vault={vault}
                    selected={
                      selected?.chainId === vault.chainId &&
                      selected.address.toLowerCase() === vault.address.toLowerCase()
                    }
                    showNetwork={network === 'all'}
                    disabled={validation.isPending}
                    onSelect={() => select(vault)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
        <p className="shrink-0 border-t border-border px-4 py-3 text-[11px] leading-relaxed text-text-secondary">
          {tab === 'wallet'
            ? 'Wallet discovery may miss vaults. Paste an address to open one.'
            : 'Yearn V3 allocator vaults on supported networks. Enable retired vaults to find older positions.'}
        </p>
      </div>
    </dialog>
  )
}

function VaultRow({
  vault,
  disabled,
  selected,
  showNetwork,
  onSelect
}: {
  vault: TVaultChoice
  disabled: boolean
  selected: boolean
  showNetwork: boolean
  onSelect: () => void
}) {
  const { assets } = useVaultWidgetRuntime()
  const logo = assets.getTokenLogoUrl({
    address: vault.assetAddress ?? vault.address,
    chainId: vault.chainId,
    size: 32
  })
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-pressed={selected}
        title={`${getChain(vault.chainId)?.name} · ${vault.address}`}
        className={cl(
          'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 disabled:opacity-50',
          selected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-surface-secondary'
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">
            <TokenLogoV2
              src={logo}
              tokenSymbol={vault.symbol}
              tokenName={vault.name}
              width={24}
              height={24}
              className="rounded-full"
            />
          </span>
          <span className="min-w-0 text-left">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="break-all text-sm font-medium text-text-primary">{vault.symbol}</span>
              <span
                className={cl(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                  vault.retired ? 'bg-surface-secondary text-text-secondary' : 'bg-green-500/10 text-green-600'
                )}
              >
                {vault.retired ? 'Retired' : 'Vault'}
              </span>
            </span>
            <span className="block truncate text-xs text-text-secondary">{vault.name}</span>
            {showNetwork && (
              <span className="block text-[10px] text-text-secondary">{getChain(vault.chainId)?.name}</span>
            )}
          </span>
        </span>
        {vault.shares !== undefined && vault.decimals !== undefined && (
          <span
            className="shrink-0 text-right text-xs text-text-secondary"
            title={`${formatUnits(vault.shares, vault.decimals)} ${vault.symbol} shares`}
          >
            {formatTAmount({ value: vault.shares, decimals: vault.decimals })}
          </span>
        )}
      </button>
    </li>
  )
}
