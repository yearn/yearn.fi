import type { TKatanaAprs } from '@shared/hooks/useKatanaAprs'
import { isZero, toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'

export function calculateVaultEstimatedAPY(vault: TYDaemonVault, katanaAprs: Partial<TKatanaAprs> | undefined): number {
  if (vault.chainID === 747474) {
    const katanaAprData = katanaAprs?.[toAddress(vault.address)]?.apr?.extra
    if (katanaAprData) {
      const appRewardsApr = katanaAprData.katanaAppRewardsAPR ?? katanaAprData.katanaRewardsAPR ?? 0
      return (vault.apr?.forwardAPR?.netAPR || 0) + (katanaAprData.FixedRateKatanaRewards || 0) + appRewardsApr
    }
    return 0
  }

  if (vault.apr?.forwardAPR?.type === '') {
    return (vault.apr?.extra?.stakingRewardsAPR || 0) + (vault.apr?.netAPR || 0)
  }

  if (vault.chainID === 1 && vault.apr?.forwardAPR?.composite?.boost > 0 && !vault.apr?.extra?.stakingRewardsAPR) {
    return vault.apr?.forwardAPR?.netAPR || 0
  }

  const sumOfRewardsAPY = (vault.apr?.extra?.stakingRewardsAPR || 0) + (vault.apr?.extra?.gammaRewardAPR || 0)
  const hasForwardAPYSource = vault.apr?.forwardAPR?.type === 'oracle' || vault.apr?.forwardAPR?.type === 'estimated'
  const hasForwardAPY = hasForwardAPYSource || !isZero(vault?.apr?.forwardAPR?.netAPR || 0)

  if (sumOfRewardsAPY > 0) {
    return sumOfRewardsAPY + (vault.apr?.forwardAPR?.netAPR || 0)
  }
  if (hasForwardAPY) {
    return vault.apr?.forwardAPR?.netAPR || 0
  }
  return vault.apr?.netAPR || 0
}

export function calculateKatanaThirtyDayAPY(
  vault: TYDaemonVault,
  katanaAprs: Partial<TKatanaAprs> | undefined
): number | undefined {
  if (vault.chainID !== 747474) return undefined

  const katanaAprData = katanaAprs?.[toAddress(vault.address)]?.apr?.extra
  if (!katanaAprData) return undefined

  const appRewardsApr = katanaAprData.katanaAppRewardsAPR ?? katanaAprData.katanaRewardsAPR
  const parts = [katanaAprData.katanaNativeYield, katanaAprData.FixedRateKatanaRewards, appRewardsApr].filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value)
  )

  if (parts.length === 0) return undefined
  return parts.reduce((acc, value) => acc + value, 0)
}

export function calculateVaultHistoricalAPY(
  vault: TYDaemonVault,
  katanaAprs: Partial<TKatanaAprs> | undefined
): number | null {
  const katanaAPY = calculateKatanaThirtyDayAPY(vault, katanaAprs)
  if (vault.chainID === 747474) {
    return typeof katanaAPY === 'number' ? katanaAPY : null
  }
  if (typeof katanaAPY === 'number') {
    return katanaAPY
  }

  const monthlyAPY = vault.apr?.points?.monthAgo
  const weeklyAPY = vault.apr?.points?.weekAgo
  const chosenAPY = !isZero(monthlyAPY || 0) ? monthlyAPY : weeklyAPY
  return typeof chosenAPY === 'number' ? chosenAPY : null
}
