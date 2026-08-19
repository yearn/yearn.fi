import type { TPortfolioGrowthVault } from '@pages/portfolio/types/api'
import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import type { TSortDirection } from '@shared/types'
import { toAddress } from '@shared/utils'

const YBOLD_CHAIN_ID = 1

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

function combineGrowthVariants(
  vaultsByKey: Map<string, TPortfolioGrowthVault>,
  chainId: number,
  displayAddress: string,
  variantAddresses: readonly string[]
): TPortfolioGrowthVault | null {
  const displayKey = getPortfolioGrowthVaultKey({ chainId, vaultAddress: displayAddress })
  const variants = variantAddresses
    .map((vaultAddress) => vaultsByKey.get(getPortfolioGrowthVaultKey({ chainId, vaultAddress })))
    .filter((vault): vault is TPortfolioGrowthVault => Boolean(vault))

  if (variants.length === 0) {
    return null
  }

  const baselineUsd = sumGrowthField(variants, 'baselineUsd')
  const baselineExposureUsdYears = sumGrowthField(variants, 'baselineExposureUsdYears')
  const growthUsd = sumGrowthField(variants, 'growthUsd')
  const issues = Array.from(new Set(variants.flatMap((vault) => vault.issues)))
  const isComplete = variants.every((vault) => vault.status === 'ok')
  const representative = vaultsByKey.get(displayKey) ?? variants[0]

  return {
    ...representative,
    vaultAddress: displayAddress,
    status: isComplete ? 'ok' : 'partial',
    issues,
    baselineUsd,
    baselineExposureUsdYears,
    growthUsd,
    growthPct: baselineUsd > 0 ? (growthUsd / baselineUsd) * 100 : null,
    annualizedProtocolReturnPct: baselineExposureUsdYears > 0 ? (growthUsd / baselineExposureUsdYears) * 100 : null
  }
}

function combineYvUsdGrowth(vaultsByKey: Map<string, TPortfolioGrowthVault>): TPortfolioGrowthVault | null {
  return combineGrowthVariants(vaultsByKey, YVUSD_CHAIN_ID, YVUSD_UNLOCKED_ADDRESS, [
    YVUSD_UNLOCKED_ADDRESS,
    YVUSD_LOCKED_ADDRESS
  ])
}

function combineYBoldGrowth(vaultsByKey: Map<string, TPortfolioGrowthVault>): TPortfolioGrowthVault | null {
  return combineGrowthVariants(vaultsByKey, YBOLD_CHAIN_ID, YBOLD_VAULT_ADDRESS, [
    YBOLD_VAULT_ADDRESS,
    YBOLD_STAKING_ADDRESS
  ])
}

export function mapPortfolioGrowthVaults(
  vaults: readonly TPortfolioGrowthVault[]
): ReadonlyMap<string, TPortfolioGrowthVault> {
  const vaultsByKey = new Map(vaults.map((vault) => [getPortfolioGrowthVaultKey(vault), vault] as const))

  for (const combinedGrowth of [combineYvUsdGrowth(vaultsByKey), combineYBoldGrowth(vaultsByKey)]) {
    if (combinedGrowth) {
      vaultsByKey.set(getPortfolioGrowthVaultKey(combinedGrowth), combinedGrowth)
    }
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
