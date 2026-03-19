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
    const envRPC = getRpcUriFor(chain.id)
    const hasExplicitRpcOverride = Boolean(envRPC)
    const seen = new Set<string>()
    const availableTransports: Transport[] = []

    const addIfNew = (url: string): void => {
      if (url && !seen.has(url)) {
        seen.add(url)
        availableTransports.push(http(url, { batch: true }))
      }
    }

    if (network?.defaultRPC) {
      addIfNew(network.defaultRPC)
    }

    if (envRPC) {
      addIfNew(envRPC)
    }

    for (const rpc of chain.rpcUrls?.default?.http ?? []) {
      addIfNew(rpc)
    }

    availableTransports.push(http())

    transports[chain.id as TSupportedChainId] = fallback(
      availableTransports,
      hasExplicitRpcOverride
        ? undefined
        : {
            // Keep explicit RPC overrides first instead of letting faster public
            // endpoints outrank fork/custom backends.
            rank: { interval: 30_000, timeout: 3_000 }
          }
    )
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
