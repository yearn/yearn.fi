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
  const parsedData = schema.safeParse(data)

  if (!parsedData.success) {
    console.error(`[useFetch] Schema validation failed for ${endpoint}:`, parsedData.error)
    throw new Error('Schema validation failed')
  }

  return parsedData.data
}
