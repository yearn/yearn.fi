import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { RPC_URLS } from '@erc4626/lib/rpc'
import { deduplicateWalletAnnouncements } from '@yearn/wallet-ui/discovery'
import { getYearnConnectors } from '@yearn/wallet-ui/wallets'
import { type Config, createConfig, http } from 'wagmi'

deduplicateWalletAnnouncements()

const transports = {
  1: http(RPC_URLS[1]),
  8453: http(RPC_URLS[8453]),
  42161: http(RPC_URLS[42161]),
  10: http(RPC_URLS[10]),
  137: http(RPC_URLS[137]),
  4663: http(RPC_URLS[4663])
}
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
export const wagmiConfig: Config = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors: getYearnConnectors({
    projectId,
    appName: 'Yearn ERC-4626',
    appUrl: 'https://yearn.fi',
    appIcon: 'https://yearn.fi/favicons/android-icon-192x192.png'
  }),
  transports,
  ssr: true
})
