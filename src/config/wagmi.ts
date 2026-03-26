import { registerConfig } from '@shared/utils/wagmi'
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
import { cookieStorage, createConfig, createStorage } from 'wagmi'
import { supportedAppChains, supportedWalletChains } from './supportedChains'
import { getWagmiConfigChains } from './wagmiChains'
import { buildTransports } from './wagmiTransports'

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

const wagmiChains = getWagmiConfigChains(supportedWalletChains, supportedAppChains)

export const wagmiConfig = createConfig({
  chains: wagmiChains,
  connectors,
  transports: buildTransports(wagmiChains),
  storage: createStorage({ storage: cookieStorage }),
  ssr: true
})

registerConfig(wagmiConfig)

export type TWagmiConfig = typeof wagmiConfig
