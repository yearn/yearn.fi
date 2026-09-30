import type { Address, Chain } from 'viem'
import {
  arbitrum,
  base,
  berachain,
  fantom,
  gnosis,
  katana,
  mainnet,
  optimism,
  polygon,
  robinhood,
  sonic
} from 'viem/chains'

export type TPriceProvider = 'yearn-prices' | 'defillama'
export type TChainRegistration = {
  chain: Chain
  displayName: string
  optimizationRpcUrls?: readonly string[]
  wrappedNative?: Address
  prices: Partial<Record<TPriceProvider, string>>
  enso?: { router: Address; source: string }
}

// Metadata declares configuration, not live provider or vault coverage.
export const CHAIN_REGISTRY: readonly TChainRegistration[] = [
  {
    chain: mainnet,
    optimizationRpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://1rpc.io/eth',
      'https://rpc.ankr.com/eth',
      'https://eth-mainnet.nodereal.io/v1/1659dfb40aa24bbb8153a677b98064d7'
    ],
    displayName: 'Ethereum',
    prices: { 'yearn-prices': 'ethereum', defillama: 'ethereum' },
    wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    enso: {
      router: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
      source: 'https://docs.enso.build/pages/build/reference/deployments'
    }
  },
  {
    chain: optimism,
    optimizationRpcUrls: [
      'https://optimism.public.blockpi.network/v1/rpc/public',
      'https://1rpc.io/op',
      'https://optimism-public.nodies.app',
      'https://optimism-mainnet.public.blastapi.io'
    ],
    displayName: 'Optimism',
    prices: { 'yearn-prices': 'optimism', defillama: 'optimism' },
    wrappedNative: '0x4200000000000000000000000000000000000006',
    enso: {
      router: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
      source: 'https://docs.enso.build/pages/build/reference/deployments'
    }
  },
  { chain: gnosis, displayName: 'Gnosis', prices: { 'yearn-prices': 'gnosis', defillama: 'gnosis' } },
  {
    chain: polygon,
    optimizationRpcUrls: [
      'https://polygon-bor-rpc.publicnode.com',
      'https://rpc.ankr.com/polygon',
      'https://1rpc.io/matic',
      'https://polygon-public.nodies.app'
    ],
    displayName: 'Polygon',
    prices: { 'yearn-prices': 'polygon', defillama: 'polygon' },
    enso: {
      router: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
      source: 'https://docs.enso.build/pages/build/reference/deployments'
    }
  },
  { chain: sonic, displayName: 'Sonic', prices: { 'yearn-prices': 'sonic', defillama: 'sonic' } },
  {
    chain: fantom,
    optimizationRpcUrls: [
      'https://fantom-rpc.publicnode.com',
      'https://1rpc.io/ftm',
      'https://fantom-public.nodies.app',
      'https://fantom-mainnet.public.blastapi.io'
    ],
    displayName: 'Fantom',
    prices: { 'yearn-prices': 'fantom', defillama: 'fantom' },
    wrappedNative: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'
  },
  {
    chain: base,
    optimizationRpcUrls: [
      'https://base-mainnet.public.blastapi.io',
      'https://1rpc.io/base',
      'https://base-public.nodies.app',
      'https://base.public.blockpi.network/v1/rpc/public'
    ],
    displayName: 'Base',
    prices: { 'yearn-prices': 'base', defillama: 'base' },
    wrappedNative: '0x4200000000000000000000000000000000000006',
    enso: {
      router: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
      source: 'https://docs.enso.build/pages/build/reference/deployments'
    }
  },
  {
    chain: arbitrum,
    optimizationRpcUrls: [
      'https://arbitrum-one.public.blastapi.io',
      'https://1rpc.io/arb',
      'https://arbitrum-one-public.nodies.app',
      'https://rpc.ankr.com/arbitrum'
    ],
    displayName: 'Arbitrum',
    prices: { 'yearn-prices': 'arbitrum', defillama: 'arbitrum' },
    wrappedNative: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    enso: {
      router: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
      source: 'https://docs.enso.build/pages/build/reference/deployments'
    }
  },
  { chain: berachain, displayName: 'Berachain', prices: { 'yearn-prices': 'berachain', defillama: 'berachain' } },
  {
    chain: katana,
    displayName: 'Katana',
    prices: { 'yearn-prices': 'katana', defillama: 'katana' },
    enso: {
      router: '0x3067BDBa0e6628497d527bEF511c22DA8b32cA3F',
      source: 'https://docs.enso.build/pages/build/reference/deployments'
    }
  },
  {
    chain: robinhood,
    displayName: 'Robinhood',
    prices: { 'yearn-prices': 'robinhood', defillama: 'robinhood' },
    wrappedNative: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
    enso: {
      router: '0xCfBAa9Cfce952Ca4F4069874fF1Df8c05e37a3c7',
      source: 'https://docs.enso.build/pages/build/reference/deployments'
    }
  }
]
