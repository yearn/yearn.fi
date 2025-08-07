import type { Chain, PublicClient } from 'viem'
import { createPublicClient, defineChain, http } from 'viem'
import * as wagmiChains from 'viem/chains'
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

export const katana = defineChain({
  id: 747474,
  name: 'Katana',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH'
  },
  rpcUrls: {
    default: { http: ['https://rpc.katanarpc.com'] }
  },
  blockExplorers: {
    default: {
      name: 'Katana Explorer',
      url: 'https://katanascan.com'
    }
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 1898013
    }
  },
  testnet: false
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

function initIndexedWagmiChains(): TNDict<TExtendedChain> {
  const _indexedWagmiChains: TNDict<TExtendedChain> = {}
  for (const chain of Object.values({ ...wagmiChains, rari, katana })) {
    if (isChain(chain)) {
      let extendedChain = chain as unknown as TExtendedChain
      if (extendedChain.id === 1337) {
        extendedChain = localhost as unknown as TExtendedChain
      }
      if (extendedChain.id === 5402) {
        extendedChain = anotherLocalhost as unknown as TExtendedChain
      }

      extendedChain.contracts = {
        ...extendedChain.contracts
      }

      const newRPC = process.env.RPC_URI_FOR?.[extendedChain.id] || ''
      const newRPCBugged = process.env[`RPC_URI_FOR_${extendedChain.id}`]
      const oldRPC = process.env.JSON_RPC_URI?.[extendedChain.id] || process.env.JSON_RPC_URL?.[extendedChain.id]
      if (!newRPC && (newRPCBugged || oldRPC)) {
        console.debug(
          `JSON_RPC_URI[${extendedChain.id}] and RPC_URI_FOR_${extendedChain.id} are deprecated. Please use RPC_URI_FOR[${extendedChain.id}]`
        )
      }
      const defaultJsonRPCURL = extendedChain?.rpcUrls?.public?.http?.[0]

      extendedChain.defaultRPC = newRPC || oldRPC || newRPCBugged || defaultJsonRPCURL || ''
      extendedChain.rpcUrls.alchemy = { http: [getAlchemyBaseURL(extendedChain.id)] }
      extendedChain.rpcUrls.infura = { http: [getInfuraBaseURL(extendedChain.id)] }

      const http = [extendedChain.defaultRPC, ...extendedChain.rpcUrls.default.http].filter(Boolean)
      extendedChain.rpcUrls.default.http = http
      extendedChain.defaultBlockExplorer =
        extendedChain.blockExplorers?.etherscan?.url ||
        extendedChain.blockExplorers?.default.url ||
        'https://etherscan.io'
      _indexedWagmiChains[extendedChain.id] = extendedChain
    }
  }
  return _indexedWagmiChains
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
  if (!indexedWagmiChains[chainID]) {
    throw new Error(`Chain ${chainID} is not supported`)
  }
  const chainConfig = indexedWagmiChains?.[chainID] || retrieveConfig().chains.find((chain) => chain.id === chainID)

  const newRPC = process.env.RPC_URI_FOR?.[chainID] || ''
  const newRPCBugged = process.env[`RPC_URI_FOR_${chainID}`]
  const oldRPC = process.env.JSON_RPC_URI?.[chainID] || process.env.JSON_RPC_URL?.[chainID]

  let url =
    newRPC ||
    oldRPC ||
    newRPCBugged ||
    chainConfig.rpcUrls.default.http[0] ||
    chainConfig.rpcUrls.alchemy.http[0] ||
    chainConfig.rpcUrls.infura.http[0] ||
    indexedWagmiChains?.[chainID]?.rpcUrls?.public?.http?.[0] ||
    ''

  try {
    new URL(url)
    const urlAsNodeURL = new URL(url)
    let headers = {}
    if (urlAsNodeURL.username && urlAsNodeURL.password) {
      headers = {
        Authorization: `Basic ${btoa(urlAsNodeURL.username + ':' + urlAsNodeURL.password)}`
      }
      url = urlAsNodeURL.href.replace(`${urlAsNodeURL.username}:${urlAsNodeURL.password}@`, '')
      return createPublicClient({
        chain: indexedWagmiChains[chainID],
        transport: http(url, { fetchOptions: { headers } })
      })
    }
    return createPublicClient({ chain: indexedWagmiChains[chainID], transport: http(url) })
  } catch {
    throw new Error(`We couldn't get a valid RPC URL for chain ${chainID}`)
  }
}
