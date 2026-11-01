'use client'

import { useErc4626Vault } from '@yearn/vault-widget/erc4626/useErc4626Vault'
import { CloseIcon } from '@yearn/vault-widget/icons'
import { TokenLogoV2 } from '@yearn/vault-widget/internal/components/shared/TokenLogoV2'
import { Widget } from '@yearn/vault-widget/internal/components/widget'
import { SettingsPanel } from '@yearn/vault-widget/internal/components/widget/SettingsPanel'
import { TokenSelectorCardContext } from '@yearn/vault-widget/internal/components/widget/shared/TokenSelectorOverlay'
import { IconSettings } from '@yearn/vault-widget/internal/icons/IconSettings'
import { useVaultWidgetRuntime, VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { type VaultWidgetVault, WidgetActionType, type WidgetAddress } from '@yearn/vault-widget/types'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

export type Erc4626VaultWidgetProps = {
  address?: WidgetAddress
  chainId: number
  className?: string
  onSelectVault?: () => void
  vaultSelector?: ReactNode | ((mode: WidgetActionType) => ReactNode)
  /** Change this when the host explicitly reselects the same vault. */
  selectionRevision?: number
  isRetired?: boolean
  isCheckingRetirement?: boolean
  contractKind?: VaultWidgetVault['contractKind']
  enableZaps?: boolean
  headerInsideCard?: boolean
  renderChart?: (context: { isOpen: boolean; onClose: () => void; vault?: VaultWidgetVault }) => ReactNode
}

function Erc4626VaultContent({
  address,
  chainId,
  className,
  onSelectVault,
  vaultSelector: renderVaultSelector,
  isRetired,
  isCheckingRetirement,
  contractKind,
  enableZaps,
  headerInsideCard,
  renderChart,
  mode,
  onModeChange
}: Erc4626VaultWidgetProps & { mode: WidgetActionType; onModeChange: (mode: WidgetActionType) => void }) {
  const runtime = useVaultWidgetRuntime()
  const [riskDialogOpen, setRiskDialogOpen] = useState(false)
  const [depositAccepted, setDepositAccepted] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cardElement, setCardElement] = useState<HTMLDivElement | null>(null)
  const chartToggleRef = useRef<HTMLButtonElement>(null)
  const chartRef = useRef<HTMLElement>(null)
  // Observe the rendered chart size so full-card pickers can grow independently.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !chartOpen || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (chart.parentElement?.querySelector('[data-vault-selector-overlay], [data-token-selector-overlay]')) return
      chart.style.setProperty('--chart-resting-height', `${chart.getBoundingClientRect().height}px`)
    })
    observer.observe(chart)
    return () => observer.disconnect()
  }, [chartOpen])
  const chartId = useId()
  const settingsId = useId()
  const activeMode = isCheckingRetirement || (isRetired && !depositAccepted) ? WidgetActionType.Withdraw : mode
  const vaultSelector =
    typeof renderVaultSelector === 'function' ? renderVaultSelector(activeMode) : renderVaultSelector
  const selectVaultLabel = `Select vault to ${activeMode === WidgetActionType.Deposit ? 'deposit into' : 'withdraw from'}`
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
    account: runtime.wallet.address,
    contractKind,
    enabled: !isCheckingRetirement
  })
  const retry = () => {
    void refetch().catch(() => undefined)
  }
  const header = (
    <div className="relative">
      <div className="flex h-10 items-center justify-between gap-3" aria-label="Widget header">
        <fieldset aria-label="Widget action" data-selector-toggle className="flex items-center gap-1">
          {[WidgetActionType.Deposit, WidgetActionType.Withdraw].map((action) => (
            <button
              key={action}
              type="button"
              aria-pressed={activeMode === action}
              onClick={() => {
                setSettingsOpen(false)
                changeMode(action)
              }}
              className={[
                'rounded-full px-4 py-2 text-base font-medium transition-colors',
                activeMode === action
                  ? 'font-semibold text-primary'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
              ].join(' ')}
            >
              {action === WidgetActionType.Deposit ? 'Deposit' : 'Withdraw'}
            </button>
          ))}
        </fieldset>
        <div className="flex items-center gap-1">
          <button
            ref={chartToggleRef}
            type="button"
            aria-label="Toggle chart"
            aria-expanded={chartOpen}
            aria-controls={chartId}
            aria-pressed={chartOpen}
            onClick={() => setChartOpen((open) => !open)}
            className={[
              'rounded-lg p-2 text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
              chartOpen ? 'bg-surface-tertiary' : ''
            ].join(' ')}
          >
            <svg
              aria-hidden="true"
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 17 6-6 4 4 8-10M15 5h6v6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Transaction settings"
            aria-expanded={settingsOpen}
            aria-controls={settingsId}
            onClick={() => setSettingsOpen((open) => !open)}
            className={[
              'rounded-lg p-2 text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
              settingsOpen ? 'bg-surface-tertiary' : ''
            ].join(' ')}
          >
            <IconSettings className="size-5" />
          </button>
        </div>
      </div>
      <div id={settingsId} className="absolute right-0 top-10 z-30 w-full max-w-[404px] shadow-lg">
        <SettingsPanel
          isActive={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          showAutoStake={false}
          description="Slippage settings apply to swap routes. Direct ERC-4626 deposits and withdrawals do not enforce a slippage bound."
        />
      </div>
    </div>
  )
  return (
    <div
      className={['yv-widget erc4626-layout', className].filter(Boolean).join(' ')}
      data-chart-open={chartOpen}
      data-header-inside-card={headerInsideCard || undefined}
    >
      <aside
        ref={chartRef}
        id={chartId}
        aria-label="Vault chart"
        aria-hidden={!chartOpen}
        inert={!chartOpen}
        className="erc4626-chart"
      >
        {renderChart ? (
          renderChart({
            isOpen: chartOpen,
            onClose: () => {
              setChartOpen(false)
              chartToggleRef.current?.focus()
            },
            vault
          })
        ) : (
          <div className="min-h-80 rounded-2xl border border-border bg-surface shadow-sm" />
        )}
      </aside>
      <div data-widget-column className="relative min-w-0 space-y-2">
        {!headerInsideCard && header}
        <TokenSelectorCardContext.Provider value={cardElement}>
          <div
            ref={setCardElement}
            data-erc4626-card
            className="relative flex min-h-[460px] flex-col rounded-2xl border border-border bg-surface"
            style={vaultSelector ? { minHeight: 'max(460px, calc(100dvh - 236px))' } : undefined}
          >
            <div data-erc4626-content inert={!!vaultSelector} className="flex flex-1 flex-col">
              {headerInsideCard && <div className="px-6 pt-6">{header}</div>}
              <div data-widget-part="vault-selector" className="px-6 pt-6">
                <button
                  data-vault-selector-trigger
                  type="button"
                  onClick={onSelectVault}
                  disabled={!onSelectVault}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-secondary/30 motion-reduce:transition-none"
                  aria-label={vault ? `Change vault: ${vault.name}` : selectVaultLabel}
                  aria-expanded={!!vaultSelector}
                  aria-haspopup="dialog"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {vault && (
                      <span className="relative size-10 shrink-0" data-selected-vault-logo>
                        <TokenLogoV2
                          src={runtime.assets.getTokenLogoUrl({ address: vault.asset.address, chainId, size: 32 })}
                          tokenSymbol={vault.symbol}
                          tokenName={vault.name}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                        <span
                          className="absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border border-border bg-surface"
                          data-selected-vault-chain
                        >
                          <TokenLogoV2
                            src={runtime.assets.getChainLogoUrl(chainId)}
                            tokenSymbol={runtime.chains.getChain(chainId)?.name}
                            width={16}
                            height={16}
                          />
                        </span>
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-xl font-normal">{vault?.name ?? selectVaultLabel}</span>
                      {isRetired && <span className="mt-1 block text-xs text-text-secondary">Retired</span>}
                    </span>
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
                <EmptyVaultForm
                  mode={activeMode}
                  status={
                    address
                      ? isLoading
                        ? 'Reading vault…'
                        : 'Unable to load this vault.'
                      : `Select a vault to ${activeMode === WidgetActionType.Deposit ? 'deposit' : 'withdraw'}.`
                  }
                />
              )}
              {address && error && (
                <p role="alert" className="px-6 pb-4 text-sm text-red-700">
                  {error}{' '}
                  <button type="button" onClick={retry} className="underline">
                    Retry
                  </button>
                </p>
              )}
              {vault && vaultUserData && (
                <Widget
                  mode={activeMode}
                  onModeChange={changeMode}
                  showTabs={false}
                  hideActionHeader
                  hideContainerBorder
                  currentVault={vault}
                  chainId={chainId}
                  vaultUserData={vaultUserData}
                  actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
                  disableTokenSelector={!enableZaps}
                  disableDepositStaking
                  withdrawalSource="vault"
                />
              )}
            </div>
            {vaultSelector && (
              <div data-vault-selector-overlay className="absolute inset-0 z-20 overflow-hidden rounded-2xl bg-surface">
                {vaultSelector}
              </div>
            )}
          </div>
        </TokenSelectorCardContext.Provider>
      </div>
    </div>
  )
}

function EmptyVaultForm({ mode, status }: { mode: WidgetActionType; status: string }) {
  const deposit = mode === WidgetActionType.Deposit
  return (
    <div data-widget-part="form-layout" className="flex flex-1 flex-col px-6 pb-6 pt-4">
      <fieldset disabled className="contents" aria-label="Select a vault to enable the form">
        <div className="flex min-w-0 flex-1 flex-col gap-4 opacity-40">
          <div data-widget-part="amount-box" className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <label htmlFor="empty-vault-amount">Amount</label>
              <div className="flex gap-1">
                {['25%', '50%', '75%', 'Max'].map((label) => (
                  <button key={label} type="button" className="rounded bg-surface-secondary px-1.5 py-0.5">
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                id="empty-vault-amount"
                aria-label="Amount"
                placeholder="0.00"
                className="min-w-0 w-full bg-transparent text-3xl"
              />
              <span className="shrink-0 text-sm">USDC</span>
            </div>
          </div>
          <dl className="mt-auto space-y-3 pt-4 text-sm">
            {(deposit
              ? ['You Will Deposit', 'You Will Receive', 'Vault share value', 'Est. Annual Return', 'Existing Approval']
              : ['You will redeem', 'You will receive', 'Vault share value']
            ).map((label) => (
              <div key={label} className="flex justify-between gap-4">
                <dt>{label}</dt>
                <dd aria-label="Unavailable">—</dd>
              </div>
            ))}
          </dl>
          <button type="button" aria-live="polite" className="w-full rounded-lg bg-primary p-3 text-white">
            {status}
          </button>
        </div>
      </fieldset>
    </div>
  )
}

/** Direct vault preset with optional host-supplied zaps, wallet UI, chains and notifications. */
export function Erc4626VaultWidget(props: Erc4626VaultWidgetProps) {
  const [mode, setMode] = useState(WidgetActionType.Deposit)
  const runtime = useVaultWidgetRuntime()
  const [slippagePercent, setSlippagePercent] = useState(runtime.settings.slippagePercent)
  return (
    <VaultWidgetRuntimeProvider
      value={{
        routing: { isEnsoEnabled: props.enableZaps ? runtime.routing.isEnsoEnabled : () => false },
        settings: { autoStake: false, slippagePercent, setSlippagePercent }
      }}
    >
      <Erc4626VaultContent
        key={`${props.chainId}:${props.address?.toLowerCase() ?? 'empty'}:${props.contractKind ?? 'erc4626'}:${runtime.wallet.address?.toLowerCase() ?? 'disconnected'}:${props.isRetired === true}:${props.selectionRevision ?? 0}`}
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
