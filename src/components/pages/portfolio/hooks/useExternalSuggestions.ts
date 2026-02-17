import { EXTERNAL_TOKENS } from '@pages/portfolio/constants/externalTokens'
import { getEligibleVaults, normalizeSymbol, selectPreferredVault } from '@pages/portfolio/hooks/getEligibleVaults'
import { getVaultToken, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useEnsoBalances } from '@shared/hooks/useEnsoBalances'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'

export type TExternalSuggestion = {
  vault: TKongVault
  externalProtocol: string
  underlyingSymbol: string
}

export function useExternalSuggestions(holdingsKeySet: Set<string>): {
  suggestions: TExternalSuggestion[]
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
    if (detectedTokens.length === 0) return []

    const eligible = getEligibleVaults(vaults, holdingsKeySet)

    const vaultsBySymbol = eligible.reduce((acc, vault) => {
      const normalized = normalizeSymbol(getVaultToken(vault).symbol ?? '')
      return acc.set(normalized, [...(acc.get(normalized) ?? []), vault])
    }, new Map<string, TKongVault[]>())

    const bestVaultByUnderlying = new Map<string, TKongVault>(
      [...vaultsBySymbol.entries()]
        .map(([symbol, candidates]) => [symbol, selectPreferredVault(candidates)] as const)
        .filter((entry): entry is [string, TKongVault] => entry[1] !== undefined)
    )

    return detectedTokens
      .flatMap((token) => {
        const normalized = normalizeSymbol(token.underlyingSymbol)
        const bestVault = bestVaultByUnderlying.get(normalized)
        if (!bestVault) return []

        return [{ vault: bestVault, externalProtocol: token.protocol, underlyingSymbol: token.underlyingSymbol }]
      })
      .slice(0, 2)
  }, [detectedTokens, vaults, holdingsKeySet])

  return { suggestions }
}
