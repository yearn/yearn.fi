import type { CreateAppKit } from '@reown/appkit/react'
import { createWalletAppKitOptions } from '@yearn/wallet-ui/appkit'
import type { Chain } from 'viem'
import { supportedAppChains, supportedWalletChains } from '@/config/supportedChains'
import { getWagmiConfigChains } from '@/config/wagmiChains'
import { getTransportRpcUrlsForChain } from '@/config/wagmiTransports'

export const YEARN_APPKIT_NETWORKS = getWagmiConfigChains(supportedWalletChains, supportedAppChains)
export const YEARN_WAGMI_RECONNECT_ON_MOUNT = false

export const YEARN_APPKIT_METADATA: NonNullable<CreateAppKit['metadata']> = {
  description: 'The yield protocol for digital assets',
  icons: ['https://yearn.fi/favicons/favicon-512x512.png'],
  name: 'Yearn Finance',
  url: 'https://yearn.fi'
}

type TRpcUrlResolver = (chain: Chain) => readonly string[]

export function createYearnCustomRpcUrls(
  networks: readonly Chain[] = YEARN_APPKIT_NETWORKS,
  resolveRpcUrls: TRpcUrlResolver = getTransportRpcUrlsForChain
): NonNullable<CreateAppKit['customRpcUrls']> {
  return Object.fromEntries(
    networks.map((network) => [`eip155:${network.id}`, resolveRpcUrls(network).map((url) => ({ url }))])
  ) as NonNullable<CreateAppKit['customRpcUrls']>
}

type TYearnAppKitAdapter = NonNullable<CreateAppKit['adapters']>[number]

export function createYearnAppKitOptions(
  adapter: TYearnAppKitAdapter,
  projectId: string,
  customRpcUrls: NonNullable<CreateAppKit['customRpcUrls']>
): CreateAppKit {
  return createWalletAppKitOptions({
    adapter,
    customRpcUrls,
    defaultNetwork: YEARN_APPKIT_NETWORKS[0],
    enableNetworkSwitch: false,
    metadata: YEARN_APPKIT_METADATA,
    networks: YEARN_APPKIT_NETWORKS,
    projectId
  })
}
