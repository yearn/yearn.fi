import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VAULT_ADDRESSES } from '@vaults/constants/addresses'

export function isPendleArbVault(vault: TYDaemonVault): boolean {
  return toAddress(vault.address) === toAddress(VAULT_ADDRESSES.PENDLE_ARB_REWARDS)
}

export function isKelpEigenVault(vault: TYDaemonVault): boolean {
  return toAddress(vault.address) === toAddress(VAULT_ADDRESSES.KELP_N_ENGENLAYER)
}

export function isKelpVault(vault: TYDaemonVault): boolean {
  return toAddress(vault.address) === toAddress(VAULT_ADDRESSES.KELP)
}

export function sumApr(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

export function projectVeYfiRange(vault: TYDaemonVault): [number, number] {
  const sumOfRewardsAPY = vault.apr.extra.stakingRewardsAPR + vault.apr.extra.gammaRewardAPR
  const minRewards = vault.apr.extra.stakingRewardsAPR / 10 + vault.apr.extra.gammaRewardAPR
  return [minRewards, sumOfRewardsAPY]
}

export function calcBoostedApr(vault: TYDaemonVault): { boost: number; unboosted: number } {
  const boost = vault.apr.forwardAPR.composite?.boost || 0
  const unboosted = boost > 0 ? vault.apr.forwardAPR.netAPR / boost : vault.apr.forwardAPR.netAPR
  return { boost, unboosted }
}
