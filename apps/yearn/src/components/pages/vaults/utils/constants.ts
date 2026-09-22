import { ALL_VAULTSV3_CATEGORIES } from '@pages/vaults/constants'
import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'
import { getVaultChainIds, getVaultFilterChainIds } from '@yearn/chains'

export const V2_SUPPORTED_CHAINS = getVaultChainIds('v2')
export const V3_SUPPORTED_CHAINS = getVaultChainIds('v3')

export const AVAILABLE_TOGGLE_VALUE = 'available'
export const V3_PRIMARY_CHAIN_IDS = getVaultFilterChainIds('primary')
export const V3_DEFAULT_SECONDARY_CHAIN_IDS = getVaultFilterChainIds('secondary')
export const AGGRESSIVENESS_OPTIONS: TVaultAggressiveness[] = ['Conservative', 'Moderate', 'Aggressive']
export const V3_ASSET_CATEGORIES = [ALL_VAULTSV3_CATEGORIES.Stablecoin, ALL_VAULTSV3_CATEGORIES.Volatile]
export const DEFAULT_MIN_TVL = 500

export function toggleInArray<T>(current: T[] | null, next: T): T[] {
  const existing = current ?? []
  if (existing.includes(next)) {
    return existing.filter((value) => value !== next)
  }
  return [...existing, next]
}

export function readBooleanParam(searchParams: URLSearchParams, key: string): boolean {
  const raw = searchParams.get(key)
  return raw === '1' || raw === 'true'
}

export function selectVaultsByType<T>(
  vaultType: 'all' | 'v3' | 'factory',
  v3Value: T,
  v2Value: T,
  mergeArrays = false
): T {
  if (vaultType === 'all') {
    if (mergeArrays && Array.isArray(v3Value) && Array.isArray(v2Value)) {
      return [...v3Value, ...v2Value] as T
    }
    if (typeof v3Value === 'object' && typeof v2Value === 'object' && !Array.isArray(v3Value)) {
      return { ...v3Value, ...v2Value } as T
    }
    return v3Value
  }
  return vaultType === 'v3' ? v3Value : v2Value
}
