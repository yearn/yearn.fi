/*******************************************************************************
 ** Shared configuration for balance query hooks
 ******************************************************************************/

/*******************************************************************************
 ** Cache configuration per chain - different chains have different rate limits
 ******************************************************************************/
export const CHAIN_CACHE_CONFIG: Record<number, { staleTime: number; gcTime: number }> = {
  // Mainnet - longer cache times
  1: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 }, // 5 min stale, 10 min cache
  // Optimism
  10: { staleTime: 3 * 60 * 1000, gcTime: 7 * 60 * 1000 },
  // BSC
  56: { staleTime: 3 * 60 * 1000, gcTime: 7 * 60 * 1000 },
  // Polygon
  137: { staleTime: 3 * 60 * 1000, gcTime: 7 * 60 * 1000 },
  // Arbitrum
  42161: { staleTime: 3 * 60 * 1000, gcTime: 7 * 60 * 1000 },
  // Base - longer cache due to rate limiting issues
  8453: { staleTime: 10 * 60 * 1000, gcTime: 15 * 60 * 1000 }
}

export const DEFAULT_CACHE_CONFIG = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 }

export function getChainCacheConfig(chainId: number) {
  return CHAIN_CACHE_CONFIG[chainId] || DEFAULT_CACHE_CONFIG
}

/*******************************************************************************
 ** Rate limiting configuration per chain
 ******************************************************************************/
export const CHAIN_RATE_LIMITS: Record<number, { maxConcurrent: number; delayMs: number }> = {
  // Base - most restrictive due to rate limiting
  8453: { maxConcurrent: 2, delayMs: 500 },
  // Other chains with moderate limits
  1: { maxConcurrent: 5, delayMs: 100 },
  10: { maxConcurrent: 3, delayMs: 200 },
  56: { maxConcurrent: 3, delayMs: 200 },
  137: { maxConcurrent: 3, delayMs: 200 },
  42161: { maxConcurrent: 3, delayMs: 200 }
}

export const DEFAULT_RATE_LIMIT = { maxConcurrent: 3, delayMs: 200 }

export function getChainRateLimit(chainId: number) {
  return CHAIN_RATE_LIMITS[chainId] || DEFAULT_RATE_LIMIT
}

export function getChainConfig(chainId: number) {
  return {
    cache: getChainCacheConfig(chainId),
    rateLimit: getChainRateLimit(chainId)
  }
}
