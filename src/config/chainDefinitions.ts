import { defineChain } from 'viem'
import { arbitrum, base, fantom, mainnet, optimism, polygon, sonic } from 'viem/chains'

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

export const canonicalChains = [mainnet, optimism, polygon, fantom, base, arbitrum, sonic, katana] as const

export type TCanonicalChainId = (typeof canonicalChains)[number]['id']
