import { type AppKitNetwork, mainnet } from '@reown/appkit/networks'
import type { CreateAppKit } from '@reown/appkit/react'
import {
  createWalletAppKitOptions,
  isSafeConnectorId,
  requireWalletConnectProjectId,
  WALLET_APPKIT_FEATURES,
  WALLETCONNECT_WALLET_IDS,
  WALLETCONNECT_WALLETS
} from '@yearn/wallet-ui/appkit'

const DEFAULT_RPC_URL = 'https://ethereum-rpc.publicnode.com'

export const YBOLD_APPKIT_NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet]

export const YBOLD_APPKIT_FEATURES = WALLET_APPKIT_FEATURES

export const YBOLD_WAGMI_RECONNECT_ON_MOUNT = false

export const YBOLD_WALLETCONNECT_WALLETS = WALLETCONNECT_WALLETS

export const YBOLD_WALLETCONNECT_WALLET_IDS = WALLETCONNECT_WALLET_IDS

type TYboldAppKitAdapter = Parameters<typeof createWalletAppKitOptions>[0]['adapter']

export function resolveYboldRpcUrl(value = process.env.NEXT_PUBLIC_RPC_URL): string {
  return value?.trim() || DEFAULT_RPC_URL
}

export { isSafeConnectorId, requireWalletConnectProjectId }

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
  return createWalletAppKitOptions({
    adapter,
    customRpcUrls,
    defaultNetwork: mainnet,
    enableNetworkSwitch: false,
    metadata: {
      description: 'Deposit, manage, and withdraw yBOLD positions with Yearn',
      icons: ['https://bold.yearn.fi/yearn-symbol.svg'],
      name: 'yBOLD by Yearn',
      url: 'https://bold.yearn.fi'
    },
    networks: YBOLD_APPKIT_NETWORKS,
    projectId,
    themeMode: 'light'
  })
}
