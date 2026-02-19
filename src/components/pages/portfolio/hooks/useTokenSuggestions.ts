import { getEligibleVaults, normalizeSymbol, selectPreferredVault } from '@pages/portfolio/hooks/getEligibleVaults'
import { getVaultToken, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { useMemo } from 'react'

export type TTokenSuggestion = {
  vault: TKongVault
  matchedSymbol: string
}

export function useTokenSuggestions(holdingsKeySet: Set<string>): TTokenSuggestion[] {
  const { balances } = useWallet()
  const { vaults } = useYearn()

  return useMemo(() => {
    const userTokens = Object.values(balances ?? {}).flatMap((perChain) =>
      Object.values(perChain ?? {}).filter(
        (token) => token?.balance && token.balance.raw > 0n && token.symbol && token.value > 0
      )
    )

    const symbolTotals = userTokens.reduce((acc, { symbol, value }) => {
      const normalized = normalizeSymbol(symbol)
      if (!normalized) return acc
      return acc.set(normalized, (acc.get(normalized) ?? 0) + value)
    }, new Map<string, number>())

    const sortedSymbols = [...symbolTotals.entries()].sort((a, b) => b[1] - a[1])

    const eligible = getEligibleVaults(vaults, holdingsKeySet)

    const vaultsBySymbol = eligible.reduce((acc, vault) => {
      const vaultSymbol = normalizeSymbol(getVaultToken(vault).symbol ?? '')
      if (!vaultSymbol) return acc
      return acc.set(vaultSymbol, [...(acc.get(vaultSymbol) ?? []), vault])
    }, new Map<string, TKongVault[]>())

    return sortedSymbols.reduce<{ results: TTokenSuggestion[]; usedVaults: Set<string> }>(
      (acc, [symbol]) => {
        if (acc.results.length >= 4) return acc
        const candidates = vaultsBySymbol.get(symbol)
        if (!candidates?.length) return acc

        const bestVault = selectPreferredVault(candidates.filter((vault) => !acc.usedVaults.has(getVaultKey(vault))))

        if (!bestVault) return acc

        acc.usedVaults.add(getVaultKey(bestVault))
        return {
          results: [...acc.results, { vault: bestVault, matchedSymbol: symbol }],
          usedVaults: acc.usedVaults
        }
      },
      { results: [], usedVaults: new Set() }
    ).results
  }, [balances, vaults, holdingsKeySet])
}
