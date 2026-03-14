import { getAddress } from 'viem'
import type { TAddress } from '../types/address'
import type { TNDict } from '../types/mixed'
import type { TUseBalancesTokens } from './useBalances.multichains'

type TStagedTokensByChain = {
  priorityTokensByChain: TNDict<TUseBalancesTokens[]>
  secondaryTokensByChain: TNDict<TUseBalancesTokens[]>
}

export function partitionTokensByQueryStage(
  tokens: TUseBalancesTokens[],
  priorityChainId?: number
): TStagedTokensByChain {
  const grouped: TNDict<TUseBalancesTokens[]> = {}
  const uniqueTokens: TNDict<Set<TAddress>> = {}

  for (const token of tokens) {
    if (!grouped[token.chainID]) {
      grouped[token.chainID] = []
      uniqueTokens[token.chainID] = new Set()
    }

    const tokenAddress = getAddress(token.address)
    if (!uniqueTokens[token.chainID].has(tokenAddress)) {
      uniqueTokens[token.chainID].add(tokenAddress)
      grouped[token.chainID].push(token)
    }
  }

  if (!priorityChainId || !grouped[priorityChainId]) {
    return {
      priorityTokensByChain: {},
      secondaryTokensByChain: grouped
    }
  }

  const priorityTokensByChain: TNDict<TUseBalancesTokens[]> = {
    [priorityChainId]: grouped[priorityChainId]
  }
  const secondaryTokensByChain: TNDict<TUseBalancesTokens[]> = {}

  for (const [chainIdStr, chainTokens] of Object.entries(grouped)) {
    const chainId = Number(chainIdStr)
    if (chainId === priorityChainId) {
      continue
    }
    secondaryTokensByChain[chainId] = chainTokens
  }

  return {
    priorityTokensByChain,
    secondaryTokensByChain
  }
}
