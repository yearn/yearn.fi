import { fetchAddressActivityChainIdsByExistence, type VaultVersion } from './graphql'
import { lowerCaseAddress } from './pnlShared'

export interface HoldingsActivityFacetsResponse {
  address: string
  version: VaultVersion
  facets: {
    chainIds: number[]
  }
}

export async function getHoldingsActivityFacetResponse(
  userAddress: string,
  version: VaultVersion
): Promise<HoldingsActivityFacetsResponse> {
  const chainIds = await fetchAddressActivityChainIdsByExistence(userAddress, version)

  return {
    address: lowerCaseAddress(userAddress),
    version,
    facets: { chainIds }
  }
}
