export type TWalletConnectorSummary = {
  id: string
  name: string
  type: string
}

const NON_BROWSER_CONNECTOR_IDS = new Set(['auth', 'baseAccount', 'coinbaseWalletSDK', 'safe', 'walletConnect'])
const EXCLUDED_BROWSER_WALLET_RDNS = new Set(['app.phantom'])

export function selectBrowserWalletConnectors<TConnector extends TWalletConnectorSummary>(
  connectors: readonly TConnector[]
): TConnector[] {
  const browserConnectors = connectors.filter(
    (connector) => connector.type === 'injected' && !NON_BROWSER_CONNECTOR_IDS.has(connector.id)
  )
  const discoveredConnectors = browserConnectors.filter((connector) => connector.id !== 'injected')
  const supportedDiscoveredConnectors = discoveredConnectors.filter(
    (connector) => !EXCLUDED_BROWSER_WALLET_RDNS.has(connector.id.toLowerCase())
  )

  return discoveredConnectors.length > 0
    ? supportedDiscoveredConnectors
    : browserConnectors.filter((connector) => connector.id === 'injected')
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

export function getWalletConnectionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/rejected|denied|cancelled|canceled|closed by user/i.test(message)) {
    return 'Connection cancelled. Choose a wallet to try again.'
  }

  if (/provider.*not found|no provider|not installed|unavailable/i.test(message)) {
    return 'No browser wallet was found. Install or enable a wallet extension, then try again.'
  }

  return 'The wallet could not be opened. Check the extension or network connection and try again.'
}
