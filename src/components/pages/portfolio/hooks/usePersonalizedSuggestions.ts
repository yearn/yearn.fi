import { UNDERLYING_ASSET_OVERRIDES } from '@pages/vaults/utils/vaultListFacets'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { useMemo } from 'react'

export type TPersonalizedSuggestion = {
  vault: TYDaemonVault
  matchedSymbol: string
}

function normalizeSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  return UNDERLYING_ASSET_OVERRIDES[upper] ?? upper
}

export function usePersonalizedSuggestions(holdingsKeySet: Set<string>): TPersonalizedSuggestion[] {
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

    // Sort symbols by total USD value (biggest holdings first)
    const sortedSymbols = [...symbolTotals.entries()].sort((a, b) => b[1] - a[1])

    const vaultsBySymbol = Object.values(vaults)
      .filter((vault) => {
        if (Boolean(vault.info?.isHidden) || Boolean(vault.info?.isRetired) || Boolean(vault.migration?.available))
          return false
        if ((vault.tvl?.tvl ?? 0) <= 0) return false
        if (holdingsKeySet.has(getVaultKey(vault))) return false
        return normalizeSymbol(vault.token.symbol ?? '') !== ''
      })
      .reduce((acc, vault) => {
        const vaultSymbol = normalizeSymbol(vault.token.symbol ?? '')
        return acc.set(vaultSymbol, [...(acc.get(vaultSymbol) ?? []), vault])
      }, new Map<string, TYDaemonVault[]>())

    return sortedSymbols.reduce<{ results: TPersonalizedSuggestion[]; usedVaults: Set<string> }>(
      (acc, [symbol]) => {
        if (acc.results.length >= 4) return acc
        const candidates = vaultsBySymbol.get(symbol)
        if (!candidates?.length) return acc

        const bestVault = [...candidates]
          .sort((a, b) => (b.tvl?.tvl ?? 0) - (a.tvl?.tvl ?? 0))
          .find((vault) => !acc.usedVaults.has(getVaultKey(vault)))

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
