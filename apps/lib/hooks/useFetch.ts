/************************************************************************************************
 * Enhanced useFetch hook with improved caching capabilities
 * Uses SWR for intelligent caching, deduplication, and background revalidation
 * Supports Zod schema validation with comprehensive error handling
 ************************************************************************************************/

import type { SWRResponse } from 'swr'
import useSWR from 'swr'
import type { z } from 'zod'
import { baseFetcher } from '../utils/fetchers'

type TUseZodProps<T> = {
  endpoint: string | null
  schema: z.ZodSchema
  config?: Parameters<typeof useSWR<T>>[2] & {
    /** Cache duration in milliseconds (default: 2 minutes) */
    cacheDuration?: number
    /** Enable background revalidation on interval (default: false) */
    shouldEnableRefreshInterval?: boolean
    /** Refresh interval in milliseconds (default: 30 seconds) */
    refreshInterval?: number
    /** Maximum number of retries on error (default: 3) */
    maxRetries?: number
  }
}

export function useFetch<T>({ endpoint, schema, config }: TUseZodProps<T>): SWRResponse<T> & { isSuccess: boolean } {
  const {
    cacheDuration = 2 * 60 * 1000, // 2 minutes
    shouldEnableRefreshInterval = false,
    refreshInterval = 30 * 1000, // 30 seconds
    maxRetries = 3,
    ...swrConfig
  } = config ?? {}

  const result = useSWR<T>(endpoint, baseFetcher, {
    // Caching configuration
    revalidateOnFocus: false,
    revalidateIfStale: true,
    dedupingInterval: cacheDuration,

    // Background revalidation
    refreshInterval: shouldEnableRefreshInterval ? refreshInterval : 0,
    refreshWhenHidden: false,
    refreshWhenOffline: false,

    // Error handling and retries
    // Don't hammer on hard network/CORS failures; retry a few times with backoff otherwise
    shouldRetryOnError: (err: unknown): boolean => {
      // AxiosError shape detection without direct import
      const anyErr = err as any
      const status = anyErr?.response?.status as number | undefined
      const code = anyErr?.code as string | undefined
      const isNetworkLike = code === 'ERR_NETWORK' || (!anyErr?.response && anyErr?.request)
      // Avoid retrying on obvious permanent failures
      if (isNetworkLike) return false
      if (typeof status === 'number' && status >= 400 && status < 500) return false
      return true
    },
    errorRetryCount: maxRetries,
    errorRetryInterval: 1000,
    onErrorRetry: (err, _key, _config, revalidate, opts): void => {
      const anyErr = err as any
      const status = anyErr?.response?.status as number | undefined
      const code = anyErr?.code as string | undefined
      const isNetworkLike = code === 'ERR_NETWORK' || (!anyErr?.response && anyErr?.request)
      if (isNetworkLike) return
      if (typeof status === 'number' && status >= 400 && status < 500) return
      const count = opts.retryCount || 0
      const delay = Math.min(1000 * 2 ** count, 15000)
      setTimeout(() => revalidate(opts), delay)
    },

    // Performance optimizations
    revalidateOnMount: true,
    keepPreviousData: true,

    // Override with user config
    ...swrConfig
  })

  if (!result.data || result.isLoading || result.isValidating) {
    return { ...result, isSuccess: false }
  }

  if (result.error) {
    console.error(`[useFetch] Error fetching ${endpoint}:`, result.error)
    return { ...result, isSuccess: false }
  }

  const parsedData = schema.safeParse(result.data)

  if (!parsedData.success) {
    console.error(`[useFetch] Schema validation failed for ${endpoint}:`, parsedData.error)
    return { ...result, isSuccess: false }
  }

  return { ...result, data: parsedData.data, isSuccess: true }
}
