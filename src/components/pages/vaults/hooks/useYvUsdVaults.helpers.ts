'use client'

import { getVaultView, type TKongVaultInput, type TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress, toBigInt, toNormalizedBN } from '@shared/utils'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { YVUSD_CHAIN_ID, YVUSD_DESCRIPTION, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '../utils/yvUsd'

export type TYvUsdMetrics = {
  apy: number
  tvl: number
  hasInfinifiPoints: boolean
}

export type TYvUsdPointsState = {
  unlocked: boolean
  locked: boolean
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

const MAX_REASONABLE_FORWARD_APY = 1

const FALLBACK_ASSET = {
  address: toAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6
} as const

function toFiniteNumber(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return value
}

function resolveAddress(value?: string): `0x${string}` | undefined {
  if (!value) {
    return undefined
  }
  try {
    return toAddress(value)
  } catch {
    return undefined
  }
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

function resolveBaseVaultAssetAddress(baseVault: TKongVaultInput): `0x${string}` | undefined {
  if ('token' in baseVault) {
    return resolveAddress(baseVault.token.address)
  }

  return resolveAddress(baseVault.asset?.address)
}

export function getYvUsdVaultApy(vault: TKongVaultView): number {
  return toFiniteNumber(vault.apr.forwardAPR.netAPR) ?? toFiniteNumber(vault.apr.netAPR) ?? 0
}

export function getYvUsdVaultTvl(vault: TKongVaultView): number {
  return vault.tvl.tvl ?? 0
}

export function getYvUsdTvlBreakdown({ totalTvl, lockedTvl }: { totalTvl: number; lockedTvl: number }): {
  totalTvl: number
  unlockedTvl: number
  lockedTvl: number
} {
  const resolvedTotalTvl = Number.isFinite(totalTvl) ? Math.max(totalTvl, 0) : 0
  const resolvedLockedTvl = Number.isFinite(lockedTvl) ? Math.max(lockedTvl, 0) : 0

  return {
    totalTvl: resolvedTotalTvl,
    unlockedTvl: Math.max(resolvedTotalTvl - resolvedLockedTvl, 0),
    lockedTvl: resolvedLockedTvl
  }
}

export function buildSyntheticBaseVault(snapshot?: TKongVaultSnapshot): TKongVaultListItem {
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

export function resolveYvUsdAssetAddress({
  baseVault,
  unlockedSnapshot
}: {
  baseVault: TKongVaultInput
  unlockedSnapshot?: TKongVaultSnapshot
}): `0x${string}` {
  return (
    resolveAddress(unlockedSnapshot?.meta?.token?.address) ||
    resolveAddress(unlockedSnapshot?.asset?.address) ||
    resolveBaseVaultAssetAddress(baseVault) ||
    FALLBACK_ASSET.address
  )
}

export function buildYvUsdVariantVault({
  baseVault,
  snapshot,
  address,
  name,
  fallbackToBase
}: {
  baseVault: TKongVaultInput
  snapshot?: TKongVaultSnapshot
  address: string
  name: string
  fallbackToBase: boolean
}): TKongVaultView {
  const normalizedAddress = toAddress(address)
  const baseVariant = getVaultView(baseVault, snapshot)
  const defaults = getVariantDefaults(baseVariant, fallbackToBase)

  const resolvedNetApy = resolveSnapshotNetApy(snapshot) ?? defaults.netApy
  const resolvedWeeklyApy = resolveSnapshotWeeklyApy(snapshot) ?? defaults.weeklyApy
  const resolvedMonthlyApy = resolveSnapshotMonthlyApy(snapshot) ?? defaults.monthlyApy
  const resolvedForwardApy = resolveSnapshotForwardApy(snapshot) ?? defaults.forwardApy
  const resolvedTvl = resolveSnapshotTvl(snapshot) ?? defaults.tvl
  const resolvedTotalAssets = snapshot?.totalAssets ? toBigInt(snapshot.totalAssets) : defaults.totalAssets
  const normalizedAssets = toNormalizedBN(resolvedTotalAssets, baseVariant.token.decimals).normalized
  const resolvedPrice = getVariantPrice(resolvedTvl, normalizedAssets, defaults.price)

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
        netAPR: resolvedForwardApy
      }
    },
    tvl: {
      ...baseVariant.tvl,
      totalAssets: resolvedTotalAssets,
      tvl: resolvedTvl,
      price: resolvedPrice
    }
  }
}

export function buildYvUsdListVault({
  baseVault,
  unlocked
}: {
  baseVault: TKongVaultInput
  unlocked: TKongVaultView
}): TKongVaultView {
  const baseView = getVaultView(baseVault)

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
      totalAssets: unlocked.tvl.totalAssets,
      tvl: unlocked.tvl.tvl,
      price: unlocked.tvl.price || baseView.tvl.price
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

export function buildYvUsdVaultsModel({
  baseVault,
  unlockedSnapshot,
  lockedSnapshot,
  points
}: {
  baseVault: TKongVaultInput
  unlockedSnapshot?: TKongVaultSnapshot
  lockedSnapshot?: TKongVaultSnapshot
  points?: Partial<TYvUsdPointsState>
}): {
  assetAddress: `0x${string}`
  unlockedVault: TKongVaultView
  lockedVault: TKongVaultView
  listVault: TKongVaultView
  metrics: {
    unlocked: TYvUsdMetrics
    locked: TYvUsdMetrics
  }
} {
  const unlockedVault = buildYvUsdVariantVault({
    baseVault,
    snapshot: unlockedSnapshot,
    address: YVUSD_UNLOCKED_ADDRESS,
    name: 'yvUSD',
    fallbackToBase: true
  })

  const lockedVault = buildYvUsdVariantVault({
    baseVault,
    snapshot: lockedSnapshot,
    address: YVUSD_LOCKED_ADDRESS,
    name: 'yvUSD (Locked)',
    fallbackToBase: false
  })

  const listVault = buildYvUsdListVault({
    baseVault,
    unlocked: unlockedVault
  })

  return {
    assetAddress: resolveYvUsdAssetAddress({ baseVault, unlockedSnapshot }),
    unlockedVault,
    lockedVault,
    listVault,
    metrics: {
      unlocked: {
        apy: getYvUsdVaultApy(unlockedVault),
        tvl: getYvUsdVaultTvl(unlockedVault),
        hasInfinifiPoints: points?.unlocked === true
      },
      locked: {
        apy: getYvUsdVaultApy(lockedVault),
        tvl: getYvUsdVaultTvl(lockedVault),
        hasInfinifiPoints: points?.locked === true
      }
    }
  }
}
