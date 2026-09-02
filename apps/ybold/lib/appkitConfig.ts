import { type AppKitNetwork, mainnet } from '@reown/appkit/networks'
import type { CreateAppKit } from '@reown/appkit/react'

const DEFAULT_RPC_URL = 'https://ethereum-rpc.publicnode.com'

export const YBOLD_APPKIT_NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet]

export const YBOLD_APPKIT_FEATURES = {
  analytics: false,
  connectMethodsOrder: ['wallet'],
  email: false,
  history: false,
  onramp: false,
  pay: false,
  receive: false,
  reownAuthentication: false,
  send: false,
  smartSessions: false,
  socials: false,
  swaps: false
} satisfies NonNullable<CreateAppKit['features']>

export const YBOLD_WAGMI_RECONNECT_ON_MOUNT = false

type TYboldAppKitAdapter = NonNullable<CreateAppKit['adapters']>[number]

export function requireWalletConnectProjectId(value = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID): string {
  const projectId = value?.trim()

  if (!projectId) {
    throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required to initialize Reown AppKit')
  }

  return projectId
}

export function resolveYboldRpcUrl(value = process.env.NEXT_PUBLIC_RPC_URL): string {
  return value?.trim() || DEFAULT_RPC_URL
}

export function isSafeConnectorId(connectorId: string | undefined): boolean {
  return connectorId?.toLowerCase() === 'safe'
}

export function createYboldCustomRpcUrls(rpcUrl: string): NonNullable<CreateAppKit['customRpcUrls']> {
  return {
    'eip155:1': [{ url: rpcUrl }]
  }
}

export function createYboldAppKitOptions(
  adapter: TYboldAppKitAdapter,
  projectId: string,
  customRpcUrls: NonNullable<CreateAppKit['customRpcUrls']>
): CreateAppKit {
  return {
    adapters: [adapter],
    allWallets: 'SHOW',
    customRpcUrls,
    defaultNetwork: mainnet,
    enableBaseAccount: false,
    enableCoinbase: false,
    enableEIP6963: true,
    enableInjected: true,
    enableNetworkSwitch: false,
    enableReconnect: true,
    enableWallets: true,
    features: YBOLD_APPKIT_FEATURES,
    metadata: {
      description: 'Deposit, manage, and withdraw yBOLD positions with Yearn',
      icons: ['https://bold.yearn.fi/yearn-symbol.svg'],
      name: 'yBOLD by Yearn',
      url: 'https://bold.yearn.fi'
    },
    networks: YBOLD_APPKIT_NETWORKS,
    projectId,
    themeMode: 'light',
    themeVariables: {
      '--apkt-accent': '#0657f9',
      '--w3m-accent': '#0657f9'
    }
  }
}
