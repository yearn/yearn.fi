import type { Wallet } from '@rainbow-me/rainbowkit'

export type TWalletConnectorSummary = {
  icon?: string
  id: string
  name: string
  type: string
  yearnWallet?: Pick<Wallet, 'rdns' | 'iconUrl'>
}

const NON_BROWSER_CONNECTOR_IDS = new Set(['auth', 'baseaccount', 'coinbasewalletsdk', 'safe', 'walletconnect'])
const EXCLUDED_BROWSER_WALLET_IDS = new Set(['app.phantom'])

export function isMobileWalletBrowser(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPod|iPad/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  )
}

export function selectBrowserWalletConnectors<TConnector extends TWalletConnectorSummary>(
  connectors: readonly TConnector[],
  { additionalConnectorIds = [] }: { additionalConnectorIds?: readonly string[] } = {}
): TConnector[] {
  const browserConnectors = connectors.filter(
    (connector) => connector.type === 'injected' && !NON_BROWSER_CONNECTOR_IDS.has(connector.id.toLowerCase())
  )
  const namedConnectors = browserConnectors.filter((connector) => connector.id !== 'injected')
  const discoveredIds = new Set(
    namedConnectors.filter((connector) => !connector.yearnWallet).map((connector) => connector.id.toLowerCase())
  )
  const browserChoices = (namedConnectors.length > 0 ? namedConnectors : browserConnectors).filter(
    (connector) => !connector.yearnWallet?.rdns || !discoveredIds.has(connector.yearnWallet.rdns.toLowerCase())
  )
  const additionalIds = new Set(additionalConnectorIds.map((id) => id.toLowerCase()))
  const choices = [
    ...browserChoices.filter((connector) => !EXCLUDED_BROWSER_WALLET_IDS.has(connector.id.toLowerCase())),
    ...connectors.filter((connector) => additionalIds.has(connector.id.toLowerCase()))
  ]

  return choices.filter(
    (connector, index) =>
      choices.findIndex((choice) => choice.id.toLowerCase() === connector.id.toLowerCase()) === index
  )
}

export function getBrowserWalletIcon(
  connector: TWalletConnectorSummary,
  connectors: readonly TWalletConnectorSummary[]
): Wallet['iconUrl'] | undefined {
  return (
    connector.icon ||
    connector.yearnWallet?.iconUrl ||
    connectors.find((candidate) => candidate.yearnWallet?.rdns?.toLowerCase() === connector.id.toLowerCase())
      ?.yearnWallet?.iconUrl
  )
}

export function getBrowserWalletLabel(connector: TWalletConnectorSummary | undefined): string {
  return !connector || connector.id === 'injected' || /^injected$/i.test(connector.name)
    ? 'Browser wallet'
    : connector.name
}

export function formatWalletAddress(address: string | undefined): string {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Wallet'
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
