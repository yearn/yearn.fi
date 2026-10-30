import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { RPC_URLS } from '@erc4626/lib/rpc'
import { connectorsForWallets, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { injectedWallet, safeWallet } from '@rainbow-me/rainbowkit/wallets'
import { deduplicateWalletAnnouncements } from '@yearn/wallet-ui/discovery'
import { getYearnWallets } from '@yearn/wallet-ui/rainbowkit'
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
export const wagmiConfig: Config = projectId
  ? getDefaultConfig({
      appName: 'Yearn ERC-4626',
      projectId,
      wallets: getYearnWallets(),
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
