import { V2_SUPPORTED_CHAINS, V3_SUPPORTED_CHAINS } from './constants'
import type { TVaultType } from './vaultTypeCopy'

//TODO: see what can be combined with src/components/pages/vaults/utils/constants.ts
export const ALL_SUPPORTED_CHAINS = [1, 747474, 8453, 10]

export function normalizeVaultTypeParam(typeParam: string | null): TVaultType {
  if (typeParam === 'all') return 'all'
  if (typeParam === 'lp' || typeParam === 'factory' || typeParam === 'v2' || typeParam === 'liquidity') return 'factory'
  if (typeParam === 'v3' || typeParam === 'single') return 'v3'
  return 'all'
}

export function getSupportedChainsForVaultType(vaultType: TVaultType): number[] {
  if (vaultType === 'factory') return V2_SUPPORTED_CHAINS
  if (vaultType === 'all') return ALL_SUPPORTED_CHAINS
  return V3_SUPPORTED_CHAINS
}
