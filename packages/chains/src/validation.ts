import { APP_PROFILES, type TAppId, type TChainPolicy } from '@yearn/chains/profiles'
import { CHAIN_REGISTRY, type TChainRegistration, type TPriceProvider } from '@yearn/chains/registry'
import { isHttpUrl } from '@yearn/chains/rpc'
import { isAddress, zeroAddress } from 'viem'

const validAddress = (value: string) => isAddress(value, { strict: false }) && value.toLowerCase() !== zeroAddress
export function validateChainConfiguration(
  registry: readonly TChainRegistration[] = CHAIN_REGISTRY,
  profiles: Record<TAppId, readonly TChainPolicy[]> = APP_PROFILES
): string[] {
  const errors: string[] = []
  const ids = new Set<number>()
  registry.forEach(({ chain, wrappedNative, enso, prices }) => {
    if (!Number.isSafeInteger(chain.id) || chain.id <= 0 || ids.has(chain.id))
      errors.push(`Invalid or duplicate chain ID ${chain.id}`)
    ids.add(chain.id)
    if (!chain.name || !chain.nativeCurrency.symbol || !Number.isInteger(chain.nativeCurrency.decimals))
      errors.push(`Chain ${chain.id}: missing native currency or name`)
    if (!chain.blockExplorers?.default.url || !isHttpUrl(chain.blockExplorers.default.url))
      errors.push(`Chain ${chain.id}: missing HTTP(S) explorer`)
    if (wrappedNative && !validAddress(wrappedNative)) errors.push(`Chain ${chain.id}: invalid wrapped native address`)
    if (enso && (!validAddress(enso.router) || !isHttpUrl(enso.source)))
      errors.push(`Chain ${chain.id}: Enso needs a valid router and source URL`)
    Object.entries(prices).forEach(([provider, slug]) => {
      if (!['yearn-prices', 'defillama'].includes(provider) || !/^[a-z0-9-]+$/.test(slug ?? ''))
        errors.push(`Chain ${chain.id}: invalid ${provider} identifier`)
    })
  })
  ;(['yearn-prices', 'defillama'] as TPriceProvider[]).forEach((provider) => {
    const names = registry.flatMap(({ prices }) => (prices[provider] ? [prices[provider]] : []))
    if (new Set(names).size !== names.length) errors.push(`Duplicate ${provider} identifiers`)
  })
  Object.entries(profiles).forEach(([app, entries]) => {
    if (!entries.length) errors.push(`${app}: no chains enabled`)
    if (new Set(entries.map(({ id }) => id)).size !== entries.length) errors.push(`${app}: duplicate chain IDs`)
    entries.forEach((entry) => {
      const registration = registry.find(({ chain }) => chain.id === entry.id)
      if (!registration) {
        errors.push(`${app}: unregistered chain ${entry.id}`)
        return
      }
      const rpc = entry.rpcDefault ?? registration.chain.rpcUrls.default.http[0]
      if (!rpc || !isHttpUrl(rpc)) errors.push(`${app} chain ${entry.id}: missing HTTP(S) RPC default`)
      if (entry.ensoOrder !== undefined && !registration.enso)
        errors.push(`${app} chain ${entry.id}: routing enabled without a verified Enso router`)
      if (entry.history && (!registration.prices['yearn-prices'] || !registration.prices.defillama))
        errors.push(`${app} chain ${entry.id}: history needs identifiers for both supported price providers`)
      if (entry.v3Filter && !entry.vaults?.includes('v3'))
        errors.push(`${app} chain ${entry.id}: V3 filter placement requires V3 vault support`)
      if (entry.vaults?.length && entry.vaultOrder === undefined)
        errors.push(`${app} chain ${entry.id}: vault listing needs an order`)
      ;[...(entry.depositTokens ?? []), ...(entry.withdrawTokens ?? [])].forEach((address) => {
        if (!validAddress(address)) errors.push(`${app} chain ${entry.id}: invalid common token address`)
      })
    })
  })
  return errors
}
