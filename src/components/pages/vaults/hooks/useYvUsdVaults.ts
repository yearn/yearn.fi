import {
  getVaultView,
  type TKongVaultInput,
  type TKongVaultStrategy,
  type TKongVaultView
} from '@pages/vaults/domain/kongVaultSelectors'
import { useYearn } from '@shared/contexts/useYearn'
import { toAddress, toBigInt, toNormalizedBN } from '@shared/utils'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import type { TYvUsdAprServiceStrategy, TYvUsdAprServiceVault } from '@shared/utils/schemas/yvUsdAprServiceSchema'
import { useMemo } from 'react'
import { YVUSD_CHAIN_ID, YVUSD_DESCRIPTION, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '../utils/yvUsd'
import { useVaultSnapshot } from './useVaultSnapshot'
import { useYvUsdAprService } from './useYvUsdAprService'

type TYvUsdMetrics = {
  apy: number
  tvl: number
}

type TYvUsdVaults = {
  baseVault?: TKongVaultView
  listVault?: TKongVaultView
  unlockedVault?: TKongVaultView
  lockedVault?: TKongVaultView
  metrics?: {
    unlocked: TYvUsdMetrics
    locked: TYvUsdMetrics
  }
  isLoading: boolean
}

const MAX_REASONABLE_FORWARD_APY = 1
const APR_RAW_DECIMALS = 18

const toFiniteNumber = (value: number | null | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return value
}

const getVaultApy = (vault: TKongVaultView): number =>
  toFiniteNumber(vault.apr.forwardAPR.netAPR) ?? toFiniteNumber(vault.apr.netAPR) ?? 0

const getVaultTvl = (vault: TKongVaultView): number => vault.tvl.tvl ?? 0

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

type TYvUsdAprOverlay = {
  apr?: number
  apy?: number
  strategies?: TKongVaultStrategy[]
}

const normalizeAprRaw = (value: string | null | undefined): number | null => {
  if (!value) return null
  try {
    const normalized = toNormalizedBN(value, APR_RAW_DECIMALS).normalized
    if (!Number.isFinite(normalized)) {
      return null
    }
    return normalized
  } catch {
    return null
  }
}

const normalizeWeightToDebtRatio = (weight: number | undefined): number => {
  if (weight === undefined || !Number.isFinite(weight)) {
    return 0
  }
  return Math.max(0, Math.min(10_000, Math.round(weight * 10_000)))
}

const hasDebt = (debt: string): boolean => {
  try {
    return toBigInt(debt) > 0n
  } catch {
    return false
  }
}

const mapApiStrategy = (strategy: TYvUsdAprServiceStrategy, index: number): TKongVaultStrategy => {
  const netApr = normalizeAprRaw(strategy.net_apr_raw || strategy.apr_raw)
  const debt = strategy.debt || '0'
  const debtRatio = normalizeWeightToDebtRatio(strategy.weight)
  const strategyName = strategy.meta?.name?.trim() || `Strategy ${index + 1}`
  const isAllocated = hasDebt(debt) && debtRatio > 0

  return {
    address: toAddress(strategy.address),
    name: strategyName,
    description: '',
    netAPR: netApr,
    estimatedAPY: netApr ?? undefined,
    status: isAllocated ? 'active' : 'unallocated',
    details: {
      totalDebt: debt,
      totalLoss: '0',
      totalGain: '0',
      performanceFee: 0,
      lastReport: 0,
      debtRatio
    }
  }
}

const buildAprOverlay = (vault?: TYvUsdAprServiceVault): TYvUsdAprOverlay | undefined => {
  if (!vault) return undefined

  const strategies = (vault.meta?.strategies || []).map(mapApiStrategy)
  const overlay = {
    apr: toFiniteNumber(vault.apr ?? undefined),
    apy: toFiniteNumber(vault.apy ?? undefined),
    strategies: strategies.length > 0 ? strategies : undefined
  }

  const hasApr = overlay.apr !== undefined
  const hasApy = overlay.apy !== undefined
  if (!hasApr && !hasApy && !overlay.strategies) {
    return undefined
  }

  return overlay
}

const FALLBACK_ASSET = {
  address: toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6
} as const

const buildSyntheticBaseVault = (snapshot?: TKongVaultSnapshot): TKongVaultListItem => {
  const token = snapshot?.meta?.token
  const asset = snapshot?.asset
  const resolvedAsset = {
    address: toAddress(token?.address ?? asset?.address ?? FALLBACK_ASSET.address),
    name: token?.name || asset?.name || FALLBACK_ASSET.name,
    symbol: token?.symbol || asset?.symbol || FALLBACK_ASSET.symbol,
    decimals: token?.decimals ?? asset?.decimals ?? FALLBACK_ASSET.decimals
  }

  return {
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_UNLOCKED_ADDRESS,
    name: 'yvUSD',
    symbol: 'yvUSD',
    apiVersion: snapshot?.apiVersion ?? '3.0.0',
    decimals: snapshot?.decimals ?? 18,
    asset: resolvedAsset,
    tvl: toFiniteNumber(snapshot?.tvl?.close) ?? null,
    performance: null,
    fees: {
      managementFee: toFiniteNumber(snapshot?.fees?.managementFee) ?? 0,
      performanceFee: toFiniteNumber(snapshot?.fees?.performanceFee) ?? 0
    },
    category: 'Stablecoin',
    type: snapshot?.meta?.type || 'Automated Yearn Vault',
    kind: snapshot?.meta?.kind || 'Multi Strategy',
    v3: true,
    yearn: true,
    isRetired: Boolean(snapshot?.meta?.isRetired),
    isHidden: Boolean(snapshot?.meta?.isHidden),
    isBoosted: Boolean(snapshot?.meta?.isBoosted),
    isHighlighted: true,
    inclusion: { isYearn: true },
    migration: false,
    origin: 'synthetic-yvusd',
    strategiesCount: snapshot?.composition?.length ?? snapshot?.debts?.length ?? 0,
    riskLevel: toFiniteNumber(snapshot?.risk?.riskLevel) ?? null,
    staking: null
  }
}

const buildVariantVault = ({
  baseVault,
  snapshot,
  address,
  name,
  fallbackToBase,
  aprOverlay
}: {
  baseVault: TKongVaultInput
  snapshot?: TKongVaultSnapshot
  address: string
  name: string
  fallbackToBase: boolean
  aprOverlay?: TYvUsdAprOverlay
}): TKongVaultView => {
  const normalizedAddress = toAddress(address)
  const baseVariant = getVaultView(baseVault, snapshot)

  const defaults = fallbackToBase
    ? {
        forwardApy: baseVariant.apr.forwardAPR.netAPR,
        netApy: baseVariant.apr.netAPR,
        weeklyApy: baseVariant.apr.points.weekAgo,
        monthlyApy: baseVariant.apr.points.monthAgo,
        tvl: baseVariant.tvl.tvl
      }
    : {
        forwardApy: 0,
        netApy: 0,
        weeklyApy: 0,
        monthlyApy: 0,
        tvl: 0
      }

  const resolvedNetApy = resolveSnapshotNetApy(snapshot) ?? aprOverlay?.apr ?? defaults.netApy
  const resolvedWeeklyApy = resolveSnapshotWeeklyApy(snapshot) ?? defaults.weeklyApy
  const resolvedMonthlyApy = resolveSnapshotMonthlyApy(snapshot) ?? defaults.monthlyApy
  const resolvedForwardApy = aprOverlay?.apy ?? resolveSnapshotForwardApy(snapshot) ?? defaults.forwardApy
  const resolvedTvl = resolveSnapshotTvl(snapshot) ?? defaults.tvl
  const resolvedStrategies = aprOverlay?.strategies ?? baseVariant.strategies

  return {
    ...baseVariant,
    address: normalizedAddress,
    chainID: YVUSD_CHAIN_ID,
    name,
    symbol: 'yvUSD',
    description: YVUSD_DESCRIPTION,
    category: 'Stablecoin',
    apr: {
      ...baseVariant.apr,
      netAPR: resolvedNetApy,
      points: {
        ...baseVariant.apr.points,
        weekAgo: resolvedWeeklyApy,
        monthAgo: resolvedMonthlyApy
      },
      forwardAPR: {
        ...baseVariant.apr.forwardAPR,
        type: aprOverlay?.apy !== undefined ? 'yvusd-apr-service' : baseVariant.apr.forwardAPR.type,
        netAPR: resolvedForwardApy
      }
    },
    tvl: {
      ...baseVariant.tvl,
      tvl: resolvedTvl
    },
    strategies: resolvedStrategies
  }
}

const buildListVault = ({
  baseVault,
  unlocked,
  locked
}: {
  baseVault: TKongVaultInput
  unlocked: TKongVaultView
  locked: TKongVaultView
}): TKongVaultView => {
  const baseView = getVaultView(baseVault)
  const combinedTvl = (unlocked.tvl.tvl ?? 0) + (locked.tvl.tvl ?? 0)

  return {
    ...baseView,
    address: YVUSD_UNLOCKED_ADDRESS,
    chainID: YVUSD_CHAIN_ID,
    name: 'yvUSD',
    symbol: 'yvUSD',
    description: YVUSD_DESCRIPTION,
    category: 'Stablecoin',
    tvl: {
      ...baseView.tvl,
      tvl: combinedTvl
    },
    apr: {
      ...baseView.apr,
      netAPR: unlocked.apr.netAPR,
      forwardAPR: {
        ...baseView.apr.forwardAPR,
        netAPR: unlocked.apr.forwardAPR.netAPR
      }
    },
    info: {
      ...baseView.info,
      isHighlighted: true,
      uiNotice: YVUSD_DESCRIPTION
    },
    strategies: unlocked.strategies ?? baseView.strategies,
    featuringScore: Math.max(baseView.featuringScore ?? 0, 9_999)
  }
}

export function useYvUsdVaults(): TYvUsdVaults {
  const { vaults, isLoadingVaultList } = useYearn()
  const { unlocked: unlockedAprServiceVault, locked: lockedAprServiceVault } = useYvUsdAprService()

  const { data: unlockedSnapshot, isLoading: isLoadingUnlocked } = useVaultSnapshot({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_UNLOCKED_ADDRESS
  })

  const { data: lockedSnapshot, isLoading: isLoadingLocked } = useVaultSnapshot({
    chainId: YVUSD_CHAIN_ID,
    address: YVUSD_LOCKED_ADDRESS
  })

  const baseVault = useMemo<TKongVaultInput>(() => {
    const baseCandidates = [YVUSD_UNLOCKED_ADDRESS, YVUSD_LOCKED_ADDRESS]
    const listVaultCandidate = baseCandidates.map((address) => vaults[toAddress(address)]).find(Boolean)
    if (listVaultCandidate) {
      return listVaultCandidate
    }
    return buildSyntheticBaseVault(unlockedSnapshot ?? lockedSnapshot)
  }, [lockedSnapshot, unlockedSnapshot, vaults])

  const unlockedAprOverlay = useMemo(() => buildAprOverlay(unlockedAprServiceVault), [unlockedAprServiceVault])
  const lockedAprOverlay = useMemo(() => buildAprOverlay(lockedAprServiceVault), [lockedAprServiceVault])

  const unlockedVault = useMemo(() => {
    if (!baseVault) return undefined
    return buildVariantVault({
      baseVault,
      snapshot: unlockedSnapshot,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      fallbackToBase: true,
      aprOverlay: unlockedAprOverlay
    })
  }, [baseVault, unlockedAprOverlay, unlockedSnapshot])

  const lockedVault = useMemo(() => {
    if (!baseVault) return undefined
    return buildVariantVault({
      baseVault,
      snapshot: lockedSnapshot,
      address: YVUSD_LOCKED_ADDRESS,
      name: 'yvUSD (Locked)',
      fallbackToBase: false,
      aprOverlay: lockedAprOverlay
    })
  }, [baseVault, lockedAprOverlay, lockedSnapshot])

  const listVault = useMemo(() => {
    if (!baseVault || !unlockedVault || !lockedVault) return undefined
    return buildListVault({
      baseVault,
      unlocked: unlockedVault,
      locked: lockedVault
    })
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
    baseVault: getVaultView(baseVault),
    listVault,
    unlockedVault,
    lockedVault,
    metrics,
    isLoading: isLoadingVaultList || isLoadingUnlocked || isLoadingLocked
  }
}
