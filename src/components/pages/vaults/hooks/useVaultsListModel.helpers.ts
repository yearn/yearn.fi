import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'

export type TVaultsPinnedSection = {
  key: string
  vaults: TKongVaultInput[]
}

export function getProductPinnedSections({
  shouldShowYvUsd,
  yvUsdVault
}: {
  shouldShowYvUsd: boolean
  yvUsdVault?: TKongVaultInput
}): TVaultsPinnedSection[] {
  const seen = new Set<string>()
  const sections: TVaultsPinnedSection[] = []

  const takeUnseenVaults = (vaults: TKongVaultInput[]): TKongVaultInput[] =>
    vaults.filter((vault) => {
      const key = getVaultKey(vault)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })

  if (shouldShowYvUsd && yvUsdVault) {
    const yvUsdSectionVaults = takeUnseenVaults([yvUsdVault])
    if (yvUsdSectionVaults.length > 0) {
      sections.push({
        key: 'yvUSD',
        vaults: yvUsdSectionVaults
      })
    }
  }

  return sections
}
