import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { createConfig, http, type Config } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim() || 'https://ethereum-rpc.publicnode.com'
const transports = {
  [mainnet.id]: http(rpcUrl)
}

function createWagmiConfig(): Config {
  if (projectId) {
    return getDefaultConfig({
      appName: 'yBOLD by Yearn',
      projectId,
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
