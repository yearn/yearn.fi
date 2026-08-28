import { getVaultView, type TKongVaultInput, type TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { useYearn } from '@shared/contexts/useYearn'
import { toAddress, toBigInt, toNormalizedBN } from '@shared/utils'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { useMemo } from 'react'
import { YVBTC_CHAIN_ID, YVBTC_DESCRIPTION, YVBTC_LOCKED_ADDRESS, YVBTC_UNLOCKED_ADDRESS } from '../utils/yvBtc'
import { useVaultSnapshot } from './useVaultSnapshot'
import { getYvUsdVaultApy, getYvUsdVaultTvl, type TYvUsdMetrics } from './useYvUsdVaults.helpers'

type TYvBtcVaults = {
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

const FALLBACK_ASSET = {
  address: toAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'),
  name: 'Wrapped BTC',
  symbol: 'WBTC',
  decimals: 8
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

function resolveSnapshotForwardApy(snapshot?: TKongVaultSnapshot): number | undefined {
  return (
    toFiniteNumber(snapshot?.performance?.estimated?.apy) ??
    toFiniteNumber(snapshot?.performance?.estimated?.apr) ??
    toFiniteNumber(snapshot?.apy?.net) ??
    toFiniteNumber(snapshot?.performance?.historical?.net)
  )
}

function resolveSnapshotNetApy(snapshot?: TKongVaultSnapshot): number | undefined {
  return toFiniteNumber(snapshot?.apy?.net) ?? toFiniteNumber(snapshot?.performance?.historical?.net)
}

function resolveSnapshotWeeklyApy(snapshot?: TKongVaultSnapshot): number | undefined {
  return toFiniteNumber(snapshot?.apy?.weeklyNet) ?? toFiniteNumber(snapshot?.performance?.historical?.weeklyNet)
}

function resolveSnapshotMonthlyApy(snapshot?: TKongVaultSnapshot): number | undefined {
  return toFiniteNumber(snapshot?.apy?.monthlyNet) ?? toFiniteNumber(snapshot?.performance?.historical?.monthlyNet)
}

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
    chainId: YVBTC_CHAIN_ID,
    address: YVBTC_UNLOCKED_ADDRESS,
    name: 'yvBTC',
    symbol: 'yvBTC',
    apiVersion: snapshot?.apiVersion ?? '3.0.0',
    decimals: snapshot?.decimals ?? 18,
    asset: resolvedAsset,
    tvl: toFiniteNumber(snapshot?.tvl?.close) ?? null,
    performance: null,
    fees: {
      managementFee: toFiniteNumber(snapshot?.fees?.managementFee) ?? 0,
      performanceFee: toFiniteNumber(snapshot?.fees?.performanceFee) ?? 0
    },
    category: 'Volatile',
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
    origin: 'synthetic-yvbtc',
    strategiesCount: snapshot?.composition?.length ?? snapshot?.debts?.length ?? 0,
    riskLevel: toFiniteNumber(snapshot?.risk?.riskLevel) ?? null,
    staking: null
  }
}

function resolveAssetAddress(baseVault: TKongVaultInput, unlockedSnapshot?: TKongVaultSnapshot): `0x${string}` {
  if ('token' in baseVault) {
    return (
      resolveAddress(unlockedSnapshot?.meta?.token?.address) ||
      resolveAddress(unlockedSnapshot?.asset?.address) ||
      resolveAddress(baseVault.token.address) ||
      FALLBACK_ASSET.address
    )
  }

  return (
    resolveAddress(unlockedSnapshot?.meta?.token?.address) ||
    resolveAddress(unlockedSnapshot?.asset?.address) ||
    resolveAddress(baseVault.asset?.address) ||
    FALLBACK_ASSET.address
  )
}

function buildYvBtcVariantVault({
  baseVault,
  snapshot,
  address,
  name,
  fallbackToBase
}: {
  baseVault: TKongVaultInput
  snapshot?: TKongVaultSnapshot
  address: `0x${string}`
  name: string
  fallbackToBase: boolean
}): TKongVaultView {
  const baseVariant = getVaultView(baseVault, snapshot)
  const defaultTvl = fallbackToBase ? baseVariant.tvl.tvl : 0
  const defaultTotalAssets = fallbackToBase ? baseVariant.tvl.totalAssets : 0n
  const defaultPrice = fallbackToBase ? baseVariant.tvl.price : 0
  const resolvedTvl = toFiniteNumber(snapshot?.tvl?.close) ?? defaultTvl
  const resolvedTotalAssets = snapshot?.totalAssets ? toBigInt(snapshot.totalAssets) : defaultTotalAssets
  const normalizedAssets = toNormalizedBN(resolvedTotalAssets, baseVariant.token.decimals).normalized
  const resolvedPrice = resolvedTvl > 0 && normalizedAssets > 0 ? resolvedTvl / normalizedAssets : defaultPrice

  return {
    ...baseVariant,
    address,
    chainID: YVBTC_CHAIN_ID,
    name,
    symbol: 'yvBTC',
    description: YVBTC_DESCRIPTION,
    category: 'Volatile',
    apr: {
      ...baseVariant.apr,
      netAPR: resolveSnapshotNetApy(snapshot) ?? (fallbackToBase ? baseVariant.apr.netAPR : 0),
      points: {
        ...baseVariant.apr.points,
        weekAgo: resolveSnapshotWeeklyApy(snapshot) ?? (fallbackToBase ? baseVariant.apr.points.weekAgo : 0),
        monthAgo: resolveSnapshotMonthlyApy(snapshot) ?? (fallbackToBase ? baseVariant.apr.points.monthAgo : 0)
      },
      forwardAPR: {
        ...baseVariant.apr.forwardAPR,
        netAPR: resolveSnapshotForwardApy(snapshot) ?? (fallbackToBase ? baseVariant.apr.forwardAPR.netAPR : 0)
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

function buildYvBtcListVault({
  baseVault,
  unlocked
}: {
  baseVault: TKongVaultInput
  unlocked: TKongVaultView
}): TKongVaultView {
  const baseView = getVaultView(baseVault)

  return {
    ...baseView,
    address: YVBTC_UNLOCKED_ADDRESS,
    chainID: YVBTC_CHAIN_ID,
    name: 'yvBTC',
    symbol: 'yvBTC',
    description: YVBTC_DESCRIPTION,
    category: 'Volatile',
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
      uiNotice: YVBTC_DESCRIPTION
    },
    strategies: unlocked.strategies ?? baseView.strategies,
    featuringScore: Math.max(baseView.featuringScore ?? 0, 9_998)
  }
}

export function useYvBtcVaults(): TYvBtcVaults {
  const { vaults, isLoadingVaultList } = useYearn()
  const { data: unlockedSnapshot, isLoading: isLoadingUnlocked } = useVaultSnapshot({
    chainId: YVBTC_CHAIN_ID,
    address: YVBTC_UNLOCKED_ADDRESS
  })

  const baseVault = useMemo<TKongVaultInput>(() => {
    return vaults[YVBTC_UNLOCKED_ADDRESS] ?? buildSyntheticBaseVault(unlockedSnapshot)
  }, [unlockedSnapshot, vaults])

  const baseVaultView = useMemo((): TKongVaultView => getVaultView(baseVault), [baseVault])

  const model = useMemo(() => {
    const unlockedVault = buildYvBtcVariantVault({
      baseVault,
      snapshot: unlockedSnapshot,
      address: YVBTC_UNLOCKED_ADDRESS,
      name: 'yvBTC',
      fallbackToBase: true
    })
    const lockedVault = buildYvBtcVariantVault({
      baseVault,
      address: YVBTC_LOCKED_ADDRESS,
      name: 'yvBTC (Locked)',
      fallbackToBase: false
    })
    const listVault = buildYvBtcListVault({ baseVault, unlocked: unlockedVault })

    return {
      assetAddress: resolveAssetAddress(baseVault, unlockedSnapshot),
      unlockedVault,
      lockedVault,
      listVault,
      metrics: {
        unlocked: {
          apy: getYvUsdVaultApy(unlockedVault),
          tvl: getYvUsdVaultTvl(unlockedVault),
          hasInfinifiPoints: false
        },
        locked: {
          apy: getYvUsdVaultApy(lockedVault),
          tvl: getYvUsdVaultTvl(lockedVault),
          hasInfinifiPoints: false
        }
      }
    }
  }, [baseVault, unlockedSnapshot])

  return {
    assetAddress: model.assetAddress,
    baseVault: baseVaultView,
    listVault: model.listVault,
    unlockedVault: model.unlockedVault,
    lockedVault: model.lockedVault,
    metrics: model.metrics,
    isLoading: isLoadingVaultList || isLoadingUnlocked
  }
}
