'use client'

import { getVaultInfo, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'

export function filterVisiblePortfolioHoldings<T extends TKongVaultInput>(vaults: T[], showHiddenVaults: boolean): T[] {
  if (showHiddenVaults) {
    return vaults
  }

  return vaults.filter((vault) => !Boolean(getVaultInfo(vault)?.isHidden))
}
