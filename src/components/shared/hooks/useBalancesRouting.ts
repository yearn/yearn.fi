import { getAddress } from 'viem'
import type { TUseBalancesTokens } from './useBalances.multichains'

type TBalanceSourcePartition = {
  ensoTokens: TUseBalancesTokens[]
  multicallTokens: TUseBalancesTokens[]
}

function normalizeBalanceToken(token: TUseBalancesTokens): TUseBalancesTokens {
  return {
    ...token,
    address: getAddress(token.address),
    isVaultToken: Boolean(token.isVaultToken || token.for === 'vault'),
    isStakingToken: Boolean(token.isStakingToken || token.for === 'staking')
  }
}

function mergeBalanceTokenMetadata(current: TUseBalancesTokens, next: TUseBalancesTokens): TUseBalancesTokens {
  return {
    address: current.address,
    chainID: current.chainID,
    decimals: current.decimals || next.decimals,
    name: current.name || next.name,
    symbol: current.symbol || next.symbol,
    for: current.for || next.for,
    isVaultToken: Boolean(current.isVaultToken || next.isVaultToken || current.for === 'vault' || next.for === 'vault'),
    isStakingToken: Boolean(
      current.isStakingToken || next.isStakingToken || current.for === 'staking' || next.for === 'staking'
    ),
    isStakingOnlyPair: Boolean(current.isStakingOnlyPair || next.isStakingOnlyPair),
    isVaultBackedStaking: Boolean(current.isVaultBackedStaking || next.isVaultBackedStaking),
    pairedVaultAddress: current.pairedVaultAddress || next.pairedVaultAddress,
    pairedStakingAddress: current.pairedStakingAddress || next.pairedStakingAddress
  }
}

function dedupeBalanceTokens(tokens: TUseBalancesTokens[]): TUseBalancesTokens[] {
  const deduped = new Map<string, TUseBalancesTokens>()

  for (const rawToken of tokens) {
    const token = normalizeBalanceToken(rawToken)
    const key = `${token.chainID}:${token.address}`
    const existing = deduped.get(key)

    if (!existing) {
      deduped.set(key, token)
      continue
    }

    deduped.set(key, mergeBalanceTokenMetadata(existing, token))
  }

  return [...deduped.values()]
}

function shouldUseMulticall(token: TUseBalancesTokens, unsupportedChains: Set<number>): boolean {
  if (unsupportedChains.has(token.chainID)) {
    return true
  }

  if (token.isStakingOnlyPair) {
    return true
  }

  if (token.isStakingToken && !token.isVaultBackedStaking) {
    return true
  }

  return false
}

export function partitionTokensByBalanceSource(
  tokens: TUseBalancesTokens[],
  unsupportedNetworkIds: number[]
): TBalanceSourcePartition {
  const unsupportedChains = new Set(unsupportedNetworkIds)
  const ensoTokens: TUseBalancesTokens[] = []
  const multicallTokens: TUseBalancesTokens[] = []

  for (const token of dedupeBalanceTokens(tokens)) {
    if (shouldUseMulticall(token, unsupportedChains)) {
      multicallTokens.push(token)
    } else {
      ensoTokens.push(token)
    }
  }

  return { ensoTokens, multicallTokens }
}
