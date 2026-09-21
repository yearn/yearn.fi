import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { connectorsForWallets, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { injectedWallet, safeWallet } from '@rainbow-me/rainbowkit/wallets'
import { type Config, createConfig, http } from 'wagmi'

const transports = {
  1: http(process.env.NEXT_PUBLIC_RPC_ETHEREUM || 'https://ethereum-rpc.publicnode.com'),
  8453: http(process.env.NEXT_PUBLIC_RPC_BASE || 'https://base-rpc.publicnode.com'),
  42161: http(process.env.NEXT_PUBLIC_RPC_ARBITRUM || 'https://arbitrum-one-rpc.publicnode.com'),
  10: http(process.env.NEXT_PUBLIC_RPC_OPTIMISM || 'https://optimism-rpc.publicnode.com'),
  137: http(process.env.NEXT_PUBLIC_RPC_POLYGON || 'https://polygon-bor-rpc.publicnode.com'),
  4663: http(process.env.NEXT_PUBLIC_RPC_ROBINHOOD || 'https://rpc.mainnet.chain.robinhood.com')
}
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
