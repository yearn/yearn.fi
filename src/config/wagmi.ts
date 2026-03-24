import { getNetwork, getRpcUriFor, registerConfig } from '@shared/utils/wagmi'
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
import type { Chain } from 'viem'
import { supportedChains } from './supportedChains'
import { getWagmiConfigChains } from './wagmiChains'

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

const wagmiChains = getWagmiConfigChains(supportedChains)

function buildTransports(chains: readonly Chain[]): Record<number, Transport> {
  const transports: Record<number, Transport> = {}

  for (const chain of chains) {
    const network = getNetwork(chain.id)
    const availableTransports: Transport[] = []

    if (network?.defaultRPC) {
      availableTransports.push(http(network.defaultRPC, { batch: true }))
    }

    const envRPC = getRpcUriFor(chain.id)
    if (envRPC) {
      availableTransports.push(http(envRPC, { batch: true }))
    }

    const publicRPC = chain.rpcUrls?.default?.http?.[0]
    if (publicRPC && !availableTransports.length) {
      availableTransports.push(http(publicRPC, { batch: true }))
    }

    availableTransports.push(http())

    transports[chain.id] = fallback(availableTransports)
  }

  return transports
}

export const wagmiConfig = createConfig({
  chains: wagmiChains,
  connectors,
  transports: buildTransports(wagmiChains),
  storage: createStorage({ storage: cookieStorage }),
  ssr: true
})

registerConfig(wagmiConfig)

export type TWagmiConfig = typeof wagmiConfig
