'use client'

import { useConnectModal, WalletButton } from '@rainbow-me/rainbowkit'
import { restorePreviousAccount } from '@yearn/wallet-ui/connectionCleanup'
import {
  getBrowserWalletIcon,
  getBrowserWalletLabel,
  getWalletConnectionErrorMessage,
  isMobileWalletBrowser,
  selectBrowserWalletConnectors
} from '@yearn/wallet-ui/connectors'
import { DEFAULT_WALLET_DRAWER_ID, WalletDrawerContext } from '@yearn/wallet-ui/context'
import { WALLETCONNECT_QR_WALLET_ID } from '@yearn/wallet-ui/rainbowkit'
import { cancelWalletReconnect } from '@yearn/wallet-ui/WalletProvider'
import { WalletSurface } from '@yearn/wallet-ui/WalletSurface'
import { type ReactNode, Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { type Connector, ConnectorAlreadyConnectedError, useAccount, useConfig, useConnect } from 'wagmi'
import { getAccount, watchAccount } from 'wagmi/actions'

export { restorePreviousAccount } from '@yearn/wallet-ui/connectionCleanup'

export { DEFAULT_WALLET_DRAWER_ID, type TWalletDrawerContext, useWalletDrawer } from '@yearn/wallet-ui/context'

export type TWalletDrawerProviderProps = {
  additionalConnectorIds?: readonly string[]
  children: ReactNode
  desktopRight?: string
  desktopTop?: string
  dialogId?: string
  themeClassName?: string
}

const EMPTY_CONNECTOR_IDS: readonly string[] = []

type TConnectionAttempt = {
  connector: Connector
  secondary?: boolean
  superseded: boolean
  previousConnector?: Connector
}

type TIconLoader = () => Promise<string>
const iconPromises = new WeakMap<TIconLoader, Promise<string | undefined>>()

function LoadedMethodIcon({ loadIcon }: { loadIcon: TIconLoader }) {
  const promise =
    iconPromises.get(loadIcon) ??
    Promise.resolve()
      .then(loadIcon)
      .catch(() => undefined)
  iconPromises.set(loadIcon, promise)
  return <MethodIcon icon={use(promise)} />
}

function MethodIcon({ icon, kind }: { icon?: string | TIconLoader; kind?: 'walletConnect' | 'more' }) {
  if (typeof icon === 'function') {
    return (
      <Suspense fallback={<MethodIcon />}>
        <LoadedMethodIcon loadIcon={icon} />
      </Suspense>
    )
  }
  if (icon) {
    return <img aria-hidden src={icon} alt="" className="size-6 rounded-md" />
  }
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      {kind === 'walletConnect' ? (
        <path
          d="M5.2 9.4a9.6 9.6 0 0 1 13.6 0M7.8 12a6 6 0 0 1 8.4 0M10.5 14.7a2.2 2.2 0 0 1 3 0m-6.3.1 4.8 4.1 4.8-4.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : kind === 'more' ? (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </>
      ) : (
        <>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <path d="M3.5 9h17M7 7h.01M10 7h.01" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function WalletMethodButton({
  detail,
  disabled,
  icon,
  isPending,
  label,
  onClick
}: {
  detail?: string
  disabled?: boolean
  icon: ReactNode
  isPending?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={isPending || undefined}
      aria-label={isPending ? `Waiting for ${label}…` : `${label}${detail ? ` ${detail}` : ''}`}
      onClick={onClick}
      className="group flex min-h-16 w-full items-center gap-3 bg-app px-4 py-3 text-left transition-colors duration-150 hover:bg-primary/[0.06] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
        {isPending ? (
          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : (
          icon
        )}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-text-primary">
        {isPending ? `Waiting for ${label}…` : label}
      </span>
      {!isPending &&
        (detail ? (
          <span className="text-xs text-text-secondary">{detail}</span>
        ) : (
          <span aria-hidden className="text-text-secondary">
            ›
          </span>
        ))}
    </button>
  )
}

export function WalletDrawerProvider({
  additionalConnectorIds = EMPTY_CONNECTOR_IDS,
  children,
  desktopRight = 'max(1.5rem,calc((100vw-72rem)/2+1.5rem))',
  desktopTop = '6rem',
  dialogId = DEFAULT_WALLET_DRAWER_ID,
  themeClassName = ''
}: TWalletDrawerProviderProps) {
  const { openConnectModal, connectModalOpen } = useConnectModal()
  const config = useConfig()
  const { isConnected } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const hasWalletConnect = connectors.some((connector) => connector.id === 'walletConnect')
  const isMobileBrowser = isMobileWalletBrowser()
  const [isOpen, setIsOpen] = useState(false)
  const [hasLegacyProvider, setHasLegacyProvider] = useState(false)
  const [pendingConnector, setPendingConnector] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const attemptRef = useRef<object | undefined>(undefined)
  const inFlightAttemptsRef = useRef(new Set<TConnectionAttempt>())
  const restoreFocusRef = useRef(true)
  const triggerRef = useRef<HTMLElement | null>(null)
  const wasRainbowModalOpen = useRef(false)
  const handedOff = useRef(false)
  const displayedConnectors = selectBrowserWalletConnectors(connectors, { additionalConnectorIds }).filter(
    (connector) => connector.id !== 'injected' || hasLegacyProvider
  )

  const closeWalletDrawer = useCallback(() => {
    attemptRef.current = undefined
    setPendingConnector(undefined)
    setErrorMessage(undefined)
    setIsOpen(false)
  }, [])

  // The legacy provider is a browser capability and cannot be checked during server rendering.
  useEffect(() => {
    setHasLegacyProvider(Boolean((window as Window & { ethereum?: unknown }).ethereum))
  }, [])

  // Wagmi cannot cancel provider prompts. Remember the account displaced by an obsolete response.
  useEffect(
    () =>
      watchAccount(config, {
        onChange(account, previousAccount) {
          if (account.status !== 'connected' || account.connector?.uid === previousAccount.connector?.uid) {
            return
          }
          const attempts = Array.from(inFlightAttemptsRef.current).filter(
            ({ connector }) => connector.uid === account.connector?.uid
          )
          if (attempts.some((attempt) => attemptRef.current === attempt)) {
            // A matching account can arrive before connectAsync settles. Same-wallet retries remain ambiguous.
            if (attempts.length === 1 && !attempts[0].secondary) {
              closeWalletDrawer()
            }
            attempts
              .filter(({ secondary }) => secondary)
              .forEach((attempt) => {
                inFlightAttemptsRef.current.delete(attempt)
              })
            return
          }
          attempts.forEach((attempt) => {
            attempt.superseded = true
            attempt.previousConnector = previousAccount.connector
            if (attempt.secondary) {
              // RainbowKit owns the QR promise, so reconcile its obsolete result from the public account event.
              void restorePreviousAccount(config, attempt).catch(() => undefined)
              inFlightAttemptsRef.current.delete(attempt)
            }
          })
        }
      }),
    [closeWalletDrawer, config]
  )

  const openWalletDrawer = useCallback(() => {
    attemptRef.current = undefined
    handedOff.current = false
    restoreFocusRef.current = true
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPendingConnector(undefined)
    setErrorMessage(undefined)
    setIsOpen(true)
  }, [])

  const toggleWalletDrawer = useCallback(() => {
    if (isOpen) {
      closeWalletDrawer()
    } else {
      openWalletDrawer()
    }
  }, [closeWalletDrawer, isOpen, openWalletDrawer])

  // Restored sessions close an idle picker; pending attempts require their scoped promise or matching account event.
  useEffect(() => {
    if (isConnected && !pendingConnector) {
      closeWalletDrawer()
    }
  }, [closeWalletDrawer, isConnected, pendingConnector])

  // RainbowKit owns secondary modal lifetime. Its dismissed transport may still be pending.
  useEffect(() => {
    if (wasRainbowModalOpen.current && !connectModalOpen && handedOff.current) {
      handedOff.current = false
      attemptRef.current = undefined
      const trigger = triggerRef.current?.isConnected
        ? triggerRef.current
        : document.querySelector<HTMLElement>(
            '[data-wallet-drawer-trigger], [data-wallet-account-trigger], [data-mobile-nav-trigger]'
          )
      trigger?.focus()
    }
    wasRainbowModalOpen.current = connectModalOpen
  }, [connectModalOpen])

  // Invalidating the token prevents a settled connector promise from updating an unmounted provider.
  useEffect(
    () => () => {
      attemptRef.current = undefined
    },
    []
  )

  const connectDetectedWallet = async (connector: Connector) => {
    cancelWalletReconnect(config, connector)
    const attempt: TConnectionAttempt = { connector, superseded: false }
    attemptRef.current = attempt
    inFlightAttemptsRef.current.add(attempt)
    setPendingConnector(connector.uid)
    setErrorMessage(undefined)
    try {
      // WalletButton.Custom only accepts configured RainbowKit wallets, not EIP-6963 connectors.
      await connectAsync({ connector })
      if (attemptRef.current === attempt) {
        closeWalletDrawer()
      } else if (attempt.superseded) {
        // Restore only the account this stale response displaced, preserving external switches/disconnects.
        await restorePreviousAccount(config, attempt)
      }
    } catch (error) {
      if (attemptRef.current === attempt) {
        // Reconnect can restore this wallet before Wagmi finishes checking the other connectors.
        if (error instanceof ConnectorAlreadyConnectedError && getAccount(config).connector?.uid === connector.uid) {
          closeWalletDrawer()
        } else {
          setErrorMessage(getWalletConnectionErrorMessage(error))
        }
      }
    } finally {
      inFlightAttemptsRef.current.delete(attempt)
      if (attemptRef.current === attempt) {
        attemptRef.current = undefined
        setPendingConnector(undefined)
      }
    }
  }

  const openSecondaryScreen = (open: () => void | Promise<void>, connector?: Connector) => {
    cancelWalletReconnect(config, connector)
    restoreFocusRef.current = false
    handedOff.current = true
    // Release the mobile inert/scroll/focus ownership before RainbowKit opens its own portal.
    flushSync(closeWalletDrawer)
    // More wallets exposes modal lifetime, but its public API does not expose the chosen connection attempt.
    const secondaryAttempt = connector ? { connector, secondary: true, superseded: false } : undefined
    const attempt = secondaryAttempt ?? {}
    attemptRef.current = attempt
    // Each new secondary screen replaces the previous QR intent, including a new More wallets selection.
    Array.from(inFlightAttemptsRef.current)
      .filter(({ secondary }) => secondary)
      .forEach((pending) => {
        inFlightAttemptsRef.current.delete(pending)
      })
    if (secondaryAttempt) {
      inFlightAttemptsRef.current.add(secondaryAttempt)
    }
    void Promise.resolve()
      .then(open)
      .catch(() => {
        if (attemptRef.current !== attempt) {
          return
        }
        handedOff.current = false
        openWalletDrawer()
        setErrorMessage('The wallet could not be opened. Please try again.')
      })
  }

  const contextValue = useMemo(
    () => ({
      dialogId,
      isConnecting: !isConnected && Boolean(pendingConnector),
      isOpen,
      closeWalletDrawer,
      openWalletDrawer,
      toggleWalletDrawer
    }),
    [dialogId, isConnected, pendingConnector, isOpen, closeWalletDrawer, openWalletDrawer, toggleWalletDrawer]
  )

  const renderPicker = (
    connectWalletConnect?: () => void | Promise<void>,
    walletConnectMounted = false,
    walletConnectUid?: string
  ) => (
    <WalletSurface
      isOpen={isOpen}
      onClose={closeWalletDrawer}
      restoreFocus={restoreFocusRef}
      dialogId={dialogId}
      title="Connect a wallet"
      desktopRight={desktopRight}
      desktopTop={desktopTop}
      themeClassName={themeClassName}
    >
      <p className="sr-only">Choose an installed browser wallet, WalletConnect, or another supported wallet.</p>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {displayedConnectors.length ? (
          displayedConnectors.map((connector) => (
            <WalletMethodButton
              key={connector.uid}
              label={getBrowserWalletLabel(connector)}
              detail="Detected"
              icon={<MethodIcon icon={getBrowserWalletIcon(connector, connectors)} />}
              disabled={pendingConnector === connector.uid}
              isPending={pendingConnector === connector.uid}
              onClick={() => void connectDetectedWallet(connector)}
            />
          ))
        ) : (
          <WalletMethodButton
            label="Browser wallet"
            detail="Not detected"
            icon={<MethodIcon />}
            disabled
            onClick={() => undefined}
          />
        )}
        {connectWalletConnect ? (
          <WalletMethodButton
            label="WalletConnect"
            icon={<MethodIcon kind="walletConnect" />}
            // RainbowKit ready also follows stale Wagmi transport state after QR dismissal.
            disabled={!walletConnectMounted || !openConnectModal}
            onClick={() =>
              openSecondaryScreen(
                connectWalletConnect,
                connectors.find(({ uid }) => uid === walletConnectUid)
              )
            }
          />
        ) : (
          <WalletMethodButton
            label="WalletConnect"
            detail="Unavailable"
            icon={<MethodIcon kind="walletConnect" />}
            disabled
            onClick={() => undefined}
          />
        )}
        <WalletMethodButton
          label="More wallets"
          icon={<MethodIcon kind="more" />}
          disabled={!hasWalletConnect || !openConnectModal}
          onClick={() => openConnectModal && openSecondaryScreen(openConnectModal)}
        />
      </div>
      {errorMessage && (
        <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm leading-5 text-error">
          {errorMessage}
        </p>
      )}
    </WalletSurface>
  )

  return (
    <WalletDrawerContext.Provider value={contextValue}>
      {children}
      {hasWalletConnect && !isMobileBrowser ? (
        // Keep RainbowKit's render component mounted while its secondary modal owns the connection.
        <WalletButton.Custom wallet={WALLETCONNECT_QR_WALLET_ID}>
          {({ connect, mounted, connector }) => renderPicker(connect, mounted, connector.uid)}
        </WalletButton.Custom>
      ) : (
        renderPicker(hasWalletConnect ? openConnectModal : undefined, Boolean(openConnectModal))
      )}
    </WalletDrawerContext.Provider>
  )
}
