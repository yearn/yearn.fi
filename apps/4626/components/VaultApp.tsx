'use client'

import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { parseVaultSelection } from '@erc4626/lib/vaultSelection'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Erc4626VaultWidget } from '@yearn/vault-widget'
import Image from 'next/image'
import { type FormEvent, useState } from 'react'

export function VaultApp({ initialChain, initialAddress }: { initialChain?: string; initialAddress?: string }) {
  const initial = parseVaultSelection(initialChain, initialAddress)
  const [chain, setChain] = useState(initialChain ?? '1')
  const [address, setAddress] = useState(initialAddress ?? '')
  const [selection, setSelection] = useState(initial.ok ? initial : undefined)
  const [error, setError] = useState(initialAddress ? initial.error : undefined)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = parseVaultSelection(chain, address)
    setError(next.error)
    if (next.ok) {
      setSelection(next)
      const url = new URL(window.location.href)
      url.search = new URLSearchParams({ chain: String(next.chainId), vault: next.address }).toString()
      window.history.replaceState(null, '', url)
    }
  }
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-6">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/yearn.svg" alt="" width={28} height={28} /> Yearn
        </a>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-10 pt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-text-secondary">ERC-4626 utility</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Deposit. Withdraw.</h1>
        <p className="mt-3 text-text-secondary">
          Open a vault by its contract address to deposit or withdraw its underlying token.
        </p>
        <form onSubmit={submit} className="my-7 space-y-4 rounded-lg border border-border bg-white p-5">
          <div>
            <label htmlFor="chain" className="mb-2 block text-sm font-medium">
              Network
            </label>
            <select
              id="chain"
              value={chain}
              onChange={(event) => setChain(event.target.value)}
              className="w-full rounded-md border border-border bg-white p-3"
            >
              {SUPPORTED_CHAINS.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="vault" className="mb-2 block text-sm font-medium">
              Vault address
            </label>
            <input
              id="vault"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!error}
              aria-describedby={error ? 'vault-error' : undefined}
              className="w-full rounded-md border border-border p-3 font-mono text-sm"
            />
          </div>
          {error && (
            <p id="vault-error" role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 p-3 font-medium text-white hover:bg-neutral-700"
          >
            Open vault
          </button>
        </form>
        {selection && <Erc4626VaultWidget address={selection.address} chainId={selection.chainId} />}
        <p className="mt-6 text-xs leading-relaxed text-text-secondary">
          Opening a contract here does not mean it is a Yearn vault or has been reviewed by Yearn. Verify the network,
          vault address and underlying token before depositing.
        </p>
      </main>
    </>
  )
}
