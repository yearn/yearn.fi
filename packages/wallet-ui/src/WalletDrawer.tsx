'use client'

import {
  connectionErrorCategory,
  createWalletAnalytics,
  type TWalletAnalytics,
  type TWalletPath
} from '@yearn/wallet-ui/analytics'
import { restorePreviousAccount } from '@yearn/wallet-ui/connectionCleanup'
import {
  getBrowserWalletIcon,
  getBrowserWalletLabel,
  getWalletConnectionErrorMessage,
  isMobileWalletBrowser,
  selectBrowserWalletConnectors
} from '@yearn/wallet-ui/connectors'
import { DEFAULT_WALLET_DRAWER_ID, WalletDrawerContext } from '@yearn/wallet-ui/context'
import { cancelWalletReconnect } from '@yearn/wallet-ui/WalletProvider'
import { WalletQr } from '@yearn/wallet-ui/WalletQr'
import { WalletSurface } from '@yearn/wallet-ui/WalletSurface'
import { CURATED_WALLETS, getWalletAppLink, rememberWalletApp, type TWalletOption } from '@yearn/wallet-ui/wallets'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Connector, ConnectorAlreadyConnectedError, useAccount, useConfig, useConnect } from 'wagmi'
import { getAccount, watchAccount } from 'wagmi/actions'

export type TWalletDrawerProviderProps = {
  onAnalytics?: TWalletAnalytics
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
  superseded: boolean
  previousConnector?: Connector
  uri?: string
  tracked: ReturnType<ReturnType<typeof createWalletAnalytics>['start']>
  analyticsConnector: Connector
}

function MethodIcon({ icon, kind }: { icon?: string; kind?: 'walletConnect' | 'more' }) {
  if (icon) return <img aria-hidden src={icon} alt="" className="size-6 rounded-md" />
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
  onAnalytics,
  additionalConnectorIds = EMPTY_CONNECTOR_IDS,
  children,
  desktopRight = 'max(1.5rem,calc((100vw-72rem)/2+1.5rem))',
  desktopTop = '6rem',
  dialogId = DEFAULT_WALLET_DRAWER_ID,
  themeClassName = ''
}: TWalletDrawerProviderProps) {
  const config = useConfig()
  const { isConnected, connector: connectedConnector } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const walletConnect = connectors.find((connector) => connector.type === 'walletConnect')
  const [isOpen, setIsOpen] = useState(false)
  const [screen, setScreen] = useState<'picker' | 'wallets' | 'connect'>('picker')
  const [selectedWallet, setSelectedWallet] = useState<TWalletOption>()
  const [uri, setUri] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [hasLegacyProvider, setHasLegacyProvider] = useState(false)
  const [pendingConnector, setPendingConnector] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const attemptRef = useRef<TConnectionAttempt | undefined>(undefined)
  const inFlightAttemptsRef = useRef(new Set<TConnectionAttempt>())
  const pairingRef = useRef<TConnectionAttempt | undefined>(undefined)
  const analyticsCallback = useRef(onAnalytics)
  // The host callback changes independently of the lifetime of a wallet attempt.
  useEffect(() => {
    analyticsCallback.current = onAnalytics
  }, [onAnalytics])
  const [analytics] = useState(() => createWalletAnalytics((event, props) => analyticsCallback.current?.(event, props)))
  const displayedConnectors = selectBrowserWalletConnectors(connectors, { additionalConnectorIds }).filter(
    (connector) => connector.id !== 'injected' || hasLegacyProvider
  )

  const hideWalletDrawer = useCallback(() => {
    attemptRef.current = undefined
    setPendingConnector(undefined)
    setErrorMessage(undefined)
    setIsOpen(false)
  }, [])
  const closeWalletDrawer = useCallback(() => {
    analytics.close()
    hideWalletDrawer()
  }, [analytics, hideWalletDrawer])

  // The legacy provider is a browser capability and cannot be checked during server rendering.
  useEffect(() => {
    setHasLegacyProvider(Boolean((window as Window & { ethereum?: unknown }).ethereum))
  }, [])

  // A view change can remove the focused button; keep keyboard focus and scroll inside the same surface.
  useEffect(() => {
    if (!isOpen) return
    const dialog = document.getElementById(dialogId)
    dialog?.focus()
    const content = dialog?.querySelector('[data-wallet-content]')
    if (content) content.scrollTop = 0
  }, [dialogId, isOpen, screen])

  // Provider prompts cannot be cancelled. Track the account displaced by an obsolete response.
  useEffect(
    () =>
      watchAccount(config, {
        onChange(account, previousAccount) {
          if (account.status !== 'connected' || account.connector?.uid === previousAccount.connector?.uid) return
          const attempts = Array.from(inFlightAttemptsRef.current).filter(
            ({ connector }) => connector.uid === account.connector?.uid
          )
          if (attempts.some((attempt) => attemptRef.current === attempt)) {
            // Multiple prompts from the same extension are ambiguous until their individual promises settle.
            if (attempts.length === 1) {
              analytics.finish(attempts[0].tracked, 'success', attempts[0].analyticsConnector, account.chainId)
              hideWalletDrawer()
            }
            return
          }
          attempts.forEach((attempt) => {
            attempt.superseded = true
            attempt.previousConnector = previousAccount.connector
          })
        }
      }),
    [analytics, config, hideWalletDrawer]
  )

  const openWalletDrawer = useCallback(() => {
    attemptRef.current = undefined
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const entry = trigger?.closest('[data-wallet-entry]')?.getAttribute('data-wallet-entry')
    analytics.open({
      entry_point: entry === 'header' || entry === 'widget' || entry === 'portfolio' ? entry : 'other',
      device: isMobileWalletBrowser() ? 'mobile' : 'desktop'
    })
    setScreen('picker')
    setPendingConnector(undefined)
    setErrorMessage(undefined)
    setIsOpen(true)
  }, [analytics])
  const toggleWalletDrawer = useCallback(() => {
    if (isOpen) closeWalletDrawer()
    else openWalletDrawer()
  }, [closeWalletDrawer, isOpen, openWalletDrawer])

  // Restored sessions close an idle picker; pending requests are owned by their scoped promise/account event.
  useEffect(() => {
    const obsolete = Array.from(inFlightAttemptsRef.current).some(
      (attempt) => attempt.superseded && attempt.connector.uid === connectedConnector?.uid
    )
    if (isConnected && !attemptRef.current && !obsolete) closeWalletDrawer()
  }, [closeWalletDrawer, connectedConnector?.uid, isConnected])
  // A failed relay can leave the SDK waiting indefinitely before producing a QR code.
  useEffect(() => {
    if (screen !== 'connect' || !pendingConnector || uri) return
    const timeout = setTimeout(() => {
      setPendingConnector(undefined)
      setErrorMessage('WalletConnect is taking too long. Check your connection and try again.')
    }, 30000)
    return () => clearTimeout(timeout)
  }, [pendingConnector, screen, uri])
  // Invalidate ownership when unmounting; a late approval must not reconnect an abandoned screen.
  useEffect(
    () => () => {
      attemptRef.current = undefined
      inFlightAttemptsRef.current.forEach((attempt) => {
        attempt.superseded = true
      })
      analytics.close()
    },
    [analytics]
  )

  const connectWallet = async (connector: Connector, path: TWalletPath, wallet?: TWalletOption) => {
    const active = analytics.active()
    const tracked =
      path !== 'detected' && active?.path === path && !active.finished
        ? active
        : analytics.start(path, connector, displayedConnectors)
    cancelWalletReconnect(config, connector)
    setPendingConnector(connector.uid)
    setErrorMessage(undefined)
    const isPairing = connector.type === 'walletConnect'
    if (isPairing) {
      if (!pairingRef.current) rememberWalletApp()
      setScreen('connect')
      setSelectedWallet(wallet)
      setCopied(false)
      setUri(pairingRef.current?.uri)
      // The SDK has no cancellable pairing API. Resume one outstanding request instead of creating overlapping sessions.
      if (pairingRef.current) {
        pairingRef.current.tracked = tracked
        pairingRef.current.analyticsConnector = wallet ? { ...connector, name: wallet.name } : connector
        pairingRef.current.superseded = false
        attemptRef.current = pairingRef.current
        return
      }
    }
    const attempt: TConnectionAttempt = {
      connector,
      superseded: false,
      tracked,
      analyticsConnector: wallet ? { ...connector, name: wallet.name } : connector
    }
    attemptRef.current = attempt
    inFlightAttemptsRef.current.add(attempt)
    const onMessage = ({ type, data }: { type: string; data?: unknown }) => {
      if (type !== 'display_uri' || typeof data !== 'string' || !data.startsWith('wc:')) return
      attempt.uri = data
      if (attemptRef.current === attempt) {
        setUri(data)
        setErrorMessage(undefined)
        setPendingConnector(connector.uid)
      }
    }
    if (isPairing) {
      pairingRef.current = attempt
      connector.emitter.on('message', onMessage)
    }
    try {
      const result = await connectAsync({ connector })
      if (attemptRef.current === attempt) {
        analytics.finish(attempt.tracked, 'success', attempt.analyticsConnector, result?.chainId)
        hideWalletDrawer()
      } else if (attempt.superseded) {
        await restorePreviousAccount(config, attempt)
      }
    } catch (error) {
      if (attemptRef.current === attempt) {
        if (error instanceof ConnectorAlreadyConnectedError && getAccount(config).connector?.uid === connector.uid) {
          analytics.finish(attempt.tracked, 'success', attempt.analyticsConnector, getAccount(config).chainId)
          hideWalletDrawer()
        } else {
          const category = connectionErrorCategory(error)
          analytics.finish(
            attempt.tracked,
            category === 'rejected' ? 'rejected' : 'error',
            attempt.analyticsConnector,
            undefined,
            category
          )
          setUri(undefined)
          setErrorMessage(getWalletConnectionErrorMessage(error))
        }
      }
    } finally {
      if (isPairing) {
        connector.emitter.off('message', onMessage)
        pairingRef.current = undefined
      }
      inFlightAttemptsRef.current.delete(attempt)
      if (attemptRef.current === attempt) {
        attemptRef.current = undefined
        setPendingConnector(undefined)
      }
    }
  }

  const openWalletList = (path: TWalletPath) => {
    attemptRef.current = undefined
    setPendingConnector(undefined)
    analytics.start(path, undefined, displayedConnectors)
    setScreen('wallets')
    setErrorMessage(undefined)
  }
  const back = () => {
    analytics.finish(analytics.active(), 'closed_without_connection')
    attemptRef.current = undefined
    setPendingConnector(undefined)
    setErrorMessage(undefined)
    setScreen(screen === 'connect' && selectedWallet ? 'wallets' : 'picker')
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
  const appLink = uri && selectedWallet ? getWalletAppLink(selectedWallet, uri, isMobileWalletBrowser()) : undefined
  const linkClassName =
    'rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-primary hover:bg-app focus-visible:outline-2 focus-visible:outline-primary'

  return (
    <WalletDrawerContext.Provider value={contextValue}>
      {children}
      <WalletSurface
        isOpen={isOpen}
        onClose={closeWalletDrawer}
        dialogId={dialogId}
        title="Connect a wallet"
        hideTitle
        desktopRight={desktopRight}
        desktopTop={desktopTop}
        themeClassName={themeClassName}
      >
        {screen !== 'picker' && (
          <button type="button" onClick={back} className={`mb-3 ${linkClassName}`}>
            ‹ Back
          </button>
        )}
        {screen === 'picker' && (
          <>
            <p className="sr-only">Choose an installed browser wallet, WalletConnect, or another supported wallet.</p>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {displayedConnectors.length ? (
                displayedConnectors.map((connector) => (
                  <WalletMethodButton
                    key={connector.uid}
                    label={getBrowserWalletLabel(connector)}
                    detail="Detected"
                    icon={<MethodIcon icon={getBrowserWalletIcon(connector)} />}
                    disabled={pendingConnector === connector.uid}
                    isPending={pendingConnector === connector.uid}
                    onClick={() => void connectWallet(connector, 'detected')}
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
              <WalletMethodButton
                label="WalletConnect"
                detail={walletConnect ? undefined : 'Unavailable'}
                icon={<MethodIcon kind="walletConnect" />}
                disabled={!walletConnect}
                onClick={() => {
                  if (!walletConnect) return
                  if (isMobileWalletBrowser()) openWalletList('walletconnect')
                  else void connectWallet(walletConnect, 'walletconnect')
                }}
              />
              <WalletMethodButton
                label="More wallets"
                icon={<MethodIcon kind="more" />}
                disabled={!walletConnect}
                onClick={() => openWalletList('more_wallets')}
              />
            </div>
          </>
        )}
        {screen === 'wallets' && (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {CURATED_WALLETS.map((wallet) => {
              const detected = displayedConnectors.find(({ id }) => id === wallet.rdns)
              return (
                <WalletMethodButton
                  key={wallet.id}
                  label={wallet.name}
                  detail={detected ? 'Detected' : undefined}
                  icon={<MethodIcon icon={wallet.icon} />}
                  onClick={() => {
                    const connector = detected ?? walletConnect
                    if (connector) void connectWallet(connector, analytics.active()?.path ?? 'more_wallets', wallet)
                  }}
                />
              )
            })}
            {walletConnect && (
              <WalletMethodButton
                label="Use a QR code"
                icon={<MethodIcon kind="walletConnect" />}
                onClick={() => void connectWallet(walletConnect, analytics.active()?.path ?? 'walletconnect')}
              />
            )}
          </div>
        )}
        {screen === 'connect' && (
          <div className="space-y-4">
            <p className="text-center text-sm text-text-secondary">
              {uri
                ? `Scan with ${selectedWallet?.name ?? 'your wallet'} to connect.`
                : pendingConnector
                  ? 'Opening a secure connection…'
                  : 'Try connecting again when you are ready.'}
            </p>
            {uri ? (
              <>
                <WalletQr key={uri} uri={uri} />
                <div className="flex flex-col gap-2">
                  {appLink && (
                    <a
                      href={appLink}
                      onClick={() => rememberWalletApp(selectedWallet, isMobileWalletBrowser())}
                      className={linkClassName}
                    >
                      Open {selectedWallet?.name}
                    </a>
                  )}
                  <button
                    type="button"
                    className={linkClassName}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(uri)
                        setCopied(true)
                      } catch {
                        setErrorMessage('The link could not be copied. Please scan the QR code instead.')
                      }
                    }}
                  >
                    {copied ? 'Copied' : 'Copy connection link'}
                  </button>
                </div>
              </>
            ) : !pendingConnector && walletConnect ? (
              <button
                type="button"
                className={`w-full ${linkClassName}`}
                onClick={() =>
                  void connectWallet(walletConnect, selectedWallet ? 'more_wallets' : 'walletconnect', selectedWallet)
                }
              >
                Try again
              </button>
            ) : (
              <p role="status" className="py-8 text-center text-sm text-text-secondary">
                Waiting for WalletConnect…
              </p>
            )}
            {selectedWallet && (
              <a
                href={
                  /Android/i.test(navigator.userAgent)
                    ? (selectedWallet.androidDownloadUrl ?? selectedWallet.downloadUrl)
                    : selectedWallet.downloadUrl
                }
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs text-text-secondary underline"
              >
                Get {selectedWallet.name}
              </a>
            )}
          </div>
        )}
        {errorMessage && (
          <p role="alert" className="mt-3 rounded-lg bg-error/10 px-3 py-2.5 text-sm leading-5 text-error">
            {errorMessage}
          </p>
        )}
      </WalletSurface>
    </WalletDrawerContext.Provider>
  )
}
