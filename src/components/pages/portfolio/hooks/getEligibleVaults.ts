import {
  getVaultInfo,
  getVaultMigration,
  getVaultToken,
  getVaultTVL,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { UNDERLYING_ASSET_OVERRIDES } from '@pages/vaults/utils/vaultListFacets'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'

export function normalizeSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  return UNDERLYING_ASSET_OVERRIDES[upper] ?? upper
}

export function getEligibleVaults(vaults: Record<string, TKongVault>, holdingsKeySet: Set<string>): TKongVault[] {
  return Object.values(vaults).filter((vault) => {
    const info = getVaultInfo(vault)
    const migration = getVaultMigration(vault)
    if (Boolean(info.isHidden) || Boolean(info.isRetired) || Boolean(migration.available)) return false
    if ((getVaultTVL(vault).tvl ?? 0) <= 0) return false
    if (holdingsKeySet.has(getVaultKey(vault))) return false
    return (getVaultToken(vault).symbol ?? '').trim() !== ''
  })
}
