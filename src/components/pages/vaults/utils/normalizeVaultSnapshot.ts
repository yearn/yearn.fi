import { toAddress, toBigInt, toNormalizedBN } from '@shared/utils'
import type {
  TKongVaultSnapshot,
  TKongVaultSnapshotComposition,
  TKongVaultSnapshotDebt,
  TKongVaultSnapshotStakingReward
} from '@shared/utils/schemas/kongVaultSnapshotSchema'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { zeroAddress } from 'viem'
import { normalizeVaultCategory } from './normalizeVaultCategory'

const RISK_SCORE_KEYS = [
  'review',
  'testing',
  'complexity',
  'riskExposure',
  'protocolIntegration',
  'centralizationRisk',
  'externalProtocolAudit',
  'externalProtocolCentralisation',
  'externalProtocolTvl',
  'externalProtocolLongevity',
  'externalProtocolType'
] as const

const normalizeNumber = (value: number | string | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) {
    return fallback
  }
  const normalized = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(normalized)) {
    return fallback
  }
  return normalized
}

const pickNonZeroNumber = (...values: Array<number | string | null | undefined>): number => {
  let fallback: number | undefined
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const normalized = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(normalized)) {
      continue
    }
    if (fallback === undefined) {
      fallback = normalized
    }
    if (normalized > 0) {
      return normalized
    }
  }
  return fallback ?? 0
}

const pickNonZeroBigNumberish = (...values: Array<string | number | null | undefined>): string => {
  let fallback: string | undefined
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const asString = String(value)
    if (!fallback) {
      fallback = asString
    }
    try {
      if (toBigInt(value) > 0n) {
        return asString
      }
    } catch {}
  }
  return fallback ?? '0'
}

const toBigIntValue = (value: string | number | bigint | null | undefined): bigint => {
  try {
    return toBigInt(value ?? 0)
  } catch {
    return 0n
  }
}

const computeDebtRatioFromCurrentDebt = (
  currentDebt: string | number | bigint | null | undefined,
  totalDebt: string | number | bigint | null | undefined
): number => {
  const debt = toBigIntValue(currentDebt)
  const total = toBigIntValue(totalDebt)
  if (debt <= 0n || total <= 0n) {
    return 0
  }
  return Number((debt * 10000n) / total)
}

const computeDebtRatioFromTotalAssets = (
  totalDebt: string | number | bigint | null | undefined,
  totalAssets: string | number | bigint | null | undefined
): number => {
  const debt = toBigIntValue(totalDebt)
  const assets = toBigIntValue(totalAssets)
  if (debt <= 0n || assets <= 0n) {
    return 0
  }
  return Number((debt * 10000n) / assets)
}

const computeTotalDebtForRatios = (snapshot: TKongVaultSnapshot, base?: TYDaemonVault): string => {
  const snapshotTotalDebt = toBigIntValue(snapshot.totalDebt)
  if (snapshotTotalDebt > 0n) {
    return snapshotTotalDebt.toString()
  }

  const debts = snapshot.debts || []
  let summedDebt = 0n
  for (const debt of debts) {
    const debtAmount = pickNonZeroBigNumberish(debt.currentDebt, debt.totalDebt)
    const normalizedDebt = toBigIntValue(debtAmount)
    if (normalizedDebt > 0n) {
      summedDebt += normalizedDebt
    }
  }
  if (summedDebt > 0n) {
    return summedDebt.toString()
  }

  const snapshotAssets = toBigIntValue(snapshot.totalAssets)
  if (snapshotAssets > 0n) {
    return snapshotAssets.toString()
  }

  const baseAssets = toBigIntValue(base?.tvl.totalAssets)
  if (baseAssets > 0n) {
    return baseAssets.toString()
  }

  return '0'
}

const resolveTotalAssetsForRatios = (snapshot: TKongVaultSnapshot, base?: TYDaemonVault): bigint => {
  const snapshotAssets = toBigIntValue(snapshot.totalAssets)
  if (snapshotAssets > 0n) {
    return snapshotAssets
  }

  const baseAssets = toBigIntValue(base?.tvl.totalAssets)
  if (baseAssets > 0n) {
    return baseAssets
  }

  return 0n
}

const pickNumber = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return 0
}

const pickNumberOrNull = (...values: Array<number | string | null | undefined>): number | null => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }
    const normalized = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(normalized)) {
      continue
    }
    return normalized
  }
  return null
}

const normalizeFee = (value: number | null | undefined): number => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0
  }
  if (value > 1) {
    return value / 10000
  }
  return value
}

const resolveDecimals = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return 18
}

const normalizePricePerShare = (
  value: string | number | null | undefined,
  decimals: number,
  fallback?: number
): number => {
  if (value === null || value === undefined) {
    return fallback ?? 0
  }
  const normalized = toNormalizedBN(value, decimals).normalized
  if (normalized === 0 && typeof fallback === 'number' && fallback > 0) {
    return fallback
  }
  return normalized
}

type TSnapshotRiskScore = NonNullable<TKongVaultSnapshot['risk']>['riskScore']

const buildRiskScores = (riskScore: TSnapshotRiskScore | undefined, fallback?: number[]): number[] => {
  const scores = RISK_SCORE_KEYS.map((key) => normalizeNumber((riskScore as Record<string, number | null>)?.[key]))
  const hasSnapshotScores = scores.some((score) => score > 0)
  if (!hasSnapshotScores && fallback && fallback.length) {
    return fallback
  }
  return scores
}

const normalizeCompositionStatus = (
  status: TKongVaultSnapshotComposition['status'],
  hasAllocation: boolean
): TYDaemonVaultStrategy['status'] => {
  if (typeof status === 'string') {
    const normalized = status.toLowerCase().replace(/[\s-]+/g, '_')
    if (['active', 'enabled', 'live'].includes(normalized)) {
      return 'active'
    }
    if (['inactive', 'not_active', 'disabled', 'deprecated', 'retired', 'paused'].includes(normalized)) {
      return 'not_active'
    }
    if (['unallocated', 'idle', 'unfunded', 'no_debt'].includes(normalized)) {
      return 'unallocated'
    }
  }

  if (typeof status === 'number') {
    if (status === 1) {
      return 'active'
    }
    if (status <= 0) {
      return hasAllocation ? 'active' : 'unallocated'
    }
    return 'not_active'
  }

  return hasAllocation ? 'active' : 'unallocated'
}

const mapSnapshotComposition = (
  composition: TKongVaultSnapshotComposition[] | undefined,
  totalAssetsForRatios: bigint
): TYDaemonVaultStrategy[] => {
  if (!composition || composition.length === 0) {
    return []
  }

  const strategies: TYDaemonVaultStrategy[] = []
  composition.forEach((entry, index) => {
    const resolvedAddress = toAddress(entry.address ?? entry.strategy)
    if (resolvedAddress === zeroAddress) {
      return
    }
    const totalDebt = pickNonZeroBigNumberish(entry.totalDebt, entry.currentDebt, '0')
    const computedDebtRatio = computeDebtRatioFromTotalAssets(totalDebt, totalAssetsForRatios)
    const debtRatio = normalizeNumber(entry.debtRatio ?? computedDebtRatio, computedDebtRatio)
    const totalGain = entry.totalGain ?? '0'
    const totalLoss = entry.totalLoss ?? '0'
    const performanceFee = normalizeNumber(entry.performanceFee ?? 0)
    const lastReport = normalizeNumber(entry.lastReport ?? 0)
    const hasAllocation = toBigInt(totalDebt) > 0n || debtRatio > 0
    const status = normalizeCompositionStatus(entry.status, hasAllocation)
    const name = entry.name?.trim() || `Strategy ${index + 1}`
    const resolvedApr = pickNumberOrNull(
      entry.performance?.oracle?.apy,
      entry.performance?.historical?.net,
      entry.latestReportApr
    )
    strategies.push({
      address: resolvedAddress,
      name,
      description: '',
      netAPR: resolvedApr,
      status,
      details: {
        totalDebt,
        totalLoss,
        totalGain,
        performanceFee,
        lastReport,
        debtRatio
      }
    })
  })
  return strategies
}

const mapSnapshotDebts = (
  debts: TKongVaultSnapshotDebt[] = [],
  totalDebtForRatios?: string
): TYDaemonVaultStrategy[] => {
  return debts.map((debt, index) => {
    const debtAmount = pickNonZeroBigNumberish(debt.currentDebt, debt.totalDebt)
    const computedDebtRatio = computeDebtRatioFromCurrentDebt(debtAmount, totalDebtForRatios)
    const debtRatio = pickNonZeroNumber(debt.debtRatio, computedDebtRatio, 0)
    const totalDebt = pickNonZeroBigNumberish(debt.totalDebt, debt.currentDebt)
    const totalGain = debt.totalGain ?? '0'
    const totalLoss = debt.totalLoss ?? '0'
    const performanceFee = normalizeNumber(debt.performanceFee ?? 0)
    const lastReport = normalizeNumber(debt.lastReport ?? 0)
    const hasAllocation = toBigInt(totalDebt) > 0n || debtRatio > 0
    return {
      address: toAddress(debt.strategy),
      name: `Strategy ${index + 1}`,
      description: '',
      netAPR: null,
      status: hasAllocation ? 'active' : 'unallocated',
      details: {
        totalDebt,
        totalLoss,
        totalGain,
        performanceFee,
        lastReport,
        debtRatio
      }
    }
  })
}

const mergeStrategies = (
  baseStrategies: TYDaemonVault['strategies'] | null | undefined,
  debts: TKongVaultSnapshotDebt[] | undefined,
  totalDebtForRatios?: string
): TYDaemonVaultStrategy[] => {
  if (!debts || debts.length === 0) {
    return (baseStrategies || []) as TYDaemonVaultStrategy[]
  }

  const debtMap = new Map(debts.map((debt) => [toAddress(debt.strategy), debt]))
  if (baseStrategies && baseStrategies.length > 0) {
    return (baseStrategies || []).map((strategy) => {
      const debt = debtMap.get(toAddress(strategy.address))
      if (!debt) return strategy
      if (!strategy.details) {
        return strategy
      }
      const debtAmount = pickNonZeroBigNumberish(debt.currentDebt, debt.totalDebt)
      const computedDebtRatio = computeDebtRatioFromCurrentDebt(debtAmount, totalDebtForRatios)
      const debtRatio = pickNonZeroNumber(debt.debtRatio, computedDebtRatio, 0)
      const totalDebt = pickNonZeroBigNumberish(debt.totalDebt, debt.currentDebt, strategy.details?.totalDebt)
      const totalGain = debt.totalGain ?? strategy.details?.totalGain ?? '0'
      const totalLoss = debt.totalLoss ?? strategy.details?.totalLoss ?? '0'
      const performanceFee = normalizeNumber(debt.performanceFee ?? strategy.details?.performanceFee ?? 0)
      const lastReport = normalizeNumber(debt.lastReport ?? strategy.details?.lastReport ?? 0)
      const hasAllocation = toBigInt(totalDebt) > 0n || debtRatio > 0
      const status = hasAllocation ? 'active' : strategy.status === 'not_active' ? 'not_active' : 'unallocated'
      return {
        ...strategy,
        status,
        details: {
          ...strategy.details,
          totalDebt,
          totalGain,
          totalLoss,
          performanceFee,
          lastReport,
          debtRatio
        }
      }
    })
  }

  return mapSnapshotDebts(debts, totalDebtForRatios)
}

const mapSnapshotStakingRewards = (
  rewards: TKongVaultSnapshotStakingReward[] | undefined
): TYDaemonVault['staking']['rewards'] => {
  if (!rewards || rewards.length === 0) {
    return []
  }

  return rewards.map((reward) => ({
    address: toAddress(reward.address ?? zeroAddress),
    name: reward.name ?? '',
    symbol: reward.symbol ?? '',
    decimals: resolveDecimals(reward.decimals ?? null),
    price: normalizeNumber(reward.price ?? 0),
    isFinished: Boolean(reward.isFinished),
    finishedAt: normalizeNumber(reward.finishedAt ?? 0),
    apr: reward.apr === null || reward.apr === undefined || Number.isNaN(reward.apr) ? null : reward.apr,
    perWeek: normalizeNumber(reward.perWeek ?? 0)
  }))
}

const mapSnapshotStaking = (snapshot: TKongVaultSnapshot): TYDaemonVault['staking'] => {
  if (!snapshot.staking) {
    return {
      address: zeroAddress,
      available: false,
      source: '',
      rewards: []
    }
  }

  return {
    address: toAddress(snapshot.staking.address ?? zeroAddress),
    available: Boolean(snapshot.staking.available),
    source: snapshot.staking.source ?? '',
    rewards: mapSnapshotStakingRewards(snapshot.staking.rewards)
  }
}

const resolveStrategies = (
  snapshot: TKongVaultSnapshot,
  base: TYDaemonVault | undefined,
  totalDebtForRatios: string,
  totalAssetsForRatios: bigint
): TYDaemonVaultStrategy[] => {
  const compositionStrategies = mapSnapshotComposition(snapshot.composition, totalAssetsForRatios)
  if (compositionStrategies.length > 0) {
    return compositionStrategies
  }
  return mergeStrategies(base?.strategies, snapshot.debts, totalDebtForRatios)
}

const computePrice = (totalAssets: string, decimals: number, tvlUsd: number, fallback?: number): number => {
  const normalizedAssets = toNormalizedBN(totalAssets, decimals).normalized
  if (!Number.isFinite(tvlUsd) || tvlUsd <= 0 || normalizedAssets <= 0) {
    return fallback ?? 0
  }
  return tvlUsd / normalizedAssets
}

const buildSnapshotVault = (
  snapshot: TKongVaultSnapshot,
  base?: TYDaemonVault,
  totalDebtForRatios?: string,
  totalAssetsForRatios?: bigint
): TYDaemonVault => {
  const resolvedTotalDebtForRatios = totalDebtForRatios ?? computeTotalDebtForRatios(snapshot, base)
  const resolvedTotalAssetsForRatios = totalAssetsForRatios ?? resolveTotalAssetsForRatios(snapshot, base)
  const metaToken = snapshot.meta?.token
  const tokenFallback = base?.token
  const token = {
    address: toAddress(metaToken?.address ?? snapshot.asset?.address ?? tokenFallback?.address ?? zeroAddress),
    name: metaToken?.name ?? snapshot.asset?.name ?? tokenFallback?.name ?? '',
    symbol: metaToken?.symbol ?? snapshot.asset?.symbol ?? tokenFallback?.symbol ?? '',
    description: metaToken?.description ?? tokenFallback?.description ?? '',
    decimals: resolveDecimals(metaToken?.decimals, snapshot.asset?.decimals, tokenFallback?.decimals)
  }

  const vaultDecimals = resolveDecimals(snapshot.decimals, base?.decimals, token.decimals)
  const totalAssets = snapshot.totalAssets ?? base?.tvl.totalAssets?.toString() ?? '0'
  const tvlUsd = pickNumber(snapshot.tvl?.close, base?.tvl.tvl, 0)
  const price = computePrice(totalAssets, token.decimals, tvlUsd, base?.tvl.price)

  const historical = snapshot.performance?.historical
  const netApr = pickNumber(snapshot.apy?.net, historical?.net, base?.apr.netAPR, 0)
  const weekNet = pickNumber(snapshot.apy?.weeklyNet, historical?.weeklyNet, base?.apr.points?.weekAgo, 0)
  const monthNet = pickNumber(snapshot.apy?.monthlyNet, historical?.monthlyNet, base?.apr.points?.monthAgo, 0)
  const inceptionNet = pickNumber(snapshot.apy?.inceptionNet, historical?.inceptionNet, base?.apr.points?.inception, 0)
  const forwardNet = pickNumber(snapshot.performance?.oracle?.apr, base?.apr.forwardAPR.netAPR, 0)

  const forwardType =
    snapshot.performance?.oracle?.apr !== null && snapshot.performance?.oracle?.apr !== undefined
      ? 'oracle'
      : (base?.apr.forwardAPR.type ?? 'unknown')

  const feesPerformance = snapshot.fees ? normalizeFee(snapshot.fees.performanceFee) : (base?.apr.fees.performance ?? 0)
  const feesManagement = snapshot.fees ? normalizeFee(snapshot.fees.managementFee) : (base?.apr.fees.management ?? 0)

  const pricePerShareToday = normalizePricePerShare(
    snapshot.apy?.pricePerShare,
    token.decimals,
    base?.apr.pricePerShare.today
  )
  const pricePerShareWeekly = normalizePricePerShare(
    snapshot.apy?.weeklyPricePerShare,
    token.decimals,
    base?.apr.pricePerShare.weekAgo
  )
  const pricePerShareMonthly = normalizePricePerShare(
    snapshot.apy?.monthlyPricePerShare,
    token.decimals,
    base?.apr.pricePerShare.monthAgo
  )

  const riskScore = buildRiskScores(snapshot.risk?.riskScore, base?.info.riskScore)
  const riskLevel = Math.max(0, normalizeNumber(snapshot.risk?.riskLevel, base?.info.riskLevel ?? 0))
  const riskScoreComment = snapshot.risk?.riskScore?.comment || base?.info.riskScoreComment || ''
  const strategies = resolveStrategies(snapshot, base, resolvedTotalDebtForRatios, resolvedTotalAssetsForRatios)
  const staking = mapSnapshotStaking(snapshot)

  return yDaemonVaultSchema.parse({
    address: snapshot.address,
    version: snapshot.apiVersion ?? base?.version ?? '',
    type: snapshot.meta?.type ?? base?.type ?? 'Standard',
    kind: snapshot.meta?.kind ?? base?.kind ?? 'Legacy',
    symbol: snapshot.symbol || snapshot.meta?.displaySymbol || base?.symbol || '',
    name: snapshot.name || snapshot.meta?.name || snapshot.meta?.displayName || base?.name || '',
    description: snapshot.meta?.description ?? base?.description ?? '',
    category: normalizeVaultCategory(snapshot.meta?.category ?? base?.category ?? ''),
    decimals: vaultDecimals,
    chainID: snapshot.chainId,
    token,
    tvl: {
      totalAssets,
      tvl: tvlUsd,
      price
    },
    apr: {
      type: snapshot.apy?.label || base?.apr.type || 'unknown',
      netAPR: netApr,
      fees: {
        performance: feesPerformance,
        withdrawal: base?.apr.fees.withdrawal ?? 0,
        management: feesManagement
      },
      extra: base?.apr.extra ?? undefined,
      points: {
        weekAgo: weekNet,
        monthAgo: monthNet,
        inception: inceptionNet
      },
      pricePerShare: {
        today: pricePerShareToday,
        weekAgo: pricePerShareWeekly,
        monthAgo: pricePerShareMonthly
      },
      forwardAPR: {
        type: forwardType,
        netAPR: forwardNet,
        composite: base?.apr.forwardAPR.composite ?? undefined
      }
    },
    featuringScore: base?.featuringScore ?? 0,
    strategies,
    staking,
    migration: {
      available: snapshot.meta?.migration?.available ?? base?.migration.available ?? false,
      address: snapshot.meta?.migration?.target ?? base?.migration.address ?? zeroAddress,
      contract: snapshot.meta?.migration?.contract ?? base?.migration.contract ?? zeroAddress
    },
    info: {
      sourceURL: snapshot.meta?.sourceURI ?? base?.info.sourceURL ?? '',
      riskLevel,
      riskScore,
      riskScoreComment,
      uiNotice: snapshot.meta?.uiNotice ?? base?.info.uiNotice ?? '',
      isRetired: snapshot.meta?.isRetired ?? base?.info.isRetired ?? false,
      isBoosted: snapshot.meta?.isBoosted ?? base?.info.isBoosted ?? false,
      isHighlighted: snapshot.meta?.isHighlighted ?? base?.info.isHighlighted ?? false,
      isHidden: snapshot.meta?.isHidden ?? base?.info.isHidden ?? false
    }
  })
}

export const mergeVaultSnapshot = (
  base: TYDaemonVault | undefined,
  snapshot: TKongVaultSnapshot | undefined
): TYDaemonVault | undefined => {
  if (!snapshot && base) return base
  if (!snapshot) return undefined

  if (!base) {
    return buildSnapshotVault(snapshot)
  }

  if (base.chainID !== snapshot.chainId) {
    return buildSnapshotVault(snapshot)
  }

  const totalDebtForRatios = computeTotalDebtForRatios(snapshot, base)
  const totalAssetsForRatios = resolveTotalAssetsForRatios(snapshot, base)
  const merged = buildSnapshotVault(snapshot, base, totalDebtForRatios, totalAssetsForRatios)
  return {
    ...base,
    ...merged,
    token: {
      ...merged.token,
      ...base.token
    },
    strategies: merged.strategies,
    staking: merged.staking,
    info: {
      ...base.info,
      ...merged.info,
      riskScore: merged.info.riskScore.length ? merged.info.riskScore : base.info.riskScore
    },
    migration: {
      ...base.migration,
      ...merged.migration
    },
    tvl: {
      ...merged.tvl,
      price: merged.tvl.price || base.tvl.price
    }
  }
}
