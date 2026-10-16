'use client'

import { useErc4626Vault } from '@yearn/vault-widget/erc4626/useErc4626Vault'
import { CloseIcon } from '@yearn/vault-widget/icons'
import { Widget, WidgetTabs } from '@yearn/vault-widget/internal/components/widget'
import { useVaultWidgetRuntime, VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { WidgetActionType, type WidgetAddress } from '@yearn/vault-widget/types'
import { useEffect, useRef, useState } from 'react'
import { formatUnits } from 'viem'

export type Erc4626VaultWidgetProps = {
  address?: WidgetAddress
  chainId: number
  className?: string
  onSelectVault?: () => void
  /** Change this when the host explicitly reselects the same vault. */
  selectionRevision?: number
  isRetired?: boolean
  isCheckingRetirement?: boolean
}

function Erc4626VaultContent({
  address,
  chainId,
  className,
  onSelectVault,
  isRetired,
  isCheckingRetirement,
  mode,
  onModeChange
}: Erc4626VaultWidgetProps & { mode: WidgetActionType; onModeChange: (mode: WidgetActionType) => void }) {
  const runtime = useVaultWidgetRuntime()
  const [riskDialogOpen, setRiskDialogOpen] = useState(false)
  const [depositAccepted, setDepositAccepted] = useState(false)
  const activeMode = isCheckingRetirement || (isRetired && !depositAccepted) ? WidgetActionType.Withdraw : mode
  const changeMode = (next: WidgetActionType) => {
    if (next === WidgetActionType.Deposit && isCheckingRetirement) return
    if (next === WidgetActionType.Deposit && isRetired) {
      setDepositAccepted(false)
      setRiskDialogOpen(true)
      return
    }
    setDepositAccepted(false)
    onModeChange(next)
  }
  const { vault, vaultUserData, isLoading, error, refetch } = useErc4626Vault({
    address,
    chainId,
    account: runtime.wallet.address
  })
  const retry = () => {
    void refetch().catch(() => undefined)
  }
  const explorer = runtime.chains.getChain(chainId)?.blockExplorerUrl
  return (
    <div className={['yv-widget space-y-4', className].filter(Boolean).join(' ')}>
      <div>
        <button
          type="button"
          onClick={onSelectVault}
          disabled={!onSelectVault}
          className="flex w-full items-center justify-between gap-3 rounded-t-lg border border-border bg-surface p-5 text-left"
          aria-label={vault ? `Change vault: ${vault.name}` : 'Select vault'}
        >
          <span className="min-w-0">
            {vault && (
              <span className="mb-1 block text-xs text-text-secondary">
                {runtime.chains.getChain(chainId)?.name}
                {isRetired ? ' · Retired' : ''}
              </span>
            )}
            <span className="block truncate text-lg font-semibold">{vault?.name ?? 'Select vault'}</span>
          </span>
          {onSelectVault && (
            <svg
              aria-hidden="true"
              className="ml-1 size-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
        <WidgetTabs
          actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
          activeAction={activeMode}
          onActionChange={changeMode}
        />
      </div>
      {isCheckingRetirement && (
        <p role="status" className="text-sm text-text-secondary">
          Checking Yearn vault status before enabling deposits…
        </p>
      )}
      {riskDialogOpen && (
        <RetiredVaultDisclaimer
          vaultName={vault?.name}
          onCancel={() => setRiskDialogOpen(false)}
          onAccept={() => {
            setDepositAccepted(true)
            setRiskDialogOpen(false)
            onModeChange(WidgetActionType.Deposit)
          }}
        />
      )}
      {(!vault || !vaultUserData) && (
        <div className="space-y-5 rounded-lg border border-border bg-surface p-5">
          <label className="block text-sm text-text-secondary">
            Amount
            <input
              disabled
              aria-label="Amount"
              placeholder="0.00"
              className="mt-2 w-full rounded-lg border border-border bg-surface-secondary p-4 text-3xl"
            />
          </label>
          <p role="status" className="text-sm text-text-secondary">
            {address
              ? isLoading
                ? 'Reading vault…'
                : 'Unable to load this vault.'
              : 'Select a vault to deposit or withdraw.'}
          </p>
          <button type="button" disabled className="w-full rounded-lg bg-surface-secondary p-4 text-text-secondary">
            {activeMode === WidgetActionType.Deposit ? 'Deposit' : 'Withdraw'}
          </button>
        </div>
      )}
      {address && error && (
        <p role="alert" className="text-sm text-red-700">
          {error}{' '}
          <button type="button" onClick={retry} className="underline">
            Retry
          </button>
        </p>
      )}
      {vault && vaultUserData && (
        <>
          <Widget
            mode={activeMode}
            onModeChange={changeMode}
            showTabs={false}
            currentVault={vault}
            chainId={chainId}
            vaultUserData={vaultUserData}
            actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
            disableTokenSelector
            disableDepositStaking
            withdrawalSource="vault"
          />
          {runtime.wallet.address && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Position value</dt>
                <dd className="break-all text-right">
                  {formatUnits(vaultUserData.depositedValue, vault.asset.decimals)} {vault.asset.symbol}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Available to withdraw</dt>
                <dd className="break-all text-right">
                  {formatUnits(vaultUserData.erc4626?.maxWithdraw ?? 0n, vault.asset.decimals)} {vault.asset.symbol}
                </dd>
              </div>
            </dl>
          )}
          {explorer && (
            <a
              href={`${explorer}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="block break-all font-mono text-xs underline"
            >
              {address}
            </a>
          )}
          <p className="text-xs text-text-secondary">
            Amounts are in {vault.asset.symbol}. Estimates can change before confirmation; withdrawal fees and vault
            limits may apply.
          </p>
        </>
      )}
    </div>
  )
}

/** A direct-only preset. The host supplies wallet UI, configured chains and notifications. */
export function Erc4626VaultWidget(props: Erc4626VaultWidgetProps) {
  const [mode, setMode] = useState(WidgetActionType.Deposit)
  const runtime = useVaultWidgetRuntime()
  return (
    <VaultWidgetRuntimeProvider value={{ routing: { isEnsoEnabled: () => false }, settings: { autoStake: false } }}>
      <Erc4626VaultContent
        key={`${props.chainId}:${props.address?.toLowerCase() ?? 'empty'}:${runtime.wallet.address?.toLowerCase() ?? 'disconnected'}:${props.isRetired === true}:${props.selectionRevision ?? 0}`}
        {...props}
        mode={mode}
        onModeChange={setMode}
      />
    </VaultWidgetRuntimeProvider>
  )
}

function RetiredVaultDisclaimer({
  vaultName,
  onAccept,
  onCancel
}: {
  vaultName?: string
  onAccept: () => void
  onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [accepted, setAccepted] = useState(false)
  // Native dialog manages focus trapping and Escape through its browser lifecycle API.
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      onCancel={onCancel}
      aria-labelledby="retired-vault-title"
      aria-describedby="retired-vault-description"
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-[404px] overflow-y-auto rounded-lg border border-border bg-surface p-0 text-text-primary shadow-xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <h2 id="retired-vault-title" className="text-base font-semibold">
          This vault is retired
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close retired vault disclaimer"
          className="rounded-lg p-1 hover:bg-surface-secondary"
        >
          <CloseIcon className="size-5 text-text-secondary" />
        </button>
      </div>
      <form
        className="space-y-4 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (accepted) onAccept()
        }}
      >
        <p id="retired-vault-description" className="text-sm leading-relaxed text-text-secondary">
          {vaultName ?? 'This Yearn vault'} has been retired. New deposits are not recommended. If you choose to
          deposit, you do so at your own risk.
        </p>
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 shrink-0"
          />
          I understand this vault is retired and accept the risks of depositing.
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!accepted}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to deposit
          </button>
        </div>
      </form>
    </dialog>
  )
}
