import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import {
  getVaultAddress,
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
  projectVeYfiRange,
  sumApr
} from '@pages/vaults/utils/apy'
import { useYearn } from '@shared/contexts/useYearn'
import type { TKatanaAprData } from '@shared/hooks/useKatanaAprs'
import { isZero, toAddress } from '@shared/utils'
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
  if (!katanaExtras) return undefined

  const appRewardsApr = katanaExtras.katanaAppRewardsAPR ?? katanaExtras.katanaRewardsAPR
  const baseApr = typeof baseAprOverride === 'number' ? baseAprOverride : katanaExtras.katanaNativeYield
  const parts = [baseApr, katanaExtras.FixedRateKatanaRewards, appRewardsApr].filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value)
  )

  if (parts.length === 0) return undefined
  return sumApr(parts)
}

export function useVaultApyData(vault: TKongVaultInput): TVaultApyData {
  const { katanaAprs } = useYearn()
  const shouldUseKatanaAPRs = getVaultChainID(vault) === KATANA_CHAIN_ID

  const staking = getVaultStaking(vault)
  const apr = getVaultAPR(vault)

  const baseForwardApr = apr.forwardAPR.netAPR
  const hasForwardAprSource = apr.forwardAPR.type === 'oracle' || apr.forwardAPR.type === 'estimated'
  const hasForwardApr = hasForwardAprSource || !isZero(baseForwardApr)
  const netApr = apr.netAPR
  const rewardsAprSum = apr.extra.stakingRewardsAPR + apr.extra.gammaRewardAPR
  const isBoosted =
    getVaultChainID(vault) === 1 && (apr.forwardAPR.composite?.boost || 0) > 0 && !apr.extra.stakingRewardsAPR
  const { boost, unboosted } = calcBoostedApr(vault)

  const katanaExtras = useMemo(() => {
    if (!shouldUseKatanaAPRs) return undefined
    return katanaAprs?.[toAddress(getVaultAddress(vault))]?.apr?.extra as TKatanaAprData | undefined
  }, [shouldUseKatanaAPRs, katanaAprs, vault])

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
    if (hasForwardApr) {
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
