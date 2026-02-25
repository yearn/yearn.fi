import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import {
  getVaultAPR,
  getVaultChainID,
  getVaultStaking,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import {
  calcBoostedApr,
  isKelpEigenVault,
  isKelpVault,
  isPendleArbVault,
  projectVeYfiRange
} from '@pages/vaults/utils/apy'
import { isZero } from '@shared/utils'
import { calculateKatanaTotalApr, getKatanaAprData, type TKatanaAprData } from '@shared/utils/vaultApy'
import { useMemo } from 'react'

export type TVaultApyMode = 'katana' | 'noForward' | 'boosted' | 'rewards' | 'spot' | 'historical'

export type TVaultApyData = {
  mode: TVaultApyMode
  baseForwardApr: number
  netApr: number
  rewardsAprSum: number
  isBoosted: boolean
  boost?: number
  unboostedApr?: number
  veYfiRange?: [number, number]
  estAprRange?: [number, number]
  hasPendleArbRewards: boolean
  hasKelp: boolean
  hasKelpNEngenlayer: boolean
  isEligibleForSteer?: boolean
  steerPointsPerDollar?: number
  katanaExtras?: TKatanaAprData
  katanaThirtyDayApr?: number
  katanaEstApr?: number
}

export function computeKatanaTotalApr(
  katanaExtras?: Partial<TKatanaAprData>,
  baseAprOverride?: number
): number | undefined {
  return calculateKatanaTotalApr(katanaExtras, baseAprOverride)
}

export function resolveKatanaExtras(vault: TKongVaultInput): TKatanaAprData | undefined {
  if (getVaultChainID(vault) !== KATANA_CHAIN_ID) {
    return undefined
  }
  return getKatanaAprData(vault)
}

export function useVaultApyData(vault: TKongVaultInput): TVaultApyData {
  const shouldUseKatanaAPRs = getVaultChainID(vault) === KATANA_CHAIN_ID

  const apr = getVaultAPR(vault)
  const staking = getVaultStaking(vault)
  const baseForwardApr = apr.forwardAPR.netAPR
  const netApr = apr.netAPR
  const rewardsAprSum = apr.extra.stakingRewardsAPR + apr.extra.gammaRewardAPR
  const isBoosted =
    getVaultChainID(vault) === 1 && (apr.forwardAPR.composite?.boost || 0) > 0 && !apr.extra.stakingRewardsAPR
  const { boost, unboosted } = calcBoostedApr(vault)

  const katanaExtras = useMemo(() => {
    if (!shouldUseKatanaAPRs) return undefined
    return resolveKatanaExtras(vault)
  }, [shouldUseKatanaAPRs, vault])

  const katanaThirtyDayApr = useMemo(() => {
    return computeKatanaTotalApr(katanaExtras)
  }, [katanaExtras])

  const katanaEstApr = useMemo(() => {
    return computeKatanaTotalApr(katanaExtras, baseForwardApr)
  }, [katanaExtras, baseForwardApr])

  const hasPendleArbRewards = isPendleArbVault(vault)
  const hasKelpNEngenlayer = isKelpEigenVault(vault)
  const hasKelp = isKelpVault(vault)

  const { mode, veYfiRange, estAprRange } = ((): {
    mode: TVaultApyMode
    veYfiRange?: [number, number]
    estAprRange?: [number, number]
  } => {
    if (katanaExtras && katanaEstApr !== undefined) {
      return { mode: 'katana' }
    }
    if (apr.forwardAPR.type === '') {
      return { mode: 'noForward' }
    }
    if (isBoosted) {
      return { mode: 'boosted' }
    }
    if (rewardsAprSum > 0) {
      if (staking.source === 'VeYFI') {
        const veYfiRange = projectVeYfiRange(vault)
        return {
          mode: 'rewards',
          veYfiRange,
          estAprRange: [baseForwardApr, (veYfiRange?.[1] || 0) + baseForwardApr]
        }
      }
      return { mode: 'rewards' }
    }
    if (!isZero(baseForwardApr)) {
      return { mode: 'spot' }
    }
    return { mode: 'historical' }
  })()

  const isEligibleForSteer = (katanaExtras?.steerPointsPerDollar || 0) > 0
  const steerPointsPerDollar = katanaExtras?.steerPointsPerDollar

  return {
    mode,
    baseForwardApr,
    netApr,
    rewardsAprSum,
    isBoosted,
    boost,
    unboostedApr: unboosted,
    veYfiRange,
    estAprRange,
    hasPendleArbRewards,
    hasKelp,
    hasKelpNEngenlayer,
    isEligibleForSteer,
    steerPointsPerDollar,
    katanaExtras,
    katanaThirtyDayApr,
    katanaEstApr
  }
}
