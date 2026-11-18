import { deduplicateWalletAnnouncements } from '@yearn/wallet-ui/discovery'
import { getYearnConnectors } from '@yearn/wallet-ui/wallets'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

deduplicateWalletAnnouncements()
export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: getYearnConnectors({
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim(),
    appName: 'Yearn Wrapped',
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://yearn.fi',
    appIcon: 'https://yearn.fi/favicons/android-icon-192x192.png'
  }),
  transports: { [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_URI_FOR_1 ?? 'https://ethereum-rpc.publicnode.com') },
  ssr: true
})
