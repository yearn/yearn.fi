import { getVaultAPR, getVaultAddress, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { VAULT_ADDRESSES } from '@pages/vaults/constants/addresses'
import { toAddress } from '@shared/utils'

export function isPendleArbVault(vault: TKongVaultInput): boolean {
  return toAddress(getVaultAddress(vault)) === toAddress(VAULT_ADDRESSES.PENDLE_ARB_REWARDS)
}

export function isKelpEigenVault(vault: TKongVaultInput): boolean {
  return toAddress(getVaultAddress(vault)) === toAddress(VAULT_ADDRESSES.KELP_N_ENGENLAYER)
}

export function isKelpVault(vault: TKongVaultInput): boolean {
  return toAddress(getVaultAddress(vault)) === toAddress(VAULT_ADDRESSES.KELP)
}

export function sumApr(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

export function projectVeYfiRange(vault: TKongVaultInput): [number, number] {
  const apr = getVaultAPR(vault)
  const sumOfRewardsAPY = apr.extra.stakingRewardsAPR + apr.extra.gammaRewardAPR
  const minRewards = apr.extra.stakingRewardsAPR / 10 + apr.extra.gammaRewardAPR
  return [minRewards, sumOfRewardsAPY]
}

export function calcBoostedApr(vault: TKongVaultInput): { boost: number; unboosted: number } {
  const apr = getVaultAPR(vault)
  const boost = apr.forwardAPR.composite?.boost || 0
  const unboosted = boost > 0 ? apr.forwardAPR.netAPR / boost : apr.forwardAPR.netAPR
  return { boost, unboosted }
}
