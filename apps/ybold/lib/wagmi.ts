import { RPC_URL } from '@ybold/lib/rpc'
import { deduplicateWalletAnnouncements } from '@yearn/wallet-ui/discovery'
import { getYearnConnectors } from '@yearn/wallet-ui/wallets'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

deduplicateWalletAnnouncements()

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
const transports = {
  [mainnet.id]: http(RPC_URL)
}

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: getYearnConnectors({
    projectId,
    appName: 'yBOLD by Yearn',
    appUrl: 'https://ybold.yearn.fi',
    appIcon: 'https://yearn.fi/favicons/android-icon-192x192.png'
  }),
  transports,
  ssr: true
})
