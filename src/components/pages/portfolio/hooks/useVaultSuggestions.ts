'use client'

import { EXTERNAL_TOKENS } from '@pages/portfolio/constants/externalTokens'
import { buildVaultSuggestions, type TVaultSuggestion } from '@pages/portfolio/hooks/buildVaultSuggestions'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useEnsoBalances } from '@shared/hooks/useEnsoBalances'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'

export function useVaultSuggestions(holdingsKeySet: Set<string>): {
  suggestions: TVaultSuggestion[]
} {
  const { address } = useWeb3()
  const { vaults } = useYearn()
  const { data: ensoBalances } = useEnsoBalances(address)

  const detectedTokens = useMemo(
    () =>
      EXTERNAL_TOKENS.filter((token) => {
        const balance = ensoBalances?.[token.chainId]?.[toAddress(token.address)]?.balance
        return balance && balance.raw > 0n
      }),
    [ensoBalances]
  )

  const suggestions = useMemo(() => {
    return buildVaultSuggestions(detectedTokens, vaults, holdingsKeySet)
  }, [detectedTokens, vaults, holdingsKeySet])

  return { suggestions }
}
