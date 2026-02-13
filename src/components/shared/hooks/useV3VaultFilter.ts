import type { TVaultAggressiveness } from '@pages/vaults/utils/vaultListFacets'
import { type TVaultFilterResult, useVaultFilter } from './useVaultFilter'

type TV3VaultFilterResult = TVaultFilterResult

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
