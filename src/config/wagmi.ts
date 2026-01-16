import { getNetwork, registerConfig } from '@lib/utils/wagmi'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  frameWallet,
  injectedWallet,
  ledgerWallet,
  rabbyWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets'
import type { Transport } from 'viem'
import { cookieStorage, createConfig, createStorage, fallback, http } from 'wagmi'
import { supportedChains, type TSupportedChainId } from './supportedChains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string
const appName = (import.meta.env.VITE_WALLETCONNECT_PROJECT_NAME as string) || 'Yearn Finance'

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        injectedWallet,
        rabbyWallet,
        frameWallet,
        walletConnectWallet,
        rainbowWallet,
        ledgerWallet,
        safeWallet
      ]
    }
  ],
  { projectId, appName }
)

function buildTransports(): Record<TSupportedChainId, Transport> {
  const transports = {} as Record<TSupportedChainId, Transport>

  for (const chain of supportedChains) {
    const network = getNetwork(chain.id)
    const availableTransports: Transport[] = []

    if (network?.defaultRPC) {
      availableTransports.push(http(network.defaultRPC, { batch: true }))
    }

    const envRPC = import.meta.env.VITE_RPC_URI_FOR?.[chain.id]
    if (envRPC) {
      availableTransports.push(http(envRPC, { batch: true }))
    }

    const publicRPC = chain.rpcUrls?.default?.http?.[0]
    if (publicRPC && !availableTransports.length) {
      availableTransports.push(http(publicRPC, { batch: true }))
    }

    availableTransports.push(http())

    transports[chain.id as TSupportedChainId] = fallback(availableTransports)
  }

  return transports
}

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors,
  transports: buildTransports(),
  storage: createStorage({ storage: cookieStorage }),
  ssr: true
})

registerConfig(wagmiConfig)

export type TWagmiConfig = typeof wagmiConfig
