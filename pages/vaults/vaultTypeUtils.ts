import { V2_SUPPORTED_CHAINS, V3_SUPPORTED_CHAINS } from './constants'
import type { TVaultType } from './vaultTypeCopy'

export const ALL_SUPPORTED_CHAINS = Array.from(new Set([...V2_SUPPORTED_CHAINS, ...V3_SUPPORTED_CHAINS]))

export function normalizeVaultTypeParam(typeParam: string | null): TVaultType {
  if (typeParam === 'all') return 'all'
  if (typeParam === 'lp' || typeParam === 'factory' || typeParam === 'v2') return 'factory'
  if (typeParam === 'v3') return 'v3'
  return 'v3'
}

export function sanitizeChainsParam(params: URLSearchParams, supportedChainIds: number[]): void {
  const rawChains = params.get('chains')
  if (!rawChains || rawChains === '0') {
    return
  }
  const nextChains = rawChains
    .split('_')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && supportedChainIds.includes(value))

  if (nextChains.length === 0) {
    params.delete('chains')
  } else {
    params.set('chains', nextChains.join('_'))
  }
}

export function getSupportedChainsForVaultType(vaultType: TVaultType): number[] {
  if (vaultType === 'factory') return V2_SUPPORTED_CHAINS
  if (vaultType === 'all') return ALL_SUPPORTED_CHAINS
  return V3_SUPPORTED_CHAINS
}
