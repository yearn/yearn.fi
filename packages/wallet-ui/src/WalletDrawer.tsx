'use client'

import { useAppKit, useAppKitState, useAppKitTheme } from '@reown/appkit/react'
import {
  connectEvmWalletWithAppKit,
  getBrowserWalletLabel,
  getWalletConnectionErrorMessage,
  selectBrowserWalletConnectors,
  type TEvmAppKitConnectionClient
} from '@yearn/wallet-ui/connectors'
import { DEFAULT_WALLET_DRAWER_ID, WalletDrawerContext } from '@yearn/wallet-ui/context'
import { ReownWalletModalOverrides } from '@yearn/wallet-ui/ReownWalletModalOverrides'
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useAccount, useConnect, type Connector as WagmiConnector } from 'wagmi'

export {
  DEFAULT_WALLET_DRAWER_ID,
  type TWalletDrawerContext,
  useWalletDrawer
} from '@yearn/wallet-ui/context'

type TWalletAction = { type: 'connector'; connector: WagmiConnector } | { type: 'more' | 'walletConnect' }

type TCloseWalletDrawerOptions = {
  force?: boolean
  restoreFocus?: boolean
}

export type TWalletDrawerProviderProps = {
  additionalConnectorIds?: readonly string[]
  appKit: TEvmAppKitConnectionClient
  appKitTheme?: 'dark' | 'light'
  children: ReactNode
  desktopRight?: string
  desktopTop?: string
  dialogId?: string
  themeClassName?: string
}

type TWalletDrawerStyle = CSSProperties & {
  '--wallet-ui-desktop-right': string
  '--wallet-ui-desktop-top': string
}

const MOBILE_VIEWPORT_QUERY = '(max-width: 639px)'
const EMPTY_CONNECTOR_IDS: readonly string[] = []

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
}

function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
}

function BrowserWalletIcon({ icon }: { icon?: string }) {
  if (icon) {
    return <img aria-hidden src={icon} alt="" className="size-6 rounded-md" />
  }

  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M3.5 9h17M7 7h.01M10 7h.01" strokeLinecap="round" />
    </svg>
  )
}

function WalletConnectIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      <path
        d="M5.2 9.4a9.6 9.6 0 0 1 13.6 0M7.8 12a6 6 0 0 1 8.4 0M10.5 14.7a2.2 2.2 0 0 1 3 0"
        strokeLinecap="round"
      />
      <path d="m7.2 14.8 4.8 4.1 4.8-4.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WalletGridIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8">
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2">
      <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  )
}

function WalletMethodButton({
  detail,
  disabled,
  icon,
  isPending,
  label,
  onClick,
  pendingLabel
}: {
  detail?: string
  disabled: boolean
  icon: ReactNode
  isPending: boolean
  label: string
  onClick: () => void
  pendingLabel: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={isPending || undefined}
      onClick={onClick}
      className="group flex min-h-16 w-full items-center gap-3 bg-app px-4 py-3 text-left transition-[background-color,color] duration-150 hover:bg-primary/[0.06] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary transition-transform duration-150 group-enabled:group-hover:scale-105">
        {isPending ? <Spinner /> : icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-text-primary">{isPending ? pendingLabel : label}</span>
      {!isPending && detail && <span className="text-xs text-text-secondary">{detail}</span>}
      {!isPending && !detail && (
        <span className="text-text-secondary transition-transform duration-150 group-enabled:group-hover:translate-x-0.5 group-enabled:group-hover:text-primary">
          <ArrowIcon />
        </span>
      )}
    </button>
  )
}

export function WalletDrawerProvider({
  additionalConnectorIds = EMPTY_CONNECTOR_IDS,
  appKit,
  appKitTheme = 'light',
  children,
  desktopRight = 'max(1.5rem,calc((100vw-72rem)/2+1.5rem))',
  desktopTop = '6rem',
  dialogId = DEFAULT_WALLET_DRAWER_ID,
  themeClassName = ''
}: TWalletDrawerProviderProps) {
  const { open: openAppKit } = useAppKit()
  const { connectingWallet } = useAppKitState()
  const { setThemeMode } = useAppKitTheme()
  const { isConnected } = useAccount()
  const { connectors } = useConnect()
  const [isOpen, setIsOpen] = useState(false)
  const [hasLegacyInjectedProvider, setHasLegacyInjectedProvider] = useState(false)
  const [mobileViewport, setMobileViewport] = useState(isMobileViewport)
  const [pendingAction, setPendingAction] = useState<TWalletAction>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const dialogRef = useRef<HTMLElement>(null)
  const pendingActionRef = useRef<TWalletAction>(undefined)
  const restoreFocusOnCloseRef = useRef(true)
  const titleId = useId()
  const descriptionId = useId()
  const displayedConnectors = useMemo(
    () =>
      selectBrowserWalletConnectors(connectors, { additionalConnectorIds }).filter(
        (connector) => connector.id !== 'injected' || hasLegacyInjectedProvider
      ),
    [additionalConnectorIds, connectors, hasLegacyInjectedProvider]
  )
  const drawerStyle = useMemo<TWalletDrawerStyle>(
    () => ({
      '--wallet-ui-desktop-right': desktopRight,
      '--wallet-ui-desktop-top': desktopTop
    }),
    [desktopRight, desktopTop]
  )

  // Wallet providers and viewport mode are browser capabilities, so they are synchronized after hydration.
  useEffect(() => {
    const browserWindow = window as Window & { ethereum?: unknown }
    const viewportQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY)
    const updateViewport = () => setMobileViewport(viewportQuery.matches)

    setHasLegacyInjectedProvider(Boolean(browserWindow.ethereum))
    updateViewport()
    viewportQuery.addEventListener('change', updateViewport)

    return () => viewportQuery.removeEventListener('change', updateViewport)
  }, [])

  // AppKit's follow-on modal lives outside this tree, so synchronize its theme imperatively.
  useEffect(() => {
    setThemeMode(appKitTheme)
  }, [appKitTheme, setThemeMode])

  const closeWalletDrawer = useCallback((options?: TCloseWalletDrawerOptions) => {
    if (pendingActionRef.current && !options?.force) {
      return
    }

    pendingActionRef.current = undefined
    restoreFocusOnCloseRef.current = options?.restoreFocus ?? true
    setErrorMessage(undefined)
    setPendingAction(undefined)
    setIsOpen(false)
  }, [])

  const openWalletDrawer = useCallback(() => {
    if (pendingActionRef.current) {
      return
    }

    restoreFocusOnCloseRef.current = true
    setErrorMessage(undefined)
    setIsOpen(true)
  }, [])

  const toggleWalletDrawer = useCallback(() => {
    if (isOpen) {
      closeWalletDrawer()
      return
    }

    openWalletDrawer()
  }, [closeWalletDrawer, isOpen, openWalletDrawer])

  // Wagmi can connect before AppKit's headless promise settles; reconcile that external lifecycle here.
  useEffect(() => {
    if (!isConnected) {
      return
    }

    if (connectingWallet) {
      appKit.resetConnectingWallet()
    }

    if (isOpen) {
      closeWalletDrawer({ force: true })
    }
  }, [appKit, closeWalletDrawer, connectingWallet, isConnected, isOpen])

  // The adaptive surface needs imperative focus, escape, click-away, and mobile scroll-lock behavior.
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const previousOverflow = document.body.style.overflow
    const focusFrame = requestAnimationFrame(() => dialogRef.current?.focus())

    if (mobileViewport) {
      document.body.style.overflow = 'hidden'
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (
        mobileViewport ||
        !(target instanceof Node) ||
        dialogRef.current?.contains(target) ||
        (target instanceof Element && target.closest('[data-wallet-drawer-trigger]'))
      ) {
        return
      }

      closeWalletDrawer({ restoreFocus: false })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeWalletDrawer()
        return
      }

      if (!mobileViewport || event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)

      if (!firstElement || !lastElement) {
        return
      }

      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault()
        const nextElement = event.shiftKey ? lastElement : firstElement
        nextElement.focus()
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)

      if (restoreFocusOnCloseRef.current) {
        previousFocus?.focus()
      }
    }
  }, [closeWalletDrawer, isOpen, mobileViewport])

  const runWalletAction = useCallback(
    async (action: TWalletAction) => {
      if (pendingActionRef.current) {
        return
      }

      pendingActionRef.current = action
      setPendingAction(action)
      setErrorMessage(undefined)
      const opensModal = action.type !== 'connector'
      if (opensModal) {
        // AppKit owns the next surface; don't stack the picker underneath it or steal its focus.
        restoreFocusOnCloseRef.current = false
        setIsOpen(false)
      }

      try {
        if (action.type === 'connector') {
          await connectEvmWalletWithAppKit(appKit, action.connector)
        } else {
          await openAppKit({
            namespace: 'eip155',
            view: action.type === 'walletConnect' ? 'ConnectingWalletConnectBasic' : 'AllWallets'
          })
        }

        if (pendingActionRef.current === action) {
          closeWalletDrawer({ force: true, restoreFocus: !opensModal })
        }
      } catch (error) {
        if (pendingActionRef.current === action) {
          setErrorMessage(getWalletConnectionErrorMessage(error))
          setIsOpen(true)
        }
      } finally {
        if (pendingActionRef.current === action) {
          pendingActionRef.current = undefined
          setPendingAction(undefined)
        }
      }
    },
    [appKit, closeWalletDrawer, openAppKit]
  )

  // Loading belongs to our active action, not a transport that can outlive its closed QR modal.
  const isConnecting = !isConnected && Boolean(pendingAction)
  const contextValue = useMemo(
    () => ({ dialogId, isConnecting, isOpen, openWalletDrawer, toggleWalletDrawer }),
    [dialogId, isConnecting, isOpen, openWalletDrawer, toggleWalletDrawer]
  )
  const allMethodsDisabled = Boolean(pendingAction)

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeWalletDrawer({ restoreFocus: false })
    }
  }

  return (
    <WalletDrawerContext.Provider value={contextValue}>
      <ReownWalletModalOverrides />
      <div className="contents" inert={isOpen && mobileViewport ? true : undefined}>
        {children}
      </div>
      {isOpen && (
        <>
          <div
            aria-hidden
            className="wallet-ui-backdrop fixed inset-0 z-[9999] bg-modal-overlay sm:hidden"
            onMouseDown={handleBackdropMouseDown}
          />
          <section
            id={dialogId}
            ref={dialogRef}
            data-wallet-drawer
            role="dialog"
            tabIndex={-1}
            aria-modal={mobileViewport || undefined}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            style={drawerStyle}
            className={`wallet-ui-panel fixed inset-x-0 bottom-0 z-[10000] flex max-h-[calc(100svh-0.75rem)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-surface focus:outline-none sm:inset-x-auto sm:top-[var(--wallet-ui-desktop-top)] sm:right-[var(--wallet-ui-desktop-right)] sm:bottom-auto sm:w-[23rem] sm:rounded-2xl sm:border ${themeClassName}`}
          >
            <div className="flex justify-center pt-2 sm:hidden">
              <span className="h-1 w-9 rounded-full bg-text-primary/15" />
            </div>

            <header className="flex items-center justify-between px-5 pt-4 pb-3 sm:px-4 sm:pt-4 sm:pb-3">
              <h2 id={titleId} className="text-base font-medium tracking-tight text-text-primary">
                Connect a wallet
              </h2>
              <button
                type="button"
                aria-label="Close wallet picker"
                disabled={allMethodsDisabled}
                onClick={() => closeWalletDrawer()}
                className="flex size-10 items-center justify-center rounded-full text-text-secondary transition hover:bg-app hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 sm:hidden"
              >
                <CloseIcon />
              </button>
            </header>

            <p id={descriptionId} className="sr-only">
              Choose an installed browser wallet, WalletConnect, or another supported wallet.
            </p>

            <div className="overflow-y-auto px-4 pb-4">
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {displayedConnectors.length > 0 ? (
                  displayedConnectors.map((selectedConnector) => {
                    const walletLabel = getBrowserWalletLabel(selectedConnector)

                    return (
                      <WalletMethodButton
                        key={selectedConnector.uid}
                        label={walletLabel}
                        pendingLabel={`Waiting for ${walletLabel}…`}
                        detail="Detected"
                        disabled={allMethodsDisabled}
                        icon={<BrowserWalletIcon icon={selectedConnector.icon} />}
                        isPending={
                          pendingAction?.type === 'connector' && pendingAction.connector.uid === selectedConnector.uid
                        }
                        onClick={() => void runWalletAction({ type: 'connector', connector: selectedConnector })}
                      />
                    )
                  })
                ) : (
                  <WalletMethodButton
                    label="Browser wallet"
                    pendingLabel="Waiting for browser wallet…"
                    detail="Not detected"
                    disabled
                    icon={<BrowserWalletIcon />}
                    isPending={false}
                    onClick={() => undefined}
                  />
                )}
                <WalletMethodButton
                  label="WalletConnect"
                  pendingLabel="Opening WalletConnect…"
                  disabled={allMethodsDisabled}
                  icon={<WalletConnectIcon />}
                  isPending={pendingAction?.type === 'walletConnect'}
                  onClick={() => void runWalletAction({ type: 'walletConnect' })}
                />
                <WalletMethodButton
                  label="More wallets"
                  pendingLabel="Opening wallet list…"
                  disabled={allMethodsDisabled}
                  icon={<WalletGridIcon />}
                  isPending={pendingAction?.type === 'more'}
                  onClick={() => void runWalletAction({ type: 'more' })}
                />
              </div>

              {errorMessage && (
                <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm leading-5 text-error">
                  {errorMessage}
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </WalletDrawerContext.Provider>
  )
}
