import { getVaultInfo, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'

export function filterVisiblePortfolioHoldings(vaults: TKongVault[], showHiddenVaults: boolean): TKongVault[] {
  if (showHiddenVaults) {
    return vaults
  }

  return vaults.filter((vault) => !Boolean(getVaultInfo(vault)?.isHidden))
}
