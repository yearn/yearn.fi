import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { useVaultFilter } from './useVaultFilter'
import type { TVaultFlags } from './useVaultFilterUtils'

type TV3VaultFilterResult = {
  filteredVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  availableVaults: TYDaemonVault[]
  vaultFlags: Record<string, TVaultFlags>
  availableUnderlyingAssets: string[]
  underlyingAssetVaults: Record<string, TYDaemonVault>
  totalMatchingVaults: number
  totalHoldingsMatching: number
  totalAvailableMatching: number
  totalMigratableMatching: number
  totalRetiredMatching: number
  isLoading: boolean
}

export function useV3VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string,
  categories?: string[] | null,
  aggressiveness?: TVaultAggressiveness[] | null,
  underlyingAssets?: string[] | null,
  minTvl?: number,
  showHiddenVaults?: boolean,
  enabled?: boolean
): TV3VaultFilterResult {
  return useVaultFilter({
    version: 'v3',
    types,
    chains,
    search,
    categories,
    aggressiveness,
    underlyingAssets,
    minTvl,
    showHiddenVaults,
    enabled
  })
}
