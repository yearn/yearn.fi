import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { PortfolioDropdown } from '@pages/portfolio/components/PortfolioDropdown'
import { PortfolioWalletLabel } from '@pages/portfolio/components/PortfolioWalletLabel'
import {
  createBundleShareUrl,
  normalizeSavedWallet,
  type TPortfolioBundle
} from '@pages/portfolio/utils/savedWalletPortfolio'
import { Button } from '@shared/components/Button'
import { CompactActionButton } from '@shared/components/CompactActionButton'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconCross } from '@shared/icons/IconCross'
import { IconPlus } from '@shared/icons/IconPlus'
import { useMutation } from '@tanstack/react-query'
import { useWalletDrawer } from '@yearn/wallet-ui'
import { resolveEnsAddress } from '@yearn/wallet-ui/ens'
import { useState } from 'react'
import type { Address } from 'viem'
import { mainnet } from 'viem/chains'
import { usePublicClient } from 'wagmi'

type TPortfolioWalletEditorProps = {
  connected: Address | null
  wallets: Address[]
  name?: string
  onSave: (name: string, wallets: Address[]) => void
  onClose: () => void
}

function PortfolioWalletEditor({ connected, wallets, name = '', onSave, onClose }: TPortfolioWalletEditorProps) {
  const client = usePublicClient({ chainId: mainnet.id })
  const { openLoginModal } = useWeb3()
  const [bundleName, setBundleName] = useState(name)
  const [input, setInput] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState(wallets)
  const entries = input
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
  const addInput = useMutation({
    mutationFn: async (entries: string[]) =>
      entries.reduce<Promise<{ addresses: Address[]; unresolved: string[] }>>(
        async (previous, entry) => {
          const result = await previous
          const address =
            normalizeSavedWallet(entry) ??
            (entry.includes('.') && client
              ? await resolveEnsAddress(client, entry)
                  .then(({ address }) => address && normalizeSavedWallet(address))
                  .catch(() => null)
              : null)
          if (address) result.addresses.push(address)
          else result.unresolved.push(entry)
          return result
        },
        Promise.resolve({ addresses: [], unresolved: [] })
      )
  })

  function submit() {
    addInput.mutate(entries, {
      onSuccess: ({ addresses, unresolved }) => {
        const next = [...new Set([...draft, ...addresses])]
        if (unresolved.length) {
          setDraft(next)
          setInput(unresolved.join(', '))
          setNotice('Some entries could not be resolved. Check the addresses or ENS names and try again.')
          return
        }
        if (next.length === 0) {
          setNotice('Add at least one wallet to save this bundle.')
          return
        }
        if (next.length === 1 && next[0] === connected && !name) {
          setNotice('Add a wallet to include alongside your connected wallet.')
          return
        }
        onSave(bundleName.trim(), next)
      }
    })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Bundle name
        <input
          className="w-full rounded-md border border-border bg-app px-3 py-2 font-normal"
          required
          maxLength={64}
          value={bundleName}
          onChange={(event) => setBundleName(event.target.value)}
          placeholder="e.g. Long-term vaults"
          disabled={addInput.isPending}
        />
      </label>
      {draft.length ? (
        <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {draft.map((wallet) => (
            <li key={wallet} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <PortfolioWalletLabel wallet={wallet} className="min-w-0 truncate font-mono" />
              {wallet === connected ? (
                <span className="ml-auto shrink-0 text-text-secondary">Connected wallet</span>
              ) : null}
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                aria-label={`Remove ${wallet}`}
                disabled={addInput.isPending}
                onClick={() => setDraft((current) => current.filter((entry) => entry !== wallet))}
              >
                <IconCross className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Wallet addresses or ENS names
        <textarea
          rows={2}
          className="w-full resize-y rounded-md border border-border bg-app px-3 py-2 font-normal"
          placeholder="0x… or name.eth"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          value={input}
          disabled={addInput.isPending}
          onChange={(event) => {
            setInput(event.target.value)
            setNotice('')
          }}
        />
      </label>
      {!connected ? (
        <Button
          type="button"
          variant="outlined"
          className="self-start"
          disabled={addInput.isPending}
          data-wallet-entry="portfolio"
          onClick={() => void openLoginModal()}
        >
          Connect wallet
        </Button>
      ) : !draft.includes(connected) ? (
        <Button
          type="button"
          variant="outlined"
          className="self-start"
          disabled={addInput.isPending}
          onClick={() => setDraft((current) => [...current, connected])}
        >
          Add connected wallet
        </Button>
      ) : null}
      {notice ? (
        <p className="text-sm text-text-secondary" role="status">
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          isBusy={addInput.isPending}
          disabled={addInput.isPending || !bundleName.trim() || (!entries.length && !draft.length)}
        >
          Save bundle
        </Button>
      </div>
    </form>
  )
}

type TPortfolioWalletDialogProps = {
  connected: Address | null
  bundles: TPortfolioBundle[]
  initialBundleId?: string
  onSave: (bundleId: string | null, name: string, wallets: Address[]) => void
  onClose: () => void
}

function BundleShareButton({ bundle }: { bundle: TPortfolioBundle }) {
  const [copied, setCopied] = useState(false)
  const [manualLink, setManualLink] = useState('')

  async function copyLink() {
    const link = createBundleShareUrl(window.location.origin, bundle)
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setManualLink('')
    } catch {
      setCopied(false)
      setManualLink(link)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2">
        <CompactActionButton onClick={() => void copyLink()}>Copy share link</CompactActionButton>
        <span role="status" className="text-sm text-text-secondary">
          {copied ? 'Link copied' : manualLink ? 'Copy the link below.' : null}
        </span>
      </div>
      {manualLink ? (
        <input
          aria-label="Bundle share link"
          className="w-full rounded-md border border-border bg-app px-3 py-2 text-sm"
          readOnly
          value={manualLink}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  )
}

export function PortfolioWalletDialog({
  connected,
  bundles,
  initialBundleId,
  onSave,
  onClose
}: TPortfolioWalletDialogProps) {
  const { isOpen: isWalletDrawerOpen } = useWalletDrawer()
  const [selectedBundleId, setSelectedBundleId] = useState(initialBundleId ?? bundles[0]?.id ?? '')
  const bundle = bundles.find(({ id }) => id === selectedBundleId)
  return (
    <Dialog open={!isWalletDrawerOpen} unmount={false} onClose={onClose} className="relative z-70">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-5 text-text-primary shadow-xl">
            <DialogTitle className="text-lg font-semibold">Manage wallets</DialogTitle>
            {bundles.length ? (
              <div className="flex items-center gap-2">
                <PortfolioDropdown
                  label={bundle?.name ?? 'New bundle'}
                  ariaLabel="Bundle to edit"
                  value={bundle?.id ?? ''}
                  onChange={setSelectedBundleId}
                  groups={[{ options: bundles.map(({ id, name }) => ({ value: id, label: name })) }]}
                  align="start"
                  buttonClassName="min-w-0 flex-1"
                />
                {bundle ? (
                  <CompactActionButton onClick={() => setSelectedBundleId('')}>
                    <IconPlus className="size-4" aria-hidden="true" />
                    Add bundle
                  </CompactActionButton>
                ) : null}
              </div>
            ) : null}
            {bundle ? <BundleShareButton key={bundle.id} bundle={bundle} /> : null}
            <PortfolioWalletEditor
              key={bundle ? `bundle:${bundle.id}` : 'new'}
              connected={connected}
              name={bundle?.name}
              wallets={bundle?.wallets ?? (connected ? [connected] : [])}
              onSave={(name, wallets) => onSave(bundle?.id ?? null, name, wallets)}
              onClose={onClose}
            />
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
