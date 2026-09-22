import { getAppChains, getAppRpcUrl, parseRpcOverrides } from '@yearn/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { createConfig, http, type Config } from 'wagmi'
import { injected } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
const chains = getAppChains('ybold')
const rpcOverrides = parseRpcOverrides(process.env.NEXT_PUBLIC_CHAIN_RPC_URLS)
const transports = Object.fromEntries(chains.map(({ id }) =>
  [id, http(getAppRpcUrl('ybold', id, rpcOverrides, process.env.NEXT_PUBLIC_RPC_URL))]
))

function createWagmiConfig(): Config {
  if (projectId) {
    return getDefaultConfig({
      appName: 'yBOLD by Yearn',
      projectId,
      chains,
      transports,
      ssr: true
    })
  }

  return createConfig({
    chains,
    connectors: [injected()],
    transports,
    ssr: true
  })
}

export const wagmiConfig = createWagmiConfig()
