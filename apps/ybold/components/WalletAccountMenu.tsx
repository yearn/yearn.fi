'use client'

import { useWalletActivity } from '@ybold/components/WalletActivityProvider'
import { BOLD, ST_YBOLD, YBOLD } from '@ybold/lib/contracts'
import { appKit } from '@ybold/lib/wagmi'
import { selectRecentYboldWalletActivities, type TYboldWalletActivity } from '@ybold/lib/walletActivity'
import { formatWalletAddress } from '@ybold/lib/walletDrawer'
import { useVaultUserData } from '@yearn/vault-widget/internal/hooks/useVaultUserData'
import { useVaultWidgetSpotPrices } from '@yearn/vault-widget/internal/hooks/useVaultWidgetSpotPrices'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import Image from 'next/image'
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'

const YEARN_PORTFOLIO_URL = 'https://yearn.fi/portfolio'
const YBOLD_PRICE_TOKENS = [{ address: BOLD, chainId: 1 }] as const
const SLIPPAGE_OPTIONS = [0.1, 0.5, 1] as const

type TAccountView = 'account' | 'settings'

function CopyIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="1.8">
      <rect x="8" y="8" width="11" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.97 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

function PowerIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      <path d="M12 3v9" strokeLinecap="round" />
      <path d="M7.05 5.6a8 8 0 1 0 9.9 0" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      <path d="M5 12h14m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
}

function formatActivityType(type: string): string {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`
}

function formatActivityDate(activity: TYboldWalletActivity): string {
  return new Date(activity.finishedAt ?? activity.createdAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short'
  })
}

function getActivityStatusClass(status: TYboldWalletActivity['status']): string {
  if (status === 'success') {
    return 'text-good'
  }

  if (status === 'error') {
    return 'text-bad'
  }

  return 'text-yearn'
}

function AccountValue({ isLoading, value }: { isLoading: boolean; value: number }) {
  if (isLoading) {
    return (
      <span
        aria-label="Loading yBOLD position value"
        className="mt-1 block h-9 w-28 animate-pulse rounded bg-navy/10"
      />
    )
  }

  const [whole = '0', fraction = '00'] = value
    .toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    .split('.')

  return (
    <p
      aria-label={`yBOLD position value $${whole}.${fraction}`}
      className="text-4xl font-bold tracking-tight text-navy"
    >
      ${whole}
      <span className="text-navy/65">.{fraction}</span>
    </p>
  )
}

function ActivityRow({ activity }: { activity: TYboldWalletActivity }) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background">
          <Image src="/yearn-symbol.svg" alt="" width={25} height={25} />
        </span>
        <span className="min-w-0">
          <span className={`block truncate text-sm font-medium ${getActivityStatusClass(activity.status)}`}>
            {formatActivityType(activity.type)}
          </span>
          <span className="block truncate text-xs text-navy/65">
            {activity.amount} {activity.fromSymbol}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-xs text-navy/60">{formatActivityDate(activity)}</span>
    </>
  )
  const rowClassName =
    'flex min-h-14 items-center justify-between gap-4 rounded-lg pr-2 pl-1 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn'

  if (activity.txHash) {
    return (
      <a href={`https://etherscan.io/tx/${activity.txHash}`} target="_blank" rel="noreferrer" className={rowClassName}>
        {content}
      </a>
    )
  }

  return <div className={rowClassName}>{content}</div>
}

function AccountView({
  address,
  isBalanceLoading,
  isDisconnecting,
  onClose,
  onCopy,
  onDisconnect,
  onSettings,
  positionValue,
  recentActivity,
  wasCopied
}: {
  address: `0x${string}`
  isBalanceLoading: boolean
  isDisconnecting: boolean
  onClose: () => void
  onCopy: () => void
  onDisconnect: () => void
  onSettings: () => void
  positionValue: number
  recentActivity: readonly TYboldWalletActivity[]
  wasCopied: boolean
}) {
  const iconButtonClass =
    'flex size-10 items-center justify-center rounded-full text-navy/55 transition-[background-color,color,transform] duration-150 hover:scale-105 hover:bg-navy/[0.06] hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <>
      <div className="rounded-2xl bg-background p-4">
        <div className="mb-7 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onCopy}
              className="group flex max-w-full items-center gap-1.5 text-sm font-medium text-navy transition-colors hover:text-yearn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn"
            >
              <span className="truncate">{formatWalletAddress(address)}</span>
              <span className="shrink-0 text-navy/45 transition-colors group-hover:text-yearn">
                <CopyIcon />
              </span>
              {wasCopied && <span className="ml-1 text-xs font-normal text-good">Copied</span>}
            </button>
            <AccountValue isLoading={isBalanceLoading} value={positionValue} />
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Open wallet settings" className={iconButtonClass} onClick={onSettings}>
              <SettingsIcon />
            </button>
            <button
              type="button"
              aria-label="Disconnect wallet"
              className={iconButtonClass}
              onClick={onDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <Spinner /> : <PowerIcon />}
            </button>
          </div>
        </div>

        <a
          href={YEARN_PORTFOLIO_URL}
          target="_blank"
          rel="noreferrer"
          onClick={onClose}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-navy transition-[background-color,border-color,color] hover:border-navy/25 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn"
        >
          View portfolio
          <ArrowRightIcon />
        </a>
      </div>

      <div className="px-1 pt-5 pb-1">
        <h3 className="mb-2 text-sm font-semibold text-navy">Recent activity</h3>
        {recentActivity.length > 0 ? (
          <div className="flex flex-col">
            {recentActivity.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <p className="py-3 text-sm text-navy/60">No recent yBOLD activity</p>
        )}

        {recentActivity.length > 0 && (
          <a
            href={`https://etherscan.io/address/${address}`}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className="mt-2 flex w-fit items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-navy/65 transition-colors hover:bg-background hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn"
          >
            More transactions
            <ArrowRightIcon />
          </a>
        )}
      </div>
    </>
  )
}

function SettingsView({ onBack }: { onBack: () => void }) {
  const { settings } = useVaultWidgetRuntime()

  return (
    <div>
      <header className="mb-5 flex items-center">
        <button
          type="button"
          aria-label="Back to wallet account"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full text-navy/60 transition hover:bg-background hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn"
        >
          <ArrowLeftIcon />
        </button>
        <h2 className="flex-1 text-center text-base font-semibold text-navy">Settings</h2>
        <span aria-hidden className="size-10" />
      </header>

      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <span>
            <span className="block text-sm font-medium text-navy">Auto-stake deposits</span>
            <span className="block text-xs text-navy/60">Receive staked yBOLD by default</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoStake}
            aria-label="Auto-stake deposits"
            onClick={() => settings.setAutoStake(!settings.autoStake)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn ${settings.autoStake ? 'bg-yearn' : 'bg-navy/20'}`}
          >
            <span
              className={`absolute top-1 left-1 size-4 rounded-full bg-white transition-transform ${settings.autoStake ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        <div className="px-4 py-3.5">
          <p className="mb-2.5 text-sm font-medium text-navy">Slippage tolerance</p>
          <div className="grid grid-cols-3 gap-2">
            {SLIPPAGE_OPTIONS.map((slippage) => (
              <button
                key={slippage}
                type="button"
                aria-pressed={settings.slippagePercent === slippage}
                onClick={() => settings.setSlippagePercent(slippage)}
                className={`min-h-9 rounded-lg border px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn ${
                  settings.slippagePercent === slippage
                    ? 'border-yearn bg-yearn text-white'
                    : 'border-line text-navy hover:border-navy/25 hover:bg-background'
                }`}
              >
                {slippage}%
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AccountPanel({ children, panelRef }: { children: ReactNode; panelRef: RefObject<HTMLElement | null> }) {
  return (
    <section
      ref={panelRef}
      id="ybold-wallet-account-menu"
      role="dialog"
      tabIndex={-1}
      aria-label="Wallet account"
      className="wallet-ui-account-panel fixed inset-x-3 top-20 z-[10000] max-h-[calc(100svh-6rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-[0_18px_55px_rgba(17,27,77,0.16)] focus:outline-none sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80"
    >
      {children}
    </section>
  )
}

export function WalletAccountMenu() {
  const { address } = useAccount()
  const { activities } = useWalletActivity()
  const [isOpen, setIsOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [view, setView] = useState<TAccountView>('account')
  const [wasCopied, setWasCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const vaultUserData = useVaultUserData({
    account: address,
    assetAddress: BOLD,
    chainId: 1,
    stakingAddress: ST_YBOLD,
    stakingSource: 'yBOLD',
    vaultAddress: YBOLD
  })
  const { getUsdPrice, isLoading: isSpotPriceLoading } = useVaultWidgetSpotPrices(YBOLD_PRICE_TOKENS)
  const recentActivity = useMemo(() => selectRecentYboldWalletActivities(activities, address), [activities, address])
  const positionValue = useMemo(
    () => Number(formatUnits(vaultUserData.depositedValue, 18)) * getUsdPrice(YBOLD_PRICE_TOKENS[0]),
    [getUsdPrice, vaultUserData.depositedValue]
  )

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    setView('account')
    setWasCopied(false)
  }, [])

  // This anchored account surface needs browser focus, click-away, and escape-key handling.
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const focusFrame = requestAnimationFrame(() => panelRef.current?.focus())
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        closeMenu()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
        requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, isOpen])

  const handleCopy = useCallback(async () => {
    if (!address) {
      return
    }

    try {
      await navigator.clipboard.writeText(address)
      setWasCopied(true)
    } catch {
      setWasCopied(false)
    }
  }, [address])

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true)

    try {
      await appKit.disconnect('eip155')
      closeMenu()
    } catch {
      // Keep the menu open when the connector cannot complete disconnection.
    } finally {
      setIsDisconnecting(false)
    }
  }, [closeMenu])

  if (!address) {
    return null
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Open wallet account ${address}`}
        aria-controls="ybold-wallet-account-menu"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
        className="min-h-10 rounded-full border border-navy px-4 py-2 font-mono text-sm font-medium text-navy transition duration-150 hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn"
      >
        {formatWalletAddress(address)}
      </button>

      {isOpen && (
        <AccountPanel panelRef={panelRef}>
          {view === 'account' ? (
            <AccountView
              address={address}
              isBalanceLoading={vaultUserData.isLoading || isSpotPriceLoading}
              isDisconnecting={isDisconnecting}
              onClose={closeMenu}
              onCopy={() => void handleCopy()}
              onDisconnect={() => void handleDisconnect()}
              onSettings={() => setView('settings')}
              positionValue={positionValue}
              recentActivity={recentActivity}
              wasCopied={wasCopied}
            />
          ) : (
            <SettingsView onBack={() => setView('account')} />
          )}
        </AccountPanel>
      )}
    </div>
  )
}
