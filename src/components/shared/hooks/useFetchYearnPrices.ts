import { useDeepCompareMemo } from '@react-hookz/web'
import {
  buildYearnPricesSpotKeys,
  EMPTY_YEARN_PRICES_BY_CHAIN,
  mergeYearnPricesByChain,
  normalizeYearnPricesSpotResponse,
  type TYearnPricesByChain,
  type TYearnPriceToken
} from '@shared/utils/yearnPrices'
import { keepPreviousData, useQueries } from '@tanstack/react-query'
import { yearnPricesSpotResponseSchema } from '../utils/schemas/yearnPricesSpotSchema'
import { fetchWithSchema, getFetchQueryKey } from './useFetch'

const SPOT_BATCH_SIZE = 50
const SPOT_CACHE_DURATION = 120 * 1000

function buildSpotEndpoint(keys: string[]): string | null {
  if (keys.length === 0) {
    return null
  }
  return `/api/prices/spot?coins=${encodeURIComponent(JSON.stringify(keys))}`
}

function chunkSpotKeys(keys: string[]): string[][] {
  return Array.from({ length: Math.ceil(keys.length / SPOT_BATCH_SIZE) }, (_, index) =>
    keys.slice(index * SPOT_BATCH_SIZE, (index + 1) * SPOT_BATCH_SIZE)
  )
}

function useFetchYearnPrices(tokens: Array<TYearnPriceToken | null | undefined>): TYearnPricesByChain {
  const priceKeys = buildYearnPricesSpotKeys(tokens)
  const keySignature = priceKeys.join('|')
  const keyBatches = chunkSpotKeys(priceKeys)
  const queries = useQueries({
    queries: keyBatches.map((batch) => {
      const endpoint = buildSpotEndpoint(batch)
      return {
        queryKey: getFetchQueryKey(endpoint) ?? ['fetch', 'yearn-prices-spot-disabled'],
        enabled: Boolean(endpoint),
        queryFn: () => fetchWithSchema(endpoint as string, yearnPricesSpotResponseSchema),
        staleTime: SPOT_CACHE_DURATION,
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData
      }
    })
  })
  const responseData = queries.map((query) => query.data)

  return useDeepCompareMemo((): TYearnPricesByChain => {
    if (!keySignature) {
      return EMPTY_YEARN_PRICES_BY_CHAIN
    }
    return mergeYearnPricesByChain(
      responseData.flatMap((response) => (response ? [normalizeYearnPricesSpotResponse(response)] : []))
    )
  }, [keySignature, responseData])
}

export { useFetchYearnPrices }
