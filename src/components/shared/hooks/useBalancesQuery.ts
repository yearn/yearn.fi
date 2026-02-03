import type { TAddress } from '../types/address'
import { toAddress } from '../utils/tools.address'

/*******************************************************************************
 ** Query key factory for consistent cache key generation
 ******************************************************************************/
export const balanceQueryKeys = {
  all: ['balances'] as const,
  byChain: (chainId: number) => [...balanceQueryKeys.all, 'chain', chainId] as const,
  byChainAndUser: (chainId: number, userAddress?: TAddress) =>
    [...balanceQueryKeys.byChain(chainId), 'user', toAddress(userAddress)] as const,
  byToken: (chainId: number, userAddress: TAddress | undefined, tokenAddress: TAddress) =>
    [...balanceQueryKeys.byChainAndUser(chainId, userAddress), 'token', toAddress(tokenAddress)] as const,
  byTokens: (chainId: number, userAddress: TAddress | undefined, tokenAddresses: TAddress[]) =>
    [
      ...balanceQueryKeys.byChainAndUser(chainId, userAddress),
      'tokens',
      tokenAddresses.map(toAddress).toSorted().join(',')
    ] as const
}
