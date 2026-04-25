import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { isYvBtcVault } from '@pages/vaults/utils/yvBtc'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'

export type TVaultsPinnedSection = {
  key: string
  vaults: TKongVaultInput[]
}

export function getProductPinnedSections({
  sortedVaults,
  shouldShowYvUsd,
  yvUsdVault
}: {
  sortedVaults: TKongVaultInput[]
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

  const yvBtcSectionVaults = takeUnseenVaults(sortedVaults.filter((vault) => isYvBtcVault(vault)).slice(0, 1))
  if (yvBtcSectionVaults.length > 0) {
    sections.push({
      key: 'yvBTC',
      vaults: yvBtcSectionVaults
    })
  }

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
