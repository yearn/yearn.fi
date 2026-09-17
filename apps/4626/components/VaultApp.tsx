'use client'

import { Header } from '@erc4626/components/Header'
import { VaultPicker } from '@erc4626/components/VaultPicker'
import { resolveChainId } from '@erc4626/lib/chains'
import { useYearnAllocators } from '@erc4626/lib/useVaultDiscovery'
import { parseVaultSelection } from '@erc4626/lib/vaultSelection'
import { Erc4626VaultWidget } from '@yearn/vault-widget'
import { useState } from 'react'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'

export function VaultApp({ initialChain, initialAddress }: { initialChain?: string; initialAddress?: string }) {
  const initial = parseVaultSelection(initialChain, initialAddress)
  const { address: owner, chainId: walletChain } = useAccount()
  const [selection, setSelection] = useState<{ address: Address; chainId: number; retired?: boolean } | undefined>(
    initial.ok ? initial : undefined
  )
  const catalog = useYearnAllocators(!!selection)
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
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-10 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight">ERC-4626 Widget</h1>
        <Erc4626VaultWidget
          className="mt-7"
          address={selection?.address}
          chainId={selection?.chainId ?? resolveChainId(walletChain) ?? 1}
          selectionRevision={selectionRevision}
          isRetired={isRetired}
          isCheckingRetirement={!!selection && !isRetired && catalog.isPending && catalog.isFetching}
          onSelectVault={() => setPickerOpen(true)}
        />
        {pickerOpen && (
          <VaultPicker
            key={owner ?? 'disconnected'}
            selected={selection}
            chainId={selection?.chainId ?? resolveChainId(walletChain) ?? 1}
            onSelect={select}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {!selection && initialAddress && !initial.ok && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {initial.error}
          </p>
        )}
        <p className="mt-6 text-xs leading-relaxed text-text-secondary">
          Opening a contract here does not mean it is a Yearn vault or has been reviewed by Yearn. Verify the network,
          vault address and underlying token before depositing.
        </p>
      </main>
    </>
  )
}
