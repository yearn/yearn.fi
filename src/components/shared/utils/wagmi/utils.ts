import type { Chain, PublicClient } from 'viem'
import { createPublicClient, defineChain, http } from 'viem'
import * as wagmiChains from 'viem/chains'
import { katana } from '@/config/chainDefinitions'
import {
  resolveExecutionChainId,
  resolveTenderlyRpcUriForExecutionChainId,
  supportedChainLookup
} from '@/config/tenderly'
import type { TAddress } from '../../types/address'
import type { TDict, TNDict } from '../../types/mixed'
import { retrieveConfig } from './config'
import { anotherLocalhost, localhost } from './networks'

export type TChainContract = {
  address: TAddress
  blockCreated?: number
}

/*************************************************************************************************
 ** The RARI chain is not available on the Viem library wet, so we define it here manually.
 ** An existing Rejected PR can be consulted here: https://github.com/wevm/viem/pull/1741
 *************************************************************************************************/
const rari = defineChain({
  id: 1380012617,
  name: 'RARI Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://mainnet.rpc.rarichain.org/http']
    }
  },
  blockExplorers: {
    default: {
      name: 'RARI chain explorer',
      url: 'https://mainnet.explorer.rarichain.org/',
      apiUrl: 'https://mainnet.explorer.rarichain.org/api'
    }
  },
  contracts: {
    multicall3: {
      address: '0xb6D5B39F96d379569d47cC84024f3Cd78c5Ef651',
      blockCreated: 0
    }
  }
})

/***************************************************************************************************
 ** Extended Chain type is used to add additional properties to the basic wagmi Chain type.
 ** Ee need to add:
 ** - the default RPC and block explorer URLs for each chain.
 ** - the wrapped token data for each chain.
 **************************************************************************************************/
export type TExtendedChain = Chain & {
  defaultRPC: string
  defaultBlockExplorer: string
  contracts: TDict<TChainContract>
}

const isChain = (chain: wagmiChains.Chain | unknown): chain is wagmiChains.Chain => {
  return (
    typeof chain === 'object' &&
    chain !== null &&
    'id' in chain &&
    typeof (chain as Record<string, unknown>).id === 'number' &&
    chain.id !== undefined
  )
}

export function getRpcUriFor(chainId: number | string): string {
  const normalizedChainId = Number(chainId)
  if (Number.isInteger(normalizedChainId)) {
    const tenderlyRpc = resolveTenderlyRpcUriForExecutionChainId(normalizedChainId)
    if (tenderlyRpc) {
      return tenderlyRpc
    }
  }

  const key = `VITE_RPC_URI_FOR_${chainId}`
  const value = import.meta.env[key]
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function getAlchemyBaseURL(chainID: number): string {
  switch (chainID) {
    case wagmiChains.mainnet.id:
      return 'https://eth-mainnet.g.alchemy.com/v2'
    case wagmiChains.optimism.id:
      return 'https://opt-mainnet.g.alchemy.com/v2'
    case wagmiChains.polygon.id:
      return 'https://polygon-mainnet.g.alchemy.com/v2'
    case wagmiChains.polygonZkEvm.id:
      return 'https://polygonzkevm-mainnet.g.alchemy.com/v2'
    case wagmiChains.base.id:
      return 'https://base-mainnet.g.alchemy.com/v2'
    case wagmiChains.arbitrum.id:
      return 'https://arb-mainnet.g.alchemy.com/v2'
    case wagmiChains.zkSync.id:
      return 'https://zksync-mainnet.g.alchemy.com/v2'
  }
  return ''
}

function getInfuraBaseURL(chainID: number): string {
  switch (chainID) {
    case wagmiChains.mainnet.id:
      return 'https://mainnet.infura.io/v3'
    case wagmiChains.optimism.id:
      return 'https://optimism-mainnet.infura.io/v3'
    case wagmiChains.polygon.id:
      return 'https://polygon-mainnet.infura.io/v3'
    case wagmiChains.base.id:
      return 'https://base-mainnet.infura.io/v3'
    case wagmiChains.arbitrum.id:
      return 'https://arbitrum-mainnet.infura.io/v3'
    case wagmiChains.celo.id:
      return 'https://celo-mainnet.infura.io/v3'
    case wagmiChains.linea.id:
      return 'https://linea-mainnet.infura.io/v3'
    case wagmiChains.blast.id:
      return 'https://blast-mainnet.infura.io/v3'
  }
  return ''
}

function toExtendedChain(chain: Chain): TExtendedChain {
  const baseChain = (
    chain.id === localhost.id ? localhost : chain.id === anotherLocalhost.id ? anotherLocalhost : chain
  ) as Chain

  const extendedChain = {
    ...(baseChain as TExtendedChain),
    rpcUrls: {
      ...baseChain.rpcUrls,
      default: {
        ...baseChain.rpcUrls.default,
        http: [...(baseChain.rpcUrls.default?.http || [])]
      },
      public: baseChain.rpcUrls.public
        ? {
            ...baseChain.rpcUrls.public,
            http: [...(baseChain.rpcUrls.public.http || [])]
          }
        : undefined
    },
    blockExplorers: baseChain.blockExplorers
      ? {
          ...baseChain.blockExplorers,
          default: {
            ...baseChain.blockExplorers.default
          }
        }
      : undefined,
    contracts: {
      ...((baseChain as TExtendedChain).contracts || {})
    }
  } as TExtendedChain

  const newRPC = getRpcUriFor(extendedChain.id)
  const oldRPC =
    import.meta.env.VITE_JSON_RPC_URI?.[extendedChain.id] || import.meta.env.VITE_JSON_RPC_URL?.[extendedChain.id]
  if (!newRPC && oldRPC) {
    console.debug(
      `VITE_JSON_RPC_URI[${extendedChain.id}] is deprecated. Please use VITE_RPC_URI_FOR_${extendedChain.id}`
    )
  }

  const defaultJsonRPCURL = extendedChain.rpcUrls.public?.http?.[0] || extendedChain.rpcUrls.default?.http?.[0]
  extendedChain.defaultRPC = newRPC || oldRPC || defaultJsonRPCURL || ''
  extendedChain.rpcUrls.alchemy = { http: [getAlchemyBaseURL(extendedChain.id)] }
  extendedChain.rpcUrls.infura = { http: [getInfuraBaseURL(extendedChain.id)] }
  extendedChain.rpcUrls.default.http = [
    ...new Set([extendedChain.defaultRPC, ...extendedChain.rpcUrls.default.http].filter(Boolean))
  ]
  extendedChain.defaultBlockExplorer =
    extendedChain.blockExplorers?.etherscan?.url || extendedChain.blockExplorers?.default.url || 'https://etherscan.io'

  return extendedChain
}

function initIndexedWagmiChains(): TNDict<TExtendedChain> {
  const indexedChains: TNDict<TExtendedChain> = {}
  const baseChains = Object.values({ ...wagmiChains, rari, katana, localhost, anotherLocalhost }).filter(isChain)

  for (const chain of [...baseChains, ...supportedChainLookup]) {
    indexedChains[chain.id] = toExtendedChain(chain)
  }

  return indexedChains
}
export const indexedWagmiChains: TNDict<TExtendedChain> = initIndexedWagmiChains()

export function getNetwork(chainID: number): TExtendedChain {
  if (!indexedWagmiChains[chainID]) {
    console.error(`Chain ${chainID} is not supported`)
    return {
      id: chainID,
      name: `Network ${chainID}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      defaultRPC: '',
      defaultBlockExplorer: '',
      contracts: {},
      rpcUrls: {
        default: {
          http: []
        }
      },
      blockExplorers: {
        default: {
          name: '',
          url: ''
        }
      }
    } as TExtendedChain
  }
  return indexedWagmiChains[chainID]
}

export function getClient(chainID: number): PublicClient {
  const executionChainId = resolveExecutionChainId(chainID)
  if (executionChainId === undefined || !indexedWagmiChains[executionChainId]) {
    throw new Error(`Chain ${chainID} is not supported`)
  }
  const chainConfig =
    indexedWagmiChains[executionChainId] || retrieveConfig().chains.find((chain) => chain.id === executionChainId)

  const newRPC = getRpcUriFor(executionChainId)
  const oldRPC =
    import.meta.env.VITE_JSON_RPC_URI?.[executionChainId] || import.meta.env.VITE_JSON_RPC_URL?.[executionChainId]

  const url =
    newRPC ||
    oldRPC ||
    chainConfig?.rpcUrls.default.http[0] ||
    chainConfig?.rpcUrls.alchemy.http[0] ||
    chainConfig?.rpcUrls.infura.http[0] ||
    indexedWagmiChains[executionChainId]?.rpcUrls?.public?.http?.[0] ||
    ''

  try {
    new URL(url)
    const urlAsNodeURL = new URL(url)
    if (urlAsNodeURL.username && urlAsNodeURL.password) {
      const headers = { Authorization: `Basic ${btoa(urlAsNodeURL.username + ':' + urlAsNodeURL.password)}` }
      const cleanUrl = urlAsNodeURL.href.replace(`${urlAsNodeURL.username}:${urlAsNodeURL.password}@`, '')
      return createPublicClient({
        chain: indexedWagmiChains[executionChainId],
        transport: http(cleanUrl, { fetchOptions: { headers } })
      })
    }
    return createPublicClient({ chain: indexedWagmiChains[executionChainId], transport: http(url) })
  } catch {
    throw new Error(`We couldn't get a valid RPC URL for chain ${chainID}`)
  }
}
