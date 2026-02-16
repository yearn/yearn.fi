import { config } from '../config'
import type { VaultMetadata } from '../types'

interface YDaemonVaultResponse {
  address: string
  token: {
    address: string
    symbol: string
    decimals: number
  }
  decimals: number
}

const metadataCache = new Map<string, VaultMetadata>()

export async function fetchVaultMetadata(chainId: number, vaultAddress: string): Promise<VaultMetadata | null> {
  const cacheKey = `${chainId}:${vaultAddress.toLowerCase()}`

  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey)!
  }

  const url = `${config.ydaemonBaseUrl}/${chainId}/vaults/${vaultAddress}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[yDaemon] Failed to fetch metadata for ${vaultAddress}: ${response.status}`)
      return null
    }

    const data = (await response.json()) as YDaemonVaultResponse

    const metadata: VaultMetadata = {
      address: data.address,
      chainId,
      token: {
        address: data.token.address,
        symbol: data.token.symbol,
        decimals: data.token.decimals
      },
      decimals: data.decimals
    }

    metadataCache.set(cacheKey, metadata)
    return metadata
  } catch (error) {
    console.error(`[yDaemon] Error fetching metadata for ${vaultAddress}:`, error)
    return null
  }
}

export async function fetchMultipleVaultsMetadata(
  vaults: Array<{ chainId: number; vaultAddress: string }>
): Promise<Map<string, VaultMetadata>> {
  const results = new Map<string, VaultMetadata>()

  const batchSize = 5
  for (let i = 0; i < vaults.length; i += batchSize) {
    const batch = vaults.slice(i, i + batchSize)
    const promises = batch.map(async ({ chainId, vaultAddress }) => {
      const key = `${chainId}:${vaultAddress.toLowerCase()}`
      const metadata = await fetchVaultMetadata(chainId, vaultAddress)
      return { key, metadata }
    })

    const batchResults = await Promise.all(promises)
    for (const { key, metadata } of batchResults) {
      if (metadata) {
        results.set(key, metadata)
      }
    }
  }

  return results
}
