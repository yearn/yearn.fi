import { fetchAddressActivityChainIdsByExistence } from './graphql'
import { lowerCaseAddress } from './pnlShared'

export interface HoldingsActivityFacetsResponse {
  address: string
  version: 'all'
  facets: {
    chainIds: number[]
  }
}

export async function getHoldingsActivityFacetResponse(userAddress: string): Promise<HoldingsActivityFacetsResponse> {
  const chainIds = await fetchAddressActivityChainIdsByExistence(userAddress)

  return {
    address: lowerCaseAddress(userAddress),
    version: 'all',
    facets: { chainIds }
  }
}
