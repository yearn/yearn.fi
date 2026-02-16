import { EXTERNAL_TOKENS } from '@pages/portfolio/constants/externalTokens'
import { getEligibleVaults } from '@pages/portfolio/hooks/getEligibleVaults'
import { UNDERLYING_ASSET_OVERRIDES } from '@pages/vaults/utils/vaultListFacets'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useEnsoBalances } from '@shared/hooks/useEnsoBalances'
import { toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { useMemo } from 'react'

export type TExternalSuggestion = {
  vault: TYDaemonVault
  externalProtocol: string
  underlyingSymbol: string
}

function normalizeSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  return UNDERLYING_ASSET_OVERRIDES[upper] ?? upper
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

    const bestVaultByUnderlying = eligible.reduce((acc, vault) => {
      const normalized = normalizeSymbol(vault.token.symbol ?? '')
      const existing = acc.get(normalized)
      if (!existing || (vault.tvl?.tvl ?? 0) > (existing.tvl?.tvl ?? 0)) {
        acc.set(normalized, vault)
      }
      return acc
    }, new Map<string, TYDaemonVault>())

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
