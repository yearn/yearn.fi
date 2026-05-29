import { getEligibleVaults, normalizeSymbol, selectPreferredVault } from '@pages/portfolio/hooks/getEligibleVaults'
import { getVaultToken, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { useMemo } from 'react'

export type TTokenSuggestion = {
  vault: TKongVault
  matchedSymbol: string
  matchedChainID: number
}

export function useTokenSuggestions(holdingsKeySet: Set<string>): TTokenSuggestion[] {
  const { balances } = useWallet()
  const { vaults } = useYearn()

  return useMemo(() => {
    const userTokens = Object.entries(balances ?? {}).flatMap(([chainIDKey, perChain]) =>
      Object.values(perChain ?? {})
        .filter((token) => token?.balance && token.balance.raw > 0n && token.symbol && token.value > 1)
        .map((token) => {
          const parsedChainID = Number(chainIDKey)
          return { token, chainID: Number.isFinite(parsedChainID) ? parsedChainID : token.chainID }
        })
    )

    const symbolTotals = userTokens.reduce((acc, { token, chainID }) => {
      const normalized = normalizeSymbol(token.symbol)
      if (!normalized) return acc
      const previous = acc.get(normalized)
      const totalValue = (previous?.totalValue ?? 0) + token.value
      const chainValues = new Map(previous?.chainValues ?? [])
      chainValues.set(chainID, (chainValues.get(chainID) ?? 0) + token.value)
      return acc.set(normalized, { totalValue, chainValues })
    }, new Map<string, { totalValue: number; chainValues: Map<number, number> }>())

    const sortedSymbols = [...symbolTotals.entries()].sort((a, b) => b[1].totalValue - a[1].totalValue)

    const eligible = getEligibleVaults(vaults, holdingsKeySet)

    const vaultsBySymbol = eligible.reduce((acc, vault) => {
      const vaultSymbol = normalizeSymbol(getVaultToken(vault).symbol ?? '')
      if (!vaultSymbol) return acc
      return acc.set(vaultSymbol, [...(acc.get(vaultSymbol) ?? []), vault])
    }, new Map<string, TKongVault[]>())

    return sortedSymbols.reduce<{ results: TTokenSuggestion[]; usedVaults: Set<string> }>(
      (acc, [symbol, { chainValues }]) => {
        if (acc.results.length >= 4) return acc
        const candidates = vaultsBySymbol.get(symbol)
        if (!candidates?.length) return acc

        const bestVault = selectPreferredVault(candidates.filter((vault) => !acc.usedVaults.has(getVaultKey(vault))))
        const matchedChainID = [...chainValues.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

        if (!bestVault || !matchedChainID) return acc

        acc.usedVaults.add(getVaultKey(bestVault))
        return {
          results: [...acc.results, { vault: bestVault, matchedSymbol: symbol, matchedChainID }],
          usedVaults: acc.usedVaults
        }
      },
      { results: [], usedVaults: new Set() }
    ).results
  }, [balances, vaults, holdingsKeySet])
}
