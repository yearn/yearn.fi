import type { TAddress } from '@shared/types'
import {
  ARB_WETH_TOKEN_ADDRESS,
  BASE_WETH_TOKEN_ADDRESS,
  ETH_TOKEN_ADDRESS,
  OPT_WETH_TOKEN_ADDRESS,
  WETH_TOKEN_ADDRESS,
  WFTM_TOKEN_ADDRESS
} from './constants'
import type { TYearnPricesSpotResponse } from './schemas/yearnPricesSpotSchema'
import { toAddress } from './tools.address'
import { isZeroAddress } from './tools.is'

export type TYearnPriceToken = {
  address?: string | null
  chainID?: number | null
}

export type TYearnPricesByChain = Record<number, Partial<Record<TAddress, number>>>

export const YEARN_PRICES_CHAIN_NAME_BY_ID = {
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
} as const

const YEARN_PRICES_CHAIN_ID_BY_NAME = Object.fromEntries(
  Object.entries(YEARN_PRICES_CHAIN_NAME_BY_ID).map(([chainID, name]) => [name, Number(chainID)])
) as Record<string, number>

const NATIVE_WRAPPER_BY_CHAIN_ID: Partial<Record<number, TAddress>> = {
  1: WETH_TOKEN_ADDRESS,
  10: OPT_WETH_TOKEN_ADDRESS,
  250: WFTM_TOKEN_ADDRESS,
  8453: BASE_WETH_TOKEN_ADDRESS,
  42161: ARB_WETH_TOKEN_ADDRESS
}

function resolveSpotAddress(address: string | null | undefined, chainID: number): TAddress | null {
  const normalizedAddress = toAddress(address)
  if (isZeroAddress(normalizedAddress)) {
    return null
  }

  if (normalizedAddress.toLowerCase() === ETH_TOKEN_ADDRESS.toLowerCase()) {
    return NATIVE_WRAPPER_BY_CHAIN_ID[chainID] ?? normalizedAddress
  }

  return normalizedAddress
}

function splitSpotKey(key: string): { chainName: string; address: TAddress } | null {
  const [chainNameRaw, addressRaw, ...rest] = key.split(':')
  if (!chainNameRaw || !addressRaw || rest.length > 0) {
    return null
  }

  const chainName = chainNameRaw.toLowerCase()
  const chainID = YEARN_PRICES_CHAIN_ID_BY_NAME[chainName]
  if (!chainID) {
    return null
  }

  const address = resolveSpotAddress(addressRaw, chainID)
  if (!address) {
    return null
  }

  return { chainName, address }
}

export function buildYearnPricesSpotKey(token: TYearnPriceToken | null | undefined): string | null {
  const chainID = token?.chainID ?? null
  if (!chainID) {
    return null
  }

  const chainName = YEARN_PRICES_CHAIN_NAME_BY_ID[chainID as keyof typeof YEARN_PRICES_CHAIN_NAME_BY_ID]
  if (!chainName) {
    return null
  }

  const address = resolveSpotAddress(token?.address, chainID)
  if (!address) {
    return null
  }

  return `${chainName}:${address.toLowerCase()}`
}

export function normalizeYearnPricesSpotKeys(keys: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      keys.flatMap((key) => {
        if (!key) {
          return []
        }

        const parsed = splitSpotKey(key)
        return parsed ? [`${parsed.chainName}:${parsed.address.toLowerCase()}`] : []
      })
    )
  ].sort((left, right) => left.localeCompare(right))
}

export function buildYearnPricesSpotKeys(tokens: Array<TYearnPriceToken | null | undefined>): string[] {
  return normalizeYearnPricesSpotKeys(tokens.map((token) => buildYearnPricesSpotKey(token)))
}

function parseResponseSpotKey(key: string): { chainID: number; address: TAddress } | null {
  const parsed = splitSpotKey(key)
  if (!parsed) {
    return null
  }

  const chainID = YEARN_PRICES_CHAIN_ID_BY_NAME[parsed.chainName]
  if (!chainID) {
    return null
  }

  return { chainID, address: parsed.address }
}

export function mergeYearnPricesByChain(priceMaps: TYearnPricesByChain[]): TYearnPricesByChain {
  return priceMaps.reduce<TYearnPricesByChain>((acc, priceMap) => {
    return Object.entries(priceMap).reduce<TYearnPricesByChain>((chainAcc, [chainID, chainPrices]) => {
      const normalizedChainID = Number(chainID)
      chainAcc[normalizedChainID] = Object.assign({}, chainAcc[normalizedChainID] ?? {}, chainPrices)
      return chainAcc
    }, acc)
  }, {})
}

export function normalizeYearnPricesSpotResponse(response: TYearnPricesSpotResponse): TYearnPricesByChain {
  return Object.entries(response.coins).reduce<TYearnPricesByChain>((acc, [spotKey, coin]) => {
    const parsed = parseResponseSpotKey(spotKey)
    const price = coin.prices.find((point) => Number.isFinite(point.price) && point.price > 0)?.price ?? 0
    if (!parsed || price <= 0) {
      return acc
    }

    acc[parsed.chainID] = Object.assign({}, acc[parsed.chainID] ?? {}, { [parsed.address]: price })
    return acc
  }, {})
}

export const EMPTY_YEARN_PRICES_BY_CHAIN: TYearnPricesByChain = {}
