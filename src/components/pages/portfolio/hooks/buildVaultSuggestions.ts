import type { TExternalToken } from '@pages/portfolio/constants/externalTokens'
import { getEligibleVaults, normalizeSymbol, selectPreferredVault } from '@pages/portfolio/hooks/getEligibleVaults'
import { getVaultToken, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'

export type TVaultSuggestion = {
  vault: TKongVault
  externalProtocol: string
  underlyingSymbol: string
}

export function buildVaultSuggestions(
  detectedTokens: TExternalToken[],
  vaults: Record<string, TKongVault>,
  holdingsKeySet: Set<string>
): TVaultSuggestion[] {
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

  const seenVaults = new Set<string>()

  return detectedTokens
    .flatMap((token) => {
      const normalized = normalizeSymbol(token.underlyingSymbol)
      const bestVault = bestVaultByUnderlying.get(normalized)
      if (!bestVault) return []

      return [{ vault: bestVault, externalProtocol: token.protocol, underlyingSymbol: token.underlyingSymbol }]
    })
    .filter((suggestion) => {
      const vaultKey = getVaultKey(suggestion.vault)
      if (seenVaults.has(vaultKey)) {
        return false
      }
      seenVaults.add(vaultKey)
      return true
    })
    .slice(0, 2)
}
