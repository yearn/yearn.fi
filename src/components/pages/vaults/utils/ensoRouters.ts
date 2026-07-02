import { toAddress } from '@shared/utils'
import { type Address, isAddressEqual } from 'viem'

export const KNOWN_ENSO_ROUTER_ADDRESSES_BY_CHAIN: Record<number, Address> = {
  1: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  10: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  137: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  42161: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  8453: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf',
  747474: '0x3067BDBa0e6628497d527bEF511c22DA8b32cA3F'
}

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
