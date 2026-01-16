import { getNetwork } from '@lib/utils/wagmi'
import type { TVaultListKind } from './vaultListFacets'

export const TOOLTIP_DELAY_MS = 400

export const ALL_CHAINS_DESCRIPTION = 'Shows vaults across all supported chains.'

const CHAIN_DESCRIPTIONS: Record<number, string> = {
  1: 'Ethereum mainnet. Highest liquidity and security; gas fees can be higher.',
  10: 'Optimism is the heart of the "SuperChain". It is an optimistic rollup on Ethereum with lower fees and fast confirmations.',
  137: 'Polygon is a PoS sidechain to Ethereum with low fees and fast blocks.',
  42161: 'Arbitrum is an optimistic rollup on Ethereum with low fees and high throughput.',
  8453: "Base is an Coinbase's Ethereum L2 built on the OP Stack with low fees and fast confirmations.",
  747474: 'Katana is a DeFi focused zk-rollup chain with an innovative liquidity flywheel.'
}

export const RETIRED_TAG_DESCRIPTION = 'Deposits are disabled; withdrawals remain available.'
export const MIGRATABLE_TAG_DESCRIPTION = 'A retired vault with a migration path available to a newer vault.'
export const HIDDEN_TAG_DESCRIPTION = 'Hidden from the default list. Enable hidden vaults to view.'

export function getChainDescription(chainId: number): string {
  return CHAIN_DESCRIPTIONS[chainId] || `${getNetwork(chainId).name} network.`
}

export function getCategoryDescription(category?: string | null): string | null {
  if (!category) return null
  const normalized = category.toLowerCase()
  if (normalized === 'stablecoin') {
    return 'These are USD-pegged or targeted assets designed to stay stable.'
  }
  if (normalized === 'volatile') {
    return 'These are assets with market-driven price changes.'
  }
  return `${category} asset category.`
}

export function getProductTypeDescription(listKind: TVaultListKind): string {
  if (listKind === 'legacy') {
    return 'These vaults us a Legacy Yearn vault architecture (AKA v2 Vaults).'
  }
  if (listKind === 'factory') {
    return 'LP token vaults auto-compound fees and incentives from liquidity positions.'
  }
  return 'Single-asset vaults accept one token and allocate it across strategies (AKA v3 Vaults).'
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
