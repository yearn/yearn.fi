import type { TPortfolioGrowthVault } from '@pages/portfolio/types/api'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import type { TSortDirection } from '@shared/types'
import { toAddress } from '@shared/utils'

export type TPortfolioGrowthDisplay = {
  usd: number
  percent: number | null
  annualizedPercent: number | null
}

export function getPortfolioGrowthVaultKey(vault: Pick<TPortfolioGrowthVault, 'chainId' | 'vaultAddress'>): string {
  return `${vault.chainId}_${toAddress(vault.vaultAddress)}`
}

function sumGrowthField(
  vaults: readonly TPortfolioGrowthVault[],
  field: 'baselineUsd' | 'baselineExposureUsdYears' | 'growthUsd'
): number {
  return vaults.reduce((total, vault) => total + vault[field], 0)
}

function combineYvUsdGrowth(vaultsByKey: Map<string, TPortfolioGrowthVault>): TPortfolioGrowthVault | null {
  const unlockedKey = `${YVUSD_CHAIN_ID}_${YVUSD_UNLOCKED_ADDRESS}`
  const lockedKey = `${YVUSD_CHAIN_ID}_${YVUSD_LOCKED_ADDRESS}`
  const variants = [vaultsByKey.get(unlockedKey), vaultsByKey.get(lockedKey)].filter(
    (vault): vault is TPortfolioGrowthVault => Boolean(vault)
  )

  if (variants.length === 0) {
    return null
  }

  const baselineUsd = sumGrowthField(variants, 'baselineUsd')
  const baselineExposureUsdYears = sumGrowthField(variants, 'baselineExposureUsdYears')
  const growthUsd = sumGrowthField(variants, 'growthUsd')
  const issues = Array.from(new Set(variants.flatMap((vault) => vault.issues)))
  const isComplete = variants.every((vault) => vault.status === 'ok')
  const representative = vaultsByKey.get(unlockedKey) ?? variants[0]

  return {
    ...representative,
    vaultAddress: YVUSD_UNLOCKED_ADDRESS,
    status: isComplete ? 'ok' : 'partial',
    issues,
    baselineUsd,
    baselineExposureUsdYears,
    growthUsd,
    growthPct: baselineUsd > 0 ? (growthUsd / baselineUsd) * 100 : null,
    annualizedProtocolReturnPct: baselineExposureUsdYears > 0 ? (growthUsd / baselineExposureUsdYears) * 100 : null
  }
}

export function mapPortfolioGrowthVaults(
  vaults: readonly TPortfolioGrowthVault[]
): ReadonlyMap<string, TPortfolioGrowthVault> {
  const vaultsByKey = new Map(vaults.map((vault) => [getPortfolioGrowthVaultKey(vault), vault] as const))
  const combinedYvUsdGrowth = combineYvUsdGrowth(vaultsByKey)

  if (combinedYvUsdGrowth) {
    vaultsByKey.set(getPortfolioGrowthVaultKey(combinedYvUsdGrowth), combinedYvUsdGrowth)
  }

  return vaultsByKey
}

function getGrowthSortValue(vault: TPortfolioGrowthVault | undefined): number | null {
  return vault?.status === 'ok' && Number.isFinite(vault.growthUsd) ? vault.growthUsd : null
}

export function comparePortfolioGrowthVaults(
  left: TPortfolioGrowthVault | undefined,
  right: TPortfolioGrowthVault | undefined,
  sortDirection: TSortDirection
): number {
  const leftValue = getGrowthSortValue(left)
  const rightValue = getGrowthSortValue(right)

  if (leftValue === null) {
    return rightValue === null ? 0 : 1
  }
  if (rightValue === null) {
    return -1
  }
  if (sortDirection === 'asc') {
    return leftValue - rightValue
  }
  if (sortDirection === 'desc') {
    return rightValue - leftValue
  }
  return 0
}

export function toPortfolioGrowthDisplay(vault: TPortfolioGrowthVault | undefined): TPortfolioGrowthDisplay | null {
  if (vault?.status !== 'ok' || !Number.isFinite(vault.growthUsd)) {
    return null
  }

  return {
    usd: vault.growthUsd,
    percent: vault.growthPct !== null && Number.isFinite(vault.growthPct) ? vault.growthPct : null,
    annualizedPercent:
      vault.annualizedProtocolReturnPct !== null && Number.isFinite(vault.annualizedProtocolReturnPct)
        ? vault.annualizedProtocolReturnPct
        : null
  }
}
