import { APP_PROFILES, type TAppId, YEARN_PROFILE } from '@yearn/chains/profiles'
import { CHAIN_REGISTRY, type TPriceProvider } from '@yearn/chains/registry'
import type { Address, Chain } from 'viem'

export const getChainRegistration = (id: number) => CHAIN_REGISTRY.find(({ chain }) => chain.id === id)
export const getRegisteredChain = (id: number) => getChainRegistration(id)?.chain
export function requireChain(id: number): Chain {
  const chain = getRegisteredChain(id)
  if (!chain) throw new Error(`Unregistered chain ${id}`)
  return chain
}
export function getAppChains(app: TAppId): [Chain, ...Chain[]] {
  const chains = APP_PROFILES[app].map(({ id }) => requireChain(id))
  if (!chains.length) throw new Error(`No chains configured for ${app}`)
  return chains as [Chain, ...Chain[]]
}
export const getAppChain = (app: TAppId, id: number) =>
  APP_PROFILES[app].some((entry) => entry.id === id) ? getRegisteredChain(id) : undefined
export const getPriceChainName = (id: number, provider: TPriceProvider) => getChainRegistration(id)?.prices[provider]
export const getWrappedNativeAddress = (id: number) => getChainRegistration(id)?.wrappedNative
export const getEnsoRouter = (id: number) => getChainRegistration(id)?.enso?.router
export const PRICE_CHAIN_NAMES: Readonly<Partial<Record<number, string>>> = Object.fromEntries(
  CHAIN_REGISTRY.flatMap(({ chain, prices }) => (prices['yearn-prices'] ? [[chain.id, prices['yearn-prices']]] : []))
)
export const ENSO_ROUTERS: Readonly<Partial<Record<number, Address>>> = Object.fromEntries(
  CHAIN_REGISTRY.flatMap(({ chain, enso }) => (enso ? [[chain.id, enso.router]] : []))
)
export function getVaultChainIds(version: 'v2' | 'v3' | 'all'): number[] {
  const entries = YEARN_PROFILE.filter(({ vaults }) =>
    version === 'all' ? Boolean(vaults?.length) : vaults?.includes(version)
  )
  return (version === 'v2' ? entries : [...entries].sort((a, b) => (a.vaultOrder ?? 0) - (b.vaultOrder ?? 0))).map(
    ({ id }) => id
  )
}
export const getVaultFilterChainIds = (placement: 'primary' | 'secondary') =>
  getVaultChainIds('v3').filter((id) => YEARN_PROFILE.find((entry) => entry.id === id)?.v3Filter === placement)
export const getHistoryChainIds = () => YEARN_PROFILE.filter(({ history }) => history).map(({ id }) => id)
export const getRpcBalanceFallbackChainIds = () =>
  YEARN_PROFILE.filter(({ rpcBalanceFallback }) => rpcBalanceFallback).map(({ id }) => id)
export const getNativeBalanceChains = () =>
  YEARN_PROFILE.filter(({ nativeBalance }) => nativeBalance).map(({ id }) => requireChain(id))
export const getRoutingChains = (app: TAppId) =>
  APP_PROFILES[app]
    .filter(({ ensoOrder }) => ensoOrder !== undefined)
    .slice()
    .sort((a, b) => (a.ensoOrder ?? 0) - (b.ensoOrder ?? 0))
    .map(({ id }) => ({ id, name: getChainRegistration(id)?.displayName ?? requireChain(id).name }))
export const getCommonTokens = (app: TAppId, action: 'deposit' | 'withdraw'): Record<number, Address[]> =>
  Object.fromEntries(
    APP_PROFILES[app].flatMap((entry) => {
      const tokens = action === 'deposit' ? entry.depositTokens : entry.withdrawTokens
      return tokens ? [[entry.id, [...tokens]]] : []
    })
  )
