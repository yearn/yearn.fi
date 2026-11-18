import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'

export type TVaultsPinnedSection = {
  key: string
  vaults: TKongVaultInput[]
}

export function getProductPinnedSections({
  shouldShowYvUsd,
  sortBy,
  yvUsdVault
}: {
  shouldShowYvUsd: boolean
  sortBy: TPossibleSortBy
  yvUsdVault?: TKongVaultInput
}): TVaultsPinnedSection[] {
  return shouldShowYvUsd && sortBy === 'none' && yvUsdVault ? [{ key: 'yvUSD', vaults: [yvUsdVault] }] : []
}
