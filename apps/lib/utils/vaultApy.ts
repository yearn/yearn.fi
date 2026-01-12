import type { TKatanaAprs } from '@lib/hooks/useKatanaAprs'
import { isZero, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'

export function calculateVaultEstimatedAPY(vault: TYDaemonVault, katanaAprs: Partial<TKatanaAprs> | undefined): number {
  if (vault.chainID === 747474) {
    const katanaAprData = katanaAprs?.[toAddress(vault.address)]?.apr?.extra
    if (katanaAprData) {
      return (
        (katanaAprData.katanaNativeYield || 0) +
        (katanaAprData.FixedRateKatanaRewards || 0) +
        (katanaAprData.katanaAppRewardsAPR ?? katanaAprData.katanaRewardsAPR ?? 0) +
        (katanaAprData.katanaBonusAPY || 0) +
        (katanaAprData.steerPointsPerDollar || 0)
      )
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
  const hasCurrentAPY = !isZero(vault?.apr?.forwardAPR?.netAPR || 0)

  if (sumOfRewardsAPY > 0) {
    return sumOfRewardsAPY + (vault.apr?.forwardAPR?.netAPR || 0)
  }
  if (hasCurrentAPY) {
    return vault.apr?.forwardAPR?.netAPR || 0
  }
  return vault.apr?.netAPR || 0
}
