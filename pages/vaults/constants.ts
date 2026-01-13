export const V2_SUPPORTED_CHAINS = [1, 10, 8453]
export const V3_SUPPORTED_CHAINS = [1, 747474, 8453, 42161, 137]

export const AVAILABLE_TOGGLE_VALUE = 'available'
export const HOLDINGS_TOGGLE_VALUE = 'holdings'
export const V3_PRIMARY_CHAIN_IDS = [1, 747474]
export const V3_DEFAULT_SECONDARY_CHAIN_IDS = [8453, 42161, 137]
export const V2_DEFAULT_TYPES = ['factory']
export const PROTOCOL_OPTIONS = [
  'Curve',
  'Velodrome',
  'Aerodrome',
  'Balancer',
  'Fluid',
  'Morpho',
  'Aave',
  'Sky',
  'Silo',
  'Compound'
]
export const AGGRESSIVENESS_OPTIONS = [-1, -2, -3]

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
