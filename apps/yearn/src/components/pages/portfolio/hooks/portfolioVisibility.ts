import { getVaultInfo, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'

export const PORTFOLIO_DUST_USD_THRESHOLD = 0.01

export function isPortfolioDustValueVisible(value: number, shouldHideDust: boolean): boolean {
  return !shouldHideDust || value >= PORTFOLIO_DUST_USD_THRESHOLD
}

export function filterVisiblePortfolioHoldings<T extends TKongVaultInput>(
  vaults: T[],
  showHiddenVaults: boolean,
  options?: {
    shouldHideDust?: boolean
    getVaultValue?: (vault: T) => number
  }
): T[] {
  return vaults.filter((vault) => {
    if (!showHiddenVaults && Boolean(getVaultInfo(vault)?.isHidden)) {
      return false
    }

    if (!options?.shouldHideDust) {
      return true
    }

    return isPortfolioDustValueVisible(options.getVaultValue?.(vault) ?? 0, true)
  })
}
