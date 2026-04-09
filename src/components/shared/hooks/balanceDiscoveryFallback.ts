'use client'

import type { TUseBalancesTokens } from './useBalances.multichains'

export function shouldUseDiscoveryFallbackToken(params: {
  token: TUseBalancesTokens
  hasPositiveBalanceCache: boolean
}): boolean {
  const { token, hasPositiveBalanceCache } = params
  return Boolean(token.isStakingToken || hasPositiveBalanceCache)
}
