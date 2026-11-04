import { env } from '@/env'
import { registerConfig } from '@shared/utils/wagmi'
import { getYearnConnectors } from '@yearn/wallet-ui/wallets'
import { deduplicateWalletAnnouncements } from '@yearn/wallet-ui/discovery'
import { cookieStorage, createConfig, createStorage } from 'wagmi'
import { agentWallet, isAgentWalletEnabled } from '@/config/agentWallet'
import { supportedAppChains, supportedWalletChains } from '@/config/supportedChains'
import { getWagmiConfigChains } from '@/config/wagmiChains'
import { buildTransports } from '@/config/wagmiTransports'

deduplicateWalletAnnouncements()

const projectId = env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID as string
const appName = (env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_NAME as string) || 'Yearn Finance'
const connectors = [
  ...(isAgentWalletEnabled() ? [agentWallet()] : []),
  ...getYearnConnectors({
    projectId,
    appName,
    appUrl: 'https://yearn.fi',
    appIcon: 'https://yearn.fi/favicons/android-icon-192x192.png'
  })
]

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
