import type { CreateAppKit } from '@reown/appkit/react'

export const WALLET_APPKIT_FEATURES = {
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

// Snapshot of Reown's Ethereum ranking on 2026-09-03. Installed EIP-6963
// wallets are discovered separately from this WalletGuide allowlist.
export const WALLETCONNECT_WALLETS = [
  { id: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', name: 'Trust Wallet' },
  { id: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', name: 'MetaMask' },
  { id: '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4', name: 'Binance Wallet' },
  { id: '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150', name: 'SafePal' },
  { id: '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66', name: 'TokenPocket' },
  { id: '5864e2ced7c293ed18ac35e0db085c09ed567d67346ccb6f58a0327a75137489', name: 'Fireblocks' },
  { id: '376cc8495e1b9387084dce611446bc6086780b39b338934ae057ed11c5739735', name: 'IronWallet' },
  { id: '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', name: 'Bitget Wallet' },
  { id: '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709', name: 'OKX Wallet' },
  { id: '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927', name: 'Ledger Wallet' },
  { id: '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f', name: 'Safe' }
] as const

export const WALLETCONNECT_WALLET_IDS = WALLETCONNECT_WALLETS.map(({ id }) => id)

type TWalletAppKitAdapter = NonNullable<CreateAppKit['adapters']>[number]

export type TCreateWalletAppKitOptions = {
  adapter: TWalletAppKitAdapter
  customRpcUrls?: CreateAppKit['customRpcUrls']
  defaultNetwork?: CreateAppKit['defaultNetwork']
  enableNetworkSwitch: boolean
  metadata: NonNullable<CreateAppKit['metadata']>
  networks: CreateAppKit['networks']
  projectId: string
  themeMode?: CreateAppKit['themeMode']
}

export function requireWalletConnectProjectId(value = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID): string {
  const projectId = value?.trim()

  if (!projectId) {
    throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required to initialize Reown AppKit')
  }

  return projectId
}

export function isSafeConnectorId(connectorId: string | undefined): boolean {
  return connectorId?.toLowerCase() === 'safe'
}

export function createWalletAppKitOptions({
  adapter,
  customRpcUrls,
  defaultNetwork,
  enableNetworkSwitch,
  metadata,
  networks,
  projectId,
  themeMode
}: TCreateWalletAppKitOptions): CreateAppKit {
  return {
    adapters: [adapter],
    allWallets: 'SHOW',
    customRpcUrls,
    defaultNetwork,
    enableBaseAccount: false,
    enableCoinbase: false,
    enableEIP6963: true,
    enableInjected: true,
    enableNetworkSwitch,
    enableReconnect: true,
    enableWallets: true,
    features: WALLET_APPKIT_FEATURES,
    includeWalletIds: WALLETCONNECT_WALLET_IDS,
    metadata,
    networks,
    projectId,
    themeMode,
    themeVariables: {
      '--apkt-accent': '#0657f9',
      '--w3m-accent': '#0657f9'
    }
  }
}
