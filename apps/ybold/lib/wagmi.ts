import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { RPC_URL } from '@ybold/lib/rpc'
import { deduplicateWalletAnnouncements } from '@yearn/wallet-ui/discovery'
import { getYearnWallets } from '@yearn/wallet-ui/rainbowkit'
import { createConfig, http, type Config } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

deduplicateWalletAnnouncements()

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
const transports = {
  [mainnet.id]: http(RPC_URL)
}

function createWagmiConfig(): Config {
  if (projectId) {
    return getDefaultConfig({
      appName: 'yBOLD by Yearn',
      projectId,
      wallets: getYearnWallets(),
      chains: [mainnet],
      transports,
      ssr: true
    })
  }

  return createConfig({
    chains: [mainnet],
    connectors: [injected()],
    transports,
    ssr: true
  })
}

export const wagmiConfig = createWagmiConfig()
