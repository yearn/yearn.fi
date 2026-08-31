import type { TPortfolioGrowthVault } from '@pages/portfolio/types/api'
import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import type { TSortDirection } from '@shared/types'
import { toAddress } from '@shared/utils'

const YBOLD_CHAIN_ID = 1

export type TPortfolioGrowthDisplay = {
  usd: number
  assetGrowth: TPortfolioGrowthAssetDisplay[]
  isUsdEstimated: boolean
  percent: number | null
  annualizedPercent: number | null
}

export type TPortfolioGrowthAssetDisplay = {
  amount: number
  symbol: string | null
}

export type TMappedPortfolioGrowthVault = Omit<TPortfolioGrowthVault, 'growthUnderlying'> & {
  growthUnderlying: number | null
  assetGrowth: TPortfolioGrowthAssetDisplay[]
}

export function getPortfolioGrowthVaultKey(vault: Pick<TPortfolioGrowthVault, 'chainId' | 'vaultAddress'>): string {
  return `${vault.chainId}_${toAddress(vault.vaultAddress)}`
}

function sumGrowthField(
  vaults: readonly TMappedPortfolioGrowthVault[],
  field: 'baselineUsd' | 'baselineExposureUsdYears' | 'growthUsd'
): number {
  return vaults.reduce((total, vault) => total + vault[field], 0)
}

function combineGrowthRate(
  vaults: readonly TMappedPortfolioGrowthVault[],
  rateField: 'growthPct' | 'annualizedProtocolReturnPct',
  weightField: 'baselineUsd' | 'baselineExposureUsdYears'
): number | null {
  const weightedVariants = vaults.filter((vault) => Number.isFinite(vault[weightField]) && vault[weightField] > 0)
  if (
    weightedVariants.length === 0 ||
    weightedVariants.some((vault) => vault[rateField] === null || !Number.isFinite(vault[rateField]))
  ) {
    return null
  }

  const totalWeight = sumGrowthField(weightedVariants, weightField)
  return weightedVariants.reduce((total, vault) => total + vault[weightField] * vault[rateField]!, 0) / totalWeight
}

function combineGrowthVariants(
  vaultsByKey: Map<string, TMappedPortfolioGrowthVault>,
  chainId: number,
  displayAddress: string,
  variantAddresses: readonly string[],
  assetMode: 'combined' | 'separate'
): TMappedPortfolioGrowthVault | null {
  const displayKey = getPortfolioGrowthVaultKey({ chainId, vaultAddress: displayAddress })
  const variants = variantAddresses
    .map((vaultAddress) => vaultsByKey.get(getPortfolioGrowthVaultKey({ chainId, vaultAddress })))
    .filter((vault): vault is TMappedPortfolioGrowthVault => Boolean(vault))

  if (variants.length === 0) {
    return null
  }

  const baselineUsd = sumGrowthField(variants, 'baselineUsd')
  const baselineExposureUsdYears = sumGrowthField(variants, 'baselineExposureUsdYears')
  const growthUnderlying =
    assetMode === 'combined' || variants.length === 1
      ? variants.reduce((total, vault) => total + (vault.growthUnderlying ?? 0), 0)
      : null
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
    growthUnderlying,
    assetGrowth:
      assetMode === 'combined'
        ? [{ amount: growthUnderlying ?? 0, symbol: null }]
        : variants.flatMap((vault) => vault.assetGrowth),
    growthUsd,
    growthPct: combineGrowthRate(variants, 'growthPct', 'baselineUsd'),
    annualizedProtocolReturnPct: combineGrowthRate(variants, 'annualizedProtocolReturnPct', 'baselineExposureUsdYears')
  }
}

function combineYvUsdGrowth(vaultsByKey: Map<string, TMappedPortfolioGrowthVault>): TMappedPortfolioGrowthVault | null {
  return combineGrowthVariants(
    vaultsByKey,
    YVUSD_CHAIN_ID,
    YVUSD_UNLOCKED_ADDRESS,
    [YVUSD_UNLOCKED_ADDRESS, YVUSD_LOCKED_ADDRESS],
    'combined'
  )
}

function combineYBoldGrowth(vaultsByKey: Map<string, TMappedPortfolioGrowthVault>): TMappedPortfolioGrowthVault | null {
  return combineGrowthVariants(
    vaultsByKey,
    YBOLD_CHAIN_ID,
    YBOLD_VAULT_ADDRESS,
    [YBOLD_VAULT_ADDRESS, YBOLD_STAKING_ADDRESS],
    'separate'
  )
}

export function mapPortfolioGrowthVaults(
  vaults: readonly TPortfolioGrowthVault[]
): ReadonlyMap<string, TMappedPortfolioGrowthVault> {
  const vaultsByKey = new Map<string, TMappedPortfolioGrowthVault>(
    vaults.map(
      (vault) =>
        [
          getPortfolioGrowthVaultKey(vault),
          {
            ...vault,
            assetGrowth: [{ amount: vault.growthUnderlying, symbol: vault.metadata.symbol }]
          }
        ] as const
    )
  )

  for (const combinedGrowth of [combineYvUsdGrowth(vaultsByKey), combineYBoldGrowth(vaultsByKey)]) {
    if (combinedGrowth) {
      vaultsByKey.set(getPortfolioGrowthVaultKey(combinedGrowth), combinedGrowth)
    }
  }

  return vaultsByKey
}

type TComparablePortfolioGrowthVault = Pick<TPortfolioGrowthVault, 'growthUsd' | 'status'>

function getGrowthSortValue(vault: TComparablePortfolioGrowthVault | undefined): number | null {
  return vault?.status === 'ok' && Number.isFinite(vault.growthUsd) ? vault.growthUsd : null
}

export function comparePortfolioGrowthVaults(
  left: TComparablePortfolioGrowthVault | undefined,
  right: TComparablePortfolioGrowthVault | undefined,
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

export function toPortfolioGrowthDisplay(
  vault: TMappedPortfolioGrowthVault | undefined
): TPortfolioGrowthDisplay | null {
  if (vault?.status !== 'ok' || !Number.isFinite(vault.growthUsd)) {
    return null
  }

  return {
    usd: vault.growthUsd,
    assetGrowth: vault.assetGrowth,
    isUsdEstimated: vault.issues.includes('missing_exit_price'),
    percent: vault.growthPct !== null && Number.isFinite(vault.growthPct) ? vault.growthPct : null,
    annualizedPercent:
      vault.annualizedProtocolReturnPct !== null && Number.isFinite(vault.annualizedProtocolReturnPct)
        ? vault.annualizedProtocolReturnPct
        : null
  }
}
