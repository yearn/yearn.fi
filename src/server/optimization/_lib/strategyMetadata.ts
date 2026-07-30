export type StrategyNameSource = 'optimizer' | 'current-metadata-catalog'

export interface StrategyMetadata {
  name: string
  source: 'current-metadata-catalog'
}

interface KongCompositionStrategy {
  address?: string | null
  name?: string | null
}

interface KongVaultSnapshot {
  composition?: KongCompositionStrategy[] | null
}

const STRATEGY_METADATA_CACHE_TTL_MS = 10 * 60 * 1000
const strategyMetadataCache = new Map<string, { expiresAt: number; value: Map<string, StrategyMetadata> }>()

export async function fetchCurrentStrategyMetadata(
  chainId: number,
  vaultAddress: string
): Promise<Map<string, StrategyMetadata>> {
  const cacheKey = `${chainId}:${vaultAddress.toLowerCase()}`
  const cached = strategyMetadataCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const kongRestUrl = process.env.NEXT_PUBLIC_KONG_REST_URL
  if (!kongRestUrl) {
    return new Map()
  }

  const response = await fetch(`${kongRestUrl}/snapshot/${chainId}/${vaultAddress}`, {
    signal: AbortSignal.timeout(4000)
  })
  if (!response.ok) {
    throw new Error(`Kong strategy metadata request failed: HTTP ${response.status}`)
  }

  const snapshot = (await response.json()) as KongVaultSnapshot
  const metadata = (snapshot.composition ?? []).reduce((strategies, strategy) => {
    const address = strategy.address?.toLowerCase()
    const name = strategy.name?.trim()
    if (address && name) {
      strategies.set(address, { name, source: 'current-metadata-catalog' })
    }
    return strategies
  }, new Map<string, StrategyMetadata>())

  strategyMetadataCache.set(cacheKey, {
    expiresAt: Date.now() + STRATEGY_METADATA_CACHE_TTL_MS,
    value: metadata
  })
  return metadata
}
