import { useYearn } from '@shared/contexts/useYearn'
import { toAddress } from '@shared/utils'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { useMemo } from 'react'
import { mergeVaultSnapshot } from '../utils/normalizeVaultSnapshot'
import {
  YVUSD_BASELINE_VAULT_ADDRESS,
  YVUSD_CHAIN_ID,
  YVUSD_DESCRIPTION,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '../utils/yvUsd'
import { useVaultSnapshot } from './useVaultSnapshot'

type TYvUsdMetrics = {
  apy: number
  tvl: number
}

type TYvUsdVaults = {
  baseVault?: TYDaemonVault
  listVault?: TYDaemonVault
  unlockedVault?: TYDaemonVault
  lockedVault?: TYDaemonVault
  metrics?: {
    unlocked: TYvUsdMetrics
    locked: TYvUsdMetrics
  }
  isLoading: boolean
}

const MAX_REASONABLE_FORWARD_APY = 1

const toFiniteNumber = (value: number | null | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return value
}

const getVaultApy = (vault: TYDaemonVault): number =>
  toFiniteNumber(vault.apr?.forwardAPR?.netAPR) ?? toFiniteNumber(vault.apr?.netAPR) ?? 0

const getVaultTvl = (vault: TYDaemonVault): number => vault.tvl?.tvl ?? 0

type TSnapshotApyMetric = 'net' | 'weeklyNet' | 'monthlyNet'

const resolveSnapshotHistoricalApy = (
  snapshot: TKongVaultSnapshot | undefined,
  metric: TSnapshotApyMetric
): number | undefined =>
  toFiniteNumber(snapshot?.apy?.[metric]) ?? toFiniteNumber(snapshot?.performance?.historical?.[metric])

const resolveSnapshotNetApy = (snapshot?: TKongVaultSnapshot): number | undefined =>
  resolveSnapshotHistoricalApy(snapshot, 'net')

const resolveSnapshotWeeklyApy = (snapshot?: TKongVaultSnapshot): number | undefined =>
  resolveSnapshotHistoricalApy(snapshot, 'weeklyNet')

const resolveSnapshotMonthlyApy = (snapshot?: TKongVaultSnapshot): number | undefined =>
  resolveSnapshotHistoricalApy(snapshot, 'monthlyNet')

const resolveSnapshotForwardApy = (snapshot?: TKongVaultSnapshot): number | undefined => {
  const estimatedApy = toFiniteNumber(snapshot?.performance?.estimated?.apy)
  if (estimatedApy !== undefined) {
    return estimatedApy
  }

  const estimatedApr = toFiniteNumber(snapshot?.performance?.estimated?.apr)
  if (estimatedApr !== undefined) {
    return estimatedApr
  }

  for (const oracleValue of [
    toFiniteNumber(snapshot?.performance?.oracle?.apy),
    toFiniteNumber(snapshot?.performance?.oracle?.apr)
  ]) {
    if (oracleValue !== undefined && Math.abs(oracleValue) <= MAX_REASONABLE_FORWARD_APY) {
      return oracleValue
    }
  }

  return resolveSnapshotNetApy(snapshot)
}

const resolveSnapshotTvl = (snapshot?: TKongVaultSnapshot): number | undefined => toFiniteNumber(snapshot?.tvl?.close)

const buildVariantVault = ({
  baseVault,
  snapshot,
  address,
  name,
  fallbackToBase
}: {
  baseVault: TYDaemonVault
  snapshot?: TKongVaultSnapshot
  address: string
  name: string
  fallbackToBase: boolean
}): TYDaemonVault => {
  const normalizedAddress = toAddress(address)
  const baseVariant: TYDaemonVault = {
    ...baseVault,
    address: normalizedAddress,
    chainID: YVUSD_CHAIN_ID,
    name,
    symbol: 'yvUSD',
    description: YVUSD_DESCRIPTION,
    category: 'Stablecoin'
  }

  const mergedVault = snapshot ? (mergeVaultSnapshot(baseVariant, snapshot) ?? baseVariant) : baseVariant
  const defaults = fallbackToBase
    ? {
        forwardApy: mergedVault.apr.forwardAPR.netAPR,
        netApy: mergedVault.apr.netAPR,
        weeklyApy: mergedVault.apr.points.weekAgo,
        monthlyApy: mergedVault.apr.points.monthAgo,
        tvl: mergedVault.tvl.tvl
      }
    : {
        forwardApy: 0,
        netApy: 0,
        weeklyApy: 0,
        monthlyApy: 0,
        tvl: 0
      }

  const resolvedNetApy = resolveSnapshotNetApy(snapshot) ?? defaults.netApy
  const resolvedWeeklyApy = resolveSnapshotWeeklyApy(snapshot) ?? defaults.weeklyApy
  const resolvedMonthlyApy = resolveSnapshotMonthlyApy(snapshot) ?? defaults.monthlyApy
  const resolvedForwardApy = resolveSnapshotForwardApy(snapshot) ?? defaults.forwardApy
  const resolvedTvl = resolveSnapshotTvl(snapshot) ?? defaults.tvl

  return {
    ...mergedVault,
    address: normalizedAddress,
    chainID: YVUSD_CHAIN_ID,
    name,
    symbol: 'yvUSD',
    description: YVUSD_DESCRIPTION,
    category: 'Stablecoin',
    apr: {
      ...mergedVault.apr,
      netAPR: resolvedNetApy,
      points: {
        ...mergedVault.apr.points,
        weekAgo: resolvedWeeklyApy,
        monthAgo: resolvedMonthlyApy
      },
      forwardAPR: {
        ...mergedVault.apr.forwardAPR,
        netAPR: resolvedForwardApy
      }
    },
    tvl: {
      ...mergedVault.tvl,
      tvl: resolvedTvl
    }
  }
}

const buildListVault = (baseVault: TYDaemonVault, unlocked: TYDaemonVault, locked: TYDaemonVault): TYDaemonVault => {
  const combinedTvl = (unlocked.tvl?.tvl ?? 0) + (locked.tvl?.tvl ?? 0)
  return {
    ...baseVault,
    address: YVUSD_UNLOCKED_ADDRESS,
    chainID: YVUSD_CHAIN_ID,
    name: 'yvUSD',
    symbol: 'yvUSD',
    description: YVUSD_DESCRIPTION,
    category: 'Stablecoin',
    tvl: {
      ...baseVault.tvl,
      tvl: combinedTvl
    },
    apr: {
      ...baseVault.apr,
      netAPR: unlocked.apr?.netAPR ?? baseVault.apr?.netAPR ?? 0,
      forwardAPR: {
        ...baseVault.apr.forwardAPR,
        netAPR: unlocked.apr?.forwardAPR?.netAPR ?? baseVault.apr?.forwardAPR?.netAPR ?? 0
      }
    },
    info: {
      ...baseVault.info,
      isHighlighted: true,
      uiNotice: YVUSD_DESCRIPTION
    },
    strategies: unlocked.strategies ?? baseVault.strategies,
    featuringScore: Math.max(baseVault.featuringScore ?? 0, 9_999)
  }
}

export function useYvUsdVaults(): TYvUsdVaults {
  const { vaults, isLoadingVaultList } = useYearn()

  const baseVault = useMemo(() => vaults[toAddress(YVUSD_BASELINE_VAULT_ADDRESS)], [vaults])

  const { data: unlockedSnapshot, isLoading: isLoadingUnlocked } = useVaultSnapshot({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_UNLOCKED_ADDRESS
  })

  const { data: lockedSnapshot, isLoading: isLoadingLocked } = useVaultSnapshot({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_LOCKED_ADDRESS
  })

  const unlockedVault = useMemo(() => {
    if (!baseVault) return undefined
    return buildVariantVault({
      baseVault,
      snapshot: unlockedSnapshot,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      fallbackToBase: true
    })
  }, [baseVault, unlockedSnapshot])

  const lockedVault = useMemo(() => {
    if (!baseVault) return undefined
    return buildVariantVault({
      baseVault,
      snapshot: lockedSnapshot,
      address: YVUSD_LOCKED_ADDRESS,
      name: 'yvUSD (Locked)',
      fallbackToBase: false
    })
  }, [baseVault, lockedSnapshot])

  const listVault = useMemo(() => {
    if (!baseVault || !unlockedVault || !lockedVault) return undefined
    return buildListVault(baseVault, unlockedVault, lockedVault)
  }, [baseVault, unlockedVault, lockedVault])

  const metrics = useMemo(() => {
    if (!unlockedVault || !lockedVault) return undefined
    return {
      unlocked: {
        apy: getVaultApy(unlockedVault),
        tvl: getVaultTvl(unlockedVault)
      },
      locked: {
        apy: getVaultApy(lockedVault),
        tvl: getVaultTvl(lockedVault)
      }
    }
  }, [unlockedVault, lockedVault])

  return {
    baseVault,
    listVault,
    unlockedVault,
    lockedVault,
    metrics,
    isLoading: isLoadingVaultList || isLoadingUnlocked || isLoadingLocked
  }
}
