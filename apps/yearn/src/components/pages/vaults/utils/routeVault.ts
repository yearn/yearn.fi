import { getVaultAddress, getVaultChainID, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import { isAddressEqual } from 'viem'

type TRouteChainAddressMatchProps = {
  routeChainId: number
  routeAddress?: string | null
  expectedChainId: number
  expectedAddress?: string | null
}

export function isRouteChainAddressMatch({
  routeChainId,
  routeAddress,
  expectedChainId,
  expectedAddress
}: TRouteChainAddressMatchProps): boolean {
  if (!Number.isInteger(routeChainId) || !Number.isInteger(expectedChainId) || !routeAddress || !expectedAddress) {
    return false
  }

  return routeChainId === expectedChainId && isAddressEqual(toAddress(routeAddress), toAddress(expectedAddress))
}

export function resolveRouteVaultFromMap<TVault extends TKongVaultInput>(
  vaults: Record<string, TVault | undefined>,
  {
    routeChainId,
    routeAddress
  }: {
    routeChainId: number
    routeAddress?: string | null
  }
): TVault | undefined {
  if (!Number.isInteger(routeChainId) || !routeAddress) {
    return undefined
  }

  const candidateVault = vaults[toAddress(routeAddress)]
  if (!candidateVault) {
    return undefined
  }

  return isRouteChainAddressMatch({
    routeChainId,
    routeAddress,
    expectedChainId: getVaultChainID(candidateVault),
    expectedAddress: getVaultAddress(candidateVault)
  })
    ? candidateVault
    : undefined
}
