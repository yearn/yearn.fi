import { ENSO_ROUTERS } from '@yearn/chains'
import { toAddress } from '@yearn/vault-widget/internal/utils'
import { type Address, isAddressEqual } from 'viem'

export const KNOWN_ENSO_ROUTER_ADDRESSES_BY_CHAIN = ENSO_ROUTERS

export const UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE = 'This approval address is not a known Enso router address.'

export function getKnownEnsoRouterAddress(chainId: number): Address | undefined {
  return KNOWN_ENSO_ROUTER_ADDRESSES_BY_CHAIN[chainId]
}

export function getValidatedEnsoRouterAddress({
  chainId,
  routerAddress,
  routeChainId = chainId
}: {
  chainId: number
  routerAddress?: string | null
  routeChainId?: number
}): Address | undefined {
  const knownRouterAddress = getKnownEnsoRouterAddress(chainId)

  if (!knownRouterAddress || !routerAddress || routeChainId !== chainId) {
    return undefined
  }

  return isAddressEqual(toAddress(routerAddress), knownRouterAddress) ? knownRouterAddress : undefined
}
