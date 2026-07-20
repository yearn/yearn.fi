import { BottomDrawer } from '@pages/vaults/components/detail/BottomDrawer'
import { useMediaQuery } from '@react-hookz/web'
import { useTenderlyPanel } from '@shared/contexts/useTenderlyPanel'
import type { TTenderlyFundableAsset, TTenderlySnapshotRecord } from '@shared/types/tenderly'
import {
  addTenderlyTimeIncrement,
  cl,
  convertTenderlyTimeAmountToSeconds,
  getDefaultTenderlyFundableAssets,
  getLastRestorableTenderlySnapshot,
  truncateHex
} from '@shared/utils'
import type { TTenderlyFastForwardUnit } from '@shared/utils/tenderlyPanel'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

type TDesktopPanelKey = 'snapshots' | 'faucet' | 'fast-forward'

const QUICK_FORWARD_OPTIONS: Array<{ label: string; amount: number; unit: TTenderlyFastForwardUnit }> = [
  { label: '+1h', amount: 1, unit: 'hours' },
  { label: '+1d', amount: 1, unit: 'days' },
  { label: '+7d', amount: 7, unit: 'days' },
  { label: '+14d', amount: 14, unit: 'days' }
]

function ActionButton(props: {
  label: string
  onClick: () => void
  disabled?: boolean
  isActive?: boolean
  variant?: 'primary' | 'secondary'
  className?: string
}): ReactElement {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={cl(
        'rounded-full border px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50',
        props.variant === 'primary'
          ? 'border-text-primary bg-text-primary text-surface hover:opacity-90'
          : props.isActive
            ? 'border-text-primary bg-surface text-text-primary'
            : 'border-border bg-surface-secondary text-text-secondary hover:text-text-primary',
        props.disabled ? '' : 'active:scale-[0.98]',
        props.className
      )}
    >
      {props.label}
    </button>
  )
}

function PanelShell(props: {
  title: string
  subtitle?: string
  onClose?: () => void
  children: ReactElement
  className?: string
}): ReactElement {
  return (
    <div
      className={cl(
        'w-full max-w-3xl rounded-[2rem] border border-border bg-app/95 p-4 shadow-2xl backdrop-blur-xl',
        props.className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{props.title}</p>
          {props.subtitle ? <p className="mt-1 text-xs text-text-secondary">{props.subtitle}</p> : null}
        </div>
        {props.onClose ? <ActionButton label={'close'} onClick={props.onClose} className="shrink-0" /> : null}
      </div>
      <div className="mt-4">{props.children}</div>
    </div>
  )
}

function ChainSelector(props: {
  availableChains: Array<{
    canonicalChainId: number
    canonicalChainName: string
    executionChainId: number
    hasAdminRpc: boolean
  }>
  selectedCanonicalChainId?: number
  setSelectedCanonicalChainId: (chainId: number) => void
}): ReactElement | null {
  if (props.availableChains.length <= 1) {
    return null
  }

  return (
    <select
      value={props.selectedCanonicalChainId}
      onChange={(event) => props.setSelectedCanonicalChainId(Number(event.target.value))}
      className="rounded-full border border-border bg-surface-secondary px-3 py-2 text-xs text-text-primary"
    >
      {props.availableChains.map((chain) => (
        <option key={chain.canonicalChainId} value={chain.canonicalChainId}>
          {chain.canonicalChainName}
        </option>
      ))}
    </select>
  )
}

function BaselineGateCard(props: {
  pendingAction: string | null
  disabled?: boolean
  onCreateBaseline: () => Promise<void>
}): ReactElement {
  return (
    <div className="rounded-3xl border border-border bg-surface-secondary p-4">
      <p className="text-sm font-semibold text-text-primary">{'Create a baseline snapshot first'}</p>
      <p className="mt-1 text-xs text-text-secondary">
        {'All Tenderly mutations stay locked until this chain has a baseline snapshot you can return to.'}
      </p>
      <div className="mt-4">
        <ActionButton
          label={props.pendingAction === 'create-baseline' ? 'creating baseline...' : 'create baseline snapshot'}
          onClick={() => void props.onCreateBaseline()}
          disabled={props.disabled || props.pendingAction !== null}
          variant="primary"
        />
      </div>
    </div>
  )
}

function SnapshotList(props: {
  pendingAction: string | null
  snapshotRecords: TTenderlySnapshotRecord[]
  onRevert: (snapshotRecord: TTenderlySnapshotRecord) => Promise<void>
}): ReactElement {
  if (props.snapshotRecords.length === 0) {
    return <p className="text-xs text-text-secondary">{'No snapshots stored for this Tenderly chain yet.'}</p>
  }

  return (
    <div className="space-y-2">
      {props.snapshotRecords.map((snapshotRecord) => (
        <div
          key={snapshotRecord.snapshotId}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-3 py-3 md:flex-row md:items-center md:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-text-primary">{snapshotRecord.label}</p>
              <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
                {snapshotRecord.kind}
              </span>
              {snapshotRecord.lastKnownStatus === 'invalid' ? (
                <span className="rounded-full bg-red/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red">
                  {'invalid'}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {new Date(snapshotRecord.createdAt).toLocaleString('en-US')}
            </p>
          </div>
          <ActionButton
            label={snapshotRecord.kind === 'baseline' ? 'reset to baseline' : 'revert'}
            onClick={() => void props.onRevert(snapshotRecord)}
            disabled={props.pendingAction !== null || snapshotRecord.lastKnownStatus !== 'valid'}
          />
        </div>
      ))}
    </div>
  )
}

function WalletAssetRow(props: {
  asset: TTenderlyFundableAsset
  isSelected: boolean
  onSelect: () => void
}): ReactElement {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={cl(
        'flex w-full flex-col gap-2 px-3 py-2 text-left text-sm transition-colors',
        props.isSelected ? 'bg-surface-secondary' : 'hover:bg-surface-secondary'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-medium text-text-primary">{props.asset.symbol}</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
            {props.asset.tokenType}
          </span>
        </span>
        <span className="text-xs text-text-secondary">{props.asset.name}</span>
      </div>
      <p className="font-mono text-[11px] leading-tight text-text-secondary" title={props.asset.address}>
        {props.asset.address}
      </p>
    </button>
  )
}

function useTenderlyControlState() {
  const {
    status,
    selectedCanonicalChainId,
    selectedExecutionChainId,
    snapshotRecords,
    baselineSnapshot,
    fundableAssets,
    connectedWalletAddress,
    pendingAction,
    setSelectedCanonicalChainId,
    createBaselineSnapshot,
    createSnapshot,
    clearSnapshotHistory,
    revertToSnapshot,
    increaseTime,
    fundWallet
  } = useTenderlyPanel()
  const [customAmount, setCustomAmount] = useState('14')
  const [customUnit, setCustomUnit] = useState<TTenderlyFastForwardUnit>('days')
  const [fundSearch, setFundSearch] = useState('')
  const [selectedAssetAddress, setSelectedAssetAddress] = useState<`0x${string}` | undefined>(undefined)
  const [fundAmount, setFundAmount] = useState('')
  const [nativeFundMode, setNativeFundMode] = useState<'add' | 'set'>('add')
  const availableChains = useMemo(
    () => (status?.configuredChains || []).filter((chain) => chain.hasAdminRpc),
    [status?.configuredChains]
  )
  const selectedChain = useMemo(
    () => availableChains.find((chain) => chain.canonicalChainId === selectedCanonicalChainId),
    [availableChains, selectedCanonicalChainId]
  )
  const controlsUnlocked = Boolean(baselineSnapshot)
  const lastRestorableSnapshot = useMemo(() => getLastRestorableTenderlySnapshot(snapshotRecords), [snapshotRecords])

  const selectedAssetAddressOrFallback =
    selectedAssetAddress && fundableAssets.some((asset) => asset.address === selectedAssetAddress)
      ? selectedAssetAddress
      : fundableAssets[0]?.address
  const selectedAsset = fundableAssets.find((asset) => asset.address === selectedAssetAddressOrFallback)
  const filteredAssets = useMemo(() => {
    const normalizedSearch = fundSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return getDefaultTenderlyFundableAssets(fundableAssets, 14)
    }

    return fundableAssets
      .filter((asset) =>
        [asset.symbol, asset.name, asset.address, asset.tokenType].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        )
      )
      .slice(0, 14)
  }, [fundSearch, fundableAssets])

  const customSeconds = convertTenderlyTimeAmountToSeconds(Number(customAmount), customUnit)

  const handleQuickForwardInput = (amount: number, unit: TTenderlyFastForwardUnit): void => {
    const nextInput = addTenderlyTimeIncrement({
      currentAmount: Number(customAmount),
      currentUnit: customUnit,
      addedAmount: amount,
      addedUnit: unit
    })

    setCustomAmount(String(nextInput.amount))
    setCustomUnit(nextInput.unit)
  }

  const handleCustomFastForward = async (): Promise<void> => {
    if (customSeconds <= 0) {
      return
    }

    await increaseTime({ seconds: customSeconds, mineBlock: true })
  }

  const handleFundWallet = async (): Promise<void> => {
    if (!selectedAsset || !fundAmount) {
      return
    }

    await fundWallet({
      assetKind: selectedAsset.assetKind,
      tokenAddress: selectedAsset.assetKind === 'erc20' ? selectedAsset.address : undefined,
      symbol: selectedAsset.symbol,
      decimals: selectedAsset.decimals,
      amount: fundAmount,
      mode: selectedAsset.assetKind === 'native' ? nativeFundMode : 'set'
    })
    setFundAmount('')
  }

  const handleResetToLast = async (): Promise<void> => {
    if (!lastRestorableSnapshot) {
      return
    }

    await revertToSnapshot(lastRestorableSnapshot)
  }

  return {
    availableChains,
    selectedChain,
    selectedCanonicalChainId,
    selectedExecutionChainId,
    snapshotRecords,
    baselineSnapshot,
    controlsUnlocked,
    lastRestorableSnapshot,
    fundableAssets,
    filteredAssets,
    selectedAsset,
    selectedAssetAddress: selectedAssetAddressOrFallback,
    setSelectedAssetAddress,
    connectedWalletAddress,
    pendingAction,
    setSelectedCanonicalChainId,
    createBaselineSnapshot,
    createSnapshot,
    clearSnapshotHistory,
    revertToSnapshot,
    handleResetToLast,
    customAmount,
    setCustomAmount,
    customUnit,
    setCustomUnit,
    customSeconds,
    handleQuickForwardInput,
    handleCustomFastForward,
    fundSearch,
    setFundSearch,
    fundAmount,
    setFundAmount,
    nativeFundMode,
    setNativeFundMode,
    handleFundWallet
  }
}

type TTenderlyControlState = ReturnType<typeof useTenderlyControlState>

function SnapshotPanel(props: { state: TTenderlyControlState; onClose?: () => void }): ReactElement {
  const { state } = props

  return (
    <PanelShell
      title={'Snapshots'}
      subtitle={
        state.selectedCanonicalChainId && state.selectedExecutionChainId
          ? `Canonical ${state.selectedCanonicalChainId} -> execution ${state.selectedExecutionChainId}`
          : 'Select a configured Tenderly chain'
      }
      onClose={props.onClose}
    >
      <div className="space-y-4">
        {!state.controlsUnlocked ? (
          <BaselineGateCard
            pendingAction={state.pendingAction}
            disabled={!state.selectedCanonicalChainId}
            onCreateBaseline={state.createBaselineSnapshot}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-border bg-surface-secondary p-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{'Saved snapshots'}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {state.lastRestorableSnapshot?.kind === 'snapshot'
                  ? `Reset currently targets ${state.lastRestorableSnapshot.label}.`
                  : 'Reset currently falls back to the baseline snapshot.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                label={'clear local history'}
                onClick={state.clearSnapshotHistory}
                disabled={state.pendingAction !== null || state.snapshotRecords.length === 0}
              />
              <ActionButton
                label={state.pendingAction === 'create-snapshot' ? 'saving...' : 'new snapshot'}
                onClick={() => void state.createSnapshot()}
                disabled={state.pendingAction !== null}
                variant="primary"
              />
            </div>
          </div>
        )}
        <SnapshotList
          pendingAction={state.pendingAction}
          snapshotRecords={state.snapshotRecords}
          onRevert={state.revertToSnapshot}
        />
      </div>
    </PanelShell>
  )
}

function FastForwardPanel(props: { state: TTenderlyControlState; onClose?: () => void }): ReactElement {
  const { state } = props

  return (
    <PanelShell
      title={'Fast Forward'}
      subtitle={'Preset buttons add time to the current input. The actual fast-forward happens only when you submit.'}
      onClose={props.onClose}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {!state.controlsUnlocked ? (
          <BaselineGateCard
            pendingAction={state.pendingAction}
            disabled={!state.selectedCanonicalChainId}
            onCreateBaseline={state.createBaselineSnapshot}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {QUICK_FORWARD_OPTIONS.map((option) => (
                <ActionButton
                  key={option.label}
                  label={option.label}
                  onClick={() => state.handleQuickForwardInput(option.amount, option.unit)}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                type="number"
                min="1"
                step="any"
                value={state.customAmount}
                onChange={(event) => state.setCustomAmount(event.target.value)}
                className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                placeholder="Amount"
              />
              <select
                value={state.customUnit}
                onChange={(event) => state.setCustomUnit(event.target.value as TTenderlyFastForwardUnit)}
                className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-text-primary"
              >
                <option value="minutes">{'Minutes'}</option>
                <option value="hours">{'Hours'}</option>
                <option value="days">{'Days'}</option>
              </select>
              <ActionButton
                label={state.pendingAction === 'increase-time' ? 'fast-forwarding...' : 'fast forward'}
                onClick={() => void state.handleCustomFastForward()}
                disabled={state.pendingAction !== null || state.customSeconds <= 0}
                variant="primary"
              />
            </div>
            <p className="text-xs text-text-secondary">
              {state.customSeconds > 0
                ? `Ready to move Tenderly forward by ${state.customSeconds.toLocaleString('en-US')} seconds and mine one block.`
                : 'Enter a positive amount to fast-forward Tenderly.'}
            </p>
          </>
        )}
      </div>
    </PanelShell>
  )
}

function WalletFaucetPanel(props: { state: TTenderlyControlState; onClose?: () => void }): ReactElement {
  const { state } = props

  return (
    <PanelShell
      title={'Wallet Faucet'}
      subtitle={
        state.connectedWalletAddress
          ? `Funding ${truncateHex(state.connectedWalletAddress, 4)} on Tenderly`
          : 'Connect a wallet to fund the currently connected address'
      }
      onClose={props.onClose}
    >
      <div className="space-y-4">
        {!state.controlsUnlocked ? (
          <BaselineGateCard
            pendingAction={state.pendingAction}
            disabled={!state.selectedCanonicalChainId}
            onCreateBaseline={state.createBaselineSnapshot}
          />
        ) : (
          <>
            <input
              type="text"
              value={state.fundSearch}
              onChange={(event) => state.setFundSearch(event.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text-primary"
              placeholder="Search common Yearn and Kong assets"
            />
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-border bg-surface">
              {state.filteredAssets.length === 0 ? (
                <p className="px-3 py-3 text-xs text-text-secondary">{'No matching assets'}</p>
              ) : (
                state.filteredAssets.map((asset) => (
                  <WalletAssetRow
                    key={`${asset.chainId}:${asset.address}:${asset.tokenType}`}
                    asset={asset}
                    isSelected={state.selectedAssetAddress === asset.address}
                    onSelect={() => state.setSelectedAssetAddress(asset.address)}
                  />
                ))
              )}
            </div>
            <div className="rounded-2xl border border-border bg-surface-secondary px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-text-secondary">{'Selected asset'}</p>
              {state.selectedAsset ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-text-primary">
                    {`${state.selectedAsset.symbol} · ${state.selectedAsset.name}`}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-text-secondary" title={state.selectedAsset.address}>
                    {state.selectedAsset.address}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-text-secondary">{'Choose an asset to fund the connected wallet.'}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                type="text"
                value={state.fundAmount}
                onChange={(event) => state.setFundAmount(event.target.value)}
                className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                placeholder={state.selectedAsset ? `Amount in ${state.selectedAsset.symbol}` : 'Amount'}
              />
              {state.selectedAsset?.assetKind === 'native' ? (
                <select
                  value={state.nativeFundMode}
                  onChange={(event) => state.setNativeFundMode(event.target.value as 'add' | 'set')}
                  className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                >
                  <option value="add">{'Add balance'}</option>
                  <option value="set">{'Set exact balance'}</option>
                </select>
              ) : null}
              <ActionButton
                label={state.pendingAction === 'fund-wallet' ? 'funding...' : 'fund wallet'}
                onClick={() => void state.handleFundWallet()}
                disabled={
                  state.pendingAction !== null ||
                  !state.connectedWalletAddress ||
                  !state.selectedAsset ||
                  !state.fundAmount
                }
                variant="primary"
              />
            </div>
          </>
        )}
      </div>
    </PanelShell>
  )
}

function MobileTenderlyPanelContent(props: { state: TTenderlyControlState }): ReactElement {
  const { state } = props

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">{'Tenderly Control Panel'}</p>
          <p className="text-xs text-text-secondary">
            {state.selectedCanonicalChainId && state.selectedExecutionChainId
              ? `Canonical ${state.selectedCanonicalChainId} -> execution ${state.selectedExecutionChainId}`
              : 'Select a configured Tenderly chain'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ChainSelector
            availableChains={state.availableChains}
            selectedCanonicalChainId={state.selectedCanonicalChainId}
            setSelectedCanonicalChainId={state.setSelectedCanonicalChainId}
          />
          {state.availableChains.length <= 1 ? (
            <span className="rounded-full border border-border bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
              {state.selectedChain?.canonicalChainName || 'No Tenderly chains'}
            </span>
          ) : null}
        </div>
      </div>

      {!state.controlsUnlocked ? (
        <BaselineGateCard
          pendingAction={state.pendingAction}
          disabled={!state.selectedCanonicalChainId}
          onCreateBaseline={state.createBaselineSnapshot}
        />
      ) : (
        <>
          <div className="rounded-3xl border border-border bg-surface-secondary p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                label={state.pendingAction === 'revert-snapshot' ? 'resetting...' : 'reset to last snapshot'}
                onClick={() => void state.handleResetToLast()}
                disabled={state.pendingAction !== null || !state.lastRestorableSnapshot}
                variant="primary"
              />
              <ActionButton
                label={state.pendingAction === 'create-snapshot' ? 'saving...' : 'new snapshot'}
                onClick={() => void state.createSnapshot()}
                disabled={state.pendingAction !== null}
              />
              <ActionButton
                label={'clear local history'}
                onClick={state.clearSnapshotHistory}
                disabled={state.pendingAction !== null || state.snapshotRecords.length === 0}
              />
            </div>
          </div>

          <FastForwardPanel state={state} />
          <WalletFaucetPanel state={state} />
          <SnapshotPanel state={state} />
        </>
      )}
    </div>
  )
}

function DesktopTenderlyPanel(props: { state: TTenderlyControlState }): ReactElement {
  const { state } = props
  const [activePanel, setActivePanel] = useState<TDesktopPanelKey | null>(null)
  const panelRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!state.controlsUnlocked) {
      setActivePanel('snapshots')
    }
  }, [state.controlsUnlocked])

  useEffect(() => {
    if (!activePanel) {
      return
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (!panelRootRef.current?.contains(target)) {
        setActivePanel(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [activePanel])

  const selectedChainLabel = state.selectedChain?.canonicalChainName || 'Tenderly chain'
  const statusLabel = state.selectedExecutionChainId
    ? `${selectedChainLabel} · execution ${state.selectedExecutionChainId}`
    : selectedChainLabel

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[75] hidden justify-center px-4 md:flex">
      <div ref={panelRootRef} className="pointer-events-auto flex w-full max-w-4xl flex-col items-center gap-3">
        {activePanel === 'snapshots' ? (
          <SnapshotPanel state={state} onClose={() => setActivePanel(null)} />
        ) : activePanel === 'faucet' ? (
          <WalletFaucetPanel state={state} onClose={() => setActivePanel(null)} />
        ) : activePanel === 'fast-forward' ? (
          <FastForwardPanel state={state} onClose={() => setActivePanel(null)} />
        ) : null}

        <div className="w-full max-w-[42rem] rounded-[2rem] border border-border bg-app/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">{statusLabel}</p>
            <ChainSelector
              availableChains={state.availableChains}
              selectedCanonicalChainId={state.selectedCanonicalChainId}
              setSelectedCanonicalChainId={state.setSelectedCanonicalChainId}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <ActionButton
              label={'snapshot'}
              onClick={() => setActivePanel((current) => (current === 'snapshots' ? null : 'snapshots'))}
              isActive={activePanel === 'snapshots'}
            />
            <ActionButton
              label={state.pendingAction === 'revert-snapshot' ? 'resetting...' : 'reset'}
              onClick={() => {
                setActivePanel(null)
                void state.handleResetToLast()
              }}
              disabled={state.pendingAction !== null || !state.controlsUnlocked || !state.lastRestorableSnapshot}
              variant="primary"
            />
            <ActionButton
              label={'wallet faucet'}
              onClick={() => setActivePanel((current) => (current === 'faucet' ? null : 'faucet'))}
              disabled={!state.controlsUnlocked}
              isActive={activePanel === 'faucet'}
            />
            <ActionButton
              label={'fast forward'}
              onClick={() => setActivePanel((current) => (current === 'fast-forward' ? null : 'fast-forward'))}
              disabled={!state.controlsUnlocked}
              isActive={activePanel === 'fast-forward'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TenderlyControlPanelBody(props: { isOpen: boolean; closePanel: () => void }): ReactElement {
  const state = useTenderlyControlState()
  const isDesktop = useMediaQuery('(min-width: 768px)', { initializeWithValue: true }) ?? false

  if (isDesktop) {
    return <DesktopTenderlyPanel state={state} />
  }

  return (
    <BottomDrawer isOpen={props.isOpen} onClose={props.closePanel} title={'Tenderly Controls'}>
      <MobileTenderlyPanelContent state={state} />
    </BottomDrawer>
  )
}

export function TenderlyControlPanel(): ReactElement | null {
  const { isTenderlyMode, isPanelAvailable, isOpen, closePanel } = useTenderlyPanel()

  if (!isTenderlyMode || !isPanelAvailable || !isOpen) {
    return null
  }

  return <TenderlyControlPanelBody isOpen={isOpen} closePanel={closePanel} />
}
