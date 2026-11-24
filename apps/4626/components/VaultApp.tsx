'use client'

import { Header } from '@erc4626/components/Header'
import { VaultChartSidecar } from '@erc4626/components/VaultChartSidecar'
import { VaultPicker } from '@erc4626/components/VaultPicker'
import { VaultZapRuntime } from '@erc4626/components/VaultZapRuntime'
import { resolveChainId } from '@erc4626/lib/chains'
import { useYearnVaultMetadata } from '@erc4626/lib/useVaultDiscovery'
import { parseVaultSelection } from '@erc4626/lib/vaultSelection'
import { Erc4626VaultWidget } from '@yearn/vault-widget'
import { useState } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'

export function VaultApp({
  initialChain,
  initialAddress,
  demo = false,
  headerInsideCard = false
}: {
  initialChain?: string
  initialAddress?: string
  demo?: boolean
  headerInsideCard?: boolean
}) {
  const initial = parseVaultSelection(initialChain, initialAddress)
  const { address: owner, chainId: walletChain } = useAccount()
  const [selection, setSelection] = useState<{ address: Address; chainId: number; retired?: boolean } | undefined>(
    initial.ok ? initial : undefined
  )
  const catalog = useYearnVaultMetadata(!!selection)
  const selectedMetadata = catalog.data?.find(
    (vault) => vault.chainId === selection?.chainId && vault.address.toLowerCase() === selection?.address.toLowerCase()
  )
  const isRetired =
    selection?.retired === true ||
    catalog.data?.some(
      (vault) =>
        vault.chainId === selection?.chainId &&
        vault.address.toLowerCase() === selection?.address.toLowerCase() &&
        vault.retired
    ) === true
  const [selectionRevision, setSelectionRevision] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const select = (next: { address: Address; chainId: number; retired?: boolean }) => {
    setSelection(next)
    setSelectionRevision((revision) => revision + 1)
    setPickerOpen(false)
    const url = new URL(window.location.href)
    url.search = new URLSearchParams({ chain: String(next.chainId), vault: next.address }).toString()
    window.history.replaceState(null, '', url)
  }
  return (
    <>
      <Header />
      <main aria-label="ERC-4626 vault" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-10 pt-8">
        {!demo && (
          <a href="/demo" className="mx-auto mb-4 block max-w-xl text-sm text-text-secondary underline">
            Try the wallet-free playground
          </a>
        )}
        <VaultZapRuntime chainId={selection?.chainId ?? resolveChainId(walletChain) ?? 1}>
          <Erc4626VaultWidget
            renderChart={({ isOpen, onClose, vault }) => (
              <VaultChartSidecar
                key={`${selection?.chainId}:${selection?.address}`}
                enabled={isOpen}
                onClose={onClose}
                vault={vault}
              />
            )}
            headerInsideCard={headerInsideCard}
            enableZaps
            address={selection?.address}
            chainId={selection?.chainId ?? resolveChainId(walletChain) ?? 1}
            selectionRevision={selectionRevision}
            isRetired={isRetired}
            contractKind={selectedMetadata?.factory ? 'yearn-v2' : undefined}
            isCheckingRetirement={!!selection && !isRetired && catalog.isPending && catalog.isFetching}
            onSelectVault={() => setPickerOpen(true)}
            vaultSelector={
              pickerOpen
                ? (mode) => (
                    <VaultPicker
                      mode={mode}
                      key={owner ?? 'disconnected'}
                      selected={selection}
                      chainId={selection?.chainId ?? resolveChainId(walletChain) ?? 1}
                      onSelect={select}
                      onClose={() => setPickerOpen(false)}
                    />
                  )
                : undefined
            }
          />
        </VaultZapRuntime>
        {!selection && initialAddress && !initial.ok && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {initial.error}
          </p>
        )}
      </main>
    </>
  )
}
