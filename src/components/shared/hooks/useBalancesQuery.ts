import type { TAddress } from '../types/address'
import { toAddress } from '../utils/tools.address'

/*******************************************************************************
 ** Query key factory for consistent cache key generation
 ******************************************************************************/
function toExecutionKey(executionChainId?: number): number | 'none' {
  return Number.isInteger(executionChainId) ? (executionChainId as number) : 'none'
}

export const balanceQueryKeys = {
  all: ['balances'] as const,
  byChain: (chainId: number, executionChainId?: number) =>
    [...balanceQueryKeys.all, 'chain', chainId, 'execution', toExecutionKey(executionChainId)] as const,
  byChainAndUser: (chainId: number, executionChainId: number | undefined, userAddress?: TAddress) =>
    [...balanceQueryKeys.byChain(chainId, executionChainId), 'user', toAddress(userAddress)] as const,
  byToken: (
    chainId: number,
    executionChainId: number | undefined,
    userAddress: TAddress | undefined,
    tokenAddress: TAddress
  ) =>
    [
      ...balanceQueryKeys.byChainAndUser(chainId, executionChainId, userAddress),
      'token',
      toAddress(tokenAddress)
    ] as const,
  byTokens: (
    chainId: number,
    executionChainId: number | undefined,
    userAddress: TAddress | undefined,
    tokenAddresses: TAddress[]
  ) =>
    [
      ...balanceQueryKeys.byChainAndUser(chainId, executionChainId, userAddress),
      'tokens',
      tokenAddresses.map(toAddress).toSorted().join(',')
    ] as const
}
