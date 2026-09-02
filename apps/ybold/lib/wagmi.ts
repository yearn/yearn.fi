'use client'

import { createAppKit } from '@reown/appkit/react'
import { mainnet } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import {
  createYboldAppKitOptions,
  createYboldCustomRpcUrls,
  requireWalletConnectProjectId,
  resolveYboldRpcUrl,
  YBOLD_APPKIT_NETWORKS
} from '@ybold/lib/appkitConfig'
import { http } from 'wagmi'

const projectId = requireWalletConnectProjectId()
const rpcUrl = resolveYboldRpcUrl()
const customRpcUrls = createYboldCustomRpcUrls(rpcUrl)

export const wagmiAdapter = new WagmiAdapter({
  customRpcUrls,
  networks: YBOLD_APPKIT_NETWORKS,
  projectId,
  ssr: true,
  transports: {
    [mainnet.id]: http(rpcUrl)
  }
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

export const appKit = createAppKit(createYboldAppKitOptions(wagmiAdapter, projectId, customRpcUrls))
