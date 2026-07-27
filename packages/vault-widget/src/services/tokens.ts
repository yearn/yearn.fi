import { type Address, isAddress } from 'viem'
import { type WithEnsoRoutesOptions, withEnsoRoutes } from '../presets/enso'
import type { VaultWidgetConfig, VaultWidgetToken } from '../types'
import { createKongVaultConfigResolver } from './config'
import type { VaultWidgetConfigResolver } from './types'

const DEFAULT_TOKEN_LIST_URLS = [
  'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/etherscan.json',
  'https://cdn.jsdelivr.net/gh/yearn/tokenLists@main/lists/tokenlistooor.json'
] as const

type TokenListToken = {
  address: Address
  chainId: number
  decimals: number
  logoURI?: string
  name?: string
  symbol: string
}

export type VaultWidgetTokenCatalog = {
  list: (signal?: AbortSignal) => Promise<readonly VaultWidgetToken[]>
}

export type VaultWidgetTokenPriceService = {
  hydrate: (tokens: readonly VaultWidgetToken[], signal?: AbortSignal) => Promise<readonly VaultWidgetToken[]>
}

export type HttpTokenCatalogOptions = {
  fetcher?: typeof fetch
  urls?: readonly string[]
}

export type HttpTokenPriceServiceOptions = {
  endpoint?: string
  fetcher?: typeof fetch
}

export type EnsoVaultConfigResolverOptions = Omit<WithEnsoRoutesOptions, 'routeTokens'> & {
  baseResolver?: VaultWidgetConfigResolver
  priceService?: VaultWidgetTokenPriceService | false
  tokenCatalog?: VaultWidgetTokenCatalog
}

const YEARN_PRICE_CHAIN_BY_ID: Readonly<Record<number, string>> = {
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

function isTokenListToken(value: unknown): value is TokenListToken {
  if (!value || typeof value !== 'object') return false
  const token = value as Partial<TokenListToken>
  return (
    typeof token.address === 'string' &&
    isAddress(token.address) &&
    typeof token.chainId === 'number' &&
    Number.isInteger(token.chainId) &&
    typeof token.decimals === 'number' &&
    Number.isInteger(token.decimals) &&
    token.decimals >= 0 &&
    token.decimals <= 255 &&
    typeof token.symbol === 'string' &&
    token.symbol.length > 0
  )
}

function parseTokenList(payload: unknown): readonly VaultWidgetToken[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { tokens?: unknown }).tokens)) return []
  return (payload as { tokens: unknown[] }).tokens.filter(isTokenListToken).map((token) => ({
    address: token.address,
    chainId: token.chainId,
    decimals: token.decimals,
    logoURI: token.logoURI,
    name: token.name,
    symbol: token.symbol
  }))
}

export function createHttpTokenCatalog(options: HttpTokenCatalogOptions = {}): VaultWidgetTokenCatalog {
  const fetcher = options.fetcher ?? fetch
  const urls = options.urls ?? DEFAULT_TOKEN_LIST_URLS
  let cachedTokens: readonly VaultWidgetToken[] | undefined

  return {
    async list(signal) {
      if (cachedTokens) return cachedTokens
      const responses = await Promise.allSettled(
        urls.map(async (url) => {
          const response = await fetcher(url, { signal })
          if (!response.ok) throw new Error(`Unable to load token list (${response.status})`)
          return parseTokenList(await response.json())
        })
      )
      const tokens = responses.flatMap((response) => (response.status === 'fulfilled' ? response.value : []))
      if (tokens.length === 0 && responses.length > 0) throw new Error('Unable to load a valid token list')
      cachedTokens = tokens
      return cachedTokens
    }
  }
}

function getPriceKey(token: VaultWidgetToken): string | undefined {
  const chain = YEARN_PRICE_CHAIN_BY_ID[token.chainId]
  return chain ? `${chain}:${token.address.toLowerCase()}` : undefined
}

function getSpotPrice(payload: unknown, key: string): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const coins = (payload as { coins?: unknown }).coins
  if (!coins || typeof coins !== 'object') return undefined
  const coin = (coins as Record<string, unknown>)[key]
  if (!coin || typeof coin !== 'object') return undefined
  const prices = (coin as { prices?: unknown }).prices
  if (!Array.isArray(prices)) return undefined
  const price = prices
    .map((point) => (point && typeof point === 'object' ? (point as { price?: unknown }).price : undefined))
    .find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
  return price
}

export function createHttpTokenPriceService(options: HttpTokenPriceServiceOptions = {}): VaultWidgetTokenPriceService {
  const endpoint = options.endpoint ?? '/api/prices/spot'
  const fetcher = options.fetcher ?? fetch

  return {
    async hydrate(tokens, signal) {
      const tokenKeys = tokens.flatMap((token) => {
        const key = getPriceKey(token)
        return key ? [{ key, token }] : []
      })
      const batches = Array.from({ length: Math.ceil(tokenKeys.length / 50) }, (_, index) =>
        tokenKeys.slice(index * 50, (index + 1) * 50)
      )
      const responses = await Promise.allSettled(
        batches.map(async (batch) => {
          const url = new URL(endpoint, globalThis.location?.origin ?? 'http://localhost')
          url.searchParams.set('coins', JSON.stringify(batch.map(({ key }) => key)))
          const response = await fetcher(endpoint.startsWith('/') ? `${url.pathname}${url.search}` : url.toString(), {
            signal
          })
          if (!response.ok) throw new Error(`Unable to load token prices (${response.status})`)
          return response.json() as Promise<unknown>
        })
      )
      const payloads = responses.flatMap((response) => (response.status === 'fulfilled' ? [response.value] : []))
      return tokens.map((token) => {
        const key = getPriceKey(token)
        const priceUsd = key ? payloads.map((payload) => getSpotPrice(payload, key)).find(Boolean) : undefined
        return priceUsd ? { ...token, priceUsd } : token
      })
    }
  }
}

function isPackageSpecificConfig(config: VaultWidgetConfig): boolean {
  return config.id === 'ybold-mainnet' || config.id.startsWith('yvUSD:') || config.id.startsWith('yvBTC:')
}

function getConfiguredDefaultToken(
  tokens: readonly VaultWidgetToken[],
  configuredAddress: VaultWidgetConfig['defaultDepositToken']
): VaultWidgetToken | undefined {
  return configuredAddress
    ? (tokens.find(({ address }) => address.toLowerCase() === configuredAddress.toLowerCase()) ?? tokens[0])
    : tokens[0]
}

function getDefaultRouteTokens(config: VaultWidgetConfig): readonly VaultWidgetToken[] {
  return [
    getConfiguredDefaultToken(config.depositTokens, config.defaultDepositToken),
    getConfiguredDefaultToken(config.withdrawTokens, config.defaultWithdrawToken)
  ]
    .flatMap((token) => (token ? [token] : []))
    .reduce<VaultWidgetToken[]>(
      (tokens, token) =>
        tokens.some(
          (candidate) =>
            candidate.chainId === token.chainId && candidate.address.toLowerCase() === token.address.toLowerCase()
        )
          ? tokens
          : tokens.concat(token),
      []
    )
}

function mergeHydratedTokens(
  tokens: readonly VaultWidgetToken[],
  hydratedTokens: readonly VaultWidgetToken[]
): readonly VaultWidgetToken[] {
  return tokens.map((token) => {
    const hydratedToken = hydratedTokens.find(
      (candidate) =>
        candidate.chainId === token.chainId && candidate.address.toLowerCase() === token.address.toLowerCase()
    )
    return hydratedToken ? { ...token, ...hydratedToken } : token
  })
}

export function createEnsoVaultConfigResolver(options: EnsoVaultConfigResolverOptions = {}): VaultWidgetConfigResolver {
  const baseResolver = options.baseResolver ?? createKongVaultConfigResolver()
  const tokenCatalog = options.tokenCatalog ?? createHttpTokenCatalog()
  const priceService =
    options.priceService === false ? undefined : (options.priceService ?? createHttpTokenPriceService())

  return {
    async resolve(chainId, vaultAddress, signal) {
      const config = await baseResolver.resolve(chainId, vaultAddress, signal)
      if (isPackageSpecificConfig(config)) return config
      const catalogTokens = await tokenCatalog.list(signal)
      const tokens = [...config.depositTokens, ...config.withdrawTokens, ...catalogTokens]
      const defaultRouteTokens = getDefaultRouteTokens(config)
      const tokensToHydrate = defaultRouteTokens.filter(({ priceUsd }) => priceUsd === undefined)
      const hydratedTokens =
        priceService && tokensToHydrate.length > 0
          ? await priceService.hydrate(tokensToHydrate, signal).catch(() => [])
          : []
      const routeTokens = mergeHydratedTokens(tokens, hydratedTokens)
      return withEnsoRoutes(config, {
        defaultDepositTokens: options.defaultDepositTokens,
        defaultWithdrawTokens: options.defaultWithdrawTokens,
        endpoint: options.endpoint,
        enso: options.enso,
        routeTokens,
        routerByChain: options.routerByChain,
        selectorChains: options.selectorChains,
        slippageBps: options.slippageBps
      })
    }
  }
}

export { DEFAULT_TOKEN_LIST_URLS }
