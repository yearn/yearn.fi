import { getVaultAPR, getVaultChainID, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { isZero } from '@shared/utils'

const KATANA_CHAIN_ID = 747474

export type TKatanaAprData = {
  katanaRewardsAPR?: number
  katanaAppRewardsAPR?: number
  FixedRateKatanaRewards?: number
  katanaBonusAPY?: number
  katanaNativeYield?: number
  steerPointsPerDollar?: number
}

const normalizeFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number') {
    return undefined
  }
  if (!Number.isFinite(value)) {
    return undefined
  }
  return value
}

export function calculateKatanaTotalApr(
  katanaExtras?: Partial<TKatanaAprData>,
  baseAprOverride?: number
): number | undefined {
  if (!katanaExtras) {
    return undefined
  }

  const appRewardsApr = katanaExtras.katanaAppRewardsAPR ?? katanaExtras.katanaRewardsAPR
  const baseApr = typeof baseAprOverride === 'number' ? baseAprOverride : katanaExtras.katanaNativeYield
  const parts = [baseApr, katanaExtras.FixedRateKatanaRewards, appRewardsApr].filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value)
  )

  if (parts.length === 0) {
    return undefined
  }
  return parts.reduce((acc, value) => acc + value, 0)
}

export function getKatanaAprData(vault: TKongVaultInput): TKatanaAprData | undefined {
  if (getVaultChainID(vault) !== KATANA_CHAIN_ID) {
    return undefined
  }

  const apr = getVaultAPR(vault)
  const composite = apr.forwardAPR?.composite
  if (!composite) {
    return undefined
  }

  const fixedRateKatanaRewards = normalizeFiniteNumber(
    composite.fixedRateKatanaRewards ?? composite.FixedRateKatanaRewards
  )
  const katanaAppRewardsAPR = normalizeFiniteNumber(composite.katanaAppRewardsAPR)
  const katanaNativeYield = normalizeFiniteNumber(composite.katanaNativeYield)
  const katanaBonusAPY = normalizeFiniteNumber(composite.katanaBonusAPY)
  const steerPointsPerDollar = normalizeFiniteNumber(composite.steerPointsPerDollar)

  const hasKatanaComponentData = [
    fixedRateKatanaRewards,
    katanaAppRewardsAPR,
    katanaNativeYield,
    katanaBonusAPY,
    steerPointsPerDollar
  ].some((value) => value !== undefined)

  if (!hasKatanaComponentData) {
    return undefined
  }

  return {
    katanaRewardsAPR: katanaAppRewardsAPR,
    katanaAppRewardsAPR,
    FixedRateKatanaRewards: fixedRateKatanaRewards,
    katanaBonusAPY,
    katanaNativeYield,
    steerPointsPerDollar
  }
}

export function calculateVaultEstimatedAPY(vault: TKongVaultInput): number {
  const apr = getVaultAPR(vault)
  const chainID = getVaultChainID(vault)

  if (chainID === KATANA_CHAIN_ID) {
    const katanaAprData = getKatanaAprData(vault)
    if (katanaAprData) {
      const katanaEstimatedApr = calculateKatanaTotalApr(katanaAprData, apr.forwardAPR?.netAPR || 0)
      return katanaEstimatedApr ?? (apr.forwardAPR?.netAPR || 0)
    }
    return apr.forwardAPR?.netAPR || 0
  }

  if (apr.forwardAPR?.type === '') {
    return (apr.extra?.stakingRewardsAPR || 0) + (apr?.netAPR || 0)
  }

  if (chainID === 1 && apr.forwardAPR?.composite?.boost > 0 && !apr.extra?.stakingRewardsAPR) {
    return apr.forwardAPR?.netAPR || 0
  }

  const sumOfRewardsAPY = (apr.extra?.stakingRewardsAPR || 0) + (apr.extra?.gammaRewardAPR || 0)
  const hasCurrentAPY = !isZero(apr.forwardAPR?.netAPR || 0)

  if (sumOfRewardsAPY > 0) {
    return sumOfRewardsAPY + (apr.forwardAPR?.netAPR || 0)
  }
  if (hasCurrentAPY) {
    return apr.forwardAPR?.netAPR || 0
  }
  return apr?.netAPR || 0
}

export function calculateKatanaThirtyDayAPY(vault: TKongVaultInput): number | undefined {
  if (getVaultChainID(vault) !== KATANA_CHAIN_ID) {
    return undefined
  }
  const katanaAprData = getKatanaAprData(vault)
  if (!katanaAprData) {
    return undefined
  }
  return calculateKatanaTotalApr(katanaAprData)
}

export function calculateVaultHistoricalAPY(vault: TKongVaultInput): number | null {
  const apr = getVaultAPR(vault)
  const katanaAPY = calculateKatanaThirtyDayAPY(vault)

  if (getVaultChainID(vault) === KATANA_CHAIN_ID && typeof katanaAPY === 'number') {
    return katanaAPY
  }
  if (typeof katanaAPY === 'number') {
    return katanaAPY
  }

  const monthlyAPY = apr.points?.monthAgo
  const weeklyAPY = apr.points?.weekAgo
  const chosenAPY = !isZero(monthlyAPY || 0) ? monthlyAPY : weeklyAPY
  return typeof chosenAPY === 'number' ? chosenAPY : null
}
