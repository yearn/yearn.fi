import {
  getVaultAPR,
  getVaultInfo,
  getVaultMigration,
  getVaultToken,
  getVaultTVL,
  getVaultVersion,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { deriveListKind, UNDERLYING_ASSET_OVERRIDES } from '@pages/vaults/utils/vaultListFacets'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'

export function normalizeSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  return UNDERLYING_ASSET_OVERRIDES[upper] ?? upper
}

const isV3Vault = (vault: TKongVault): boolean => {
  const version = getVaultVersion(vault)
  return version.startsWith('3') || version.startsWith('~3')
}

export function selectPreferredVault(candidates: TKongVault[]): TKongVault | undefined {
  const v3Candidates = candidates.filter(isV3Vault)
  if (v3Candidates.length === 0) return undefined

  const qualifying = v3Candidates.filter((vault) => {
    const tvl = getVaultTVL(vault).tvl ?? 0
    const apr = getVaultAPR(vault).forwardAPR.netAPR
    return tvl > 500_000 && apr > 0.04
  })

  if (qualifying.length > 0) {
    return qualifying.reduce((best, vault) =>
      (getVaultTVL(vault).tvl ?? 0) < (getVaultTVL(best).tvl ?? 0) ? vault : best
    )
  }

  return v3Candidates.reduce((best, vault) =>
    (getVaultTVL(vault).tvl ?? 0) > (getVaultTVL(best).tvl ?? 0) ? vault : best
  )
}

export function getEligibleVaults(vaults: Record<string, TKongVault>, holdingsKeySet: Set<string>): TKongVault[] {
  return Object.values(vaults).filter((vault) => {
    const info = getVaultInfo(vault)
    const migration = getVaultMigration(vault)
    if (Boolean(info.isHidden) || Boolean(info.isRetired) || Boolean(migration.available)) return false
    if (deriveListKind(vault) !== 'allocator') return false
    if (getVaultAPR(vault).forwardAPR.netAPR <= 0.005) return false
    if ((getVaultTVL(vault).tvl ?? 0) <= 0) return false
    if (holdingsKeySet.has(getVaultKey(vault))) return false
    return (getVaultToken(vault).symbol ?? '').trim() !== ''
  })
}
