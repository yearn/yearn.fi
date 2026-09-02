'use client'

import { useAppKit } from '@reown/appkit/react'
import {
  getBrowserWalletLabel,
  getWalletConnectionErrorMessage,
  selectBrowserWalletConnector
} from '@ybold/lib/walletDrawer'
import {
  createContext,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useAccount, useConnect } from 'wagmi'

type TWalletMethod = 'browser' | 'more' | 'walletConnect'

type TCloseWalletDrawerOptions = {
  restoreFocus?: boolean
}

type TWalletDrawerContext = {
  isOpen: boolean
  openWalletDrawer: () => void
  toggleWalletDrawer: () => void
}

const WalletDrawerContext = createContext<TWalletDrawerContext | undefined>(undefined)
const MOBILE_VIEWPORT_QUERY = '(max-width: 639px)'

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
}

function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
}

function BrowserWalletIcon() {
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
      className="group flex min-h-16 w-full items-center gap-3 bg-background px-4 py-3 text-left transition-[background-color,color] duration-150 hover:bg-yearn/[0.06] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-yearn disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-yearn transition-transform duration-150 group-enabled:group-hover:scale-105">
        {isPending ? <Spinner /> : icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-navy">{isPending ? pendingLabel : label}</span>
      {!isPending && detail && <span className="text-xs text-muted">{detail}</span>}
      {!isPending && !detail && (
        <span className="text-muted transition-transform duration-150 group-enabled:group-hover:translate-x-0.5 group-enabled:group-hover:text-yearn">
          <ArrowIcon />
        </span>
      )}
    </button>
  )
}

export function useWalletDrawer(): TWalletDrawerContext {
  const context = useContext(WalletDrawerContext)

  if (!context) {
    throw new Error('useWalletDrawer must be used within WalletDrawerProvider')
  }

  return context
}

export function WalletDrawerProvider({ children }: { children: ReactNode }) {
  const { open: openAppKit } = useAppKit()
  const { isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const [isOpen, setIsOpen] = useState(false)
  const [hasLegacyInjectedProvider, setHasLegacyInjectedProvider] = useState(false)
  const [mobileViewport, setMobileViewport] = useState(isMobileViewport)
  const [pendingMethod, setPendingMethod] = useState<TWalletMethod>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const dialogRef = useRef<HTMLElement>(null)
  const operationIdRef = useRef(0)
  const restoreFocusOnCloseRef = useRef(true)
  const titleId = useId()
  const descriptionId = useId()
  const browserConnectorCandidate = useMemo(() => selectBrowserWalletConnector(connectors), [connectors])
  const browserConnector =
    browserConnectorCandidate?.id === 'injected' && !hasLegacyInjectedProvider ? undefined : browserConnectorCandidate
  const browserWalletLabel = getBrowserWalletLabel(browserConnector)

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

  const closeWalletDrawer = useCallback((options?: TCloseWalletDrawerOptions) => {
    operationIdRef.current += 1
    restoreFocusOnCloseRef.current = options?.restoreFocus ?? true
    setErrorMessage(undefined)
    setPendingMethod(undefined)
    setIsOpen(false)
  }, [])

  const openWalletDrawer = useCallback(() => {
    operationIdRef.current += 1
    restoreFocusOnCloseRef.current = true
    setErrorMessage(undefined)
    setPendingMethod(undefined)
    setIsOpen(true)
  }, [])

  const toggleWalletDrawer = useCallback(() => {
    if (isOpen) {
      closeWalletDrawer()
      return
    }

    openWalletDrawer()
  }, [closeWalletDrawer, isOpen, openWalletDrawer])

  // A successful connection can complete outside this component, so mirror that external state into the picker.
  useEffect(() => {
    if (isConnected && isOpen) {
      closeWalletDrawer()
    }
  }, [closeWalletDrawer, isConnected, isOpen])

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

  const connectBrowserWallet = useCallback(async () => {
    if (!browserConnector) {
      setErrorMessage('No browser wallet was detected. Enable an extension or use WalletConnect.')
      return
    }

    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    setPendingMethod('browser')
    setErrorMessage(undefined)

    try {
      await connectAsync({ connector: browserConnector })

      if (operationIdRef.current === operationId) {
        closeWalletDrawer()
      }
    } catch (error) {
      if (operationIdRef.current === operationId) {
        setErrorMessage(getWalletConnectionErrorMessage(error))
      }
    } finally {
      if (operationIdRef.current === operationId) {
        setPendingMethod(undefined)
      }
    }
  }, [browserConnector, closeWalletDrawer, connectAsync])

  const openReownView = useCallback(
    async (method: Extract<TWalletMethod, 'more' | 'walletConnect'>) => {
      const operationId = operationIdRef.current + 1
      operationIdRef.current = operationId
      restoreFocusOnCloseRef.current = false
      setPendingMethod(method)
      setErrorMessage(undefined)

      // AppKit owns the next surface, so remove this picker before asking it to open.
      setIsOpen(false)

      try {
        await openAppKit({
          namespace: 'eip155',
          view: method === 'walletConnect' ? 'ConnectingWalletConnectBasic' : 'AllWallets'
        })
      } catch (error) {
        if (operationIdRef.current === operationId) {
          setErrorMessage(getWalletConnectionErrorMessage(error))
          setIsOpen(true)
        }
      } finally {
        if (operationIdRef.current === operationId) {
          setPendingMethod(undefined)
        }
      }
    },
    [openAppKit]
  )

  const contextValue = useMemo(
    () => ({ isOpen, openWalletDrawer, toggleWalletDrawer }),
    [isOpen, openWalletDrawer, toggleWalletDrawer]
  )
  const allMethodsDisabled = pendingMethod !== undefined

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeWalletDrawer({ restoreFocus: false })
    }
  }

  return (
    <WalletDrawerContext.Provider value={contextValue}>
      <div className="contents" inert={isOpen && mobileViewport ? true : undefined}>
        {children}
      </div>
      {isOpen && (
        <>
          <div
            aria-hidden
            className="ybold-wallet-backdrop fixed inset-0 z-[9999] bg-navy/40 sm:hidden"
            onMouseDown={handleBackdropMouseDown}
          />
          <section
            id="ybold-wallet-picker"
            ref={dialogRef}
            data-wallet-drawer
            role="dialog"
            tabIndex={-1}
            aria-modal={mobileViewport || undefined}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="ybold-wallet-panel fixed inset-x-0 bottom-0 z-[10000] flex max-h-[calc(100svh-0.75rem)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-line bg-surface focus:outline-none sm:inset-x-auto sm:top-24 sm:right-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] sm:bottom-auto sm:w-[23rem] sm:rounded-2xl sm:border"
          >
            <div className="flex justify-center pt-2 sm:hidden">
              <span className="h-1 w-9 rounded-full bg-navy/15" />
            </div>

            <header className="flex items-center justify-between px-5 pt-4 pb-3 sm:px-4 sm:pt-4 sm:pb-3">
              <h2 id={titleId} className="text-base font-medium tracking-tight text-navy">
                Connect a wallet
              </h2>
              <button
                type="button"
                aria-label="Close wallet picker"
                onClick={() => closeWalletDrawer()}
                className="flex size-10 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn sm:hidden"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="overflow-y-auto px-4 pb-4">
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                <WalletMethodButton
                  label={browserWalletLabel}
                  pendingLabel={`Waiting for ${browserWalletLabel}…`}
                  detail={browserConnector ? 'Detected' : 'Not detected'}
                  disabled={allMethodsDisabled || !browserConnector}
                  icon={<BrowserWalletIcon />}
                  isPending={pendingMethod === 'browser'}
                  onClick={() => void connectBrowserWallet()}
                />
                <WalletMethodButton
                  label="WalletConnect"
                  pendingLabel="Opening WalletConnect…"
                  disabled={allMethodsDisabled}
                  icon={<WalletConnectIcon />}
                  isPending={pendingMethod === 'walletConnect'}
                  onClick={() => void openReownView('walletConnect')}
                />
                <WalletMethodButton
                  label="More wallets"
                  pendingLabel="Opening wallet list…"
                  disabled={allMethodsDisabled}
                  icon={<WalletGridIcon />}
                  isPending={pendingMethod === 'more'}
                  onClick={() => void openReownView('more')}
                />
              </div>

              {errorMessage && (
                <p role="alert" className="mt-3 rounded-lg bg-bad/10 px-3 py-2.5 text-sm leading-5 text-bad">
                  {errorMessage}
                </p>
              )}

              <p id={descriptionId} className="mt-3 px-1 text-xs leading-5 text-muted">
                yBOLD never asks for a recovery phrase.
              </p>
            </div>
          </section>
        </>
      )}
    </WalletDrawerContext.Provider>
  )
}
