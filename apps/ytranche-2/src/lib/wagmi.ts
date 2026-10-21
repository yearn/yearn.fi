import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { deduplicateWalletAnnouncements } from '@yearn/wallet-ui/discovery'
import { getYearnWallets } from '@yearn/wallet-ui/rainbowkit'
import { ETHEREUM_RPC_URLS } from '@/lib/rpc'
import { createConfig, fallback, http, type Config } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

deduplicateWalletAnnouncements()

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
const transports = {
  [mainnet.id]: fallback(ETHEREUM_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 0 })))
}

function createWagmiConfig(): Config {
  if (projectId) {
    return getDefaultConfig({
      appName: 'yTranche 2 by Yearn',
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
