import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { connectorsForWallets, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { injectedWallet, safeWallet } from '@rainbow-me/rainbowkit/wallets'
import { getAppRpcUrl } from '@yearn/chains'
import { type Config, createConfig, http } from 'wagmi'

// Keep explicit reads so Next.js can inline the existing per-chain variables.
const rpcOverrides: Partial<Record<number, string | undefined>> = {
  1: process.env.NEXT_PUBLIC_RPC_ETHEREUM,
  8453: process.env.NEXT_PUBLIC_RPC_BASE,
  42161: process.env.NEXT_PUBLIC_RPC_ARBITRUM,
  10: process.env.NEXT_PUBLIC_RPC_OPTIMISM,
  137: process.env.NEXT_PUBLIC_RPC_POLYGON,
  4663: process.env.NEXT_PUBLIC_RPC_ROBINHOOD
}
const transports = Object.fromEntries(
  SUPPORTED_CHAINS.map(({ id }) => [id, http(getAppRpcUrl('erc4626', id, rpcOverrides))])
)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
export const wagmiConfig: Config = projectId
  ? getDefaultConfig({
      appName: 'Yearn ERC-4626',
      projectId,
      chains: SUPPORTED_CHAINS,
      transports,
      ssr: true
    })
  : createConfig({
      chains: SUPPORTED_CHAINS,
      connectors: connectorsForWallets([{ groupName: 'Available wallets', wallets: [injectedWallet, safeWallet] }], {
        appName: 'Yearn ERC-4626',
        projectId: ''
      }),
      transports,
      ssr: true
    })
