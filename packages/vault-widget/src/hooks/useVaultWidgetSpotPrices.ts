'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ARB_WETH_TOKEN_ADDRESS,
  BASE_WETH_TOKEN_ADDRESS,
  ETH_TOKEN_ADDRESS,
  OPT_WETH_TOKEN_ADDRESS,
  WETH_TOKEN_ADDRESS,
  WFTM_TOKEN_ADDRESS,
  ZERO_ADDRESS
} from '@yearn/vault-widget/internal/utils/constants'
import { useVaultWidgetRuntime, type VaultWidgetTokenReference } from '@yearn/vault-widget/runtime'
import { useCallback } from 'react'
import { isAddress } from 'viem'

const SPOT_PRICE_BATCH_SIZE = 50
const SPOT_PRICE_STALE_TIME = 120_000
const SPOT_PRICE_GC_TIME = 10 * 60_000

const YEARN_PRICE_CHAIN_NAME_BY_ID: Readonly<Record<number, string>> = {
  1: 'ethereum',
  10: 'optimism',
  100: 'gnosis',
  137: 'polygon',
  146: 'sonic',
  250: 'fantom',
  8453: 'base',
  42161: 'arbitrum',
  80094: 'berachain',
  747474: 'katana'
}
const YEARN_PRICE_CHAIN_NAMES = new Set(Object.values(YEARN_PRICE_CHAIN_NAME_BY_ID))

const NATIVE_WRAPPER_BY_CHAIN_ID: Readonly<Partial<Record<number, `0x${string}`>>> = {
  1: WETH_TOKEN_ADDRESS,
  10: OPT_WETH_TOKEN_ADDRESS,
  250: WFTM_TOKEN_ADDRESS,
  8453: BASE_WETH_TOKEN_ADDRESS,
  42161: ARB_WETH_TOKEN_ADDRESS
}

type TSpotPriceToken = VaultWidgetTokenReference | null | undefined
type TSpotPrices = Readonly<Record<string, number>>
type TFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPositivePrice(value: unknown): number {
  const price = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(price) && price > 0 ? price : 0
}

function normalizeResponseKey(key: string): string | null {
  const [chainName, address, ...rest] = key.split(':')
  const normalizedChainName = chainName?.toLowerCase()
  const normalizedAddress = address?.toLowerCase()
  if (
    !normalizedChainName ||
    !YEARN_PRICE_CHAIN_NAMES.has(normalizedChainName) ||
    !normalizedAddress ||
    !isAddress(normalizedAddress) ||
    rest.length > 0
  ) {
    return null
  }

  return `${normalizedChainName}:${normalizedAddress}`
}

function chunkPriceKeys(priceKeys: readonly string[]): string[][] {
  return Array.from({ length: Math.ceil(priceKeys.length / SPOT_PRICE_BATCH_SIZE) }, (_, index) =>
    priceKeys.slice(index * SPOT_PRICE_BATCH_SIZE, (index + 1) * SPOT_PRICE_BATCH_SIZE)
  )
}

export function buildVaultWidgetSpotPriceKey(token: VaultWidgetTokenReference): string | null {
  const chainName = YEARN_PRICE_CHAIN_NAME_BY_ID[token.chainId]
  const normalizedAddress = token.address.toLowerCase()
  if (!chainName || !isAddress(normalizedAddress) || normalizedAddress === ZERO_ADDRESS.toLowerCase()) {
    return null
  }

  const priceAddress =
    normalizedAddress === ETH_TOKEN_ADDRESS.toLowerCase()
      ? (NATIVE_WRAPPER_BY_CHAIN_ID[token.chainId] ?? token.address)
      : token.address
  return `${chainName}:${priceAddress.toLowerCase()}`
}

export function buildVaultWidgetSpotPriceKeys(tokens: readonly TSpotPriceToken[]): string[] {
  return [
    ...new Set(
      tokens.flatMap((token) => {
        if (!token) {
          return []
        }

        const key = buildVaultWidgetSpotPriceKey(token)
        return key ? [key] : []
      })
    )
  ].sort((left, right) => left.localeCompare(right))
}

export function buildVaultWidgetSpotPriceRequestUrl(endpoint: string, priceKeys: readonly string[]): string {
  const separator = endpoint.includes('?') ? '&' : '?'
  return `${endpoint}${separator}coins=${encodeURIComponent(JSON.stringify(priceKeys))}`
}

export function parseVaultWidgetSpotPriceResponse(payload: unknown): TSpotPrices {
  if (!isRecord(payload) || !isRecord(payload.coins)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(payload.coins).flatMap(([rawKey, rawCoin]) => {
      const key = normalizeResponseKey(rawKey)
      if (!key || !isRecord(rawCoin) || !Array.isArray(rawCoin.prices)) {
        return []
      }

      const price = rawCoin.prices
        .map((point) => (isRecord(point) ? toPositivePrice(point.price) : 0))
        .find((candidate) => candidate > 0)
      return price ? [[key, price] as const] : []
    })
  )
}

export async function fetchVaultWidgetSpotPrices({
  endpoint,
  priceKeys,
  signal,
  fetcher = fetch
}: {
  endpoint: string
  priceKeys: readonly string[]
  signal?: AbortSignal
  fetcher?: TFetcher
}): Promise<TSpotPrices> {
  const batches = chunkPriceKeys(priceKeys)
  if (batches.length === 0) {
    return {}
  }

  const batchPrices = await Promise.all(
    batches.map(async (batch) => {
      const response = await fetcher(buildVaultWidgetSpotPriceRequestUrl(endpoint, batch), { signal })
      if (!response.ok) {
        throw new Error(`Unable to fetch widget spot prices (${response.status})`)
      }

      return parseVaultWidgetSpotPriceResponse(await response.json())
    })
  )
  return Object.assign({}, ...batchPrices)
}

export function resolveVaultWidgetSpotPrice({
  fetchedPrices,
  runtimePrice,
  token
}: {
  fetchedPrices?: TSpotPrices
  runtimePrice: number
  token: VaultWidgetTokenReference
}): number {
  const key = buildVaultWidgetSpotPriceKey(token)
  const fetchedPrice = key ? toPositivePrice(fetchedPrices?.[key]) : 0
  return fetchedPrice || toPositivePrice(runtimePrice)
}

export function useVaultWidgetSpotPrices(tokens: readonly TSpotPriceToken[]): {
  getUsdPrice: (token: VaultWidgetTokenReference) => number
  isLoading: boolean
} {
  const { prices } = useVaultWidgetRuntime()
  const endpoint = prices.spotPriceEndpoint?.trim() || undefined
  const priceKeys = buildVaultWidgetSpotPriceKeys(tokens)
  const query = useQuery({
    queryKey: ['vault-widget', 'spot-prices', endpoint, priceKeys],
    queryFn: ({ signal }) =>
      endpoint ? fetchVaultWidgetSpotPrices({ endpoint, priceKeys, signal }) : Promise.resolve({}),
    enabled: Boolean(endpoint && priceKeys.length > 0),
    staleTime: SPOT_PRICE_STALE_TIME,
    gcTime: SPOT_PRICE_GC_TIME,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: 1
  })

  const getUsdPrice = useCallback(
    (token: VaultWidgetTokenReference): number =>
      resolveVaultWidgetSpotPrice({
        fetchedPrices: query.data,
        runtimePrice: prices.getUsdPrice(token),
        token
      }),
    [prices, query.data]
  )

  return {
    getUsdPrice,
    isLoading: query.isFetching
  }
}
