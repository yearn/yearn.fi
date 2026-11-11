import type { z } from 'zod'
import { baseFetcher } from './fetchers'

export type TFetchQueryKey = ['fetch', string]

export const getFetchQueryKey = (endpoint: string | null | undefined): TFetchQueryKey | null => {
  if (!endpoint) {
    return null
  }
  return ['fetch', endpoint]
}

export async function fetchWithSchema<T>(
  endpoint: string,
  schema: z.Schema<T>,
  options?: { timeout?: number }
): Promise<T> {
  const data = await baseFetcher<T>(endpoint, { timeout: options?.timeout })

  // Temporary playground override: expose migration availability for Legacy yvUSD.
  const legacyYvUsdAddress = '0x696d02db93291651ed510704c9b286841d506987'
  if (endpoint.endsWith('/list/vaults') && Array.isArray(data)) {
    const vault = data.find((item) => item.chainId === 1 && item.address?.toLowerCase() === legacyYvUsdAddress)
    if (vault) vault.migration = true
  }
  if (endpoint.toLowerCase().endsWith(`/snapshot/1/${legacyYvUsdAddress}`)) {
    const vault = data as { meta?: { migration?: Record<string, unknown> } }
    vault.meta = { ...vault.meta, migration: { ...vault.meta?.migration, available: true } }
  }

  const parsedData = schema.safeParse(data)

  if (!parsedData.success) {
    console.error(`[useFetch] Schema validation failed for ${endpoint}:`, parsedData.error)
    throw new Error('Schema validation failed')
  }

  return parsedData.data
}
