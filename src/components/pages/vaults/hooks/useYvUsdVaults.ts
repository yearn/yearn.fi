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
  hasInfinifiPoints: boolean
}

type TYvUsdVaults = {
  assetAddress: `0x${string}`
  baseVault: TKongVaultView
  listVault: TKongVaultView
  unlockedVault: TKongVaultView
  lockedVault: TKongVaultView
  metrics: {
    unlocked: TYvUsdMetrics
    locked: TYvUsdMetrics
  }
  isLoading: boolean
}

const MAX_REASONABLE_FORWARD_APY = 1
const APR_RAW_DECIMALS = 18

function toFiniteNumber(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return value
}

function getVaultApy(vault: TKongVaultView): number {
  return toFiniteNumber(vault.apr.forwardAPR.netAPR) ?? toFiniteNumber(vault.apr.netAPR) ?? 0
}

function getVaultTvl(vault: TKongVaultView): number {
  return vault.tvl.tvl ?? 0
}

type TSnapshotApyMetric = 'net' | 'weeklyNet' | 'monthlyNet'
type TYvUsdVariantDefaults = {
  forwardApy: number
  netApy: number
  weeklyApy: number
  monthlyApy: number
  tvl: number
  totalAssets: bigint
  price: number
}

function resolveSnapshotHistoricalApy(
  snapshot: TKongVaultSnapshot | undefined,
  metric: TSnapshotApyMetric
): number | undefined {
  return toFiniteNumber(snapshot?.apy?.[metric]) ?? toFiniteNumber(snapshot?.performance?.historical?.[metric])
}

function resolveSnapshotNetApy(snapshot?: TKongVaultSnapshot): number | undefined {
  return resolveSnapshotHistoricalApy(snapshot, 'net')
}

function resolveSnapshotWeeklyApy(snapshot?: TKongVaultSnapshot): number | undefined {
  return resolveSnapshotHistoricalApy(snapshot, 'weeklyNet')
}

function resolveSnapshotMonthlyApy(snapshot?: TKongVaultSnapshot): number | undefined {
  return resolveSnapshotHistoricalApy(snapshot, 'monthlyNet')
}

function resolveSnapshotForwardApy(snapshot?: TKongVaultSnapshot): number | undefined {
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

function resolveSnapshotTvl(snapshot?: TKongVaultSnapshot): number | undefined {
  return toFiniteNumber(snapshot?.tvl?.close)
}

function normalizedToRawAmount(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0) {
    return 0n
  }

  const precision = Math.min(decimals, 12)
  const fixed = value.toFixed(precision)
  const [wholePart, fractionalPart = ''] = fixed.split('.')
  const rawString = `${wholePart}${fractionalPart.padEnd(precision, '0')}`
  const scaled = BigInt(rawString)

  if (precision === decimals) {
    return scaled
  }

  return scaled * 10n ** BigInt(decimals - precision)
}

type TYvUsdAprOverlay = {
  apr?: number
  apy?: number
  strategies?: TKongVaultStrategy[]
}

function normalizeAprRaw(value: string | null | undefined): number | null {
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

function normalizeWeightToDebtRatio(weight: number | undefined): number {
  if (weight === undefined || !Number.isFinite(weight)) {
    return 0
  }
  return Math.max(0, Math.min(10_000, Math.round(weight * 10_000)))
}

function hasDebt(debt: string): boolean {
  try {
    return toBigInt(debt) > 0n
  } catch {
    return false
  }
}

function mapApiStrategy(strategy: TYvUsdAprServiceStrategy, index: number): TKongVaultStrategy {
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

function buildAprOverlay(vault?: TYvUsdAprServiceVault): TYvUsdAprOverlay | undefined {
  if (!vault) {
    return undefined
  }

  const strategies = (vault.meta?.strategies || []).map(mapApiStrategy)
  const apr = toFiniteNumber(vault.apr ?? undefined)
  const apy = toFiniteNumber(vault.apy ?? undefined)
  const resolvedStrategies = strategies.length > 0 ? strategies : undefined

  if (apr === undefined && apy === undefined && !resolvedStrategies) {
    return undefined
  }

  return {
    apr,
    apy,
    strategies: resolvedStrategies
  }
}

function hasInfinifiPoints(vault?: TYvUsdAprServiceVault): boolean {
  return (vault?.meta?.strategies || []).some((strategy) => strategy.points === true)
}

function resolveAddress(value?: string): `0x${string}` | undefined {
  if (!value) return undefined
  try {
    return toAddress(value)
  } catch {
    return undefined
  }
}

const FALLBACK_ASSET = {
  address: toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6
} as const

function buildSyntheticBaseVault(snapshot?: TKongVaultSnapshot): TKongVaultListItem {
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

function getVariantDefaults(baseVariant: TKongVaultView, fallbackToBase: boolean): TYvUsdVariantDefaults {
  if (!fallbackToBase) {
    return {
      forwardApy: 0,
      netApy: 0,
      weeklyApy: 0,
      monthlyApy: 0,
      tvl: 0,
      totalAssets: 0n,
      price: 0
    }
  }

  return {
    forwardApy: baseVariant.apr.forwardAPR.netAPR,
    netApy: baseVariant.apr.netAPR,
    weeklyApy: baseVariant.apr.points.weekAgo,
    monthlyApy: baseVariant.apr.points.monthAgo,
    tvl: baseVariant.tvl.tvl,
    totalAssets: baseVariant.tvl.totalAssets,
    price: baseVariant.tvl.price
  }
}

function getVariantPrice(resolvedTvl: number, normalizedAssets: number, fallbackPrice: number): number {
  if (resolvedTvl > 0 && normalizedAssets > 0) {
    return resolvedTvl / normalizedAssets
  }

  return fallbackPrice
}

function buildVariantVault({
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
}): TKongVaultView {
  const normalizedAddress = toAddress(address)
  const baseVariant = getVaultView(baseVault, snapshot)
  const defaults = getVariantDefaults(baseVariant, fallbackToBase)

  const resolvedNetApy = resolveSnapshotNetApy(snapshot) ?? aprOverlay?.apr ?? defaults.netApy
  const resolvedWeeklyApy = resolveSnapshotWeeklyApy(snapshot) ?? defaults.weeklyApy
  const resolvedMonthlyApy = resolveSnapshotMonthlyApy(snapshot) ?? defaults.monthlyApy
  const resolvedForwardApy = aprOverlay?.apy ?? resolveSnapshotForwardApy(snapshot) ?? defaults.forwardApy
  const resolvedTvl = resolveSnapshotTvl(snapshot) ?? defaults.tvl
  const resolvedTotalAssets = snapshot?.totalAssets ? toBigInt(snapshot.totalAssets) : defaults.totalAssets
  const normalizedAssets = toNormalizedBN(resolvedTotalAssets, baseVariant.token.decimals).normalized
  const resolvedPrice = getVariantPrice(resolvedTvl, normalizedAssets, defaults.price)
  const resolvedStrategies = aprOverlay?.strategies ?? baseVariant.strategies
  const forwardAprType = aprOverlay?.apy !== undefined ? 'yvusd-apr-service' : baseVariant.apr.forwardAPR.type

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
        type: forwardAprType,
        netAPR: resolvedForwardApy
      }
    },
    tvl: {
      ...baseVariant.tvl,
      totalAssets: resolvedTotalAssets,
      tvl: resolvedTvl,
      price: resolvedPrice
    },
    strategies: resolvedStrategies
  }
}

function getCombinedListPrice(
  baseAssetPrice: number,
  combinedTvl: number,
  combinedAssetsNormalized: number,
  fallbackPrice: number
): number {
  if (baseAssetPrice > 0) {
    return baseAssetPrice
  }

  if (combinedTvl > 0 && combinedAssetsNormalized > 0) {
    return combinedTvl / combinedAssetsNormalized
  }

  return fallbackPrice
}

function buildListVault({
  baseVault,
  unlocked,
  locked
}: {
  baseVault: TKongVaultInput
  unlocked: TKongVaultView
  locked: TKongVaultView
}): TKongVaultView {
  const baseView = getVaultView(baseVault)
  const combinedTvl = (unlocked.tvl.tvl ?? 0) + (locked.tvl.tvl ?? 0)
  const baseAssetPrice = unlocked.tvl.price || baseView.tvl.price
  const unlockedAssetsNormalized = toNormalizedBN(unlocked.tvl.totalAssets, baseView.token.decimals).normalized
  const lockedAssetsNormalized = baseAssetPrice > 0 ? locked.tvl.tvl / baseAssetPrice : 0
  const combinedAssetsNormalized = unlockedAssetsNormalized + lockedAssetsNormalized
  const combinedTotalAssets = normalizedToRawAmount(combinedAssetsNormalized, baseView.token.decimals)
  const combinedPrice = getCombinedListPrice(baseAssetPrice, combinedTvl, combinedAssetsNormalized, baseView.tvl.price)

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
      totalAssets: combinedTotalAssets,
      tvl: combinedTvl,
      price: combinedPrice
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
  const baseVaultView = useMemo((): TKongVaultView => getVaultView(baseVault), [baseVault])

  const unlockedAprOverlay = useMemo(
    (): TYvUsdAprOverlay | undefined => buildAprOverlay(unlockedAprServiceVault),
    [unlockedAprServiceVault]
  )
  const lockedAprOverlay = useMemo(
    (): TYvUsdAprOverlay | undefined => buildAprOverlay(lockedAprServiceVault),
    [lockedAprServiceVault]
  )
  const assetAddress = useMemo((): `0x${string}` => {
    const baseAssetAddress = 'asset' in baseVault ? baseVault.asset?.address : undefined
    return (
      resolveAddress(unlockedAprServiceVault?.meta?.asset) ||
      resolveAddress(lockedAprServiceVault?.meta?.asset) ||
      resolveAddress(baseAssetAddress) ||
      FALLBACK_ASSET.address
    )
  }, [baseVault, lockedAprServiceVault, unlockedAprServiceVault])

  const unlockedVault = useMemo((): TKongVaultView => {
    return buildVariantVault({
      baseVault,
      snapshot: unlockedSnapshot,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      fallbackToBase: true,
      aprOverlay: unlockedAprOverlay
    })
  }, [baseVault, unlockedAprOverlay, unlockedSnapshot])

  const lockedVault = useMemo((): TKongVaultView => {
    return buildVariantVault({
      baseVault,
      snapshot: lockedSnapshot,
      address: YVUSD_LOCKED_ADDRESS,
      name: 'yvUSD (Locked)',
      fallbackToBase: false,
      aprOverlay: lockedAprOverlay
    })
  }, [baseVault, lockedAprOverlay, lockedSnapshot])

  const listVault = useMemo((): TKongVaultView => {
    return buildListVault({
      baseVault,
      unlocked: unlockedVault,
      locked: lockedVault
    })
  }, [baseVault, unlockedVault, lockedVault])

  const metrics = useMemo(() => {
    return {
      unlocked: {
        apy: getVaultApy(unlockedVault),
        tvl: getVaultTvl(unlockedVault),
        hasInfinifiPoints: hasInfinifiPoints(unlockedAprServiceVault)
      },
      locked: {
        apy: getVaultApy(lockedVault),
        tvl: getVaultTvl(lockedVault),
        hasInfinifiPoints: hasInfinifiPoints(lockedAprServiceVault)
      }
    }
  }, [unlockedVault, lockedVault, unlockedAprServiceVault, lockedAprServiceVault])

  return {
    assetAddress,
    baseVault: baseVaultView,
    listVault,
    unlockedVault,
    lockedVault,
    metrics,
    isLoading: isLoadingVaultList || isLoadingUnlocked || isLoadingLocked
  }
}
