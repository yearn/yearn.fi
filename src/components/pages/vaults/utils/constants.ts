import { ALL_VAULTSV3_CATEGORIES } from '@pages/vaults/constants'
import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'

//TODO: see what can be combined with src/components/pages/vaults/utils/vaultTypeUtils.ts
export const V2_SUPPORTED_CHAINS = [1, 10, 8453]
export const V3_SUPPORTED_CHAINS = [1, 747474, 8453, 137, 42161]

export const AVAILABLE_TOGGLE_VALUE = 'available'
export const HOLDINGS_TOGGLE_VALUE = 'holdings'
export const V3_PRIMARY_CHAIN_IDS = [1, 747474]
export const V3_DEFAULT_SECONDARY_CHAIN_IDS = [8453, 42161, 137]
export const V2_DEFAULT_TYPES = ['factory']
export const AGGRESSIVENESS_OPTIONS: TVaultAggressiveness[] = ['Conservative', 'Moderate', 'Aggressive']
export const V3_ASSET_CATEGORIES = [ALL_VAULTSV3_CATEGORIES.Stablecoin, ALL_VAULTSV3_CATEGORIES.Volatile]
export const V2_ASSET_CATEGORIES = ['Stablecoin', 'Volatile']
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
