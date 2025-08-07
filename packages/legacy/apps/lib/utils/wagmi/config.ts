import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import type { _chains } from '@rainbow-me/rainbowkit/dist/config/getDefaultConfig'
import {
  coinbaseWallet,
  frameWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets'
import type { Transport } from 'viem'
import type { Chain } from 'viem/chains'
import type { Config, ResolvedRegister } from 'wagmi'
import {
  cookieStorage,
  createStorage,
  custom,
  fallback,
  http,
  unstable_connector,
  webSocket
} from 'wagmi'
import { injected, safe } from 'wagmi/connectors'
import { getNetwork } from './utils'

let CONFIG: Config | undefined
let CONFIG_CHAINS: Chain[] = []
let CONFIG_WITH_WINDOW: boolean = true

type TTransport = { [key: number]: Transport }
export function getConfig({ chains }: { chains: Chain[] }): ResolvedRegister['config'] {
  const transports: TTransport = {}
  for (const chain of chains) {
    /**************************************************************************************
     ** Assign the WS URI
     *************************************************************************************/
    let wsURI = getNetwork(chain.id)?.defaultRPC
    if (wsURI.startsWith('nd-')) {
      wsURI = wsURI.replace('nd-', 'ws-nd-')
    }
    if (wsURI.startsWith('infura.io')) {
      wsURI = wsURI.replace('v3', 'ws/v3')
    }
    if (wsURI.startsWith('chainstack.com')) {
      wsURI = 'ws' + wsURI
    }

    /**************************************************************************************
     ** Assign the default transport configured for that chain
     *************************************************************************************/
    const availableTransports: Transport[] = []
    if (getNetwork(chain.id)?.defaultRPC) {
      availableTransports.push(http(getNetwork(chain.id)?.defaultRPC, { batch: true }))
    }

    /**************************************************************************************
     ** Assign the transport via the env variables
     *************************************************************************************/
    const newRPC = process.env.RPC_URI_FOR?.[chain.id] || ''
    const newRPCBugged = process.env[`RPC_URI_FOR_${chain.id}`]
    const oldRPC = process.env.JSON_RPC_URI?.[chain.id] || process.env.JSON_RPC_URL?.[chain.id]
    const defaultJsonRPCURL = chain?.rpcUrls?.public?.http?.[0]
    const envRPC = newRPC || oldRPC || newRPCBugged || defaultJsonRPCURL
    if (envRPC) {
      availableTransports.push(http(envRPC, { batch: true }))
    }
    /**************************************************************************************
     ** Assign the transport via the alchemy and infura keys
     *************************************************************************************/
    if (getNetwork(chain.id)?.rpcUrls.alchemy?.http[0] && process.env.ALCHEMY_KEY) {
      availableTransports.push(
        http(`${getNetwork(chain.id)?.rpcUrls.alchemy.http[0]}/${process.env.ALCHEMY_KEY}`, {
          batch: true
        })
      )
    }
    if (getNetwork(chain.id)?.rpcUrls.infura?.http[0] && process.env.INFURA_PROJECT_ID) {
      availableTransports.push(
        http(`${getNetwork(chain.id)?.rpcUrls.infura.http[0]}/${process.env.INFURA_PROJECT_ID}`, {
          batch: true
        })
      )
    }

    /**************************************************************************************
     ** Append the websocket transport
     *************************************************************************************/
    if (wsURI) {
      availableTransports.push(webSocket(wsURI))
    }

    const shouldUseWindowInjected = false
    if (typeof window !== 'undefined' && window.ethereum && shouldUseWindowInjected) {
      transports[chain.id] = fallback([
        unstable_connector(safe),
        ...availableTransports,
        unstable_connector(injected),
        custom(window.ethereum!),
        http()
      ])
    } else {
      transports[chain.id] = fallback([
        unstable_connector(safe),
        ...availableTransports,
        unstable_connector(injected),
        http()
      ])
    }
  }

  const config = getDefaultConfig({
    appName: (process.env.WALLETCONNECT_PROJECT_NAME as string) || '',
    projectId: process.env.WALLETCONNECT_PROJECT_ID as string,
    chains: chains as unknown as _chains,
    ssr: true,
    wallets: [
      {
        groupName: 'Popular',
        wallets: [
          injectedWallet,
          frameWallet,
          metaMaskWallet,
          walletConnectWallet,
          rainbowWallet,
          ledgerWallet,
          coinbaseWallet,
          safeWallet
        ]
      }
    ],
    storage: createStorage({
      storage: cookieStorage
    }),
    transports: transports
  })

  for (const chain of config.chains) {
    let wsURI = getNetwork(chain.id)?.defaultRPC
    if (wsURI.startsWith('nd-')) {
      wsURI = wsURI.replace('nd-', 'ws-nd-')
    }
    if (wsURI.startsWith('infura.io')) {
      wsURI = wsURI.replace('v3', 'ws/v3')
    }
    if (wsURI.startsWith('chainstack.com')) {
      wsURI = 'ws' + wsURI
    }
    const availableRPCs: string[] = []
    const newRPC = process.env.RPC_URI_FOR?.[chain.id] || ''
    const newRPCBugged = process.env[`RPC_URI_FOR_${chain.id}`]
    const oldRPC = process.env.JSON_RPC_URI?.[chain.id] || process.env.JSON_RPC_URL?.[chain.id]
    const defaultJsonRPCURL = chain?.rpcUrls?.public?.http?.[0]
    const injectedRPC = newRPC || oldRPC || newRPCBugged || defaultJsonRPCURL || ''

    if (injectedRPC) {
      availableRPCs.push(injectedRPC)
    }
    if (chain?.rpcUrls.alchemy?.http[0] && process.env.ALCHEMY_KEY) {
      availableRPCs.push(`${chain?.rpcUrls.alchemy.http[0]}/${process.env.ALCHEMY_KEY}`)
    }
    if (chain?.rpcUrls.infura?.http[0] && process.env.INFURA_PROJECT_ID) {
      availableRPCs.push(`${chain?.rpcUrls.infura.http[0]}/${process.env.INFURA_PROJECT_ID}`)
    }
    if (!chain.rpcUrls.default) {
      chain.rpcUrls.default = { http: [], webSocket: [] }
    }
    const defaultHttp = [
      ...new Set([...availableRPCs, ...(chain.rpcUrls.default?.http || [])].filter(Boolean))
    ]
    const defaultWebSocket = [
      ...new Set([wsURI, ...(chain.rpcUrls.default.webSocket || [])].filter(Boolean))
    ]
    chain.rpcUrls.default.http = defaultHttp
    chain.rpcUrls.default.webSocket = defaultWebSocket
  }

  CONFIG = config
  CONFIG_WITH_WINDOW = typeof window !== 'undefined'
  CONFIG_CHAINS = chains
  return config
}

export function retrieveConfig(): ResolvedRegister['config'] {
  if (CONFIG && CONFIG_WITH_WINDOW) {
    return CONFIG
  }
  if (!CONFIG_WITH_WINDOW) {
    return getConfig({ chains: CONFIG_CHAINS })
  }
  throw new Error('Config not set')
}
