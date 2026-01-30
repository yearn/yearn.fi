import { getNetwork } from '@shared/utils/wagmi'
import type { TVaultListKind } from './vaultListFacets'

export const TOOLTIP_DELAY_MS = 400

export const ALL_CHAINS_DESCRIPTION = 'Shows vaults across all supported chains.'

const CHAIN_DESCRIPTIONS: Record<number, string> = {
  1: 'Ethereum mainnet is the heart of the Ethereum ecosystem. Good liquidity and security, but transaction fees can be higher.',
  10: 'Optimism is the coordination layer of the "SuperChain". It is an optimistic rollup on Ethereum with lower fees and fast confirmations.',
  137: 'Polygon is a PoS sidechain to Ethereum with low fees and fast blocks.',
  42161: 'Arbitrum is an optimistic rollup on Ethereum with low fees and high throughput.',
  8453: "Base is an Coinbase's Ethereum L2 built on the OP Stack with low fees and fast confirmations.",
  747474:
    'Katana is a DeFi focused zk-rollup chain with an innovative liquidity flywheel, low fees, and fast confirmations.'
}

const CHAIN_WEBSITES: Record<number, string> = {
  1: 'https://ethereum.org',
  10: 'https://www.optimism.io/',
  137: 'https://polygon.technology/',
  42161: 'https://offchainlabs.com/#arbitrum-one',
  8453: 'https://base.org/',
  747474: 'https://katana.network'
}

export const RETIRED_TAG_DESCRIPTION = 'Deposits are disabled; withdrawals remain available.'
export const MIGRATABLE_TAG_DESCRIPTION = 'A retired vault with a migration path available to a newer vault.'
export const HIDDEN_TAG_DESCRIPTION = 'Hidden from the default list. Enable hidden vaults to view.'

export function getChainDescription(chainId: number): string {
  return CHAIN_DESCRIPTIONS[chainId] || `${getNetwork(chainId).name} network.`
}
export function getChainWebsite(chainId: number): string | null {
  return CHAIN_WEBSITES[chainId] || null
}

export function getCategoryDescription(category?: string | null): string | null {
  if (!category) return null
  const normalized = category.toLowerCase()
  if (normalized === 'stablecoin') {
    return 'This vault holds a USD-pegged or USD-targeted asset designed to maintain its price.'
  }
  if (normalized === 'volatile') {
    return 'This vault holds an asset whose price fluctuates due to market-driven events.'
  }
  return `${category} asset category.`
}

export function getProductTypeDescription(listKind: TVaultListKind): string {
  if (listKind === 'legacy') {
    return 'These vaults use a Legacy Yearn vault architecture. They were previously called "v2 Vaults").'
  }
  if (listKind === 'factory') {
    return 'LP token vaults auto-compound fees and incentives from liquidity positions. They were previously called "v2 Factory Vaults".'
  }
  return 'Single-asset vaults accept one token and allocate it across strategies. They were previously called "v3 Vaults".'
}

export function getKindDescription(kindType?: 'multi' | 'single', kindLabel?: string): string {
  if (kindType === 'multi') {
    return 'Allocator vaults route deposits across multiple strategies.'
  }
  if (kindType === 'single') {
    return 'Strategy vaults contain a single active strategy and are allocated to by Allocator vaults.'
  }
  return kindLabel ? `${kindLabel} vault classification from Yearn.` : 'Vault strategy classification from Yearn.'
}
