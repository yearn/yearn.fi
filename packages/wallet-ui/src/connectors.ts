import type { AppKit, WalletItem } from '@reown/appkit/react'

export type TWalletConnectorSummary = {
  icon?: string
  id: string
  name: string
  type: string
}

export type TEvmAppKitConnectionClient = Pick<
  AppKit,
  'connectWallet' | 'getWalletList' | 'ready' | 'resetConnectingWallet'
> &
  Partial<Pick<AppKit, 'subscribeAccount'>>

export type TSelectBrowserWalletConnectorOptions = {
  additionalConnectorIds?: readonly string[]
}

const NON_BROWSER_CONNECTOR_IDS = new Set(['auth', 'baseAccount', 'coinbaseWalletSDK', 'safe', 'walletConnect'])
const EXCLUDED_BROWSER_WALLET_RDNS = new Set(['app.phantom'])

export function selectBrowserWalletConnectors<TConnector extends TWalletConnectorSummary>(
  connectors: readonly TConnector[],
  options: TSelectBrowserWalletConnectorOptions = {}
): TConnector[] {
  const browserConnectors = connectors.filter(
    (connector) => connector.type === 'injected' && !NON_BROWSER_CONNECTOR_IDS.has(connector.id)
  )
  const discoveredConnectors = browserConnectors.filter((connector) => connector.id !== 'injected')
  const supportedDiscoveredConnectors = discoveredConnectors.filter(
    (connector) => !EXCLUDED_BROWSER_WALLET_RDNS.has(connector.id.toLowerCase())
  )

  const selectedBrowserConnectors =
    discoveredConnectors.length > 0
      ? supportedDiscoveredConnectors
      : browserConnectors.filter((connector) => connector.id === 'injected')
  const additionalConnectorIds = new Set(options.additionalConnectorIds?.map((id) => id.toLowerCase()) ?? [])
  const additionalConnectors = connectors.filter((connector) => additionalConnectorIds.has(connector.id.toLowerCase()))
  const selectedConnectorUids = new Set(selectedBrowserConnectors.map((connector) => connector.id.toLowerCase()))

  return [
    ...selectedBrowserConnectors,
    ...additionalConnectors.filter((connector) => !selectedConnectorUids.has(connector.id.toLowerCase()))
  ]
}

export function getBrowserWalletLabel(connector: TWalletConnectorSummary | undefined): string {
  if (!connector || connector.id === 'injected' || /^injected$/i.test(connector.name)) {
    return 'Browser wallet'
  }

  return connector.name
}

export function formatWalletAddress(address: string | undefined): string {
  if (!address) {
    return 'Wallet'
  }

  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function getWalletConnectionErrorMessage(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error)

  if (/rejected|denied|cancelled|canceled|closed by user/i.test(message)) {
    return undefined
  }

  if (/provider.*not found|no provider|not installed|unavailable/i.test(message)) {
    return 'No browser wallet was found. Install or enable a wallet extension, then try again.'
  }

  return 'The wallet could not be opened. Check the extension or network connection and try again.'
}

export function resolveEvmAppKitWalletItem(
  connector: TWalletConnectorSummary,
  wallets: readonly WalletItem[]
): WalletItem {
  const connectorId = connector.id.toLowerCase()
  const matchingWallet = wallets.find(
    (wallet) =>
      wallet.id.toLowerCase() === connectorId ||
      wallet.connectors.some(
        (walletConnector) =>
          walletConnector.chain === 'eip155' &&
          (walletConnector.id.toLowerCase() === connectorId || walletConnector.rdns?.toLowerCase() === connectorId)
      )
  )

  return (
    matchingWallet ?? {
      connectors: [{ chain: 'eip155', id: connector.id, rdns: connector.id }],
      id: connector.id,
      imageUrl: connector.icon ?? '',
      // AppKit uses this flag to route a WalletItem through its concrete registered connector.
      isInjected: true,
      isRecent: false,
      name: getBrowserWalletLabel(connector),
      walletInfo: {}
    }
  )
}

export async function connectEvmWalletWithAppKit(
  appKit: TEvmAppKitConnectionClient,
  connector: TWalletConnectorSummary
): Promise<void> {
  const startedAt = performance.now()
  const attempt = Math.round(startedAt)
  const trace = (stage: string, details: Record<string, unknown> = {}): void => {
    if (process.env.NODE_ENV === 'development') {
      console.info('[wallet-connect]', {
        attempt,
        elapsedMs: Math.round(performance.now() - startedAt),
        connector: connector.id,
        stage,
        ...details
      })
    }
  }
  // Observe account progress without logging addresses or changing provider requests.
  const unsubscribe =
    process.env.NODE_ENV === 'development'
      ? appKit.subscribeAccount?.((account) => {
          trace('account state changed', { isConnected: account.isConnected, status: account.status })
        }, 'eip155')
      : undefined

  try {
    // The pinned AppKit patch separates restored wallets from remote feature/usage requests.
    // Keep full startup running, but do not make an injected wallet wait for those requests.
    void appKit.ready().then(
      () => trace('AppKit full startup complete'),
      () => trace('AppKit full startup failed')
    )
    trace('waiting for wallet readiness')
    await appKit.ready({ walletsOnly: connector.type === 'injected' })
    trace('wallets ready')
    const wallet = resolveEvmAppKitWalletItem(connector, appKit.getWalletList().wallets)
    trace('requesting wallet connection')
    await appKit.connectWallet(wallet, 'eip155')
    trace('wallet connection resolved')
  } catch (error) {
    trace('connection failed', { reason: getWalletConnectionErrorMessage(error) })
    throw error
  } finally {
    unsubscribe?.()
    appKit.resetConnectingWallet()
    trace('connection cleanup complete')
  }
}
