import { useYearn } from '@lib/contexts/useYearn';
import type { TKatanaAprData } from '@lib/hooks/useKatanaAprs';
import { isZero, toAddress } from '@lib/utils';
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas';
import { KATANA_CHAIN_ID } from '@vaults-v3/constants/addresses';
import {
  calcBoostedApr,
  isKelpEigenVault,
  isKelpVault,
  isPendleArbVault,
  projectVeYfiRange,
  sumApr
} from '@vaults-v3/utils/apy';
import { useMemo } from 'react';

export type TVaultApyMode = 'katana' | 'noForward' | 'boosted' | 'rewards' | 'spot' | 'historical';

export type TVaultApyData = {
  mode: TVaultApyMode;
  baseForwardApr: number;
  netApr: number;
  rewardsAprSum: number;
  isBoosted: boolean;
  boost?: number;
  unboostedApr?: number;
  veYfiRange?: [number, number];
  estAprRange?: [number, number];
  hasPendleArbRewards: boolean;
  hasKelp: boolean;
  hasKelpNEngenlayer: boolean;
  isEligibleForSteer?: boolean;
  steerPointsPerDollar?: number;
  katanaExtras?: TKatanaAprData;
  katanaTotalApr?: number;
};

export function useVaultApyData(vault: TYDaemonVault): TVaultApyData {
  const { katanaAprs } = useYearn();
  const shouldUseKatanaAPRs = vault.chainID === KATANA_CHAIN_ID;

  const katanaExtras = useMemo(() => {
    if (!shouldUseKatanaAPRs) return undefined;
    return katanaAprs?.[toAddress(vault.address)]?.apr?.extra as TKatanaAprData | undefined;
  }, [shouldUseKatanaAPRs, katanaAprs, vault.address]);

  const katanaTotalApr = useMemo(() => {
    if (!katanaExtras) return undefined;
    const { katanaRewardsAPR: _legacy, katanaBonusAPY: _bonus, steerPointsPerDollar: _points, ...rest } = katanaExtras;
    return sumApr(Object.values(rest));
  }, [katanaExtras]);

  const baseForwardApr = vault.apr.forwardAPR.netAPR;
  const netApr = vault.apr.netAPR;
  const rewardsAprSum = vault.apr.extra.stakingRewardsAPR + vault.apr.extra.gammaRewardAPR;
  const isBoosted =
    vault.chainID === 1 && (vault.apr.forwardAPR.composite?.boost || 0) > 0 && !vault.apr.extra.stakingRewardsAPR;
  const { boost, unboosted } = calcBoostedApr(vault);

  const hasPendleArbRewards = isPendleArbVault(vault);
  const hasKelpNEngenlayer = isKelpEigenVault(vault);
  const hasKelp = isKelpVault(vault);

  let mode: TVaultApyMode = 'historical';
  let veYfiRange: [number, number] | undefined;
  let estAprRange: [number, number] | undefined;

  if (katanaExtras && katanaTotalApr !== undefined) {
    mode = 'katana';
  } else if (vault.apr.forwardAPR.type === '') {
    mode = 'noForward';
  } else if (isBoosted) {
    mode = 'boosted';
  } else if (rewardsAprSum > 0) {
    mode = 'rewards';
    if (vault.staking.source === 'VeYFI') {
      veYfiRange = projectVeYfiRange(vault);
      estAprRange = [baseForwardApr, (veYfiRange?.[1] || 0) + baseForwardApr];
    }
  } else if (!isZero(baseForwardApr)) {
    mode = 'spot';
  } else {
    mode = 'historical';
  }

  const isEligibleForSteer = (katanaExtras?.steerPointsPerDollar || 0) > 0;
  const steerPointsPerDollar = katanaExtras?.steerPointsPerDollar;

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
    katanaTotalApr
  };
}

