import { UNDERLYING_ASSET_OVERRIDES } from '@pages/vaults/utils/vaultListFacets'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'

export function normalizeSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  return UNDERLYING_ASSET_OVERRIDES[upper] ?? upper
}

export function getEligibleVaults(vaults: Record<string, TYDaemonVault>, holdingsKeySet: Set<string>): TYDaemonVault[] {
  return Object.values(vaults).filter((vault) => {
    if (Boolean(vault.info?.isHidden) || Boolean(vault.info?.isRetired) || Boolean(vault.migration?.available))
      return false
    if ((vault.tvl?.tvl ?? 0) <= 0) return false
    if (holdingsKeySet.has(getVaultKey(vault))) return false
    return (vault.token.symbol ?? '').trim() !== ''
  })
}
