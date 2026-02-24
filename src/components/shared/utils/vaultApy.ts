import {
  getVaultAddress,
  getVaultAPR,
  getVaultChainID,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import type { TKatanaAprs } from '@shared/hooks/useKatanaAprs'
import { isZero, toAddress } from '@shared/utils'

export function calculateVaultEstimatedAPY(
  vault: TKongVaultInput,
  katanaAprs: Partial<TKatanaAprs> | undefined
): number {
  const apr = getVaultAPR(vault)
  const chainID = getVaultChainID(vault)
  const address = getVaultAddress(vault)

  if (chainID === 747474) {
    const katanaAprData = katanaAprs?.[toAddress(address)]?.apr?.extra
    if (katanaAprData) {
      const appRewardsApr = katanaAprData.katanaAppRewardsAPR ?? katanaAprData.katanaRewardsAPR ?? 0
      return (apr.forwardAPR?.netAPR || 0) + (katanaAprData.FixedRateKatanaRewards || 0) + appRewardsApr
    }
    return 0
  }

  if (apr.forwardAPR?.type === '') {
    return (apr.extra?.stakingRewardsAPR || 0) + (apr?.netAPR || 0)
  }

  if (chainID === 1 && apr.forwardAPR?.composite?.boost > 0 && !apr.extra?.stakingRewardsAPR) {
    return apr.forwardAPR?.netAPR || 0
  }

  const sumOfRewardsAPY = (apr.extra?.stakingRewardsAPR || 0) + (apr.extra?.gammaRewardAPR || 0)
  const hasForwardAPYSource = apr.forwardAPR?.type === 'oracle' || apr?.forwardAPR?.type === 'estimated'
  const hasForwardAPY = hasForwardAPYSource || !isZero(apr?.forwardAPR?.netAPR || 0)

  if (sumOfRewardsAPY > 0) {
    return sumOfRewardsAPY + (apr.forwardAPR?.netAPR || 0)
  }
  if (hasForwardAPY) {
    return apr.forwardAPR?.netAPR || 0
  }
  return apr?.netAPR || 0
}

export function calculateKatanaThirtyDayAPY(
  vault: TKongVaultInput,
  katanaAprs: Partial<TKatanaAprs> | undefined
): number | undefined {
  if (getVaultChainID(vault) !== 747474) return undefined

  const katanaAprData = katanaAprs?.[toAddress(getVaultAddress(vault))]?.apr?.extra
  if (!katanaAprData) return undefined

  const appRewardsApr = katanaAprData.katanaAppRewardsAPR ?? katanaAprData.katanaRewardsAPR
  const parts = [katanaAprData.katanaNativeYield, katanaAprData.FixedRateKatanaRewards, appRewardsApr].filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value)
  )

  if (parts.length === 0) return undefined
  return parts.reduce((acc, value) => acc + value, 0)
}

export function calculateVaultHistoricalAPY(
  vault: TKongVaultInput,
  katanaAprs: Partial<TKatanaAprs> | undefined
): number | null {
  const apr = getVaultAPR(vault)
  const katanaAPY = calculateKatanaThirtyDayAPY(vault, katanaAprs)
  if (getVaultChainID(vault) === 747474) {
    return typeof katanaAPY === 'number' ? katanaAPY : null
  }
  if (typeof katanaAPY === 'number') {
    return katanaAPY
  }

  const monthlyAPY = apr.points?.monthAgo
  const weeklyAPY = apr.points?.weekAgo
  const chosenAPY = !isZero(monthlyAPY || 0) ? monthlyAPY : weeklyAPY
  return typeof chosenAPY === 'number' ? chosenAPY : null
}
