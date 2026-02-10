import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { type TVaultFilterResult, useVaultFilter } from './useVaultFilter'
import type { TVaultFlags } from './useVaultFilterUtils'

type TOptimizedV2VaultFilterResult = {
  filteredVaults: TYDaemonVault[]
  holdingsVaults: TYDaemonVault[]
  availableVaults: TYDaemonVault[]
  vaultFlags: Record<string, TVaultFlags>
  availableUnderlyingAssets: string[]
  underlyingAssetVaults: Record<string, TYDaemonVault>
  isLoading: boolean
}

function toV2Result(result: TVaultFilterResult): TOptimizedV2VaultFilterResult {
  return {
    filteredVaults: result.filteredVaults,
    holdingsVaults: result.holdingsVaults,
    availableVaults: result.availableVaults,
    vaultFlags: result.vaultFlags,
    availableUnderlyingAssets: result.availableUnderlyingAssets,
    underlyingAssetVaults: result.underlyingAssetVaults,
    isLoading: result.isLoading
  }
}

export function useV2VaultFilter(
  types: string[] | null,
  chains: number[] | null,
  search?: string,
  categories?: string[] | null,
  aggressiveness?: TVaultAggressiveness[] | null,
  underlyingAssets?: string[] | null,
  minTvl?: number,
  showHiddenVaults?: boolean,
  enabled?: boolean
): TOptimizedV2VaultFilterResult {
  const result = useVaultFilter({
    version: 'v2',
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

  return toV2Result(result)
}
